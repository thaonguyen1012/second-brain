import importlib
import time

import pytest
from django.apps import apps
from django.contrib.auth.models import User
from django.db import connection
from django.test import Client
from django.test.utils import CaptureQueriesContext

from core.testing import csrf, send
from growth.models import Skill
from library.links import parse_links
from library.models import Item, Note, NoteLink
from library.services import note_excerpt, note_label
from opportunities.models import Opportunity

pytestmark = pytest.mark.django_db


def owner(client: Client) -> User:
    client.get("/api/me")
    return User.objects.get(username="dev@localhost")


def stranger() -> User:
    return User.objects.get_or_create(username="other@x", email="other@x")[0]


def links_of(note_id: int) -> set[tuple[str, int]]:
    rows = NoteLink.objects.filter(note_id=note_id)
    return {(r.kind, r.item_id or r.target_note_id or r.opportunity_id or r.skill_id or 0) for r in rows}


def test_parse_links_reads_the_deep_links_outside_code() -> None:
    markdown = (
        'Xem [Atomic Habits](/thu-vien/item/?id=12), [ý](/thu-vien/ghi-chu/?id=3 "tiêu đề"),\n'
        "[cơ hội](</co-hoi/?id=7>) và [kỹ năng](/en/phat-trien/ky-nang/?id=5).\n"
        "Không phải: [ngoài](https://example.com/thu-vien/item/?id=9), [sai](/thu-vien/item/?id=abc), "
        "[khác](/tuan/?id=4), `[code](/thu-vien/item/?id=10)`\n\n"
        "```\n[fence](/thu-vien/item/?id=11)\n```\n"
    )
    assert parse_links(markdown) == {"item": {12}, "note": {3}, "opportunity": {7}, "skill": {5}}
    assert parse_links("") == {}


def test_an_escaped_bracket_in_a_links_text_is_no_link() -> None:
    """A title such as `x](/thu-vien/item/?id=99) y` is written with its brackets escaped: one link."""
    escaped = r"[x\](/thu-vien/item/?id=99) y](/thu-vien/item/?id=115)"
    assert parse_links(escaped) == {"item": {115}}
    # an escaped backslash right before the bracket does end the text
    assert parse_links(r"[C:\\](/thu-vien/item/?id=7)") == {"item": {7}}


def test_code_spans_are_read_as_commonmark_does() -> None:
    """An escaped backtick opens no code span, a span ends with its paragraph, and a backslash is plain
    inside one."""
    link = "[A](/thu-vien/item/?id=7)"
    assert parse_links(f"Phím \\` mở console.\n\nXem {link} và `npm run dev` nhé") == {"item": {7}}
    assert parse_links(f"Phím ` mở.\n\nXem {link} và `x` nhé") == {"item": {7}}
    assert parse_links(f"[Don\\`t]({link[4:-1]}) và `npm run dev`") == {"item": {7}}
    assert parse_links(f"- a `x\n- {link} b` c") == {"item": {7}}
    assert parse_links(f"`C:\\` {link} `y`") == {"item": {7}}
    assert parse_links(f"`a {link} b`") == {}
    # a closing fence may be longer than the opening one
    assert parse_links(f"````\n[f](/thu-vien/item/?id=4)\n`````\n{link}") == {"item": {7}}


def test_odd_link_destinations_are_ignored() -> None:
    """Superscript digits, a huge id or a bracket in the host never fail a save; `?x=1&id=8` is read."""
    huge = "9" * 5000
    odd = f"[1](/thu-vien/item/?id=²) [a](http://[x) [b](https://[a-z]+) [c](/thu-vien/item/?id={huge})"
    assert parse_links(odd + " [d](/thu-vien/item/?x=1&id=8)") == {"item": {8}}


@pytest.mark.parametrize(
    "text", ["](" * 100_000, "[a](b " * 33_000, "`" * 200_000, "` `` ``` " * 20_000, "[" * 200_000]
)
def test_parsing_stays_linear_on_pathological_text(text: str) -> None:
    started = time.monotonic()
    parse_links(text)
    note_excerpt(text, "x")
    note_label(Note(title="", markdown=text))
    assert time.monotonic() - started < 2


def test_a_note_may_link_more_than_fifty_items(client: Client) -> None:
    """The Item field sends the whole list: it keeps working when the text links many Items."""
    headers = csrf(client)
    user = owner(client)
    books = Item.objects.bulk_create(Item(user=user, type="book", title=f"B{i}") for i in range(55))
    text = " ".join(f"[B](/thu-vien/item/?id={b.pk})" for b in books)
    note = send(client, "post", "/api/notes", {"markdown": text}, headers).json()
    assert len(note["items"]) == 55
    project = Item.objects.create(user=user, type="project", title="P")
    more = {"items": [*note["items"], project.pk]}
    answer = send(client, "patch", f"/api/notes/{note['id']}", more, headers)
    assert answer.status_code == 200 and len(answer.json()["items"]) == 56


