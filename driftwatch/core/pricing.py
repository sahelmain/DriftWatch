"""Helpers for model-pricing configuration and token-cost estimation."""

from __future__ import annotations

import json
from dataclasses import dataclass


@dataclass(frozen=True)
class ModelPricing:
    input_per_million_tokens: float
    output_per_million_tokens: float


def load_model_pricing(raw_json: str) -> dict[str, ModelPricing]:
    """Parse pricing JSON into a typed mapping."""
    if not raw_json.strip():
        return {}

    try:
        data = json.loads(raw_json)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid LLM_MODEL_PRICING_JSON: {exc}") from exc

    if not isinstance(data, dict):
        raise ValueError("LLM_MODEL_PRICING_JSON must be a JSON object")

    pricing: dict[str, ModelPricing] = {}
    for model_name, raw_entry in data.items():
        if not isinstance(model_name, str):
            raise ValueError("LLM_MODEL_PRICING_JSON keys must be model-name strings")
        if not isinstance(raw_entry, dict):
            raise ValueError(f"Pricing for '{model_name}' must be an object")
        try:
            pricing[model_name] = ModelPricing(
                input_per_million_tokens=float(raw_entry["input_per_million_tokens"]),
                output_per_million_tokens=float(raw_entry["output_per_million_tokens"]),
            )
        except KeyError as exc:
            raise ValueError(
                f"Pricing for '{model_name}' must include input_per_million_tokens and output_per_million_tokens"
            ) from exc
        except (TypeError, ValueError) as exc:
            raise ValueError(
                f"Pricing for '{model_name}' must use numeric input_per_million_tokens/output_per_million_tokens"
            ) from exc

    return pricing


def estimate_cost(
    model: str,
    input_tokens: int,
    output_tokens: int,
    pricing: dict[str, ModelPricing],
) -> float | None:
    """Return the estimated USD cost for *model*, or ``None`` when unavailable."""
    model_pricing = pricing.get(model)
    if model_pricing is None:
        return None

    input_cost = (max(input_tokens, 0) / 1_000_000) * model_pricing.input_per_million_tokens
    output_cost = (max(output_tokens, 0) / 1_000_000) * model_pricing.output_per_million_tokens
    return round(input_cost + output_cost, 8)
