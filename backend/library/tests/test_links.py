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


L = "[A](/thu-vien/item/?id=7)"
U = "/thu-vien/item/?id=7"
WIKI = "https://en.wikipedia.org/wiki/Atomic_Habits_\\(book\\)"  # as the editor writes the url
# Each pair: markdown and the links the reading view (react-markdown with remark-gfm) shows in it.
READING_VIEW = [
    # fenced code inside a quote or a list item, nested too, ends with its fence or its container
    (f"> ```\n> {L}\n> ```", {}),
    (f"- a\n  - ```\n    - b\n    {L}\n    ```", {}),
    (f"- a\n  - ```\n    x\n\n    {L}\n    ```", {}),
    (f"- > ```\n  > {L}\n  > ```", {}),
    (f"- ```\n  {L}\n  ```", {}),
    (f"- ```\n  code\n  ```\n\nXem {L}", {"item": {7}}),
    (f"> ```\n> code\n\n{L}", {"item": {7}}),
    (f"- a\n\n  ```\n  code\n\n{L}", {"item": {7}}),
    (f"> - ```\n>   {L}\n> - [B](/thu-vien/item/?id=8)", {"item": {8}}),
    # a code span ends with its paragraph: a blank line (CRLF too), a thematic break or setext underline, a
    # list item that may interrupt it (ASCII digits, `1.` only), not a lazy line
    (f"a `x\r\n\r\n{L} y`", {"item": {7}}),
    (f"a `x\n***\ny` {L} `z`", {}),
    (f"a `x\n---\n{L} y` z", {"item": {7}}),
    (f"a `x\n\u0661. {L} y`", {}),  # an Arabic-Indic digit is no list number
    (f"a `x\n2. {L} y` z", {}),
    (f"> a `x\n{L} y` z", {}),
    # a link needs an unescaped `[`, no image, and holds no link
    (f"foo]({U})", {}),
    (f"\\[x]({U})", {}),
    (f"![x]({U})", {}),
    (f"[[x](/thu-vien/item/?id=8)]({U})", {"item": {8}}),
    (f"![a [b]({U}) c](/i.png)", {}),
    (f"[![a](/i.png)]({U})", {"item": {7}}),
    (f"[a [b]() c]({U})", {}),
    # HTML and indented code hold no links; a paragraph's indented line is no code
    (f"<div>\n{L}\n</div>", {}),
    (f"<br />\n{L}", {}),
    (f"<br />\n\n{L}", {"item": {7}}),
    (f"para\n\n    {L}", {}),
    (f"para\n    {L}", {"item": {7}}),
    (f"a <!-- {L} --> b", {}),
    (f'a <span title="{L}"> b', {}),
    # tables split cells before code spans; references, titles and autolinks as CommonMark reads them
    (f"| a | b | c |\n| - | - | - |\n| `x | {L} | y` |", {"item": {7}}),
    (f"a `x\n| b | c |\n| - | - |\n| {L} y` |", {"item": {7}}),
    (f"[Sách][r]\n\n[r]: {U}", {"item": {7}}),
    (f"[r][]\n\n[R]: {U}", {"item": {7}}),
    (f"[Sách][nope]\n\n[r]: {U}", {}),
    (f"[Sách]({U} 't')", {"item": {7}}),
    (f'[Sách]({U} "a \\" b")', {"item": {7}}),
    (f"<http://example.com/`> {L} `", {"item": {7}}),
    (f"http://x.co/` {L} `", {"item": {7}}),
    (f"[^1]: note\n\n    {L}", {"item": {7}}),
    # a www. literal after one that failed is still read (it takes the link into its url)
    (f"_www.x_y._www.cd/{L}", {}),
    (f"_www.a_b._www.c_d/{L}", {"item": {7}}),
    # a footnote label reads an escape first and holds at most 999 characters
    (f"[^^\\]:\n\n    {L}", {}),
    ("[^" + "\\]" * 500 + f"]: x\n\n    {L}", {}),
    # a lazy line may head a table (its delimiter row goes on with the containers); a lazy line after a table
    # and a line indented 4 columns head none (a table row splits `[x|y]` at its pipe)
    (f"- [x]({U}\n)||\n  -|-", {}),
    (f"> a|b\n> -|-\nx||\n-|-\n[|]({U})", {"item": {7}}),
    (f"a\n    b|c\n-|-\n[x|y]({U})", {"item": {7}}),
    # a footnote right inside a footnote goes on with the outer one's indent
    (f"[^1]:[^2]:```\n    {L}", {}),
    (f"[^1]:[^2]:\n    #\n        {L}", {"item": {7}}),
    # after definitions alone, a `-` or `===` line is text, not a setext underline
    (f"[r]: /u\n-\n    {L}", {"item": {7}}),
    (f"[r]: /u\n===\n    {L}", {"item": {7}}),
    # `[^1]` is a footnote call where `[^1]:` defines a footnote; else a link text or a reference
    (f"[^1]({U})\n\n[^1]: note", {}),
    (f"[^1]({U})\n\n[^2]: note", {"item": {7}}),
    (f"[^ 1]\n\n[^ 1]: {U}", {"item": {7}}),
    (f"> [^1]\n>\n> [r]: /u\n    [^1]: {U}", {"item": {7}}),
    # a bare url as micromark reads it (R4P-1): the editor escapes a url's parentheses and brackets, so a
    # `[[ ]]` link picked right after such a link (with or without a space) is read; `[`, `]`, `<` may be in a
    # url, parentheses nest up to 32 deep, and no space, unclosed `(` or control character is
    (f"[Atomic Habits (Wikipedia)]({WIKI}){L}", {"item": {7}}),
    (f"[Atomic Habits (Wikipedia)]({WIKI}) {L}", {"item": {7}}),
    (f"[kết quả](https://example.com/search?filter\\[type]=book){L}", {"item": {7}}),
    ("[]([](/thu-vien/item/?id=8))", {}),
    (f"[](]http://a){L}", {"item": {7}}),
    (f"[](x<http://a){L}", {"item": {7}}),
    (f"![{L}](\\)", {"item": {7}}),
    (f"[a]({U}#[)", {"item": {7}}),
    (f"[a]({U}&x=(a(b)))", {"item": {7}}),
    (f"[a]({U}&x={'(' * 32}{')' * 32})", {"item": {7}}),
    (f"[a]({U}&x={'(' * 33}{')' * 33})", {}),
    (f"[a]({U}&x=(a b))", {}),
    (f"[a]({U}\x01)", {}),
    (f'[a]( "{U}")', {}),
    (f"[[a]( x)]({U})", {}),
    # the url is decoded before it is read (R4P-4): escapes and character references, in definitions too
    ("[S](/thu-vien/item/?id=5\\&x=1)", {"item": {5}}),
    ("[S](/thu-vien/item/?id\\=12)", {"item": {12}}),
    ("[S](/thu-vien/item/?id=1&#48;)", {"item": {10}}),
    ("[x](/thu-vien/ghi-chu/?id=4&mp;)", {}),
    ("[S][r]\n\n[r]: </thu-vien/item/?id&#61;7>", {"item": {7}}),
    ("[S][r]\n\n[r]: /thu-vien/item/?id\\=7&amp;x=1", {"item": {7}}),
    # a task box is no reference link (R4P-2): `[x]`, `[X]` or `[ ]` opening a list item's first paragraph,
    # with a line end or spaces and text after it; not in a heading, a quote or a later paragraph
    (f"- [x] Đọc xong chương 1\n- [ ] Chương 2\n\n[x]: {U}", {}),
    (f"1. [X]\ta\n> - [x] b\n- [x]\n  c\n\n[x]: {U}", {}),
    (f"-\n  [x] a\n\n[x]: {U}", {}),
    (f"- [r]: /u\n  [x] a\n\n[x]: {U}", {}),
    (f"- [x]\n\n[x]: {U}", {"item": {7}}),
    (f"- [x] \n\n[x]: {U}", {"item": {7}}),
    (f"- [x]a\n\n[x]: {U}", {"item": {7}}),
    (f"- [x] [x]\n\n[x]: {U}", {"item": {7}}),
    (f"- > [x] a\n\n[x]: {U}", {"item": {7}}),
    (f"- [x] a\n  ===\n\n[x]: {U}", {"item": {7}}),
    (f"- a\n\n  [x] b\n\n[x]: {U}", {"item": {7}}),
    (f"[x] a\n\n[x]: {U}", {"item": {7}}),
    # after an item that began blank, a box only when nothing follows the marker and the next line adds no
    # indent of its own; an unindented line outside the item still takes the box (micromark's quirk)
    (f"- \n  [x] a\n\n[x]: {U}", {"item": {7}}),
    (f"-\t\n  [x] a\n\n[x]: {U}", {"item": {7}}),
    (f"1. \n   [x] a\n\n[x]: {U}", {"item": {7}}),
    (f"> - \n>   [x] a\n\n[x]: {U}", {"item": {7}}),
    (f"-\n   [x] a\n\n[x]: {U}", {"item": {7}}),
    (f"-\n [x] a\n\n[x]: {U}", {"item": {7}}),
    (f"-\n> [x] a\n\n[x]: {U}", {"item": {7}}),
    (f"-\n\n[x] a\n\n[x]: {U}", {"item": {7}}),
    (f"-\n[x] a\n\n[x]: {U}", {}),
    (f"> -\n> [x] a\n\n[x]: {U}", {}),
    (f"p\n\n1.\n[x] a\n\n[x]: {U}", {}),
    (f"- -\n    [x] a\n\n[x]: {U}", {}),
]