def test_saving_a_note_reads_its_links_and_links_the_items(client: Client) -> None:
    headers = csrf(client)
    user = owner(client)
    book = Item.objects.create(user=user, type="book", title="Atomic Habits")
    film = Item.objects.create(user=user, type="film", title="Dune")
    other = Note.objects.create(user=user, markdown="khác")
    opp = Opportunity.objects.create(user=user, title="Habit coach", hypothesis="h")
    skill = Skill.objects.create(user=user, name="Django", key="django")
    theirs = Item.objects.create(user=stranger(), type="book", title="Not yours")
    body = {
        "markdown": f"[A](/thu-vien/item/?id={book.pk}) [B](/thu-vien/ghi-chu/?id={other.pk}) "
        f"[C](/co-hoi/?id={opp.pk}) [D](/phat-trien/ky-nang/?id={skill.pk}) "
        f"[x](/thu-vien/item/?id={theirs.pk}) [y](/thu-vien/item/?id=999999)",
        "items": [film.pk],
    }
    created = send(client, "post", "/api/notes", body, headers)
    assert created.status_code == 201
    note = created.json()
    # unknown and foreign ids are ignored; the linked Item joins the note's Items
    assert links_of(note["id"]) == {
        ("item", book.pk),
        ("note", other.pk),
        ("opportunity", opp.pk),
        ("skill", skill.pk),
    }
    assert note["items"] == sorted([book.pk, film.pk])

    # an edit replaces the rows; a link to itself is no link; replacing `items` keeps the Items the text links
    patch = {
        "markdown": f"[A](/thu-vien/item/?id={book.pk}) [me](/thu-vien/ghi-chu/?id={note['id']})",
        "items": [],
    }
    edited = send(client, "patch", f"/api/notes/{note['id']}", patch, headers).json()
    assert links_of(note["id"]) == {("item", book.pk)}
    assert edited["items"] == [book.pk]

    # a deleted target takes its link row with it
    book.delete()
    assert links_of(note["id"]) == set()


def test_a_title_change_alone_does_not_touch_the_links(client: Client) -> None:
    headers = csrf(client)
    user = owner(client)
    book = Item.objects.create(user=user, type="book", title="Atomic Habits")
    note = send(
        client, "post", "/api/notes", {"markdown": f"[A](/thu-vien/item/?id={book.pk})"}, headers
    ).json()
    with CaptureQueriesContext(connection) as queries:
        send(client, "patch", f"/api/notes/{note['id']}", {"title": "Mới"}, headers)
    assert not any("library_notelink" in q["sql"] for q in queries.captured_queries)
    assert links_of(note["id"]) == {("item", book.pk)}


def test_saving_uses_the_same_queries_for_few_or_many_links(client: Client) -> None:
    headers = csrf(client)
    user = owner(client)
    items = [Item.objects.create(user=user, type="book", title=f"b{i}") for i in range(8)]
    note = send(client, "post", "/api/notes", {"markdown": "x"}, headers).json()

    def queries(n: int) -> int:
        text = " ".join(f"[b](/thu-vien/item/?id={i.pk})" for i in items[:n])
        with CaptureQueriesContext(connection) as captured:
            assert (
                send(client, "patch", f"/api/notes/{note['id']}", {"markdown": text}, headers).status_code
                == 200
            )
        return len(captured)

    assert queries(1) == queries(8)


def test_mentions_list_the_notes_that_link_an_item_or_a_note(client: Client) -> None:
    headers = csrf(client)
    user = owner(client)
    book = Item.objects.create(user=user, type="book", title="Atomic Habits")
    target = send(client, "post", "/api/notes", {"title": "Đích", "markdown": "x"}, headers).json()
    first = send(
        client,
        "post",
        "/api/notes",
        {"markdown": f"## Ý chính\n\n[A](/thu-vien/item/?id={book.pk})"},
        headers,
    )
    second = send(
        client,
        "post",
        "/api/notes",
        {
            "title": "Hai",
            "markdown": f"[A](/thu-vien/item/?id={book.pk}) [Đ](/thu-vien/ghi-chu/?id={target['id']})",
        },
        headers,
    )
    data = client.get(f"/api/items/{book.pk}/mentions").json()
    assert [(n["id"], n["title"]) for n in data["notes"]] == [
        (second.json()["id"], "Hai"),
        (first.json()["id"], "Ý chính"),
    ]
    backlinks = client.get(f"/api/notes/{target['id']}/mentions").json()
    assert [n["title"] for n in backlinks["notes"]] == ["Hai"] and set(backlinks["notes"][0]) == {
        "id",
        "title",
        "updatedAt",
    }
    theirs = Note.objects.create(user=stranger(), markdown="x")
    assert client.get(f"/api/notes/{theirs.pk}/mentions").status_code == 404


def test_note_mentions_need_a_login(anon_client: Client) -> None:
    assert anon_client.get("/api/notes/1/mentions").status_code == 401


def test_the_migration_reads_the_links_of_existing_notes() -> None:
    user = User.objects.create(username="owner@x")
    book = Item.objects.create(user=user, type="book", title="Atomic Habits")
    note = Note.objects.create(
        user=user, markdown=f"[A](/thu-vien/item/?id={book.pk}) [x](/thu-vien/item/?id=0)"
    )
    Note.objects.create(user=user, markdown="no links")
    fill = importlib.import_module("library.migrations.0005_fill_note_links").fill
    fill(apps, None)
    assert links_of(note.pk) == {("item", book.pk)}
    assert list(note.items.all()) == [book]
