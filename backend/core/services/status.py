"""GET /api/status: is the background machinery healthy and within budget? Counts and dates only, no secrets
(no keys, no error texts, no payloads)."""

from datetime import datetime
from decimal import Decimal
from typing import Any

from django.conf import settings
from django.contrib.auth.models import User
from django.db.models import Count, Max, Q
from django.utils import timezone

from brief.models import DailyBrief
from core.models import Job, LlmCall
from core.services import llm


def month_start(now: datetime) -> datetime:
    """The same month boundary as llm.month_paid_cost (the budget guard)."""
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def snapshot(user: User, now: datetime | None = None) -> dict[str, Any]:
    moment = now or timezone.now()
    start = month_start(moment)
    calls = LlmCall.objects.filter(created_at__gte=start).aggregate(
        calls=Count("id"), failed=Count("id", filter=Q(ok=False))
    )
    jobs: dict[str, list[dict[str, Any]]] = {Job.Status.PENDING: [], Job.Status.FAILED: []}
    rows = (
        Job.objects.filter(status__in=list(jobs))
        .values("status", "kind")
        .annotate(count=Count("id"))
        .order_by("status", "kind")
    )
    for row in rows:
        jobs[row["status"]].append({"kind": row["kind"], "count": row["count"]})
    last_brief = DailyBrief.objects.filter(user=user).aggregate(last=Max("date"))["last"]
    return {
        "llm": {
            "provider": settings.LLM_PROVIDER,
            "model": settings.LLM_MODEL,
            "freeTier": settings.LLM_FREE_TIER,
            "monthStart": start,
            "monthCostUsd": llm.month_paid_cost(moment),
            "budgetUsd": Decimal(str(settings.LLM_MONTHLY_BUDGET_USD)),
            "calls": calls["calls"],
            "failedCalls": calls["failed"],
        },
        "lastBriefDate": last_brief,
        "jobs": {"pending": jobs[Job.Status.PENDING], "failed": jobs[Job.Status.FAILED]},
    }