@pytest.mark.parametrize(("markdown", "links"), READING_VIEW)
def test_links_are_read_where_the_reading_view_shows_them(markdown: str, links: dict[str, set[int]]) -> None:
    assert parse_links(markdown) == links


def test_the_migration_copy_reads_links_as_links_py_does() -> None:
    parse = importlib.import_module("library.migrations.0005_fill_note_links").parse
    for markdown, links in READING_VIEW:
        assert parse(markdown) == links


def _backtick_runs(k: int) -> str:
    """Backtick runs of every length 1..k, a long stretch of short lines, a blank line, the runs again
    (V3-5)."""
    runs = " ".join("`" * i for i in range(1, k + 1))
    return runs + "\n" + "a\n" * ((200_000 - 2 * len(runs)) // 2 - 30) + "\n" + runs + " " + L


@pytest.mark.parametrize(
    "text",
    [
        "](" * 100_000,
        "[a](b " * 33_000,
        "`" * 200_000,
        "` `` ``` " * 20_000,
        "[" * 200_000,
        _backtick_runs(200),
        "[" + "\\[" * 99_999,
        "Ghi chú \\[V3\\]V " * 2_500 + L,
        "- " * 99_990 + "x " + L,
        "> " * 99_990 + L,
        "- " * 30_000 + "x" + "\n" * 100_000 + "  " * 30_000 + L,
        "[a](b (" * 28_000 + L,
        "[r]: /u\n\n" + "[r][r][x][] " * 16_000 + L,
        "| a |\n|-|\n" + "`[a](" * 39_000 + L,
        "http://x.y/" + "." * 199_000 + "a " + L,
        "[" * 900 + "]" * 900 + "[r]\n\n[r]: /u",
        "[^" + "\\" * 100 + "\n\n" + L,
        "- [^" + "\\" * 199_990 + "\n\n" + L,
        "_www." * 40_000 + " " + L,
        "www.a_a_" * 25_000 + " " + L,
        "[^1]:" * 30_000 + "\n" + "    x\n" * 8_000 + L,
        "[^1]: n\n\n" + "[^1]" * 49_990 + L,
        "> a|b\n> -|-\n" + "x||\n-|-\n" * 24_990 + L,
        "[r]: /u\n" * 20_000 + "-\n" * 10_000 + "===\n" + L,
        # one long url referenced many times is read once (R4P-3); bare urls that nest or run far (R4P-1)
        "[r]: /thu-vien/item/?id=5" + "&a" * 50_000 + "\n\n" + "[a][r]" * 16_660,
        "[](" * 66_000 + L,
        "[]([](" * 33_000 + L,
        "[](a(b)" * 28_000 + L,
        "[](\\)" * 40_000 + L,
        "[](" + "(" * 199_000 + L,
        "- [x] [x]\n" * 20_000 + "\n[x]: /u",
    ],
)
def test_parsing_stays_linear_on_pathological_text(text: str) -> None:
    started = time.monotonic()
    parse_links(text)
    note_excerpt(text, "x")
    note_label(Note(title="", markdown=text))
    assert time.monotonic() - started < 2


@pytest.mark.parametrize("text", ["[" + "\\[" * 99_999, "Ghi chú \\[V3\\]V " * 2_500])
def test_labels_stay_linear_on_escaped_brackets(text: str) -> None:
    """Every `[` used to start a link match that ran over the escaped brackets after it (V3-4)."""
    started = time.monotonic()
    note_label(Note(title="", markdown=text))
    labelled = time.monotonic()
    note_excerpt(text, "x")
    assert labelled - started < 0.5 and time.monotonic() - labelled < 0.5


@pytest.mark.parametrize(
    ("markdown", "title"),
    [
        # a hard break's backslash shows nothing (Shift+Enter, pasted lines)
        ("\\[V3] Dòng một\\\ndòng hai", "[V3] Dòng một"),
        ("Dòng một\\\r\ndòng hai", "Dòng một"),
        ("C:\\\\\nx", "C:\\"),
        # numeric character references show their character (the editor writes `&#x20;` for a leading space)
        ("&#x20;\\[V3] khoảng trắng đầu", "[V3] khoảng trắng đầu"),
        ("# &#x20;Tiêu đề", "Tiêu đề"),
        ("&#x9;Tab đầu", "Tab đầu"),
        ("&#123;json&#125; và &#0;", "{json} và \ufffd"),
        ("\\&#x20;viết như chữ", "&#x20;viết như chữ"),
        # inline marks are left out, an escaped one stays; an escaped `!` before a link stays a `!`
        ("**Ý chính:** đọc *chương* `3` ~~cũ~~", "Ý chính: đọc chương 3 cũ"),
        ("2\\*3 = 6, file_name và _nghiêng_", "2*3 = 6, file_name và nghiêng"),
        ("Hay quá\\![Sách](/thu-vien/item/?id=5)", "Hay quá!Sách"),
        # a link whose url has escaped parentheses (the editor's Wikipedia link) shows its text
        (
            f"Đọc thêm [Atomic Habits (Wikipedia)]({WIKI}) rồi ghi",
            "Đọc thêm Atomic Habits (Wikipedia) rồi ghi",
        ),
        # code fences, rules and delimiter rows hold no title
        ("```js\nconsole.log(1)\n```", "console.log(1)"),
        ("---\n\nNội dung", "Nội dung"),
        ("- - -\n> ---\n|---|---|\n| a | b |", "| a | b |"),
        ("-5 độ", "-5 độ"),
        # list numbers are ASCII digits; one whitespace set; the cut never splits a character
        ("\u0663. chữ số", "\u0663. chữ số"),
        ("\ufeffBOM a\x85b\x1cc", "BOM a b\x1cc"),
        ("a" * 119 + "😀b", "a" * 119 + "😀"),
    ],
)
def test_labels_show_the_text_as_it_reads(markdown: str, title: str) -> None:
    assert note_label(Note(title="", markdown=markdown)) == title


def test_excerpts_join_hard_breaks_and_show_references() -> None:
    markdown = "\\[V3] Họp nhóm\\\nChốt lịch\\\n&#x20;An lo **thiết kế**\n"
    assert note_excerpt(markdown, "") == "[V3] Họp nhóm Chốt lịch An lo thiết kế"
    assert note_excerpt(markdown, "an lo") == "[V3] Họp nhóm Chốt lịch An lo thiết kế"


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
    escaped = Note.objects.create(user=user, markdown=f"[A](/thu-vien/item/?id\\={book.pk})")
    Note.objects.create(user=user, markdown="no links")
    fill = importlib.import_module("library.migrations.0005_fill_note_links").fill
    fill(apps, None)
    assert links_of(note.pk) == {("item", book.pk)} == links_of(escaped.pk)
    assert list(note.items.all()) == [book]
