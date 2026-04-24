"""API route contract tests — verifies response shapes match frontend expectations."""

from __future__ import annotations

import uuid
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta

import pytest
from app.config import settings
from app.database import get_db
from app.main import app
from app.models import AlertEvent as AlertEventModel
from app.models import TestRun as TestRunModel
from app.models import TestSuite as TestSuiteModel
from httpx import AsyncClient

from driftwatch.core.llm import DEFAULT_LLM_MODEL

pytestmark = pytest.mark.asyncio
TestRunModel.__test__ = False
TestSuiteModel.__test__ = False

VALID_SUITE_YAML = """
tests:
  - name: t1
    prompt: hello
    assertions:
      - type: contains
        value: ["hello"]
"""


async def _register_headers(client: AsyncClient, email: str, org_name: str) -> dict[str, str]:
    res = await client.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": "testpass123",
            "org_name": org_name,
        },
    )
    assert res.status_code == 201
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


@asynccontextmanager
async def override_session():
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


class TestAuth:
    async def test_register_returns_token_and_user(self, client: AsyncClient):
        res = await client.post(
            "/api/auth/register",
            json={
                "email": "new@test.io",
                "password": "pass1234",
                "org_name": "My Org",
            },
        )
        assert res.status_code == 201
        body = res.json()
        assert "access_token" in body
        assert body["token_type"] == "bearer"
        assert body["user"]["email"] == "new@test.io"
        assert body["user"]["role"] == "admin"

    async def test_login_returns_token_and_user(self, auth_client: AsyncClient):
        res = await auth_client.post(
            "/api/auth/login",
            json={
                "email": "admin@test.io",
                "password": "testpass123",
            },
        )
        assert res.status_code == 200
        body = res.json()
        assert "access_token" in body
        assert body["user"]["email"] == "admin@test.io"

    async def test_login_invalid_creds(self, client: AsyncClient):
        res = await client.post(
            "/api/auth/login",
            json={
                "email": "nobody@test.io",
                "password": "wrong",
            },
        )
        assert res.status_code == 401


