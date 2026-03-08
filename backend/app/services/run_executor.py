from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import UTC, datetime

from sqlalchemy import select

from app.config import settings
from app.database import async_session
from app.models import TestRun, TestSuite
from app.services.alerts import AlertService
from app.services.demo_guardrails import (
    disallowed_model_message,
    is_demo_model_allowed,
    normalize_gemini_error_message,
)
from app.services.runs import RunService
from app.services.suite_validation import SUPPORTED_WEB_ASSERTIONS
from driftwatch.core.llm import infer_provider_name
from driftwatch.core.pricing import load_model_pricing
from driftwatch.core.suite_loader import TestSpec, load_suite_content, validate_suite
from driftwatch.eval.engine import EvaluationEngine, TestRunResult

logger = logging.getLogger("driftwatch.executor")

EXECUTION_ERROR_TYPE = "execution_error"
RUN_EVALUATION_CONCURRENCY = 5


async def execute_run(run_id: str | uuid.UUID) -> dict:
    run_uuid = uuid.UUID(str(run_id))

    async with async_session() as db:
        run = (await db.execute(select(TestRun).where(TestRun.id == run_uuid))).scalar_one_or_none()

        if run is None:
            logger.error("Run %s not found", run_uuid)
            return {"status": "not_found"}

        if run.status == "completed":
            logger.info("Run %s already completed - skipping", run_uuid)
            return {"status": "already_completed"}

        run.status = "running"
        run.started_at = run.started_at or datetime.now(UTC)
        await db.flush()

        suite = (await db.execute(select(TestSuite).where(TestSuite.id == run.suite_id))).scalar_one_or_none()

        if suite is None:
            run.status = "failed"
            run.completed_at = datetime.now(UTC)
            await db.commit()
            return {"status": "suite_not_found"}

        try:
            results = await _evaluate_suite(suite)
        except Exception:
            logger.exception("Evaluation failed for run %s", run_uuid)
            run.status = "failed"
            run.completed_at = datetime.now(UTC)
            await db.commit()
            return {"status": "evaluation_failed"}

        svc = RunService(db)
        await svc.save_results(run.id, results)
        await svc.compute_drift(suite.id)

        alert_svc = AlertService(db)
        refreshed = await svc.get_run(run.id)
        if refreshed:
            await alert_svc.check_and_alert(refreshed)

        await db.commit()
        logger.info("Run %s completed - %d tests", run_uuid, len(results))
        return {"status": "completed", "tests": len(results)}


async def _evaluate_suite(suite: TestSuite) -> list[dict]:
    if not suite.yaml_content or not suite.yaml_content.strip():
        raise ValueError(f"Suite {suite.id} has no YAML content")

    spec = load_suite_content(suite.yaml_content, source=f"suite {suite.id}", suite_name=suite.name)
    errors = validate_suite(spec)
    if errors:
        raise ValueError("; ".join(errors))

    pricing = load_model_pricing(settings.LLM_MODEL_PRICING_JSON)
    engine = EvaluationEngine(concurrency=RUN_EVALUATION_CONCURRENCY, pricing=pricing)
    overrides = _provider_overrides()
    semaphore = asyncio.Semaphore(RUN_EVALUATION_CONCURRENCY)

    async def _run_test(test: TestSpec) -> dict:
        async with semaphore:
            model = test.model or spec.model_default
            unsupported = sorted({a.type for a in test.assertions if a.type not in SUPPORTED_WEB_ASSERTIONS})
            if unsupported:
                return _execution_error_payload(
                    test,
                    model,
                    f"Unsupported web assertions: {', '.join(unsupported)}",
                )

            if not is_demo_model_allowed(model):
                return _execution_error_payload(test, model, disallowed_model_message(model))

            provider_name = infer_provider_name(model)
            if not overrides.get(provider_name, {}).get("api_key"):
                return _execution_error_payload(
                    test,
                    model,
                    f"Missing {provider_name} API key for model '{model}'",
                )

            if any(a.type == "cost" for a in test.assertions) and model not in pricing:
                return _execution_error_payload(
                    test,
                    model,
                    f"No pricing configured for model '{model}'",
                )

            try:
                provider = engine.get_provider_for_model(model, overrides)
                result = await engine.run_test(test, provider)
            except Exception as exc:
                logger.warning("Test '%s' failed during execution: %s", test.name, exc)
                return _execution_error_payload(
                    test,
                    model,
                    normalize_gemini_error_message(model, str(exc)),
                )

            return _test_result_payload(result, test)

    return await asyncio.gather(*[_run_test(test) for test in spec.tests])


def _provider_overrides() -> dict[str, dict[str, str]]:
    overrides: dict[str, dict[str, str]] = {}
    if settings.OPENAI_API_KEY:
        overrides["openai"] = {"api_key": settings.OPENAI_API_KEY}
    if settings.ANTHROPIC_API_KEY:
        overrides["anthropic"] = {"api_key": settings.ANTHROPIC_API_KEY}
    if settings.GEMINI_API_KEY:
        overrides["gemini"] = {
            "api_key": settings.GEMINI_API_KEY,
            "base_url": settings.GEMINI_BASE_URL,
            "rpm": settings.GEMINI_RPM,
        }
    return overrides


def _test_result_payload(result: TestRunResult, test: TestSpec) -> dict:
    return {
        "test_name": result.test_name,
        "prompt": result.prompt,
        "model": result.model,
        "output": result.output,
        "passed": result.passed,
        "latency_ms": result.latency_ms,
        "token_count": result.token_count,
        "cost": result.cost,
        "assertions": [
            {
                "assertion_type": assertion_spec.type,
                "passed": assertion_result.passed,
                "expected": assertion_result.expected,
                "actual": assertion_result.actual,
                "score": assertion_result.score,
                "message": assertion_result.message,
            }
            for assertion_spec, assertion_result in zip(
                test.assertions,
                result.assertion_results,
            )
        ],
    }


def _execution_error_payload(test: TestSpec, model: str, message: str) -> dict:
    return {
        "test_name": test.name,
        "prompt": test.prompt,
        "model": model,
        "output": None,
        "passed": False,
        "latency_ms": None,
        "token_count": None,
        "cost": None,
        "assertions": [
            {
                "assertion_type": EXECUTION_ERROR_TYPE,
                "passed": False,
                "expected": None,
                "actual": None,
                "score": None,
                "message": message,
            }
        ],
    }
