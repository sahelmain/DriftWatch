from __future__ import annotations

import uuid
from contextlib import asynccontextmanager

import pytest
from app.config import settings
from app.database import get_db
from app.main import app
from app.models import TestSuite as SuiteModel
from app.services.run_executor import execute_run
from httpx import AsyncClient

from driftwatch.core.providers import LLMProvider, ProviderResponse

pytestmark = pytest.mark.asyncio

VALID_SUITE_YAML = """
tests:
  - name: t1
    prompt: hello
    model: gpt-4o
    assertions:
      - type: contains
        value: ["hello"]
"""


class FakeProvider(LLMProvider):
    def __init__(self, name: str, calls: list[tuple[str, str]]) -> None:
        self.name = name
        self.calls = calls

    async def complete(self, prompt: str, model: str, **kwargs) -> ProviderResponse:
        self.calls.append((self.name, prompt))
        if "explode" in prompt:
            raise RuntimeError("provider exploded")
        return ProviderResponse(
            text=prompt,
            model=model,
            latency_ms=12.5,
            token_count=10,
            input_tokens=4,
            output_tokens=6,
        )


@pytest.fixture
def fake_provider_factory(monkeypatch: pytest.MonkeyPatch) -> list[tuple[str, str]]:
    calls: list[tuple[str, str]] = []

    def _factory(name: str, **kwargs) -> FakeProvider:
        return FakeProvider(name, calls)

    monkeypatch.setattr("driftwatch.eval.engine.get_provider", _factory)
    return calls


@pytest.fixture(autouse=True)
def isolate_executor_dependencies(monkeypatch: pytest.MonkeyPatch) -> None:
    @asynccontextmanager
    async def _test_async_session():
        override = app.dependency_overrides[get_db]
        generator = override()
        session = await generator.__anext__()
        try:
            yield session
        finally:
            try:
                await generator.__anext__()
            except StopAsyncIteration:
                pass

    monkeypatch.setattr("app.services.run_executor.async_session", _test_async_session)
    monkeypatch.setattr("app.services.runs.RunService.dispatch_run", lambda self, run_id: None)
    monkeypatch.setattr(settings, "ENABLE_INLINE_RUNS", False)


async def _create_suite(auth_client: AsyncClient, yaml_content: str) -> str:
    res = await auth_client.post(
        "/api/suites",
        json={
            "name": "Executor Suite",
            "yaml_content": yaml_content,
        },
    )
    assert res.status_code == 201
    return res.json()["id"]


async def _set_suite_yaml(suite_id: str, yaml_content: str) -> None:
    override = app.dependency_overrides[get_db]
    generator = override()
    session = await generator.__anext__()
    try:
        suite = await session.get(SuiteModel, uuid.UUID(suite_id))
        assert suite is not None
        suite.yaml_content = yaml_content
        await session.flush()
    finally:
        try:
            await generator.__anext__()
        except StopAsyncIteration:
            pass


async def _create_run(auth_client: AsyncClient, suite_id: str) -> str:
    res = await auth_client.post(f"/api/suites/{suite_id}/run")
    assert res.status_code == 201
    assert res.json()["status"] == "pending"
    return res.json()["id"]


def _configure_provider_settings(monkeypatch: pytest.MonkeyPatch, *, pricing_json: str = "{}") -> None:
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "openai-test-key")
    monkeypatch.setattr(settings, "ANTHROPIC_API_KEY", "anthropic-test-key")
    monkeypatch.setattr(settings, "LLM_MODEL_PRICING_JSON", pricing_json)


