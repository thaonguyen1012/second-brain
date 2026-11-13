"""GET /api/counts: the numbers next to the app sidebar's rows, for one owner.

Each number is the row count of the list that the sidebar row opens, with that page's default filters, so a
click shows exactly that many rows. The counts reuse the list endpoints' own querysets (the services behind
them): this week's open objectives (Tuần), all skills (Kỹ năng), all tools (Công cụ), this month's job
ads (Thị trường), this week's achievements (Thành tựu), all Items, notes, opportunities and projects, and
whether a timer runs.
"This week" and "this month" are Europe/Prague, as in GET /api/weeks/current and the web's lib/dates.ts.

One COUNT or EXISTS query per number. Read-only: unlike GET /api/weeks/current, no Week row is created
(a week nobody opened yet has 0 open objectives).
"""

import datetime as dt
from typing import Any

from django.contrib.auth.models import User
from django.db.models import Model, QuerySet
from django.utils import timezone

from growth import services as growth
from library import services as library
from library.models import Item
from opportunities import services as opportunities
from weeks import services as weeks
from weeks.models import Objective
from work import services as work


def rows[M: Model](listed: QuerySet[M]) -> int:
    """A list's row count. Selecting only the pk keeps its filters and grouping but leaves out the per-row
    annotations that a plain count() would still compute (e.g. the opportunities' five score subqueries)."""
    return listed.values("pk").count()


def snapshot(user: User, today: dt.date | None = None) -> dict[str, Any]:
    day = today or timezone.localdate()
    week = weeks.monday_of(day)
    open_objectives = Objective.objects.filter(
        week__user=user, week__start_date=week, status=Objective.Status.OPEN
    )
    return {
        "objectivesOpen": open_objectives.count(),
        "skills": rows(growth.skills(user, day)),
        "tools": rows(library.items(user).filter(type=Item.Type.TOOL)),
        "jobAds": rows(growth.job_ads(user, growth.month_start(day))),
        "achievements": rows(growth.achievements(user, week)),
        "items": rows(library.items(user)),
        "notes": rows(library.notes(user)),
        "opportunities": rows(opportunities.opportunities(user)),
        "projects": rows(work.projects(user)),
        "timerRunning": work.running_entries(user).exists(),
    }
