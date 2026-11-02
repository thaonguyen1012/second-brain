"""The morning brief in the app (DECISIONS 5, step 6 of 9.4).

Schedule (Europe/Prague, enqueued by `run_jobs` through `jobs.periodic`): a `feeds` job at each hour of
BRIEF_FETCH_HOURS fetches every active Source through the SSRF guard, stores new entries (deduplicated by hash
of title + URL before any LLM call) and queues one `news_tag` job per new entry, at most BRIEF_TAG_DAILY_CAP a
day per owner (the rest is stored as `skipped`). The `brief` job at BRIEF_BUILD_TIME builds one DailyBrief per
owner from the most relevant tagged items not shown before, then queues one `brief_intro` LLM call.
"""

import datetime as dt
import logging
from collections import Counter
from typing import Any

from django.conf import settings
from django.contrib.auth.models import User
from django.db import IntegrityError, transaction
from django.db.models import F, Prefetch, QuerySet
from django.utils import timezone

from brief import feeds
from brief.models import BriefEntry, DailyBrief, NewsItem, Source
from core.models import Job
from core.services import jobs, safe_fetch

logger = logging.getLogger(__name__)

FEEDS_JOB = "feeds"
BRIEF_JOB = "brief"
TAG_JOB = "news_tag"
INTRO_JOB = "brief_intro"


def _clock(value: str) -> dt.time:
    return dt.time.fromisoformat(value)


def local_moment(day: dt.date, at: dt.time) -> dt.datetime:
    return timezone.make_aware(dt.datetime.combine(day, at))


def day_bounds(day: dt.date) -> tuple[dt.datetime, dt.datetime]:
    """[start, end) of a Prague calendar day (DST-safe)."""
    return local_moment(day, dt.time.min), local_moment(day + dt.timedelta(days=1), dt.time.min)


# --- Schedule ----------------------------------------------------------------------------------------


@jobs.periodic
def schedule(now: dt.datetime) -> None:
    """Enqueue the latest due fetch slot and today's brief; idempotent keys make repeated calls free."""
    if not Source.objects.filter(active=True).exists():
        return
    local = timezone.localtime(now)
    passed = [h for h in settings.BRIEF_FETCH_HOURS if h <= local.hour]
    if passed:
        jobs.enqueue(FEEDS_JOB, f"{FEEDS_JOB}:{local:%Y-%m-%d}T{max(passed):02d}", {})
    if local >= local_moment(local.date(), _clock(settings.BRIEF_BUILD_TIME)):
        jobs.enqueue(BRIEF_JOB, f"{BRIEF_JOB}:{local:%Y-%m-%d}", {"date": local.date().isoformat()})


# --- Feeds -------------------------------------------------------------------------------------------


def fetch_source(source: Source) -> int:
    """Fetch, parse and store one feed; returns the number of new items. Errors stay on the source."""
    try:
        page = safe_fetch.fetch(source.feed_url, safe_fetch.FEED_TYPES)
        entries = feeds.parse(page.body, page.url)
    except (safe_fetch.FetchError, feeds.FeedError) as exc:
        logger.warning("feed failed", extra={"source": source.pk, "reason": str(exc)})
        source.last_error = f"{type(exc).__name__}: {exc}"[:500]
        source.last_fetched_at = timezone.now()
        source.save(update_fields=["last_error", "last_fetched_at", "updated_at"])
        return 0
    created = store_entries(source, entries)
    source.last_error, source.last_fetched_at = "", timezone.now()
    source.save(update_fields=["last_error", "last_fetched_at", "updated_at"])
    return created


