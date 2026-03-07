"""
Render cron job entry point.

Runs once per invocation, checks for suites with active cron schedules,
and dispatches any that are due. Designed as a run-and-exit script for
platforms that manage scheduling externally (Render Cron Jobs, etc).
"""

from __future__ import annotations

import asyncio
import logging

from sqlalchemy import select

from app.config import settings
from app.database import async_session, create_tables
from app.models import TestSuite
from app.sentry_setup import init_sentry
from app.services.run_executor import execute_run as execute_run_inline
from app.services.runs import RunService

init_sentry()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
logger = logging.getLogger("driftwatch.cron")


async def main() -> None:
    import app.models  # noqa: F401

    if settings.AUTO_CREATE_SCHEMA:
        await create_tables()
        logger.info("Schema auto-create enabled for cron")
    else:
        logger.info("Schema auto-create disabled for cron")

    async with async_session() as db:
        result = await db.execute(
            select(TestSuite).where(
                TestSuite.is_active.is_(True),
                TestSuite.schedule_cron.isnot(None),
            )
        )
        suites = result.scalars().all()

        if not suites:
            logger.info("No scheduled suites found")
            return

        svc = RunService(db)
        created_run_ids: list[str] = []
        for suite in suites:
            try:
                run = await svc.create_run(
                    suite.id,
                    suite.org_id,
                    trigger="scheduled",
                )
                created_run_ids.append(str(run.id))
                logger.info("Created scheduled run %s for suite %s", run.id, suite.id)
            except Exception:
                logger.exception("Failed to create run for suite %s", suite.id)

        await db.commit()
        for run_id in created_run_ids:
            try:
                if settings.ENABLE_INLINE_RUNS:
                    await execute_run_inline(run_id)
                    logger.info("Executed scheduled run %s inline", run_id)
                else:
                    svc.dispatch_run(run_id)
                    logger.info("Dispatched scheduled run %s via Celery", run_id)
            except Exception:
                logger.exception("Failed to start execution for run %s", run_id)

        logger.info("Cron tick complete — processed %d suites", len(created_run_ids))


if __name__ == "__main__":
    asyncio.run(main())
