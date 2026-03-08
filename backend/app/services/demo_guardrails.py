from __future__ import annotations

import json
import logging
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import TestRun
from driftwatch.core.llm import DEFAULT_LLM_MODEL

logger = logging.getLogger("driftwatch.demo")


def get_demo_allowed_models() -> tuple[str, ...]:
    fallback = (DEFAULT_LLM_MODEL,)
    raw = settings.DEMO_ALLOWED_MODELS_JSON.strip()
    if not raw:
        return fallback

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("Invalid DEMO_ALLOWED_MODELS_JSON, falling back to %s", fallback)
        return fallback

    if not isinstance(data, list):
        logger.warning("DEMO_ALLOWED_MODELS_JSON must be a JSON array, falling back to %s", fallback)
        return fallback

    models = tuple(sorted({str(item).strip() for item in data if str(item).strip()}))
    return models or fallback


def describe_demo_allowed_models() -> str:
    return ", ".join(get_demo_allowed_models())


def is_demo_model_allowed(model: str) -> bool:
    if not settings.PUBLIC_DEMO_MODE:
        return True
    return model in get_demo_allowed_models()


def disallowed_model_message(model: str) -> str:
    return (
        f"Model '{model}' is not available in the public demo. "
        f"Allowed models: {describe_demo_allowed_models()}."
    )


def too_many_tests_message(count: int) -> str:
    return (
        f"The public demo supports up to {settings.DEMO_MAX_TESTS_PER_SUITE} tests per suite. "
        f"Received {count}."
    )


def build_run_metadata(user_id: uuid.UUID) -> dict[str, str]:
    return {
        "created_by_user_id": str(user_id),
        "created_at": datetime.now(UTC).isoformat(),
    }


async def count_recent_demo_runs_for_user(
    db: AsyncSession,
    org_id: uuid.UUID,
    user_id: uuid.UUID,
) -> int:
    cutoff = datetime.now(UTC) - timedelta(days=1)
    rows = (
        await db.execute(
            select(TestRun).where(
                TestRun.org_id == org_id,
                TestRun.trigger == "manual",
            )
        )
    ).scalars().all()

    count = 0
    for run in rows:
        metadata = run.metadata_ or {}
        if metadata.get("created_by_user_id") != str(user_id):
            continue

        created_at = _parse_timestamp_candidates(
            metadata.get("created_at"),
            run.started_at,
            run.completed_at,
        )
        if created_at is not None and created_at >= cutoff:
            count += 1

    return count


def _parse_timestamp_candidates(*values: object) -> datetime | None:
    for value in values:
        if isinstance(value, datetime):
            return value if value.tzinfo else value.replace(tzinfo=UTC)
        if isinstance(value, str) and value:
            try:
                parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
                return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)
            except ValueError:
                continue
    return None


def normalize_gemini_error_message(model: str, message: str) -> str:
    if not model.lower().startswith("gemini"):
        return message

    lowered = message.lower()
    gemini_quota_markers = (
        "quota",
        "rate limit",
        "resource exhausted",
        "too many requests",
        "429",
    )
    if any(marker in lowered for marker in gemini_quota_markers):
        return "Gemini demo quota is temporarily exhausted. Try again later."
    return message
