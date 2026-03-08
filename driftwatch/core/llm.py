"""Shared LLM defaults and provider inference."""

from __future__ import annotations

DEFAULT_LLM_MODEL = "gemini-2.5-flash-lite"


def infer_provider_name(model: str) -> str:
    """Map a model name to its provider."""
    model_lower = model.lower()
    if model_lower.startswith("claude"):
        return "anthropic"
    if model_lower.startswith("gemini"):
        return "gemini"
    return "openai"
