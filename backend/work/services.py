"""Projects and time (DECISIONS 9.2): effective hourly rate, timer, weekly hours. No invoices, no CRM."""

import datetime as dt
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from django.contrib.auth.models import User
from django.db import IntegrityError, transaction
from django.db.models import Q, QuerySet, Sum
from django.db.models.functions import Coalesce
from django.utils import timezone

from library.models import Item
from work.models import ProjectDetails, TimeEntry

ITEM_FIELDS = ("title", "status", "tags", "source", "started_at", "finished_at")
DETAIL_FIELDS = ("client", "billing", "price", "hourly_rate", "currency")
ENTRY_FIELDS = ("project", "objective", "date", "minutes", "note", "billable")
CENT = Decimal("0.01")


class TimerConflict(Exception):
    """Another request started a timer at the same moment (the partial unique constraint fired)."""


def earned(
    billing: str, price: Decimal | None, hourly_rate: Decimal | None, billable_minutes: int
) -> Decimal | None:
    """What the project pays: the agreed price (fixed) or billable hours x rate (hourly); None if unknown."""
    if billing == ProjectDetails.Billing.HOURLY:
        if hourly_rate is None:
            return None
        return (hourly_rate * billable_minutes / 60).quantize(CENT, ROUND_HALF_UP)
    return price


def effective_rate(
    billing: str,
    price: Decimal | None,
    hourly_rate: Decimal | None,
    billable_minutes: int,
    total_minutes: int,
) -> Decimal | None:
    """Harvest-style effective hourly rate: what the project pays divided by ALL hours spent on it.

    Non-billable time counts in the hours, so it lowers the rate. None without time or without a price.
    """
    amount = earned(billing, price, hourly_rate, billable_minutes)
    if amount is None or total_minutes <= 0:
        return None
    return (amount * 60 / total_minutes).quantize(CENT, ROUND_HALF_UP)


def projects(user: User) -> QuerySet[Item]:
    """The user's project Items with their details and minute totals (finished entries only)."""
    finished = Q(time_entries__minutes__isnull=False)
    return (
        Item.objects.filter(user=user, type=Item.Type.PROJECT)
        .select_related("project")
        .annotate(
            minutes_total=Coalesce(Sum("time_entries__minutes", filter=finished), 0),
            minutes_billable=Coalesce(
                Sum("time_entries__minutes", filter=finished & Q(time_entries__billable=True)), 0
            ),
        )
    )


def details_of(item: Item) -> ProjectDetails:
    """The saved details, or unsaved defaults for a project Item created without them (e.g. in /api/items)."""
    try:
        return item.project
    except ProjectDetails.DoesNotExist:
        return ProjectDetails(item=item)


def totals(item: Item) -> dict[str, Any]:
    """Computed fields of a project from an Item annotated by `projects()`."""
    details = details_of(item)
    total: int = getattr(item, "minutes_total", 0)
    billable: int = getattr(item, "minutes_billable", 0)
    return {
        "minutesTotal": total,
        "minutesBillable": billable,
        "minutesNonBillable": total - billable,
        "earned": earned(details.billing, details.price, details.hourly_rate, billable),
        "effectiveRate": effective_rate(details.billing, details.price, details.hourly_rate, billable, total),
    }


def create_project(user: User, data: dict[str, Any]) -> Item:
    with transaction.atomic():
        item = Item.objects.create(
            user=user, type=Item.Type.PROJECT, **{f: data[f] for f in ITEM_FIELDS if f in data}
        )
        ProjectDetails.objects.create(item=item, **{f: data[f] for f in DETAIL_FIELDS if f in data})
    return item


def update_project(item: Item, data: dict[str, Any]) -> Item:
    """Item fields and details in one write; details are created for a project Item that has none."""
    with transaction.atomic():
        item_fields = [f for f in ITEM_FIELDS if f in data]
        for field in item_fields:
            setattr(item, field, data[field])
        if item_fields:
            item.save(update_fields=[*item_fields, "updated_at"])
        details = details_of(item)
        for field in DETAIL_FIELDS:
            if field in data:
                setattr(details, field, data[field])
        details.save()
    return item


