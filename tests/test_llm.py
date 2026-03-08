from __future__ import annotations

from driftwatch.core.llm import DEFAULT_LLM_MODEL
from driftwatch.core.providers import GeminiProvider, get_provider, infer_provider_name


class TestLLMDefaults:
    def test_default_model_is_gemini_flash_lite(self) -> None:
        assert DEFAULT_LLM_MODEL == "gemini-2.5-flash-lite"

    def test_infer_provider_name_routes_known_prefixes(self) -> None:
        assert infer_provider_name("gemini-2.5-flash-lite") == "gemini"
        assert infer_provider_name("claude-3-5-sonnet") == "anthropic"
        assert infer_provider_name("gpt-4o") == "openai"

    def test_get_provider_supports_gemini(self) -> None:
        provider = get_provider("gemini", api_key="gemini-test-key")
        assert isinstance(provider, GeminiProvider)
