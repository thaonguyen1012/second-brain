"""The one place that calls an LLM (DECISIONS 10.4). Jobs call `complete()`, never a provider SDK.

Each call: (1) estimate tokens with the provider's counter, (2) refuse it if this month's cost plus the
estimate would pass LLM_MONTHLY_BUDGET_USD, (3) call the API with a JSON response schema, (4) write an
LlmCall row (refusals and errors too). The reply is validated with the pydantic schema. Validated output is
cached by content hash. Only call this from background jobs, never inside a user request.
"""

import hashlib
import json
import logging
import time
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Protocol

from django.conf import settings
from django.db.models import Sum
from django.utils import timezone
from google import genai
from google.genai import errors, types
from pydantic import BaseModel, ValidationError

from core.models import LlmCache, LlmCall

logger = logging.getLogger(__name__)


class LlmError(Exception):
    pass


class BudgetExceeded(LlmError):
    """The monthly cap would be passed; nothing was sent."""


class RateLimited(LlmError):
    """429 / quota: not a failure of the input, try again on a later run."""


class InvalidOutput(LlmError):
    """The reply was not valid JSON for the schema."""


@dataclass(frozen=True)
class Reply:
    text: str
    in_tokens: int
    out_tokens: int
    cache_read: int


class Provider(Protocol):
    name: str

    def count_tokens(self, model: str, system: str, user: str) -> int: ...

    def generate(
        self, model: str, system: str, user: str, schema: type[BaseModel], max_output_tokens: int
    ) -> Reply: ...


# The reader the prompts describe when READER_PROFILE is not set (it follows "The reader is").
DEFAULT_READER_PROFILE = (
    "a software developer who builds products with AI and watches for business opportunities"
)


@dataclass(frozen=True)
class Prompt:
    purpose: str
    version: str
    system: str


def reader_profile() -> str:
    """Who the prompts in backend/prompts/ work for: READER_PROFILE, one line that follows "The reader is".
    It fills the `{reader}` mark of each prompt, so nothing about the owner is written in the prompt files."""
    return " ".join(settings.READER_PROFILE.split()).rstrip(".") or DEFAULT_READER_PROFILE


def tagged(tag: str, data: object) -> str:
    """The user message: `data` as one line of JSON between <tag> and </tag>. `</` inside the text is written
    `<\\/` (the same JSON string), so the material never shows the model a closing tag of its own
    (audit P-10)."""
    return f"<{tag}>\n" + json.dumps(data, ensure_ascii=False).replace("</", "<\\/") + f"\n</{tag}>"


def complete[T: BaseModel](prompt: Prompt, user: str, schema: type[T], use_cache: bool = True) -> T:
    model = settings.LLM_MODEL
    key = _cache_key(prompt, model, user)
    if use_cache and (hit := LlmCache.objects.filter(key=key).first()):
        return schema.model_validate(hit.output)

    provider = get_provider()
    row = LlmCall(provider=provider.name, purpose=prompt.purpose, model=model, prompt_version=prompt.version)
    try:
        _pace()
        row.in_tokens = provider.count_tokens(model, prompt.system, user)
        # The guard always uses paid-tier prices, so it holds even if the free tier silently becomes billed.
        estimate = paid_cost(model, row.in_tokens, settings.LLM_MAX_OUTPUT_TOKENS, 0)
        spent = month_paid_cost()
        if spent + estimate > Decimal(str(settings.LLM_MONTHLY_BUDGET_USD)):
            raise BudgetExceeded(
                f"month cost {spent} + estimate {estimate} > cap {settings.LLM_MONTHLY_BUDGET_USD}"
            )
        _pace()
        started = time.monotonic()
        reply = provider.generate(model, prompt.system, user, schema, settings.LLM_MAX_OUTPUT_TOKENS)
        row.latency_ms = int((time.monotonic() - started) * 1000)
        row.in_tokens, row.out_tokens, row.cache_read = reply.in_tokens, reply.out_tokens, reply.cache_read
        cost = paid_cost(model, reply.in_tokens, reply.out_tokens, reply.cache_read)
        row.cost = Decimal(0) if settings.LLM_FREE_TIER else cost
        try:
            result = schema.model_validate_json(reply.text)
        except ValidationError as exc:
            raise InvalidOutput(f"schema: {exc.error_count()} error(s): {_first_error(exc)}") from exc
    except Exception as exc:  # timeouts and network errors are logged too, then re-raised
        row.ok = False
        row.error = f"{type(exc).__name__}: {exc}"[:500] if isinstance(exc, LlmError) else type(exc).__name__
        row.save()
        logger.warning("llm call refused or failed", extra={"purpose": prompt.purpose, "error": row.error})
        raise
    row.ok = True
    row.save()
    LlmCache.objects.update_or_create(
        key=key, defaults={"purpose": prompt.purpose, "output": result.model_dump(mode="json")}
    )
    logger.info(
        "llm call",
        extra={"purpose": prompt.purpose, "model": model, "in": row.in_tokens, "out": row.out_tokens},
    )
    return result


