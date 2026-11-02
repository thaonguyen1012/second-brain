"""LLM seam with a fake provider: no network, no API key."""

from decimal import Decimal
from typing import Any

import pytest
from pydantic import BaseModel

from core.models import LlmCache, LlmCall
from core.services import llm

pytestmark = pytest.mark.django_db

PROMPT = llm.Prompt("test", "1", "system")


class Out(BaseModel):
    answer: str


class FakeProvider:
    name = "fake"

    def __init__(self, text: str = '{"answer": "yes"}', error: Exception | None = None) -> None:
        self.text, self.error, self.generated = text, error, 0

    def count_tokens(self, model: str, system: str, user: str) -> int:
        return 1000

    def generate(
        self, model: str, system: str, user: str, schema: type[BaseModel], max_out: int
    ) -> llm.Reply:
        self.generated += 1
        if self.error:
            raise self.error
        return llm.Reply(self.text, in_tokens=1000, out_tokens=100, cache_read=0)


@pytest.fixture
def provider(monkeypatch: pytest.MonkeyPatch, settings: Any) -> FakeProvider:
    settings.LLM_MIN_INTERVAL_SECONDS = 0
    settings.LLM_MODEL = "paid-model"
    settings.LLM_FREE_TIER = False
    settings.LLM_PRICES = {"paid-model": {"in": 1000.0, "out": 2000.0, "cache_read": 100.0}}  # USD per 1M
    settings.LLM_MAX_OUTPUT_TOKENS = 100
    fake = FakeProvider()
    monkeypatch.setattr(llm, "get_provider", lambda: fake)
    return fake


def test_call_is_logged_with_tokens_and_cost(provider: FakeProvider) -> None:
    assert llm.complete(PROMPT, "q", Out).answer == "yes"
    row = LlmCall.objects.get()
    assert (row.provider, row.purpose, row.model, row.prompt_version) == ("fake", "test", "paid-model", "1")
    assert (row.in_tokens, row.out_tokens, row.ok) == (1000, 100, True)
    assert row.cost == Decimal("1.200000")  # 1000 * 1000/1M + 100 * 2000/1M


def test_first_call_over_the_cap_is_refused_and_logged(provider: FakeProvider, settings: Any) -> None:
    settings.LLM_MONTHLY_BUDGET_USD = 3  # each call costs 1.20 and is estimated at 1.20
    llm.complete(PROMPT, "a", Out)
    llm.complete(PROMPT, "b", Out)  # month cost 2.40
    with pytest.raises(llm.BudgetExceeded):
        llm.complete(PROMPT, "c", Out)  # 2.40 + 1.20 > 3
    assert provider.generated == 2  # nothing was sent
    refused = LlmCall.objects.order_by("id").last()
    assert refused is not None and refused.ok is False and refused.error.startswith("BudgetExceeded")
    assert refused.cost == 0
    assert llm.month_paid_cost() == Decimal("2.4")


def test_free_tier_records_zero_cost_but_stays_capped(provider: FakeProvider, settings: Any) -> None:
    settings.LLM_FREE_TIER = True
    settings.LLM_MONTHLY_BUDGET_USD = 2
    llm.complete(PROMPT, "q", Out)
    row = LlmCall.objects.get()
    assert (row.cost, row.in_tokens, row.out_tokens) == (Decimal(0), 1000, 100)
    with pytest.raises(llm.BudgetExceeded):  # 1.20 at paid prices + 1.20 > 2
        llm.complete(PROMPT, "r", Out)


def test_unknown_model_is_refused_even_on_free_tier(provider: FakeProvider, settings: Any) -> None:
    settings.LLM_FREE_TIER, settings.LLM_MODEL = True, "unpriced-model"
    with pytest.raises(llm.BudgetExceeded, match="no price"):
        llm.complete(PROMPT, "q", Out)
    assert provider.generated == 0


def test_network_errors_are_logged(provider: FakeProvider) -> None:
    provider.error = TimeoutError("read timed out")
    with pytest.raises(TimeoutError):
        llm.complete(PROMPT, "q", Out)
    row = LlmCall.objects.get()
    assert (row.ok, row.error) == (False, "TimeoutError")


def test_rate_limit_is_logged_and_raised(provider: FakeProvider) -> None:
    provider.error = llm.RateLimited("429 RESOURCE_EXHAUSTED")
    with pytest.raises(llm.RateLimited):
        llm.complete(PROMPT, "q", Out)
    row = LlmCall.objects.get()
    assert row.ok is False and "429" in row.error


def test_invalid_output_is_logged(provider: FakeProvider) -> None:
    provider.text = '{"answer": 1, "extra": "x"'
    with pytest.raises(llm.InvalidOutput):
        llm.complete(PROMPT, "q", Out)
    assert LlmCall.objects.get().ok is False
    assert not LlmCache.objects.exists()


def test_results_are_cached_by_content(provider: FakeProvider) -> None:
    llm.complete(PROMPT, "same", Out)
    llm.complete(PROMPT, "same", Out)
    assert provider.generated == 1 and LlmCall.objects.count() == 1
    llm.complete(llm.Prompt("test", "2", "system"), "same", Out)  # new prompt version: new call
    assert provider.generated == 2


def test_anthropic_is_not_implemented_yet(settings: Any) -> None:
    settings.LLM_PROVIDER = "anthropic"
    with pytest.raises(NotImplementedError):
        llm.get_provider()


def test_gemini_needs_a_key(settings: Any) -> None:
    settings.LLM_PROVIDER, settings.GEMINI_API_KEY = "gemini", ""
    with pytest.raises(llm.LlmError, match="GEMINI_API_KEY"):
        llm.get_provider()
