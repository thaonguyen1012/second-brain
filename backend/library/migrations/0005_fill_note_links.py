"""Read the links already written in notes into NoteLink (the rows library.links keeps up to date on every save from
now on). A frozen copy of the parser: a migration never imports app code that may change later. Reversing it keeps
the rows; reversing 0004 drops them."""

import re
from collections import defaultdict
from urllib.parse import parse_qs, urlsplit

from django.db import migrations

PATHS = {
    "/thu-vien/item/": "item",
    "/thu-vien/ghi-chu/": "note",
    "/co-hoi/": "opportunity",
    "/phat-trien/ky-nang/": "skill",
}
_LANG = re.compile(r"^/(?:vi|en)(?=/)")
_FENCE = re.compile(r"^[ \t]{0,3}(`{3,}|~{3,})[^\n]*\n.*?(?:^[ \t]{0,3}\1[ \t]*$|\Z)", re.MULTILINE | re.DOTALL)
_CODE_SPAN = re.compile(r"(`+)(?!`).+?(?<!`)\1(?!`)", re.DOTALL)
_DESTINATION = re.compile(r"\]\(\s*<?([^)\s>]+)>?(?:\s+\"[^\"]*\")?\s*\)")


def parse(markdown):  # type: ignore[no-untyped-def]
    found = defaultdict(set)
    for match in _DESTINATION.finditer(_CODE_SPAN.sub(" ", _FENCE.sub(" ", markdown))):
        url = urlsplit(match.group(1))
        if url.scheme or url.netloc:
            continue
        path = _LANG.sub("", url.path)
        path = path if path.endswith("/") else path + "/"
        ids = parse_qs(url.query).get("id", [])
        if path in PATHS and ids and ids[0].isdigit():
            found[PATHS[path]].add(int(ids[0]))
    return found


def fill(apps, schema_editor):  # type: ignore[no-untyped-def]
    Note = apps.get_model("library", "Note")
    Item = apps.get_model("library", "Item")
    NoteLink = apps.get_model("library", "NoteLink")
    Opportunity = apps.get_model("opportunities", "Opportunity")
    Skill = apps.get_model("growth", "Skill")
    targets = {"item": (Item, "item"), "note": (Note, "target_note"), "opportunity": (Opportunity, "opportunity")}
    targets["skill"] = (Skill, "skill")
    for note in Note.objects.filter(markdown__contains="?id=").iterator():
        rows = []
        for kind, ids in parse(note.markdown).items():
            model, field = targets[kind]
            found = model.objects.filter(user_id=note.user_id, pk__in=ids)
            if kind == "note":
                found = found.exclude(pk=note.pk)
            for target in found:
                rows.append(NoteLink(note=note, kind=kind, **{field: target}))
                if kind == "item":
                    note.items.add(target)
        NoteLink.objects.bulk_create(rows)


class Migration(migrations.Migration):
    dependencies = [("library", "0004_note_link")]

    operations = [migrations.RunPython(fill, migrations.RunPython.noop)]