def paid_cost(model: str, in_tokens: int, out_tokens: int, cache_read: int) -> Decimal:
    """USD at the paid-tier price; a model without a price is refused (never spend blind)."""
    price = settings.LLM_PRICES.get(model)
    if price is None:
        raise BudgetExceeded(f"no price for model {model}; refusing to spend blind")
    usd = (
        (in_tokens - cache_read) * price["in"] + out_tokens * price["out"] + cache_read * price["cache_read"]
    )
    return Decimal(str(usd / 1_000_000)).quantize(Decimal("0.000001"))


def month_paid_cost(now: datetime | None = None) -> Decimal:
    """This month's spend at paid-tier prices, from the recorded tokens (what the budget guard compares)."""
    start = (now or timezone.now()).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    rows = (
        LlmCall.objects.filter(created_at__gte=start)
        .exclude(error__startswith="BudgetExceeded")  # refused: nothing was sent
        .values("model")
        .annotate(i=Sum("in_tokens"), o=Sum("out_tokens"), c=Sum("cache_read"))
    )
    return sum(
        (paid_cost(r["model"], r["i"], r["o"], r["c"]) for r in rows if r["model"] in settings.LLM_PRICES),
        Decimal(0),
    )


def get_provider() -> Provider:
    if settings.LLM_PROVIDER == "gemini":
        return GeminiProvider()
    if settings.LLM_PROVIDER == "anthropic":
        # Later: Claude (Haiku for tagging). Load the `claude-api` skill before writing this branch.
        raise NotImplementedError("LLM_PROVIDER=anthropic is not implemented yet")
    raise LlmError(f"unknown LLM_PROVIDER {settings.LLM_PROVIDER!r}")


_last_request = 0.0


def _pace() -> None:
    """Space API requests by LLM_MIN_INTERVAL_SECONDS (free-tier rate limits) within this process."""
    global _last_request
    wait = _last_request + settings.LLM_MIN_INTERVAL_SECONDS - time.monotonic()
    if wait > 0:
        time.sleep(wait)
    _last_request = time.monotonic()


def _cache_key(prompt: Prompt, model: str, user: str) -> str:
    material = json.dumps([prompt.purpose, prompt.version, model, user], ensure_ascii=False)
    return hashlib.sha256(material.encode()).hexdigest()


def _first_error(exc: ValidationError) -> str:
    err = exc.errors()[0]
    return f"{'.'.join(str(p) for p in err['loc'])} {err['msg']}"[:200]


# --- Gemini (google-genai SDK) -------------------------------------------------------------------


class GeminiProvider:
    name = "gemini"

    def __init__(self) -> None:
        if not settings.GEMINI_API_KEY:
            raise LlmError("GEMINI_API_KEY is not set (backend/.env)")
        self.client = genai.Client(
            api_key=settings.GEMINI_API_KEY,
            http_options=types.HttpOptions(
                timeout=settings.LLM_TIMEOUT_SECONDS * 1000,
                retry_options=types.HttpRetryOptions(attempts=1),  # a 429 waits for the next run_jobs
            ),
        )

    def count_tokens(self, model: str, system: str, user: str) -> int:
        try:
            response = self.client.models.count_tokens(model=model, contents=f"{system}\n\n{user}")
        except errors.APIError as exc:
            raise _error(exc) from exc
        return response.total_tokens or 0

    def generate(
        self, model: str, system: str, user: str, schema: type[BaseModel], max_output_tokens: int
    ) -> Reply:
        config = types.GenerateContentConfig(
            system_instruction=system,
            response_mime_type="application/json",
            response_json_schema=schema.model_json_schema(),
            max_output_tokens=max_output_tokens,
            temperature=0,
            automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),  # no tools, ever
        )
        try:
            response = self.client.models.generate_content(model=model, contents=user, config=config)
        except errors.APIError as exc:
            raise _error(exc) from exc
        usage = response.usage_metadata
        return Reply(
            text=response.text or "",
            in_tokens=(usage.prompt_token_count or 0) if usage else 0,
            out_tokens=((usage.candidates_token_count or 0) + (usage.thoughts_token_count or 0))
            if usage
            else 0,
            cache_read=(usage.cached_content_token_count or 0) if usage else 0,
        )


def _error(exc: errors.APIError) -> LlmError:
    message = f"{exc.code} {exc.status}"  # never the request, which could echo content or the key
    if exc.code in (429, 503) or exc.status in ("RESOURCE_EXHAUSTED", "UNAVAILABLE"):
        return RateLimited(message)  # quota or overload: try again on a later run
    return LlmError(message)
