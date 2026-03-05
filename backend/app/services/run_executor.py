from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime

from sqlalchemy import select

from app.database import async_session
from app.models import TestRun, TestSuite
from app.services.alerts import AlertService
from app.services.runs import RunService

logger = logging.getLogger("driftwatch.executor")


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
            results = _evaluate_suite(suite)
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


def _evaluate_suite(suite) -> list[dict]:
    """
    Placeholder evaluation engine.

    In production this would parse the suite YAML, iterate test cases,
    call LLM providers, run assertions, and return structured results.
    """
    import yaml

    tests: list[dict] = []
    if not suite.yaml_content:
        return tests

    try:
        spec = yaml.safe_load(suite.yaml_content)
    except Exception:
        logger.warning("Failed to parse YAML for suite %s", suite.id)
        return tests

    if not isinstance(spec, dict):
        return tests

    for tc in spec.get("tests", []):
        tests.append(
            {
                "test_name": tc.get("name", "unnamed"),
                "prompt": tc.get("prompt", ""),
                "model": tc.get("model", "gpt-4"),
                "output": "[placeholder output]",
                "passed": True,
                "latency_ms": 0.0,
                "token_count": 0,
                "cost": 0.0,
                "assertions": [
                    {
                        "assertion_type": a.get("type", "contains"),
                        "passed": True,
                        "expected": a.get("expected"),
                        "actual": None,
                        "score": 1.0,
                        "message": "Placeholder assertion",
                    }
                    for a in tc.get("assertions", [])
                ],
            }
        )

    return tests
