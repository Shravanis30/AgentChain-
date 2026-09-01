import pytest
from backend.agent_engine.llm_providers import (
    llm_provider_factory, OpenAIProvider, AnthropicProvider, UnconfiguredProviderError
)

@pytest.mark.asyncio
async def test_unconfigured_openai_provider_raises_explicit_exception():
    provider = OpenAIProvider()
    provider.api_key = "" # Unconfigured

    with pytest.raises(UnconfiguredProviderError) as exc_info:
        await provider.generate_response(
            system_instructions="System",
            user_prompt="Prompt",
            model_name="gpt-4o"
        )
    assert "OPENAI_API_KEY is unconfigured" in str(exc_info.value)

@pytest.mark.asyncio
async def test_unconfigured_anthropic_provider_raises_explicit_exception():
    provider = AnthropicProvider()
    provider.api_key = "" # Unconfigured

    with pytest.raises(UnconfiguredProviderError) as exc_info:
        await provider.generate_response(
            system_instructions="System",
            user_prompt="Prompt",
            model_name="claude-3-5-sonnet-20241022"
        )
    assert "ANTHROPIC_API_KEY is unconfigured" in str(exc_info.value)

def test_openai_token_cost_calculation():
    provider = OpenAIProvider()
    # 1000 prompt tokens ($0.0025) + 1000 completion tokens ($0.0100) = $0.0125
    cost = provider.calculate_cost_usdc(model_name="gpt-4o", prompt_tokens=1000, completion_tokens=1000)
    assert cost == 0.0125