def store_entries(source: Source, entries: list[feeds.Entry], now: dt.datetime | None = None) -> int:
    """New entries only (dedupe key per owner), newest first; entries older than BRIEF_MAX_AGE_HOURS are
    dropped. Each new item is queued for tagging until the owner's daily cap is reached."""
    moment = now or timezone.now()
    oldest = moment - dt.timedelta(hours=settings.BRIEF_MAX_AGE_HOURS)
    fresh = [e for e in entries if e.published is None or oldest <= e.published <= moment + dt.timedelta(1)]
    fresh.sort(key=lambda e: e.published or moment, reverse=True)
    keys = {feeds.dedupe_key(e.title, e.url): e for e in fresh}
    known = set(
        NewsItem.objects.filter(user_id=source.user_id, dedupe_key__in=keys).values_list(
            "dedupe_key", flat=True
        )
    )
    created = 0
    for key, entry in keys.items():
        if key in known:
            continue
        try:
            with transaction.atomic():
                item = NewsItem.objects.create(
                    user_id=source.user_id,
                    source=source,
                    title=entry.title,
                    url=entry.url,
                    published=entry.published,
                    excerpt=entry.excerpt,
                    dedupe_key=key,
                    tag_status=NewsItem.TagStatus.SKIPPED,
                )
        except IntegrityError:  # stored meanwhile from another source of the owner
            continue
        created += 1
        queue_tagging(item, moment)
    return created


def tagged_today(user_id: int, now: dt.datetime) -> int:
    """Items of the owner fetched today (Prague) that were queued for the LLM."""
    start, end = day_bounds(timezone.localdate(now))
    return (
        NewsItem.objects.filter(user_id=user_id, created_at__gte=start, created_at__lt=end)
        .exclude(tag_status=NewsItem.TagStatus.SKIPPED)
        .count()
    )


def queue_tagging(item: NewsItem, now: dt.datetime) -> bool:
    """Queue the LLM tagging unless the daily cap is reached (the item then stays `skipped`)."""
    if tagged_today(item.user_id, now) >= settings.BRIEF_TAG_DAILY_CAP:
        return False
    item.tag_status = NewsItem.TagStatus.QUEUED
    item.save(update_fields=["tag_status", "updated_at"])
    jobs.enqueue(TAG_JOB, f"{TAG_JOB}:{item.pk}", {"news_item_id": item.pk})
    return True


@jobs.handler(FEEDS_JOB)
def fetch_feeds(payload: dict[str, Any]) -> None:
    for source in Source.objects.filter(active=True).order_by("id"):
        fetch_source(source)


# --- Brief -------------------------------------------------------------------------------------------


def _waiting(day: dt.date) -> bool:
    """Fetching or tagging is still queued, and there is time to wait for it (until BRIEF_WAIT_UNTIL)."""
    if timezone.now() >= local_moment(day, _clock(settings.BRIEF_WAIT_UNTIL)):
        return False
    busy = (Job.Status.PENDING, Job.Status.RUNNING)
    return Job.objects.filter(kind__in=(FEEDS_JOB, TAG_JOB), status__in=busy).exists()


def build_brief(user_id: int, day: dt.date) -> DailyBrief:
    """The day's brief: the BRIEF_MAX_ITEMS most relevant tagged items of the last BRIEF_MAX_AGE_HOURS that no
    other day's brief showed. Building the same day again replaces its items (and keeps a written intro)."""
    since = local_moment(day, _clock(settings.BRIEF_BUILD_TIME)) - dt.timedelta(
        hours=settings.BRIEF_MAX_AGE_HOURS
    )
    picked = list(
        NewsItem.objects.filter(user_id=user_id, tag_status=NewsItem.TagStatus.TAGGED, created_at__gte=since)
        .exclude(brief_entries__brief__date__lt=day)
        .exclude(brief_entries__brief__date__gt=day)
        .order_by(F("relevance").desc(nulls_last=True), F("published").desc(nulls_last=True), "-id")[
            : settings.BRIEF_MAX_ITEMS
        ]
    )
    with transaction.atomic():
        brief, _ = DailyBrief.objects.update_or_create(
            user_id=user_id, date=day, defaults={"generated_at": timezone.now()}
        )
        brief.entries.all().delete()
        BriefEntry.objects.bulk_create(
            BriefEntry(brief=brief, news_item=item, position=n) for n, item in enumerate(picked)
        )
    if picked and not brief.intro and settings.BRIEF_INTRO:
        jobs.enqueue(INTRO_JOB, f"{INTRO_JOB}:{day.isoformat()}:{user_id}", {"brief_id": brief.pk})
    return brief


