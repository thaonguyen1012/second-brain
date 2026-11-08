"""Where an Item or a note is used (DECISIONS 9.8 "Được nhắc tới ở"): the owner's opportunities and skills
that hold an Item as evidence, and the notes that link an Item or a note in their text (`[[ ]]`,
library.links).

Kept apart from library.services: it reads the opportunities and growth apps, which depend on library."""

import datetime as dt
from typing import Any

from django.contrib.auth.models import User

from growth.models import Freshness, Skill, SkillEvidence
from growth.services import with_freshness
from library.models import Item, Note, NoteLink
from library.services import note_label
from opportunities.models import Evidence


def linking_notes(user: User, **target: Item | Note) -> list[dict[str, Any]]:
    """The owner's notes whose text links `target` (item=... or target_note=...), most recently changed first,
    as {id, title, updatedAt}: one query."""
    rows = (
        Note.objects.filter(user=user, links__in=NoteLink.objects.filter(**target))
        .distinct()
        .only("id", "title", "markdown", "updated_at")
        .order_by("-updated_at", "-id")
    )
    return [{"id": n.pk, "title": note_label(n), "updatedAt": n.updated_at} for n in rows]


def note_mentions(user: User, note: Note) -> dict[str, list[dict[str, Any]]]:
    """The notes that link `note` in their text (its backlinks)."""
    return {"notes": linking_notes(user, target_note=note)}


def item_mentions(user: User, item: Item, today: dt.date | None = None) -> dict[str, list[dict[str, Any]]]:
    """The opportunities that use `item` as evidence, each with those evidence rows (stance, title, note,
    date), the skills that do, each with its freshness (from all its evidence, as on Kỹ năng) and those rows,
    and the notes that link it in their text. The first two follow their newest evidence date. Four queries
    whatever the number of rows (opportunity evidence, skill evidence, the skills' freshness, the notes); only
    the owner's rows."""
    opportunities: dict[int, dict[str, Any]] = {}
    rows = (
        Evidence.objects.filter(item=item, opportunity__user=user)
        .select_related("opportunity")
        .order_by("-date", "-id")
    )
    for evidence in rows:
        opp = evidence.opportunity
        entry = opportunities.setdefault(
            opp.pk, {"id": opp.pk, "title": opp.title, "decision": opp.decision, "evidence": []}
        )
        entry["evidence"].append(
            {
                "id": evidence.pk,
                "stance": evidence.stance,
                "title": evidence.title,
                "note": evidence.note,
                "date": evidence.date,
            }
        )

    skill_rows = list(SkillEvidence.objects.filter(item=item, skill__user=user).order_by("-date", "-id"))
    ids = {row.skill_id for row in skill_rows}
    by_id = {s.pk: s for s in with_freshness(Skill.objects.filter(pk__in=ids), today)} if ids else {}
    skills: dict[int, dict[str, Any]] = {}
    for row in skill_rows:
        skill = by_id[row.skill_id]
        freshness = getattr(skill, "freshness", Freshness.FADED)
        entry = skills.setdefault(
            skill.pk, {"id": skill.pk, "name": skill.name, "freshness": freshness, "evidence": []}
        )
        entry["evidence"].append({"id": row.pk, "title": row.title, "note": row.note, "date": row.date})
    return {
        "opportunities": list(opportunities.values()),
        "skills": list(skills.values()),
        "notes": linking_notes(user, item=item),
    }