def create_entry(user: User, data: dict[str, Any]) -> TimeEntry:
    return TimeEntry.objects.create(user=user, **{f: data[f] for f in ENTRY_FIELDS if f in data})


def update_entry(entry: TimeEntry, data: dict[str, Any]) -> TimeEntry:
    fields = [f for f in ENTRY_FIELDS if f in data]
    for field in fields:
        setattr(entry, field, data[field])
    entry.save(update_fields=[*fields, "updated_at"])
    return entry


def delete_entry(entry: TimeEntry) -> None:
    """Finished or running (a timer discarded): the minutes simply stop counting."""
    entry.delete()


def running_entry(user: User) -> TimeEntry | None:
    return TimeEntry.objects.select_related("project").filter(user=user, minutes__isnull=True).first()


def _stop(entry: TimeEntry, now: dt.datetime) -> TimeEntry:
    assert entry.started_at is not None
    entry.minutes = max(1, round((now - entry.started_at).total_seconds() / 60))
    entry.save(update_fields=["minutes", "updated_at"])
    return entry


def start_timer(user: User, data: dict[str, Any]) -> TimeEntry:
    """Start a timer on a project; a timer already running is stopped first (Harvest behaviour)."""
    now = timezone.now()
    try:
        with transaction.atomic():
            running = TimeEntry.objects.select_for_update().filter(user=user, minutes__isnull=True).first()
            if running is not None:
                _stop(running, now)
            fields = {f: data[f] for f in ("project", "objective", "note", "billable") if f in data}
            return TimeEntry.objects.create(
                user=user, started_at=now, date=timezone.localdate(now), minutes=None, **fields
            )
    except IntegrityError as error:
        raise TimerConflict from error


def stop_timer(user: User) -> TimeEntry | None:
    """Stop the running timer (rounded to whole minutes, at least 1); None when nothing runs."""
    with transaction.atomic():
        running = TimeEntry.objects.select_for_update().filter(user=user, minutes__isnull=True).first()
        return None if running is None else _stop(running, timezone.now())


def week_summary(user: User, start: dt.date) -> dict[str, Any]:
    """Billable and non-billable minutes of the week starting `start` (Monday), in total and per project."""
    entries = TimeEntry.objects.filter(
        user=user, date__gte=start, date__lt=start + dt.timedelta(days=7), minutes__isnull=False
    )
    rows = (
        entries.values("project_id", "project__title", "project__project__client")
        .annotate(
            total=Sum("minutes"),
            billable=Coalesce(Sum("minutes", filter=Q(billable=True)), 0),
        )
        .order_by("-total", "project_id")
    )
    per_project = [
        {
            "id": row["project_id"],
            "title": row["project__title"],
            "client": row["project__project__client"] or "",
            "minutesTotal": row["total"],
            "minutesBillable": row["billable"],
            "minutesNonBillable": row["total"] - row["billable"],
        }
        for row in rows
    ]
    total = sum(p["minutesTotal"] for p in per_project)
    billable = sum(p["minutesBillable"] for p in per_project)
    return {
        "weekStart": start,
        "minutesTotal": total,
        "minutesBillable": billable,
        "minutesNonBillable": total - billable,
        "projects": per_project,
    }


def objective_time(user_id: int, week_id: int, start: dt.date) -> dict[str, Any]:
    """Minutes of the week for its objectives vs other minutes, per day and per objective (Week review chart).

    An entry counts "for objectives" when it is linked to one of this week's objectives.
    """
    entries = TimeEntry.objects.filter(
        user_id=user_id, date__gte=start, date__lt=start + dt.timedelta(days=7), minutes__isnull=False
    )
    days: dict[dt.date, dict[str, int]] = {
        start + dt.timedelta(days=i): {"forObjectives": 0, "other": 0} for i in range(7)
    }
    by_objective: dict[int, int] = {}
    for date, objective_id, objective_week, spent in entries.values_list(
        "date", "objective_id", "objective__week_id", "minutes"
    ):
        minutes = spent or 0  # never null: running entries are filtered out
        if objective_id is not None and objective_week == week_id:
            days[date]["forObjectives"] += minutes
            by_objective[objective_id] = by_objective.get(objective_id, 0) + minutes
        else:
            days[date]["other"] += minutes
    return {"days": days, "byObjective": by_objective}
