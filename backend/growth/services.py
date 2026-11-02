"""Development (DECISIONS 9.2, step 5 of 9.4): the skills matrix with fading evidence and the market mirror.

"Not falling behind" is a mirror, not numbers (9.1): a skill is fresh, aging or faded by the date of its
newest evidence (3 and 6 months), and the monthly market report lists the skills the pasted job ads ask for
next to that freshness, plus the month's morning-brief items flagged "new tool/skill". Matching is exact on
normalised names plus the aliases of each skill (DECISIONS 4.5).
"""

import calendar
import datetime as dt
import hashlib
from collections import Counter
from typing import Any

from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Case, CharField, Count, Max, QuerySet, Value, When
from django.utils import timezone

from brief.services import new_tools
from core.models import Job
from core.services import jobs
from growth.models import Freshness, JobAd, Skill, SkillEvidence

AGING_AFTER_MONTHS = 3
FADED_AFTER_MONTHS = 6  # "no new evidence for 6 months: the skill fades" (DECISIONS 9.2)
SKILL_FIELDS = ("name", "aliases", "note")
EVIDENCE_FIELDS = ("title", "url", "note", "date")
JOB_AD_FIELDS = ("title", "company", "url", "text", "month")
JD_JOB = "jd_skills"


class SkillConflict(Exception):
    """The name or an alias already belongs to another skill of the owner."""


def normalize_skill(name: str) -> str:
    """Lowercase, single spaces, no surrounding punctuation: "  React.js, " -> "react.js"."""
    return " ".join(name.lower().split()).strip(" .,;:-*\"'")[:60]


def month_start(day: dt.date) -> dt.date:
    return day.replace(day=1)


def months_before(day: dt.date, months: int) -> dt.date:
    year, month = divmod(day.year * 12 + day.month - 1 - months, 12)
    return dt.date(year, month + 1, min(day.day, calendar.monthrange(year, month + 1)[1]))


# --- Skills -----------------------------------------------------------------------------------------


def with_freshness[Q: QuerySet[Skill]](rows: Q, today: dt.date | None = None) -> Q:
    """Annotate `last_evidence_on` and `freshness` (fresh / aging / faded) as of `today` (Prague)."""
    day = today or timezone.localdate()
    annotated: Q = rows.annotate(
        last_evidence_on=Max("evidence__date"),
        freshness=Case(
            When(last_evidence_on__gt=months_before(day, AGING_AFTER_MONTHS), then=Value(Freshness.FRESH)),
            When(last_evidence_on__gt=months_before(day, FADED_AFTER_MONTHS), then=Value(Freshness.AGING)),
            default=Value(Freshness.FADED),
            output_field=CharField(),
        ),
    )
    return annotated


def skills(user: User | int, today: dt.date | None = None) -> QuerySet[Skill]:
    rows = with_freshness(Skill.objects.filter(user=user), today)
    return rows.annotate(evidence_count=Count("evidence"))


def skill_keys(name: str, aliases: list[str]) -> tuple[str, list[str]]:
    key = normalize_skill(name)
    clean: list[str] = []
    for alias in aliases:
        alias = normalize_skill(alias)
        if alias and alias != key and alias not in clean:
            clean.append(alias)
    return key, clean


def _check_free(skill: Skill) -> None:
    """Name and aliases must not match another skill's name or aliases (matching stays unambiguous)."""
    wanted = {skill.key, *skill.aliases}
    others = Skill.objects.filter(user=skill.user).exclude(pk=skill.pk).values_list("key", "aliases")
    for key, aliases in others:
        if wanted & {key, *aliases}:
            raise SkillConflict(", ".join(sorted(wanted & {key, *aliases})))


def save_skill(skill: Skill, data: dict[str, Any]) -> Skill:
    """Create (unsaved `skill`) or update; raises SkillConflict."""
    for field in SKILL_FIELDS:
        if field in data:
            setattr(skill, field, data[field])
    skill.name = " ".join(skill.name.split())
    skill.key, skill.aliases = skill_keys(skill.name, skill.aliases)
    if not skill.key:
        raise SkillConflict("empty name")
    with transaction.atomic():
        _check_free(skill)
        skill.save()
    return skill


def add_evidence(skill: Skill, data: dict[str, Any]) -> SkillEvidence:
    fields = {f: data[f] for f in (*EVIDENCE_FIELDS, "kind", "item", "library_note") if f in data}
    if not fields.get("title"):
        linked = data.get("item") or data.get("library_note")
        fields["title"] = str(getattr(linked, "title", "") or linked or "")[:300]
    return SkillEvidence.objects.create(skill=skill, **fields)


def update_evidence(evidence: SkillEvidence, data: dict[str, Any]) -> SkillEvidence:
    fields = [f for f in EVIDENCE_FIELDS if f in data]
    for field in fields:
        setattr(evidence, field, data[field])
    evidence.save(update_fields=[*fields, "updated_at"])
    return evidence


# --- Job ads ----------------------------------------------------------------------------------------


def digest(ad: JobAd) -> str:
    """What the extraction reads; a change re-runs it."""
    return hashlib.sha256(f"{ad.title}\n{ad.company}\n{ad.text}".encode()).hexdigest()[:16]