class TestSuites:
    async def test_list_suites_returns_paginated(self, auth_client: AsyncClient):
        res = await auth_client.get("/api/suites")
        assert res.status_code == 200
        body = res.json()
        assert "items" in body
        assert "total" in body
        assert "page" in body
        assert "pages" in body
        assert isinstance(body["items"], list)

    async def test_create_and_get_suite(self, auth_client: AsyncClient):
        create_res = await auth_client.post(
            "/api/suites",
            json={
                "name": "Test Suite",
                "description": "A test suite",
                "yaml_content": VALID_SUITE_YAML,
            },
        )
        assert create_res.status_code == 201
        suite = create_res.json()
        assert suite["name"] == "Test Suite"
        suite_id = suite["id"]

        get_res = await auth_client.get(f"/api/suites/{suite_id}")
        assert get_res.status_code == 200
        assert get_res.json()["name"] == "Test Suite"

    async def test_update_suite(self, auth_client: AsyncClient):
        create_res = await auth_client.post(
            "/api/suites",
            json={"name": "Old Name", "yaml_content": VALID_SUITE_YAML},
        )
        suite_id = create_res.json()["id"]

        update_res = await auth_client.put(
            f"/api/suites/{suite_id}",
            json={"name": "New Name", "yaml_content": VALID_SUITE_YAML},
        )
        assert update_res.status_code == 200
        assert update_res.json()["name"] == "New Name"

    async def test_delete_suite(self, auth_client: AsyncClient):
        create_res = await auth_client.post(
            "/api/suites",
            json={"name": "To Delete", "yaml_content": VALID_SUITE_YAML},
        )
        suite_id = create_res.json()["id"]

        del_res = await auth_client.delete(f"/api/suites/{suite_id}")
        assert del_res.status_code == 204

    async def test_validate_suite_returns_summary(self, auth_client: AsyncClient):
        res = await auth_client.post(
            "/api/suites/validate",
            json={
                "name": "Validated Suite",
                "yaml_content": VALID_SUITE_YAML,
                "schedule_cron": "0 * * * *",
            },
        )
        assert res.status_code == 200
        body = res.json()
        assert body["valid"] is True
        assert body["errors"] == []
        assert body["suite_summary"]["test_count"] == 1
        assert body["suite_summary"]["test_names"] == ["t1"]

    async def test_validate_suite_rejects_malformed_yaml(self, auth_client: AsyncClient):
        res = await auth_client.post(
            "/api/suites/validate",
            json={"name": "Bad Suite", "yaml_content": "tests: ["},
        )
        assert res.status_code == 200
        body = res.json()
        assert body["valid"] is False
        assert body["errors"][0]["field"] == "yaml_content"
        assert body["errors"][0]["code"] == "invalid_yaml"

    async def test_validate_suite_rejects_unsupported_assertions(self, auth_client: AsyncClient):
        res = await auth_client.post(
            "/api/suites/validate",
            json={
                "name": "Unsupported Suite",
                "yaml_content": """
tests:
  - name: semantic
    prompt: hello
    assertions:
      - type: semantic_similarity
        reference: hi
        threshold: 0.9
""",
            },
        )
        assert res.status_code == 200
        body = res.json()
        assert body["valid"] is False
        assert body["errors"][0]["field"] == "assertions"
        assert body["errors"][0]["test_name"] == "semantic"

    async def test_validate_suite_rejects_invalid_cron(self, auth_client: AsyncClient):
        res = await auth_client.post(
            "/api/suites/validate",
            json={
                "name": "Bad Cron Suite",
                "yaml_content": VALID_SUITE_YAML,
                "schedule_cron": "not-a-cron",
            },
        )
        assert res.status_code == 200
        body = res.json()
        assert body["valid"] is False
        assert body["errors"][0]["field"] == "schedule_cron"

    async def test_validate_suite_rejects_disallowed_models_in_demo_mode(
        self,
        auth_client: AsyncClient,
        monkeypatch: pytest.MonkeyPatch,
    ):
        monkeypatch.setattr(settings, "PUBLIC_DEMO_MODE", True)
        monkeypatch.setattr(settings, "DEMO_ALLOWED_MODELS_JSON", f'["{DEFAULT_LLM_MODEL}"]')

        res = await auth_client.post(
            "/api/suites/validate",
            json={
                "name": "Bad Model",
                "yaml_content": """
tests:
  - name: t1
    prompt: hello
    model: gpt-4o
    assertions:
      - type: contains
        value: ["hello"]
""",
            },
        )
        assert res.status_code == 200
        body = res.json()
        assert body["valid"] is False
        assert body["errors"][0]["code"] == "disallowed_model"

    async def test_validate_suite_rejects_too_many_tests_in_demo_mode(
        self,
        auth_client: AsyncClient,
        monkeypatch: pytest.MonkeyPatch,
    ):
        monkeypatch.setattr(settings, "PUBLIC_DEMO_MODE", True)
        monkeypatch.setattr(settings, "DEMO_MAX_TESTS_PER_SUITE", 3)
        monkeypatch.setattr(settings, "DEMO_ALLOWED_MODELS_JSON", f'["{DEFAULT_LLM_MODEL}"]')

        res = await auth_client.post(
            "/api/suites/validate",
            json={
                "name": "Too Many",
                "yaml_content": f"""
tests:
  - name: t1
    prompt: hello 1
    model: {DEFAULT_LLM_MODEL}
    assertions:
      - type: contains
        value: ["hello"]
  - name: t2
    prompt: hello 2
    model: {DEFAULT_LLM_MODEL}
    assertions:
      - type: contains
        value: ["hello"]
  - name: t3
    prompt: hello 3
    model: {DEFAULT_LLM_MODEL}
    assertions:
      - type: contains
        value: ["hello"]
  - name: t4
    prompt: hello 4
    model: {DEFAULT_LLM_MODEL}
    assertions:
      - type: contains
        value: ["hello"]
""",
            },
        )
        assert res.status_code == 200
        body = res.json()
        assert body["valid"] is False
        assert body["errors"][0]["code"] == "too_many_tests"

    async def test_create_suite_rejects_invalid_yaml_with_structured_errors(self, auth_client: AsyncClient):
        res = await auth_client.post(
            "/api/suites",
            json={"name": "Broken", "yaml_content": "tests: ["},
        )
        assert res.status_code == 400
        body = res.json()
        assert body["valid"] is False
        assert body["errors"][0]["field"] == "yaml_content"

    async def test_update_suite_rejects_unsupported_assertions(self, auth_client: AsyncClient):
        create_res = await auth_client.post(
            "/api/suites",
            json={"name": "Good", "yaml_content": VALID_SUITE_YAML},
        )
        suite_id = create_res.json()["id"]

        update_res = await auth_client.put(
            f"/api/suites/{suite_id}",
            json={
                "yaml_content": """
tests:
  - name: custom
    prompt: hello
    assertions:
      - type: custom
        expression: output.startswith("hello")
""",
            },
        )
        assert update_res.status_code == 400
        body = update_res.json()
        assert body["valid"] is False
        assert body["errors"][0]["field"] == "assertions"