@jobs.handler(BRIEF_JOB)
def build_briefs(payload: dict[str, Any]) -> None:
    day = dt.date.fromisoformat(payload["date"])
    if _waiting(day):
        raise jobs.RetryLater("feeds or tagging still queued")
    owners = Source.objects.filter(active=True).values_list("user_id", flat=True).distinct()
    for user_id in sorted(set(owners)):
        build_brief(user_id, day)


# --- Reading -----------------------------------------------------------------------------------------


def news(user: User | int) -> QuerySet[NewsItem]:
    return NewsItem.objects.filter(user=user).select_related("source")


def set_feedback(item: NewsItem, feedback: str | None) -> NewsItem:
    """Rate an item (useful / not_useful) or clear the rating with None; `feedback_at` follows."""
    item.feedback = feedback or ""
    item.feedback_at = timezone.now() if feedback else None
    item.save(update_fields=["feedback", "feedback_at", "updated_at"])
    return item


def rated(user: User | int) -> QuerySet[NewsItem]:
    """Items Alex rated, oldest rating first (the golden-set export)."""
    return news(user).exclude(feedback="").order_by("feedback_at", "id")


# What a rating means for `eval brief` (expect.relevance, 1-5): useful items must score high, the rest low.
FEEDBACK_RELEVANCE = {NewsItem.Feedback.USEFUL: [3, 5], NewsItem.Feedback.NOT_USEFUL: [1, 2]}


def golden_case(item: NewsItem) -> dict[str, Any]:
    """A golden-set case in the format of evals/news_tag: only the title and the first 500 characters (what
    the LLM saw), never anything else of Alex's."""
    return {
        "input": {"title": item.title, "source": item.source.name, "text": item.excerpt[:500]},
        "expect": {"relevance": FEEDBACK_RELEVANCE[NewsItem.Feedback(item.feedback)]},
        "feedback": item.feedback,
    }


def brief_of(user: User | int, day: dt.date) -> DailyBrief | None:
    entries = Prefetch(
        "entries",
        queryset=BriefEntry.objects.select_related("news_item__source").order_by("position"),
    )
    return DailyBrief.objects.filter(user=user, date=day).prefetch_related(entries).first()


def week_start(day: dt.date) -> dt.date:
    return day - dt.timedelta(days=day.weekday())


def topic_counts(user: User | int, weeks: int, today: dt.date | None = None) -> list[dict[str, Any]]:
    """Tag counts of the tagged items fetched per ISO week (Prague), oldest week first, the running week
    last. This is the "how often a topic appears in the brief" signal that replaces Exploding Topics (9.2)."""
    current = week_start(today or timezone.localdate())
    first = current - dt.timedelta(weeks=weeks - 1)
    start, _ = day_bounds(first)
    rows = NewsItem.objects.filter(
        user=user, tag_status=NewsItem.TagStatus.TAGGED, created_at__gte=start
    ).values_list("created_at", "tags")
    counts: dict[dt.date, Counter[str]] = {first + dt.timedelta(weeks=n): Counter() for n in range(weeks)}
    totals: Counter[dt.date] = Counter()
    for created_at, tags in rows:
        week = week_start(timezone.localdate(created_at))
        if week in counts:
            counts[week].update(set(tags))
            totals[week] += 1
    return [
        {
            "week": f"{week.isocalendar().year}-W{week.isocalendar().week:02d}",
            "start": week,
            "items": totals[week],
            "topics": [{"tag": t, "count": n} for t, n in sorted(c.items(), key=lambda kv: (-kv[1], kv[0]))],
        }
        for week, c in counts.items()
    ]


def new_tools(user: User | int, month: dt.date, limit: int = 20) -> list[NewsItem]:
    """Items fetched in the month and flagged "new tool/skill", most relevant first (market mirror, 9.2)."""
    start, _ = day_bounds(month)
    end, _ = day_bounds((month + dt.timedelta(days=32)).replace(day=1))
    rows = news(user).filter(new_tool=True, created_at__gte=start, created_at__lt=end)
    return list(rows.order_by(F("relevance").desc(nulls_last=True), "-created_at", "-id")[:limit])