def enqueue_extraction(ad: JobAd) -> None:
    """Idempotent per ad and text; text edited back to an earlier version re-runs that version's job."""
    job = jobs.enqueue(JD_JOB, f"{JD_JOB}:{ad.pk}:{digest(ad)}", {"job_ad_id": ad.pk, "digest": digest(ad)})
    if job.status in (Job.Status.DONE, Job.Status.FAILED):
        job.status, job.attempts, job.run_after = Job.Status.PENDING, 0, timezone.now()
        job.save(update_fields=["status", "attempts", "run_after", "updated_at"])


def create_job_ad(user: User, data: dict[str, Any]) -> JobAd:
    """Store the ad and return at once; the skills are extracted later by `run_jobs`."""
    with transaction.atomic():
        ad = JobAd(user=user, **{f: data[f] for f in JOB_AD_FIELDS if f in data})
        if "month" not in data:
            ad.month = month_start(timezone.localdate())
        if "skills" in data:  # typed by hand: no extraction
            ad.skills, ad.processed, ad.processed_at = _clean(data["skills"]), True, timezone.now()
        ad.save()
        if not ad.processed:
            enqueue_extraction(ad)
    return ad


def update_job_ad(ad: JobAd, data: dict[str, Any]) -> JobAd:
    """Edited text re-runs the extraction, unless `skills` is sent too (a hand correction wins)."""
    before = digest(ad)
    fields = [f for f in JOB_AD_FIELDS if f in data]
    for field in fields:
        setattr(ad, field, data[field])
    with transaction.atomic():
        if "skills" in data:
            ad.skills, ad.processed, ad.processed_at, ad.error = (
                _clean(data["skills"]),
                True,
                timezone.now(),
                "",
            )
            fields += ["skills", "processed", "processed_at", "error"]
        elif digest(ad) != before:
            ad.skills, ad.seniority, ad.processed, ad.processed_at, ad.error = [], "", False, None, ""
            fields += ["skills", "seniority", "processed", "processed_at", "error"]
        ad.save(update_fields=[*fields, "updated_at"])
        if not ad.processed:
            enqueue_extraction(ad)
    return ad


def _clean(names: list[str]) -> list[str]:
    result: list[str] = []
    for name in names:
        clean = normalize_skill(name)
        if clean and clean not in result:
            result.append(clean)
    return result


# --- Market report ----------------------------------------------------------------------------------


def _index(user: User | int, today: dt.date | None) -> dict[str, Skill]:
    """Normalised name and aliases -> skill (annotated with freshness)."""
    index: dict[str, Skill] = {}
    for skill in with_freshness(Skill.objects.filter(user=user), today):
        for key in (skill.key, *skill.aliases):
            index.setdefault(key, skill)
    return index


def _counts(ads: list[JobAd], index: dict[str, Skill]) -> tuple[Counter[str], dict[str, str]]:
    """How many ads ask for each skill (once per ad); a matched name counts under its skill's key."""
    counts: Counter[str] = Counter()
    names: dict[str, str] = {}
    for ad in ads:
        seen: set[str] = set()
        for name in ad.skills:
            skill = index.get(normalize_skill(name))
            group = skill.key if skill else normalize_skill(name)
            names.setdefault(group, skill.name if skill else group)
            seen.add(group)
        counts.update(seen)
    return counts, names


def _mirror(skill: Skill) -> dict[str, Any]:
    """The skill as the report shows it (annotated by `with_freshness`)."""
    return {
        "id": skill.pk,
        "name": skill.name,
        "freshness": getattr(skill, "freshness", Freshness.FADED),
        "lastEvidenceOn": getattr(skill, "last_evidence_on", None),
    }


def market_report(user: User | int, month: dt.date, today: dt.date | None = None) -> dict[str, Any]:
    """Skill frequency in the month's processed job ads, against the previous month and the skills matrix.

    A gap is a skill the market asks for with no skill row, or whose skill has faded (no evidence for 6
    months); an aging skill is shown with its freshness but is not a gap.
    """
    previous = months_before(month, 1)
    rows = list(
        JobAd.objects.filter(user=user, month__in=(month, previous)).only(
            "month", "skills", "processed", "seniority"
        )
    )
    current = [a for a in rows if a.month == month]
    done = [a for a in current if a.processed]
    index = _index(user, today)
    counts, names = _counts(done, index)
    before, _ = _counts([a for a in rows if a.month == previous and a.processed], index)
    by_key = {s.key: s for s in index.values()}
    lines = []
    for group, count in sorted(counts.items(), key=lambda kv: (-kv[1], names[kv[0]].casefold())):
        skill = by_key.get(group)
        freshness = getattr(skill, "freshness", None)
        lines.append(
            {
                "name": names[group],
                "count": count,
                "previousCount": before[group],
                "skill": _mirror(skill) if skill else None,
                "gap": freshness in (None, Freshness.FADED),
            }
        )
    seniority = Counter(a.seniority for a in done if a.seniority)
    return {
        "month": month,
        "jobAds": len(current),
        "processed": len(done),
        "seniority": [{"level": level, "count": n} for level, n in seniority.most_common()],
        "skills": lines,
        "gaps": [line for line in lines if line["gap"]],
        "newTools": new_tools(user, month),  # morning-brief items flagged "new tool/skill" (9.2)
    }
