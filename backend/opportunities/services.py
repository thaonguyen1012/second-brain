"""Opportunities (DECISIONS 9.2): hypotheses, evidence for and against, self-scores with history.

Weekly rule: an undecided or kept opportunity with no new evidence for 4 weeks is "stale" (the review
suggests dropping it). "New" means recorded (`Evidence.created_at`), not the date the evidence happened, so a
conversation typed in late still counts; an opportunity without evidence counts from its creation.
"""

import datetime as dt
from typing import Any

from django.contrib.auth.models import User
from django.db import IntegrityError, transaction
from django.db.models import (
    BooleanField,
    Case,
    Count,
    DateTimeField,
    Max,
    OuterRef,
    Q,
    QuerySet,
    Subquery,
    Value,
    When,
)
from django.utils import timezone

from inbox.models import InboxEntry
from inbox.services import triage_entry
from opportunities.models import Evidence, Opportunity, ScoreSnapshot

STALE_AFTER = dt.timedelta(weeks=4)
ACTIVE = (Opportunity.Decision.OPEN, Opportunity.Decision.KEEP)  # the stale rule only applies to these
OPPORTUNITY_FIELDS = ("title", "hypothesis", "why_now", "next_action", "decide_by", "decision")
EVIDENCE_FIELDS = ("stance", "title", "url", "note", "date")
SCORE_FIELDS = ("opportunity_score", "pain", "feasibility", "timing", "note")


class DuplicateEvidence(Exception):
    """The inbox entry is already evidence for this opportunity."""


def opportunities(user: User | int, as_of: dt.datetime | None = None) -> QuerySet[Opportunity]:
    """The user's opportunities annotated with evidence counts, last evidence, stale flag and current scores.

    `as_of` (default now) is the moment the stale rule is checked at; evidence recorded later is ignored.
    """
    moment = as_of or timezone.now()
    recorded = Q(evidence__created_at__lt=moment)
    latest = ScoreSnapshot.objects.filter(opportunity=OuterRef("pk")).order_by("-created_at", "-id")
    rows = Opportunity.objects.filter(user=user).annotate(
        evidence_supports=Count("evidence", filter=recorded & Q(evidence__stance=Evidence.Stance.SUPPORTS)),
        evidence_contradicts=Count(
            "evidence", filter=recorded & Q(evidence__stance=Evidence.Stance.CONTRADICTS)
        ),
        last_evidence_at=Max("evidence__created_at", filter=recorded),
        stale=Case(
            When(
                Q(decision__in=ACTIVE)
                & Q(created_at__lt=moment - STALE_AFTER)
                & (Q(last_evidence_at__isnull=True) | Q(last_evidence_at__lt=moment - STALE_AFTER)),
                then=Value(True),
            ),
            default=Value(False),
            output_field=BooleanField(),
        ),
        score_opportunity=Subquery(latest.values("opportunity_score")[:1]),
        score_pain=Subquery(latest.values("pain")[:1]),
        score_feasibility=Subquery(latest.values("feasibility")[:1]),
        score_timing=Subquery(latest.values("timing")[:1]),
        scored_at=Subquery(latest.values("created_at")[:1], output_field=DateTimeField()),
    )
    return rows


def current_scores(opportunity: Opportunity) -> dict[str, Any] | None:
    """The newest snapshot from the annotations of `opportunities()`; None when never scored."""
    if getattr(opportunity, "scored_at", None) is None:
        return None
    keys = {"opportunity": "score_opportunity", "pain": "score_pain", "feasibility": "score_feasibility"}
    keys |= {"timing": "score_timing", "createdAt": "scored_at"}
    return {key: getattr(opportunity, attr) for key, attr in keys.items()}


def last_evidence(opportunity: Opportunity) -> dt.datetime | None:
    """When evidence was last recorded, from the annotations of `opportunities()`."""
    last: dt.datetime | None = getattr(opportunity, "last_evidence_at", None)
    return last


def _decided(opportunity: Opportunity, decision: str) -> None:
    if decision != opportunity.decision:
        opportunity.decision = decision
        opportunity.decided_at = None if decision == Opportunity.Decision.OPEN else timezone.now()


def create_opportunity(user: User, data: dict[str, Any]) -> Opportunity:
    """The opportunity and, when `scores` is given, its first score snapshot."""
    with transaction.atomic():
        opportunity = Opportunity(
            user=user, **{f: data[f] for f in OPPORTUNITY_FIELDS if f in data and f != "decision"}
        )
        if "decision" in data:
            _decided(opportunity, data["decision"])
        opportunity.save()
        if scores := data.get("scores"):
            record_scores(opportunity, scores)
    return opportunity


