"""Where an Item is used (DECISIONS 9.8 "Được nhắc tới ở"): the owner's opportunities and skills that hold the
Item as evidence. Notes that link the Item with [[ ]] join here once the links are read out of the markdown
(9.8, order point 3).

Kept apart from library.services: it reads the opportunities and growth apps, which depend on library.
"""

import datetime as dt
from typing import Any

from django.contrib.auth.models import User

from growth.models import Freshness, Skill, SkillEvidence
from growth.services import with_freshness
from library.models import Item
from opportunities.models import Evidence


def item_mentions(user: User, item: Item, today: dt.date | None = None) -> dict[str, list[dict[str, Any]]]:
    """The opportunities that use `item` as evidence, each with those evidence rows (stance, title, note,
    date), and the skills that do, each with its freshness (from all its evidence, as on Kỹ năng) and those
    rows. Both lists follow their newest evidence date. Three queries whatever the number of rows (opportunity
    evidence, skill evidence, the skills' freshness); only the owner's rows."""
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
    return {"opportunities": list(opportunities.values()), "skills": list(skills.values())}
