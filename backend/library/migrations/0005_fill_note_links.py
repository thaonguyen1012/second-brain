"""Read the links already written in notes into NoteLink (the rows library.links keeps up to date on every save from
now on). A frozen copy of the parser: a migration never imports app code that may change later. Reversing it keeps
the rows; reversing 0004 drops them."""

import re
from bisect import bisect_left
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
_FENCE = re.compile(r"^[ \t]{0,3}(([`~])\2{2,}+)[^\n]*+\n.*?(?:^[ \t]{0,3}\1\2*[ \t]*$|\Z)", re.MULTILINE | re.DOTALL)
_TICK_OR_ESCAPE = re.compile(r"\\.|`+", re.DOTALL)
_TICKS = re.compile(r"`+")
_BLOCK_START = re.compile(r"\n(?:[ \t]*\n|[ \t]*(?:[-*+]|\d{1,9}[.)])[ \t]|[ \t]{0,3}(?:#{1,6}[ \t]|>))")
_DESTINATION = re.compile(r"(?<!\\)(?:\\\\)*\]\(\s*(?:<([^<>\n]*)>|([^()\s<>\[\]]+))(?:\s+\"[^\"\n]*\")?\s*\)")


def without_code(markdown):  # type: ignore[no-untyped-def]
    text = _FENCE.sub(" ", markdown)
    runs = defaultdict(list)
    for run in _TICKS.finditer(text):
        runs[len(run.group())].append(run.start())
    out = []
    copied = pos = 0
    while opener := _TICK_OR_ESCAPE.search(text, pos):
        pos = opener.end()
        if opener.group().startswith("\\"):
            continue
        length = len(opener.group())
        same = runs[length]
        at = bisect_left(same, pos)
        if at == len(same) or _BLOCK_START.search(text, pos, same[at]):
            continue
        out += [text[copied : opener.start()], " "]
        copied = pos = same[at] + length
    out.append(text[copied:])
    return "".join(out)


def parse(markdown):  # type: ignore[no-untyped-def]
    found = defaultdict(set)
    for match in _DESTINATION.finditer(without_code(markdown)):
        try:
            url = urlsplit(match.group(1) if match.group(1) is not None else match.group(2))
        except ValueError:
            continue
        if url.scheme or url.netloc:
            continue
        path = _LANG.sub("", url.path)
        path = path if path.endswith("/") else path + "/"
        ids = parse_qs(url.query).get("id", [])
        if path in PATHS and ids and ids[0].isascii() and ids[0].isdigit() and len(ids[0]) <= 18:
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
    for note in Note.objects.filter(markdown__contains="id=").iterator():
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