def update_opportunity(opportunity: Opportunity, data: dict[str, Any]) -> Opportunity:
    fields = [f for f in OPPORTUNITY_FIELDS if f in data and f != "decision"]
    for field in fields:
        setattr(opportunity, field, data[field])
    if "decision" in data:
        _decided(opportunity, data["decision"])
        fields += ["decision", "decided_at"]
    opportunity.save(update_fields=[*fields, "updated_at"])
    return opportunity


def record_scores(opportunity: Opportunity, scores: dict[str, Any]) -> ScoreSnapshot:
    """A new snapshot; older ones stay untouched (the history)."""
    return ScoreSnapshot.objects.create(
        opportunity=opportunity, **{f: scores[f] for f in SCORE_FIELDS if f in scores}
    )


def link_title(data: dict[str, Any]) -> str:
    """The title a linked inbox entry, Item or Note gives the evidence when none is sent."""
    if (item := data.get("item")) is not None:
        return str(item.title)
    for key in ("inbox_entry", "library_note"):
        if (linked := data.get(key)) is not None:
            return str(linked)[:300]
    return ""


def add_evidence(opportunity: Opportunity, data: dict[str, Any]) -> Evidence:
    """Raises DuplicateEvidence when the inbox entry is already evidence for this opportunity."""
    fields = {
        f: data[f] for f in (*EVIDENCE_FIELDS, "kind", "inbox_entry", "item", "library_note") if f in data
    }
    if not fields.get("title"):
        fields["title"] = link_title(data)
    try:
        with transaction.atomic():
            return Evidence.objects.create(opportunity=opportunity, **fields)
    except IntegrityError as error:
        raise DuplicateEvidence from error


def update_evidence(evidence: Evidence, data: dict[str, Any]) -> Evidence:
    fields = [f for f in EVIDENCE_FIELDS if f in data]
    for field in fields:
        setattr(evidence, field, data[field])
    evidence.save(update_fields=[*fields, "updated_at"])
    return evidence


def attach_inbox_entry(
    opportunity: Opportunity, entry: InboxEntry, data: dict[str, Any], archive: bool
) -> tuple[Evidence, bool]:
    """Weekly triage in one action: the entry becomes evidence (dated the day it was captured) and,
    with `archive`, leaves the inbox. Idempotent: an entry already attached keeps its evidence row.

    Returns the evidence and whether it was created.
    """
    with transaction.atomic():
        evidence = Evidence.objects.filter(opportunity=opportunity, inbox_entry=entry).first()
        created = evidence is None
        if evidence is None:
            fields = {
                "kind": Evidence.Kind.INBOX,
                "inbox_entry": entry,
                "url": entry.url,
                "date": timezone.localdate(entry.created_at),
                **data,
            }
            evidence = add_evidence(opportunity, fields)
        if archive and entry.status != InboxEntry.Status.ARCHIVED:
            triage_entry(entry, {"status": InboxEntry.Status.ARCHIVED})
    return evidence, created


def evidence_of(opportunity: Opportunity) -> QuerySet[Evidence]:
    return opportunity.evidence.order_by("-date", "-id")


def week_activity(user_id: int, first: dt.datetime, after: dt.datetime) -> dict[str, list[dict[str, Any]]]:
    """For the Week review: opportunities that got evidence recorded in [first, after), and the stale ones
    as of the end of that week (or now, for the running week)."""
    in_week = Q(evidence__created_at__gte=first, evidence__created_at__lt=after)
    rows = (
        Opportunity.objects.filter(user_id=user_id)
        .annotate(
            week_supports=Count("evidence", filter=in_week & Q(evidence__stance=Evidence.Stance.SUPPORTS)),
            week_contradicts=Count(
                "evidence", filter=in_week & Q(evidence__stance=Evidence.Stance.CONTRADICTS)
            ),
        )
        .filter(Q(week_supports__gt=0) | Q(week_contradicts__gt=0))
        .order_by("title", "id")
    )
    with_evidence = [
        {
            "id": o.pk,
            "title": o.title,
            "decision": o.decision,
            "supports": o.week_supports,
            "contradicts": o.week_contradicts,
        }
        for o in rows
    ]
    moment = min(after, timezone.now())
    stale = [
        {"id": o.pk, "title": o.title, "decision": o.decision, "lastEvidenceAt": last_evidence(o)}
        for o in opportunities(user_id, as_of=moment).filter(
            Q(stale=True)
        )  # annotation, unknown to the type checker.order_by("title", "id")
    ]
    return {"withEvidence": with_evidence, "stale": stale}