class TestRuns:
    async def test_list_runs_returns_paginated(self, auth_client: AsyncClient):
        res = await auth_client.get("/api/runs")
        assert res.status_code == 200
        body = res.json()
        assert "items" in body
        assert "total" in body
        assert body["total"] == 0

    async def test_trigger_run(self, auth_client: AsyncClient):
        suite_res = await auth_client.post(
            "/api/suites",
            json={"name": "Run Suite", "yaml_content": VALID_SUITE_YAML},
        )
        suite_id = suite_res.json()["id"]

        run_res = await auth_client.post(f"/api/suites/{suite_id}/run")
        assert run_res.status_code == 201
        run = run_res.json()
        assert run["suite_id"] == suite_id
        assert run["status"] == "pending"
        assert run["trigger"] == "manual"

    async def test_trigger_run_rejects_daily_demo_cap(
        self,
        auth_client: AsyncClient,
        monkeypatch: pytest.MonkeyPatch,
    ):
        monkeypatch.setattr(settings, "PUBLIC_DEMO_MODE", True)
        monkeypatch.setattr(settings, "DEMO_MAX_RUNS_PER_USER_PER_DAY", 2)
        monkeypatch.setattr(settings, "ENABLE_INLINE_RUNS", False)
        monkeypatch.setattr("app.services.runs.RunService.dispatch_run", lambda self, run_id: None)

        suite_res = await auth_client.post(
            "/api/suites",
            json={"name": "Demo Cap Suite", "yaml_content": VALID_SUITE_YAML},
        )
        suite_id = suite_res.json()["id"]

        first = await auth_client.post(f"/api/suites/{suite_id}/run")
        second = await auth_client.post(f"/api/suites/{suite_id}/run")
        third = await auth_client.post(f"/api/suites/{suite_id}/run")

        assert first.status_code == 201
        assert second.status_code == 201
        assert third.status_code == 429
        assert third.json()["detail"] == "Daily demo run limit reached. Try again tomorrow."

    async def test_register_rate_limit_applies_in_demo_mode(
        self,
        client: AsyncClient,
        monkeypatch: pytest.MonkeyPatch,
    ):
        monkeypatch.setattr(settings, "PUBLIC_DEMO_MODE", True)
        ip_headers = {"X-Forwarded-For": "198.51.100.10"}

        for index in range(5):
            res = await client.post(
                "/api/auth/register",
                json={
                    "email": f"demo-rate-{index}@test.io",
                    "password": "pass1234",
                    "org_name": f"Rate Org {index}",
                },
                headers=ip_headers,
            )
            assert res.status_code == 201

        limited = await client.post(
            "/api/auth/register",
            json={
                "email": "demo-rate-limit@test.io",
                "password": "pass1234",
                "org_name": "Rate Org Limit",
            },
            headers=ip_headers,
        )
        assert limited.status_code == 429

    async def test_trigger_run_dispatches_via_service_when_inline_disabled(
        self,
        auth_client: AsyncClient,
        monkeypatch: pytest.MonkeyPatch,
    ):
        dispatched: list[str] = []

        def _fake_dispatch(self, run_id):
            dispatched.append(str(run_id))

        monkeypatch.setattr(settings, "ENABLE_INLINE_RUNS", False)
        monkeypatch.setattr("app.services.runs.RunService.dispatch_run", _fake_dispatch)

        suite_res = await auth_client.post(
            "/api/suites",
            json={"name": "Dispatch Suite", "yaml_content": VALID_SUITE_YAML},
        )
        suite_id = suite_res.json()["id"]

        run_res = await auth_client.post(f"/api/suites/{suite_id}/run")
        assert run_res.status_code == 201
        run_id = run_res.json()["id"]
        assert dispatched == [run_id]

    async def test_get_run(self, auth_client: AsyncClient):
        suite_res = await auth_client.post(
            "/api/suites",
            json={"name": "Run Suite 2", "yaml_content": VALID_SUITE_YAML},
        )
        suite_id = suite_res.json()["id"]

        run_res = await auth_client.post(f"/api/suites/{suite_id}/run")
        run_id = run_res.json()["id"]

        get_res = await auth_client.get(f"/api/runs/{run_id}")
        assert get_res.status_code == 200
        assert get_res.json()["id"] == run_id

    async def test_list_runs_with_filters(self, auth_client: AsyncClient):
        res = await auth_client.get("/api/runs?status=pending&page=1&limit=10")
        assert res.status_code == 200
        body = res.json()
        assert body["page"] == 1

    async def test_list_runs_filters_client_statuses_server_side(self, auth_client: AsyncClient):
        suite_res = await auth_client.post(
            "/api/suites",
            json={"name": "Filter Suite", "yaml_content": VALID_SUITE_YAML},
        )
        suite_id = suite_res.json()["id"]

        pending_res = await auth_client.post(f"/api/suites/{suite_id}/run")
        pending_id = pending_res.json()["id"]
        now = datetime.now(UTC)

        async with override_session() as session:
            suite = await session.get(TestSuiteModel, uuid.UUID(suite_id))
            assert suite is not None
            session.add_all(
                [
                    TestRunModel(
                        suite_id=suite.id,
                        org_id=suite.org_id,
                        status="completed",
                        trigger="manual",
                        started_at=now - timedelta(minutes=3),
                        completed_at=now - timedelta(minutes=2),
                        total_tests=2,
                        passed_tests=2,
                        pass_rate=100.0,
                    ),
                    TestRunModel(
                        suite_id=suite.id,
                        org_id=suite.org_id,
                        status="completed",
                        trigger="manual",
                        started_at=now - timedelta(minutes=2),
                        completed_at=now - timedelta(minutes=1),
                        total_tests=2,
                        passed_tests=1,
                        pass_rate=50.0,
                    ),
                    TestRunModel(
                        suite_id=suite.id,
                        org_id=suite.org_id,
                        status="failed",
                        trigger="manual",
                    ),
                ]
            )
            await session.flush()

        pending = await auth_client.get("/api/runs?status=pending&page=1&limit=10")
        assert pending.status_code == 200
        assert pending.json()["total"] == 1
        assert pending.json()["items"][0]["id"] == pending_id

        passed = await auth_client.get("/api/runs?status=passed&page=1&limit=10")
        assert passed.status_code == 200
        assert passed.json()["total"] == 1
        assert passed.json()["items"][0]["status"] == "passed"

        failed = await auth_client.get("/api/runs?status=failed&page=1&limit=10")
        assert failed.status_code == 200
        assert failed.json()["total"] == 1
        assert failed.json()["items"][0]["status"] == "failed"

        errored = await auth_client.get("/api/runs?status=error&page=1&limit=10")
        assert errored.status_code == 200
        assert errored.json()["total"] == 1
        assert errored.json()["items"][0]["status"] == "error"

    async def test_drift_timeline_returns_more_than_one_thousand_runs(self, auth_client: AsyncClient):
        suite_res = await auth_client.post(
            "/api/suites",
            json={"name": "Timeline Suite", "yaml_content": VALID_SUITE_YAML},
        )
        suite_id = suite_res.json()["id"]
        base_time = datetime.now(UTC) - timedelta(minutes=1005)

        async with override_session() as session:
            suite = await session.get(TestSuiteModel, uuid.UUID(suite_id))
            assert suite is not None
            session.add_all(
                [
                    TestRunModel(
                        suite_id=suite.id,
                        org_id=suite.org_id,
                        status="completed",
                        trigger="manual",
                        started_at=base_time + timedelta(minutes=index),
                        completed_at=base_time + timedelta(minutes=index, seconds=30),
                        total_tests=1,
                        passed_tests=1 if index % 2 == 0 else 0,
                        pass_rate=100.0 if index % 2 == 0 else 0.0,
                    )
                    for index in range(1005)
                ]
            )
            await session.flush()

        res = await auth_client.get(f"/api/drift/{suite_id}")
        assert res.status_code == 200
        body = res.json()
        assert len(body) == 1005
        assert body[0]["run_id"]
        assert body[-1]["run_id"]