class TestExecuteRun:
    async def test_execute_run_persists_real_results(
        self,
        auth_client: AsyncClient,
        monkeypatch: pytest.MonkeyPatch,
        fake_provider_factory: list[tuple[str, str]],
    ) -> None:
        _configure_provider_settings(
            monkeypatch,
            pricing_json=(
                '{"gpt-4o":{"input_per_million_tokens":1.0,"output_per_million_tokens":2.0},'
                '"claude-3-haiku-20240307":{"input_per_million_tokens":1.5,"output_per_million_tokens":2.5}}'
            ),
        )
        suite_id = await _create_suite(
            auth_client,
            """
name: live-suite
tests:
  - name: openai
    prompt: hello from openai
    model: gpt-4o
    assertions:
      - type: contains
        value: ["hello"]
      - type: cost
        budget: 1
  - name: anthropic
    prompt: hello from anthropic
    model: claude-3-haiku-20240307
    assertions:
      - type: contains
        value: ["anthropic"]
""",
        )
        run_id = await _create_run(auth_client, suite_id)

        result = await execute_run(run_id)
        assert result["status"] == "completed"

        run_detail = await auth_client.get(f"/api/runs/{run_id}")
        assert run_detail.status_code == 200
        body = run_detail.json()
        assert body["status"] == "passed"
        assert len(body["results"]) == 2
        assert all(item["tokens_used"] == 10 for item in body["results"])
        assert body["results"][0]["cost"] is not None
        assert ("openai", "hello from openai") in fake_provider_factory
        assert ("anthropic", "hello from anthropic") in fake_provider_factory

    async def test_unsupported_assertions_fail_per_test_without_provider_call(
        self,
        auth_client: AsyncClient,
        monkeypatch: pytest.MonkeyPatch,
        fake_provider_factory: list[tuple[str, str]],
    ) -> None:
        _configure_provider_settings(monkeypatch)
        suite_id = await _create_suite(auth_client, VALID_SUITE_YAML)
        await _set_suite_yaml(
            suite_id,
            """
name: unsupported-suite
tests:
  - name: unsupported
    prompt: hello
    model: gpt-4o
    assertions:
      - type: semantic_similarity
        reference: hi
        threshold: 0.9
""",
        )
        run_id = await _create_run(auth_client, suite_id)

        await execute_run(run_id)

        run_detail = await auth_client.get(f"/api/runs/{run_id}")
        body = run_detail.json()
        assert body["status"] == "failed"
        assert fake_provider_factory == []
        assert body["results"][0]["assertions"][0]["type"] == "execution_error"
        assert "Unsupported web assertions" in body["results"][0]["assertions"][0]["message"]

    async def test_missing_provider_key_only_fails_affected_test(
        self,
        auth_client: AsyncClient,
        monkeypatch: pytest.MonkeyPatch,
        fake_provider_factory: list[tuple[str, str]],
    ) -> None:
        monkeypatch.setattr(settings, "OPENAI_API_KEY", "openai-test-key")
        monkeypatch.setattr(settings, "ANTHROPIC_API_KEY", "")
        monkeypatch.setattr(settings, "LLM_MODEL_PRICING_JSON", "{}")
        suite_id = await _create_suite(
            auth_client,
            """
name: mixed-suite
tests:
  - name: openai
    prompt: openai prompt
    model: gpt-4o
    assertions:
      - type: contains
        value: ["openai"]
  - name: anthropic
    prompt: anthropic prompt
    model: claude-3-haiku-20240307
    assertions:
      - type: contains
        value: ["anthropic"]
""",
        )
        run_id = await _create_run(auth_client, suite_id)

        await execute_run(run_id)

        run_detail = await auth_client.get(f"/api/runs/{run_id}")
        body = run_detail.json()
        assert body["status"] == "failed"
        assert ("openai", "openai prompt") in fake_provider_factory
        assert ("anthropic", "anthropic prompt") not in fake_provider_factory
        assert body["results"][1]["assertions"][0]["type"] == "execution_error"
        assert "Missing anthropic API key" in body["results"][1]["assertions"][0]["message"]

    async def test_provider_exception_does_not_abort_remaining_tests(
        self,
        auth_client: AsyncClient,
        monkeypatch: pytest.MonkeyPatch,
        fake_provider_factory: list[tuple[str, str]],
    ) -> None:
        _configure_provider_settings(monkeypatch)
        suite_id = await _create_suite(
            auth_client,
            """
name: resilient-suite
tests:
  - name: boom
    prompt: explode now
    model: gpt-4o
    assertions:
      - type: contains
        value: ["explode"]
  - name: safe
    prompt: still running
    model: gpt-4o
    assertions:
      - type: contains
        value: ["still"]
""",
        )
        run_id = await _create_run(auth_client, suite_id)

        await execute_run(run_id)

        run_detail = await auth_client.get(f"/api/runs/{run_id}")
        body = run_detail.json()
        assert body["status"] == "failed"
        assert len(body["results"]) == 2
        assert body["results"][0]["assertions"][0]["type"] == "execution_error"
        assert body["results"][1]["passed"] is True

    async def test_malformed_yaml_fails_run_without_partial_results(
        self,
        auth_client: AsyncClient,
        monkeypatch: pytest.MonkeyPatch,
        fake_provider_factory: list[tuple[str, str]],
    ) -> None:
        _configure_provider_settings(monkeypatch)
        suite_id = await _create_suite(auth_client, VALID_SUITE_YAML)
        await _set_suite_yaml(suite_id, "tests: [")
        run_id = await _create_run(auth_client, suite_id)

        result = await execute_run(run_id)
        assert result["status"] == "evaluation_failed"
        assert fake_provider_factory == []

        run_detail = await auth_client.get(f"/api/runs/{run_id}")
        body = run_detail.json()
        assert body["status"] == "error"
        assert body["results"] == []

    async def test_missing_pricing_fails_cost_assertion_with_execution_error(
        self,
        auth_client: AsyncClient,
        monkeypatch: pytest.MonkeyPatch,
        fake_provider_factory: list[tuple[str, str]],
    ) -> None:
        _configure_provider_settings(monkeypatch, pricing_json="{}")
        suite_id = await _create_suite(
            auth_client,
            """
name: cost-suite
tests:
  - name: cost-check
    prompt: hello
    model: gpt-4o
    assertions:
      - type: cost
        budget: 1
""",
        )
        run_id = await _create_run(auth_client, suite_id)

        await execute_run(run_id)

        run_detail = await auth_client.get(f"/api/runs/{run_id}")
        body = run_detail.json()
        assert body["status"] == "failed"
        assert ("openai", "hello") not in fake_provider_factory
        assert "No pricing configured" in body["results"][0]["assertions"][0]["message"]


class TestInlineDispatch:
    async def test_inline_mode_returns_pending_and_schedules_background_task(
        self,
        auth_client: AsyncClient,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        scheduled: list[str] = []

        async def _fake_execute_run(run_id: str) -> None:
            scheduled.append(run_id)

        monkeypatch.setattr(settings, "ENABLE_INLINE_RUNS", True)
        monkeypatch.setattr("app.api.routes.execute_run_inline", _fake_execute_run)

        suite_id = await _create_suite(
            auth_client,
            """
name: inline-suite
tests:
  - name: t1
    prompt: hello
    model: gpt-4o
    assertions:
      - type: contains
        value: ["hello"]
""",
        )

        res = await auth_client.post(f"/api/suites/{suite_id}/run")
        assert res.status_code == 201
        body = res.json()
        assert body["status"] == "pending"
        assert scheduled == [body["id"]]
