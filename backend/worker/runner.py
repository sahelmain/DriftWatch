from __future__ import annotations

import asyncio

from app.config import settings
from app.sentry_setup import init_sentry
from app.services.run_executor import execute_run as execute_run_async
from celery import Celery

init_sentry()

celery_app = Celery(
    "driftwatch",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    worker_concurrency=4,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
)


def _run_async(coro):
    """Run an async coroutine in a fresh event loop (Celery workers are sync)."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(
    bind=True,
    max_retries=3,
    default_retry_delay=10,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=120,
    acks_late=True,
    name="worker.execute_run",
)
def execute_run(self, run_id: str) -> dict:
    return _run_async(execute_run_async(run_id))