class TestAlerts:
    async def test_list_alerts_empty(self, auth_client: AsyncClient):
        res = await auth_client.get("/api/alerts")
        assert res.status_code == 200
        assert res.json() == []

    async def test_create_alert(self, auth_client: AsyncClient):
        res = await auth_client.post(
            "/api/alerts",
            json={
                "channel": "slack",
                "destination": "https://hooks.slack.com/test",
                "threshold_metric": "pass_rate",
                "threshold_value": 0.8,
                "enabled": True,
            },
        )
        assert res.status_code == 201
        alert = res.json()
        assert alert["channel"] == "slack"
        assert alert["threshold_metric"] == "pass_rate"
        assert alert["threshold_value"] == 0.8

    async def test_update_alert(self, auth_client: AsyncClient):
        create_res = await auth_client.post(
            "/api/alerts",
            json={
                "channel": "email",
                "destination": "team@test.io",
                "threshold_metric": "pass_rate",
                "threshold_value": 0.9,
            },
        )
        alert_id = create_res.json()["id"]

        update_res = await auth_client.put(
            f"/api/alerts/{alert_id}",
            json={
                "threshold_value": 0.7,
            },
        )
        assert update_res.status_code == 200
        assert update_res.json()["threshold_value"] == 0.7

    async def test_delete_alert(self, auth_client: AsyncClient):
        create_res = await auth_client.post(
            "/api/alerts",
            json={
                "channel": "slack",
                "destination": "https://hooks.slack.com/del",
                "threshold_metric": "pass_rate",
                "threshold_value": 0.5,
            },
        )
        alert_id = create_res.json()["id"]

        del_res = await auth_client.delete(f"/api/alerts/{alert_id}")
        assert del_res.status_code == 204


