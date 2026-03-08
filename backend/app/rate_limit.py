from __future__ import annotations

from fastapi import Request
from slowapi import Limiter

from app.config import settings


def get_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for", "")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    if request.client is not None:
        return request.client.host
    return "unknown"


limiter = Limiter(key_func=get_client_ip, headers_enabled=False)


def demo_limit(limit_value: str, *, error_message: str):
    return limiter.limit(
        limit_value,
        error_message=error_message,
        exempt_when=lambda: not settings.PUBLIC_DEMO_MODE,
    )
