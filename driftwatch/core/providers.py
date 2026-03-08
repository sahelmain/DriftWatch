"""LLM provider abstraction with retry, rate-limiting, and failover."""

from __future__ import annotations

import asyncio
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

from driftwatch.core.llm import infer_provider_name


@dataclass
class ProviderResponse:
    """Standardised response from any LLM provider."""

    text: str
    model: str
    latency_ms: float
    token_count: int
    input_tokens: int = 0
    output_tokens: int = 0
    cost: float | None = None
    raw_response: dict[str, Any] = field(default_factory=dict)


class LLMProvider(ABC):
    """Abstract base for LLM providers."""

    @abstractmethod
    async def complete(self, prompt: str, model: str, **kwargs: Any) -> ProviderResponse:
        """Send *prompt* to *model* and return a ``ProviderResponse``."""


class _RateLimiter:
    """Simple token-bucket rate limiter (requests per minute)."""

    def __init__(self, rpm: int) -> None:
        self._interval = 60.0 / rpm if rpm > 0 else 0.0
        self._last: float = 0.0
        self._lock = asyncio.Lock()

    async def acquire(self) -> None:
        if self._interval <= 0:
            return
        async with self._lock:
            now = time.monotonic()
            wait = self._interval - (now - self._last)
            if wait > 0:
                await asyncio.sleep(wait)
            self._last = time.monotonic()


async def _retry_with_backoff(
    coro_factory: Any,
    retries: int = 3,
    base_delay: float = 1.0,
) -> Any:
    """Call *coro_factory* up to *retries* times with exponential back-off."""
    last_exc: BaseException | None = None
    for attempt in range(retries):
        try:
            return await coro_factory()
        except Exception as exc:
            last_exc = exc
            if attempt < retries - 1:
                await asyncio.sleep(base_delay * (2**attempt))
    raise last_exc  # type: ignore[misc]


class OpenAIProvider(LLMProvider):
    """Provider backed by the OpenAI (or compatible) API."""

    def __init__(
        self,
        api_key: str | None = None,
        base_url: str | None = None,
        rpm: int = 60,
    ) -> None:
        try:
            from openai import AsyncOpenAI
        except ImportError as exc:
            raise ImportError("Install the 'openai' package to use OpenAIProvider.") from exc

        kwargs: dict[str, Any] = {}
        if api_key:
            kwargs["api_key"] = api_key
        if base_url:
            kwargs["base_url"] = base_url
        self._client = AsyncOpenAI(**kwargs)
        self._limiter = _RateLimiter(rpm)

    async def complete(self, prompt: str, model: str, **kwargs: Any) -> ProviderResponse:
        await self._limiter.acquire()

        async def _call() -> ProviderResponse:
            start = time.perf_counter()
            response = await self._client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                **kwargs,
            )
            latency = (time.perf_counter() - start) * 1000
            choice = response.choices[0]
            text = choice.message.content or ""
            usage = response.usage
            input_tokens = (usage.prompt_tokens if usage else 0) or 0
            output_tokens = (usage.completion_tokens if usage else 0) or 0
            tokens = (usage.total_tokens if usage else 0) or (input_tokens + output_tokens)
            return ProviderResponse(
                text=text,
                model=response.model,
                latency_ms=round(latency, 2),
                token_count=tokens,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                raw_response=response.model_dump(),
            )

        return await _retry_with_backoff(_call)


class AnthropicProvider(LLMProvider):
    """Provider backed by the Anthropic API."""

    def __init__(
        self,
        api_key: str | None = None,
        rpm: int = 60,
    ) -> None:
        try:
            from anthropic import AsyncAnthropic
        except ImportError as exc:
            raise ImportError("Install the 'anthropic' package to use AnthropicProvider.") from exc

        kwargs: dict[str, Any] = {}
        if api_key:
            kwargs["api_key"] = api_key
        self._client = AsyncAnthropic(**kwargs)
        self._limiter = _RateLimiter(rpm)

    async def complete(self, prompt: str, model: str, **kwargs: Any) -> ProviderResponse:
        await self._limiter.acquire()

        async def _call() -> ProviderResponse:
            start = time.perf_counter()
            response = await self._client.messages.create(
                model=model,
                max_tokens=kwargs.pop("max_tokens", 4096),
                messages=[{"role": "user", "content": prompt}],
                **kwargs,
            )
            latency = (time.perf_counter() - start) * 1000
            text = response.content[0].text if response.content else ""
            input_tokens = (response.usage.input_tokens if response.usage else 0) or 0
            output_tokens = (response.usage.output_tokens if response.usage else 0) or 0
            tokens = input_tokens + output_tokens
            return ProviderResponse(
                text=text,
                model=response.model,
                latency_ms=round(latency, 2),
                token_count=tokens,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                raw_response=response.model_dump(),
            )

        return await _retry_with_backoff(_call)


class GeminiProvider(OpenAIProvider):
    """Provider backed by Google's OpenAI-compatible Gemini API."""

    def __init__(
        self,
        api_key: str | None = None,
        base_url: str = "https://generativelanguage.googleapis.com/v1beta/openai/",
        rpm: int = 10,
    ) -> None:
        super().__init__(api_key=api_key, base_url=base_url, rpm=rpm)


class FailoverProvider(LLMProvider):
    """Wraps a primary provider with an optional fallback.

    If the primary exhausts retries the fallback is attempted once.
    """

    def __init__(self, primary: LLMProvider, fallback: LLMProvider) -> None:
        self._primary = primary
        self._fallback = fallback

    async def complete(self, prompt: str, model: str, **kwargs: Any) -> ProviderResponse:
        try:
            return await self._primary.complete(prompt, model, **kwargs)
        except Exception:
            return await self._fallback.complete(prompt, model, **kwargs)


_PROVIDERS: dict[str, type[LLMProvider]] = {
    "openai": OpenAIProvider,
    "anthropic": AnthropicProvider,
    "gemini": GeminiProvider,
}


def get_provider(name: str, **kwargs: Any) -> LLMProvider:
    """Factory that returns an ``LLMProvider`` by name.

    Supported names: ``"openai"``, ``"anthropic"``, ``"gemini"``.
    Extra *kwargs* are forwarded to the provider constructor.
    """
    cls = _PROVIDERS.get(name.lower())
    if cls is None:
        raise ValueError(f"Unknown provider '{name}'. Choose from: {sorted(_PROVIDERS)}")
    return cls(**kwargs)


__all__ = [
    "AnthropicProvider",
    "FailoverProvider",
    "GeminiProvider",
    "LLMProvider",
    "OpenAIProvider",
    "ProviderResponse",
    "get_provider",
    "infer_provider_name",
]