class TestPolicies:
    async def test_list_policies_empty(self, auth_client: AsyncClient):
        res = await auth_client.get("/api/policies")
        assert res.status_code == 200
        assert res.json() == []

    async def test_create_policy(self, auth_client: AsyncClient):
        res = await auth_client.post(
            "/api/policies",
            json={
                "name": "Block Low Pass Rate",
                "metric": "pass_rate",
                "operator": "lt",
                "threshold": 0.8,
                "action": "block",
            },
        )
        assert res.status_code == 201
        assert res.json()["name"] == "Block Low Pass Rate"

    async def test_delete_policy(self, auth_client: AsyncClient):
        create_res = await auth_client.post(
            "/api/policies",
            json={
                "name": "To Delete",
                "metric": "pass_rate",
                "operator": "lt",
                "threshold": 0.5,
            },
        )
        policy_id = create_res.json()["id"]

        del_res = await auth_client.delete(f"/api/policies/{policy_id}")
        assert del_res.status_code == 204


class TestTenantIsolation:
    async def test_suite_run_and_ci_access_are_scoped_to_user_org(
        self,
        client: AsyncClient,
        monkeypatch: pytest.MonkeyPatch,
    ):
        monkeypatch.setattr(settings, "ENABLE_INLINE_RUNS", False)
        monkeypatch.setattr("app.services.runs.RunService.dispatch_run", lambda self, run_id: None)

        org_a = await _register_headers(client, "tenant-a@test.io", "Tenant A")
        org_b = await _register_headers(client, "tenant-b@test.io", "Tenant B")

        suite_res = await client.post(
            "/api/suites",
            headers=org_a,
            json={"name": "Tenant A Suite", "yaml_content": VALID_SUITE_YAML},
        )
        assert suite_res.status_code == 201
        suite_id = suite_res.json()["id"]

        assert (await client.get(f"/api/suites/{suite_id}", headers=org_b)).status_code == 404
        assert (
            await client.put(
                f"/api/suites/{suite_id}",
                headers=org_b,
                json={"name": "Tenant B Rename"},
            )
        ).status_code == 404
        assert (await client.delete(f"/api/suites/{suite_id}", headers=org_b)).status_code == 404
        assert (await client.post(f"/api/suites/{suite_id}/run", headers=org_b)).status_code == 404

        run_res = await client.post(f"/api/suites/{suite_id}/run", headers=org_a)
        assert run_res.status_code == 201
        run_id = run_res.json()["id"]
        assert (await client.get(f"/api/runs/{run_id}", headers=org_b)).status_code == 404

        async with override_session() as session:
            run = await session.get(TestRunModel, uuid.UUID(run_id))
            assert run is not None
            run.status = "completed"
            run.started_at = datetime.now(UTC) - timedelta(seconds=1)
            run.completed_at = datetime.now(UTC)
            run.pass_rate = 100.0
            run.total_tests = 1
            run.passed_tests = 1

        ci_res = await client.post(
            "/api/ci/check",
            headers=org_b,
            json={"suite_id": suite_id, "commit_sha": "abc123"},
        )
        assert ci_res.status_code == 200
        ci_body = ci_res.json()
        assert ci_body["passed"] is False
        assert ci_body["run_id"] is None
        assert ci_body["message"] == "No completed runs found"

    async def test_alert_policy_dataset_and_event_access_are_scoped_to_user_org(
        self,
        client: AsyncClient,
        monkeypatch: pytest.MonkeyPatch,
    ):
        monkeypatch.setattr(settings, "ENABLE_INLINE_RUNS", False)
        monkeypatch.setattr("app.services.runs.RunService.dispatch_run", lambda self, run_id: None)

        org_a = await _register_headers(client, "alerts-a@test.io", "Alerts A")
        org_b = await _register_headers(client, "alerts-b@test.io", "Alerts B")

        suite_res = await client.post(
            "/api/suites",
            headers=org_a,
            json={"name": "Alert Suite", "yaml_content": VALID_SUITE_YAML},
        )
        suite_id = suite_res.json()["id"]
        run_res = await client.post(f"/api/suites/{suite_id}/run", headers=org_a)
        run_id = run_res.json()["id"]

        alert_res = await client.post(
            "/api/alerts",
            headers=org_a,
            json={
                "channel": "slack",
                "destination": "https://hooks.slack.com/tenant",
                "threshold_metric": "pass_rate",
                "threshold_value": 90,
            },
        )
        assert alert_res.status_code == 201
        alert_id = alert_res.json()["id"]

        policy_res = await client.post(
            "/api/policies",
            headers=org_a,
            json={
                "name": "Tenant Policy",
                "metric": "pass_rate",
                "operator": "lt",
                "threshold": 90,
                "action": "block",
            },
        )
        assert policy_res.status_code == 201
        policy_id = policy_res.json()["id"]

        dataset_res = await client.post(
            "/api/datasets",
            headers=org_a,
            json={"name": "Tenant Dataset", "content": [{"prompt": "hello"}], "row_count": 1},
        )
        assert dataset_res.status_code == 201
        dataset_id = dataset_res.json()["id"]

        assert (
            await client.put(
                f"/api/alerts/{alert_id}",
                headers=org_b,
                json={"threshold_value": 50},
            )
        ).status_code == 404
        assert (await client.delete(f"/api/alerts/{alert_id}", headers=org_b)).status_code == 404
        assert (
            await client.put(
                f"/api/policies/{policy_id}",
                headers=org_b,
                json={"threshold": 50},
            )
        ).status_code == 404
        assert (await client.delete(f"/api/policies/{policy_id}", headers=org_b)).status_code == 404
        assert (await client.get(f"/api/datasets/{dataset_id}", headers=org_b)).status_code == 404

        async with override_session() as session:
            session.add(
                AlertEventModel(
                    alert_config_id=uuid.UUID(alert_id),
                    run_id=uuid.UUID(run_id),
                    channel="slack",
                    message="tenant alert",
                    status="sent",
                )
            )

        org_a_events = await client.get("/api/alert-events", headers=org_a)
        org_b_events = await client.get("/api/alert-events", headers=org_b)
        assert org_a_events.status_code == 200
        assert org_b_events.status_code == 200
        assert len(org_a_events.json()) == 1
        assert org_b_events.json() == []


