"""Week planning and review (DECISIONS 9.2). Weeks run Monday to Sunday in TIME_ZONE (Europe/Prague)."""

import datetime as dt
from collections.abc import Iterable
from typing import Any

from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Max
from django.utils import timezone

from growth.services import achievements
from inbox.models import InboxEntry
from library.models import Item
from opportunities.services import week_activity
from progress.models import PageProgress
from weeks.models import Objective, Week
from work.services import objective_time

REVIEW_FIELDS = (
    "review_win",
    "review_distraction",
    "review_learned",
    "review_satisfied",
    "review_changed_mind",
    "review_opportunity_evidence",
)
OBJECTIVE_FIELDS = ("title", "status", "position")


class PlanError(ValueError):
    pass


def monday_of(day: dt.date) -> dt.date:
    return day - dt.timedelta(days=day.weekday())


def current_start() -> dt.date:
    return monday_of(timezone.localdate())


def get_or_create_week(user: User, start: dt.date) -> Week:
    """`start` must be a Monday (the API checks it, the DB constraint enforces it)."""
    week, _ = Week.objects.get_or_create(user=user, start_date=start)
    return week


def previous_week(week: Week) -> Week | None:
    """The latest earlier week; a skipped week does not lose its open objectives."""
    return (
        Week.objects.filter(user_id=week.user_id, start_date__lt=week.start_date)
        .order_by("-start_date")
        .first()
    )


def carry_candidates(week: Week) -> list[dict[str, Any]]:
    """Open objectives of the previous week, each flagged when already carried into `week`."""
    previous = previous_week(week)
    if previous is None:
        return []
    carried = set(
        week.objectives.filter(carried_from__isnull=False).values_list("carried_from_id", flat=True)
    )
    return [
        {"id": o.pk, "title": o.title, "weekStart": previous.start_date, "carried": o.pk in carried}
        for o in previous.objectives.filter(status=Objective.Status.OPEN)
    ]


def plan_week(week: Week, carry: Iterable[int], journal: str | None) -> Week:
    """Carry the chosen open objectives of the previous week over (idempotent) and save the journal.

    Raises PlanError when an id is not an open objective of the previous week; an objective that was
    already carried into `week` is skipped.
    """
    wanted = set(carry)
    with transaction.atomic():
        week = Week.objects.select_for_update().get(pk=week.pk)
        previous = previous_week(week)
        open_ids = (
            set(previous.objectives.filter(status=Objective.Status.OPEN).values_list("pk", flat=True))
            if previous
            else set()
        )
        if unknown := wanted - open_ids:
            raise PlanError(f"Không phải mục tiêu đang mở của tuần trước: {sorted(unknown)}")
        already = set(
            week.objectives.filter(carried_from__isnull=False).values_list("carried_from_id", flat=True)
        )
        sources = Objective.objects.filter(pk__in=wanted - already).order_by("position", "id")
        position = _next_position(week)
        for source in sources:
            Objective.objects.create(week=week, title=source.title, carried_from=source, position=position)
            position += 1
        fields = ["planned_at", "updated_at"]
        if journal is not None:
            week.planning_journal = journal
            fields.append("planning_journal")
        week.planned_at = timezone.now()
        week.save(update_fields=fields)
    return week


def save_review(week: Week, changes: dict[str, str]) -> Week:
    fields = [f for f in REVIEW_FIELDS if f in changes]
    for field in fields:
        setattr(week, field, changes[field])
    week.reviewed_at = timezone.now()
    week.save(update_fields=[*fields, "reviewed_at", "updated_at"])
    return week


def add_objective(week: Week, title: str) -> Objective:
    with transaction.atomic():
        Week.objects.select_for_update().get(pk=week.pk)  # serialize positions
        return Objective.objects.create(week=week, title=title, position=_next_position(week))


def update_objective(objective: Objective, changes: dict[str, object]) -> Objective:
    fields = [f for f in OBJECTIVE_FIELDS if f in changes]
    for field in fields:
        setattr(objective, field, changes[field])
    objective.save(update_fields=[*fields, "updated_at"])
    return objective


def _next_position(week: Week) -> int:
    top = week.objectives.aggregate(top=Max("position"))["top"]
    return 0 if top is None else top + 1


def review(week: Week) -> dict[str, Any]:
    """Objective progress and the body of work per day, from data that already exists.

    Body of work: inbox entries archived that day (`archived_at`), Items finished that day and
    handbook pages marked done that day; achievements of the brag document dated in the week. Time:
    minutes of time entries linked to this week's objectives vs other minutes, per day and per objective
    (the review chart, DECISIONS 9.2). Opportunities: those that got evidence recorded this week ("which
    opportunity got more evidence") and the stale ones.
    """
    tz = timezone.get_current_timezone()
    first = dt.datetime.combine(week.start_date, dt.time.min, tzinfo=tz)
    after = first + dt.timedelta(days=7)
    days = {week.start_date + dt.timedelta(days=i): _empty_day() for i in range(7)}

    def day_of(moment: dt.datetime) -> dict[str, list[dict[str, Any]]]:
        return days[timezone.localtime(moment, tz).date()]

    user_id = week.user_id
    archived = InboxEntry.objects.filter(
        user_id=user_id, status=InboxEntry.Status.ARCHIVED, archived_at__gte=first, archived_at__lt=after
    ).order_by("archived_at", "id")
    for entry in archived.only("id", "url", "text", "og_title", "archived_at"):
        assert entry.archived_at is not None
        day_of(entry.archived_at)["inboxArchived"].append({"id": entry.pk, "title": str(entry)})
    finished = Item.objects.filter(user_id=user_id, finished_at__gte=first, finished_at__lt=after)
    for item in finished.order_by("finished_at").only("id", "title", "type", "finished_at"):
        assert item.finished_at is not None
        day_of(item.finished_at)["itemsFinished"].append(
            {"id": item.pk, "title": item.title, "type": item.type}
        )
    pages = PageProgress.objects.filter(
        user_id=user_id, done=True, updated_at__gte=first, updated_at__lt=after
    )
    for page in pages.order_by("updated_at").only("book", "page", "updated_at"):
        day_of(page.updated_at)["pagesDone"].append({"book": page.book, "page": page.page})

    time = objective_time(user_id, week.pk, week.start_date)
    counts = dict.fromkeys(Objective.Status.values, 0)
    by_objective = []
    for objective in week.objectives.all():
        counts[objective.status] += 1
        minutes = time["byObjective"].get(objective.pk, 0)
        by_objective.append({"id": objective.pk, "title": objective.title, "minutes": minutes})
    day_minutes = time["days"]
    return {
        "week": week,
        "objectiveCounts": counts,
        "days": [
            {
                "date": day,
                **work,
                "minutesForObjectives": day_minutes[day]["forObjectives"],
                "minutesOther": day_minutes[day]["other"],
            }
            for day, work in days.items()
        ],
        "time": {
            "minutesForObjectives": sum(d["forObjectives"] for d in day_minutes.values()),
            "minutesOther": sum(d["other"] for d in day_minutes.values()),
            "byObjective": by_objective,
        },
        "opportunities": week_activity(user_id, first, after),
        "achievements": list(achievements(user_id, week.start_date).order_by("date", "id")),
    }


def _empty_day() -> dict[str, list[dict[str, Any]]]:
    return {"inboxArchived": [], "itemsFinished": [], "pagesDone": []}
