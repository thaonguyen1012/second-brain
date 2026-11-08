"""Links between notes and the rest of the brain (DECISIONS 9.8, `[[ ]]`): the editor's picker writes a
readable markdown link such as `[Atomic Habits](/thu-vien/item/?id=12)`; every save of a note reads its links
into NoteLink rows (the note's backlinks for "Được nhắc tới ở"), and a link to an Item also links the note to
that Item.

The markdown stays the only source (DECISIONS 4.1, 4.7): the rows are rebuilt from it on each save, links
inside code are not links, and an id that is unknown or another owner's is ignored. Kept apart from
library.services because it reads the opportunities and growth apps, which depend on library."""

import re
from collections import defaultdict
from urllib.parse import parse_qs, urlsplit

from django.db import transaction

from growth.models import Skill
from library.models import Item, Note, NoteLink
from opportunities.models import Opportunity

# The app's deep links, as the picker writes them (web/lib/note-links.ts); a language prefix (/en, /vi) is
# allowed.
PATHS: dict[str, str] = {
    "/thu-vien/item/": NoteLink.Kind.ITEM,
    "/thu-vien/ghi-chu/": NoteLink.Kind.NOTE,
    "/co-hoi/": NoteLink.Kind.OPPORTUNITY,
    "/phat-trien/ky-nang/": NoteLink.Kind.SKILL,
}
_LANG = re.compile(r"^/(?:vi|en)(?=/)")
# Fenced code (``` or ~~~, up to the same fence or the end) and code spans are not links.
_FENCE = re.compile(
    r"^[ \t]{0,3}(`{3,}|~{3,})[^\n]*\n.*?(?:^[ \t]{0,3}\1[ \t]*$|\Z)", re.MULTILINE | re.DOTALL
)
_CODE_SPAN = re.compile(r"(`+)(?!`).+?(?<!`)\1(?!`)", re.DOTALL)
# The destination of an inline link: ](url) or ](<url>), with an optional "title". A `]` escaped in the link's
# text (`\]`, as the editor writes a title holding one) is no end of a link.
_DESTINATION = re.compile(r"(?<!\\)(?:\\\\)*\]\(\s*<?([^)\s>]+)>?(?:\s+\"[^\"]*\")?\s*\)")


def parse_links(markdown: str) -> dict[str, set[int]]:
    """The ids each kind of deep link names in `markdown`, code left out: {"item": {12}, "note": {3}, ...}."""
    text = _CODE_SPAN.sub(" ", _FENCE.sub(" ", markdown))
    found: dict[str, set[int]] = defaultdict(set)
    for match in _DESTINATION.finditer(text):
        url = urlsplit(match.group(1))
        if url.scheme or url.netloc:
            continue
        path = _LANG.sub("", url.path)
        if not path.endswith("/"):
            path += "/"
        kind = PATHS.get(path)
        ids = parse_qs(url.query).get("id", [])
        if kind and ids and ids[0].isdigit():
            found[kind].add(int(ids[0]))
    return dict(found)


def sync_links(note: Note) -> None:
    """Replace the note's NoteLink rows with the links in its markdown (the owner's rows only, never the note
    itself) and add the linked Items to the note's Items. Run inside the save's transaction; a fixed number of
    queries."""
    ids = parse_links(note.markdown)
    user = note.user_id
    items = list(Item.objects.filter(user=user, pk__in=ids.get(NoteLink.Kind.ITEM, ())))
    notes = Note.objects.filter(user=user, pk__in=ids.get(NoteLink.Kind.NOTE, ())).exclude(pk=note.pk)
    opportunities = Opportunity.objects.filter(user=user, pk__in=ids.get(NoteLink.Kind.OPPORTUNITY, ()))
    skills = Skill.objects.filter(user=user, pk__in=ids.get(NoteLink.Kind.SKILL, ()))
    rows = [
        *(NoteLink(note=note, kind=NoteLink.Kind.ITEM, item=item) for item in items),
        *(NoteLink(note=note, kind=NoteLink.Kind.NOTE, target_note=other) for other in notes.only("pk")),
        *(
            NoteLink(note=note, kind=NoteLink.Kind.OPPORTUNITY, opportunity=o)
            for o in opportunities.only("pk")
        ),
        *(NoteLink(note=note, kind=NoteLink.Kind.SKILL, skill=skill) for skill in skills.only("pk")),
    ]
    with transaction.atomic():
        NoteLink.objects.filter(note=note).delete()
        NoteLink.objects.bulk_create(rows)
        if items:
            note.items.add(*items)