class TestSettings:
    async def test_get_settings_returns_composite(self, auth_client: AsyncClient):
        res = await auth_client.get("/api/settings")
        assert res.status_code == 200
        body = res.json()
        assert "org" in body
        assert body["org"]["name"] == "Test Org"
        assert "members" in body
        assert len(body["members"]) >= 1
        assert "api_keys" in body
        assert "usage" in body
        assert "runs_this_month" in body["usage"]
        assert "suites_count" in body["usage"]
        assert "plan_limit" in body["usage"]

    async def test_create_api_key(self, auth_client: AsyncClient):
        res = await auth_client.post(
            "/api/settings/api-keys",
            json={
                "name": "CI Key",
            },
        )
        assert res.status_code == 201
        body = res.json()
        assert "raw_key" in body
        assert body["name"] == "CI Key"

    async def test_add_member(self, auth_client: AsyncClient):
        res = await auth_client.post(
            "/api/settings/members",
            json={
                "email": "member@test.io",
                "password": "pass1234",
                "role": "member",
            },
        )
        assert res.status_code == 201
        assert res.json()["email"] == "member@test.io"


class TestAuditLog:
    async def test_audit_log_returns_paginated(self, auth_client: AsyncClient):
        res = await auth_client.get("/api/audit-log")
        assert res.status_code == 200
        body = res.json()
        assert "items" in body
        assert "total" in body
        assert "pages" in body


class TestSmokeE2E:
    """Full workflow: register -> create suite -> trigger run -> verify run list."""

    async def test_full_flow(self, client: AsyncClient):
        reg = await client.post(
            "/api/auth/register",
            json={
                "email": "e2e@test.io",
                "password": "e2epass123",
                "org_name": "E2E Org",
            },
        )
        assert reg.status_code == 201
        token = reg.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        suite = await client.post(
            "/api/suites",
            json={
                "name": "E2E Suite",
                "yaml_content": VALID_SUITE_YAML,
            },
            headers=headers,
        )
        assert suite.status_code == 201
        suite_id = suite.json()["id"]

        run = await client.post(f"/api/suites/{suite_id}/run", headers=headers)
        assert run.status_code == 201
        run_id = run.json()["id"]
        assert run.json()["status"] == "pending"

        runs_list = await client.get("/api/runs", headers=headers)
        assert runs_list.status_code == 200
        items = runs_list.json()["items"]
        assert any(r["id"] == run_id for r in items)

        run_detail = await client.get(f"/api/runs/{run_id}", headers=headers)
        assert run_detail.status_code == 200
        assert run_detail.json()["suite_id"] == suite_id

        settings = await client.get("/api/settings", headers=headers)
        assert settings.status_code == 200
        assert settings.json()["org"]["name"] == "E2E Org"
