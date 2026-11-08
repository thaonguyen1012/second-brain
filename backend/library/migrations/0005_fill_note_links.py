"""Read the links already written in notes into NoteLink (the rows library.links keeps up to date on every save from
now on). A frozen copy of the parser: a migration never imports app code that may change later. Reversing it keeps
the rows; reversing 0004 drops them."""

import re
import unicodedata
from bisect import bisect_left, bisect_right
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

# --- Blocks: which lines are text ---------------------------------------------------------------------------
# The reading view reads a note as CommonMark + GFM (react-markdown, micromark), and so does this module, as
# far as it decides where a link can be: the text of paragraphs, headings and table cells holds links; code
# blocks and HTML blocks hold none. Containers nest: block quotes (`>`), list items (their content column)
# and GFM footnote definitions (4 columns); a line stays in a container while it continues it, or lazily
# while it only continues a paragraph. Tabs reach the next multiple of 4 columns. Each line is read once and
# each container costs a character of it, so the pass is linear.
_LINE_END = re.compile(r"\r\n|\r|\n")
_TAB = 4
_QUOTE, _ITEM, _NOTE = range(3)  # containers: [kind, content column, began blank, blank line since]
_PARA, _CODE, _FENCE, _HTML, _TABLE = range(1, 6)  # leaf blocks that span lines (0: none open)
# A list marker (group 1: an ordered item's number), a footnote definition's label
_MARKER = re.compile(r"[*+-]|([0-9]{1,9})[.)]")
_FOOTNOTE = re.compile(r"\[\^(?:\\[\[\]\\]|[^ \t\[\]]){1,999}\]:")
_ATX = re.compile(r"#{1,6}(?:[ \t]|$)")
_FENCE_OPEN = re.compile(r"`{3,}(?=[^`]*$)|~{3,}")
_THEMATIC = re.compile(r"(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$")
_SETEXT = re.compile(r"(?:=+|-+)[ \t]*$")
# HTML blocks (micromark's html-flow): what opens one, and what ends it (a string on the same or a later line;
# kinds 6 and 7 end before a blank line). Kind 7, a complete tag alone on its line, cannot interrupt a
# paragraph.
_HTML_NAMES = (
    "address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|"
    "dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|"
    "link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|"
    "tfoot|th|thead|title|tr|track|ul"
)
_HTML_OPEN = re.compile(
    r"<(?:((?:pre|script|style|textarea)(?=[ \t>]|$))|(!--)|(\?)|(![A-Za-z])|((?-i:!\[CDATA\[))"
    rf"|(/?(?:{_HTML_NAMES})(?=[ \t>]|/>|$))"
    r"|((?:[A-Za-z][A-Za-z0-9-]*+(?:[ \t]++[A-Za-z_:][A-Za-z0-9_.:-]*+"
    r"(?:[ \t]*+=[ \t]*+(?:\"[^\"]*+\"|'[^']*+'|[^ \t\"'=<>`/]++|(?=/)))?+)*+[ \t]*+/?"
    r"|/[A-Za-z][A-Za-z0-9-]*+[ \t]*+)>[ \t]*+$))",
    re.IGNORECASE,
)
_HTML_ENDS = (
    re.compile(r"</(?:pre|script|style|textarea)>", re.IGNORECASE),
    re.compile("-->"),
    re.compile(r"\?>"),
    re.compile(">"),
    re.compile(r"\]\]>"),
)
# GFM tables: a paragraph line (the head) followed by a delimiter row with as many cells; then a row per line
# until a blank line or another block. Cells are split at the pipes no backslash escapes, before any code
# span or link is read, so neither crosses a cell.
_DELIMITER_ROW = re.compile(r"\|?[ \t]*+(:?-+:?[ \t]*+(?:\|[ \t]*+:?-+:?[ \t]*+)*+)\|?[ \t]*+$")
_ROW_TOKEN = re.compile(r"[ \t]++|\||(?:\\[\\|]|\\|[^ \t|\\])++")
_CELL_PIPE = re.compile(r"\\[\\|]|(\|)")


def _head_cells(row: str) -> int:
    """How many cells a table whose head is `row` has (micromark's count), 0 when it heads no table."""
    cells = 0
    seen = not row.startswith("|")
    marks = int(seen)  # the first character, when it is no pipe, counts twice
    for part in _ROW_TOKEN.findall(row):
        if part[0] in " \t":
            continue
        marks += 1
        if seen:
            seen = False
            cells += 1
        if part == "|":
            seen = True
    return cells if marks > 1 else 0


def _delimits(line: str, at: int, head: str) -> bool:
    """Whether the line from `at` is a table's delimiter row (`| - | :-: |`) with as many cells as `head`;
    without a `|` or `:` it is a setext underline or a thematic break instead."""
    row = _DELIMITER_ROW.match(line, at)
    if row is None or ("|" not in row.group() and ":" not in row.group()):
        return False
    return row.group(1).count("|") + 1 == _head_cells(head)


def _cells(row: str) -> list[str]:
    """The cells of a table row."""
    cells, start = [], 0
    for pipe in _CELL_PIPE.finditer(row):
        if pipe.group(1):
            cells.append(row[start : pipe.start()])
            start = pipe.end()
    cells.append(row[start:])
    return cells


# Link reference definitions (`[label]: /url "title"`) open a paragraph's text; a link may then name its
# destination by label: `[text][label]`, `[label][]` or `[label]`.
_LABEL = re.compile(r"\[(?!\^)((?:\\[\s\S]|[^\[\]\\]){1,999})\]")
_DEFINITION_SPACE = re.compile(r"[ \t]*+(?:\n[ \t]*+)?")
_ANGLE_URL = re.compile(r"<((?:\\[^\n]|[^<>\n\\])*+)>")
_DEFINITION_TITLE = re.compile(
    r"(?:[ \t]++(?:\n[ \t]*+)?|\n[ \t]*+)"
    r"(?:\"(?:\\[\s\S]|[^\"\\])*+\"|'(?:\\[\s\S]|[^'\\])*+'|\((?:\\[\s\S]|[^)\\])*+\))[ \t]*+(?:\n|\Z)"
)
_DEFINITION_END = re.compile(r"[ \t]*+(?:\n|\Z)")
_LABEL_SPACE = re.compile(r"[\t\n\r ]+")
_LABEL_MAX = 999


def _label(match: re.Match[str] | None) -> str | None:
    """The label in `match` (of _LABEL), if it is one: at most 999 characters besides line ends, not blank."""
    if match is None:
        return None
    label = match.group(1)
    if len(label) - label.count("\n") > _LABEL_MAX or not label.strip(" \t\n"):
        return None
    return label


def _identifier(label: str) -> str:
    """The form in which two labels match (micromark's normalizeIdentifier)."""
    return _LABEL_SPACE.sub(" ", label).strip(" ").lower().upper()


def _url_end(text: str, pos: int) -> int:
    """The end of the bare url at `pos` (parentheses balanced, escapes kept), `pos` when there is none."""
    depth, end = 0, pos
    while end < len(text):
        char = text[end]
        if char == "\\" and text[end + 1 : end + 2] in ("(", ")", "\\"):
            end += 1
        elif char == "(":
            depth += 1
        elif char == ")":
            if not depth:
                break
            depth -= 1
        elif char <= " " or char == "\x7f":
            break
        end += 1
    return pos if depth else end


def _definitions(text: str, found: dict[str, str]) -> str:
    """Take the link reference definitions that open a paragraph's `text` into `found` (the first definition
    of a label wins); the rest of the text."""
    pos = 0
    while (match := _LABEL.match(text, pos)) and text.startswith(":", match.end()):
        if (label := _label(match)) is None:
            break
        space = _DEFINITION_SPACE.match(text, match.end() + 1)
        start = space.end() if space else match.end() + 1
        if text.startswith("<", start):
            if not (angle := _ANGLE_URL.match(text, start)):
                break
            url, end = angle.group(1), angle.end()
        elif (end := _url_end(text, start)) > start:
            url = text[start:end]
        else:
            break
        line_end = _DEFINITION_TITLE.match(text, end) or _DEFINITION_END.match(text, end)
        if line_end is None:
            break
        found.setdefault(_identifier(label), url)
        pos = line_end.end()
    return text[pos:]


def _nonspace(line: str, pos: int, col: int) -> tuple[int, int]:
    """The index and column of the first character at or after `pos` (at column `col`) that is no space or
    tab."""
    while pos < len(line):
        char = line[pos]
        if char == " ":
            col += 1
        elif char == "\t":
            col += _TAB - col % _TAB
        else:
            break
        pos += 1
    return pos, col


def _advance(line: str, pos: int, col: int, columns: int) -> tuple[int, int]:
    """Past `columns` columns of the spaces and tabs at `pos`; a tab may be passed in part (the cursor then
    stays on it, at a later column)."""
    while columns > 0 and pos < len(line):
        width = _TAB - col % _TAB if line[pos] == "\t" else 1
        if width > columns:
            return pos, col + columns
        col += width
        columns -= width
        pos += 1
    return pos, col


def _list_item(
    line: str, at: int, at_col: int, col: int, interrupt: bool, tails: dict[str, int]
) -> tuple[list[int], int, int] | None:
    """The list item whose marker is at `at` (the cursor at column `col`): the container and the cursor at its
    content, or None. A line that interrupts a paragraph opens only a non-empty bullet or `1.` item. `tails`
    keeps, per marker character, where the line's last run of that character and spaces starts: a line of
    nested markers then costs no more than its length."""
    marker = _MARKER.match(line, at)
    if marker is None or (marker.end() < len(line) and line[marker.end()] not in " \t"):
        return None
    char = marker.group()
    if char in "*-":  # `* * *` is a thematic break, not three items
        if char not in tails:
            tails[char] = len(line.rstrip(char + " \t"))
        if at >= tails[char] and line.count(char, at) >= 3:
            return None
    end, end_col = marker.end(), at_col + marker.end() - at
    content, content_col = _nonspace(line, end, end_col)
    blank = content == len(line)
    if interrupt and (blank or marker.group(1) not in (None, "1")):
        return None
    width = end_col - col
    if blank:
        return [_ITEM, width + 1, 1, 0], content, content_col
    if content_col - end_col > 4:  # one space after the marker; the rest is indented code
        pos, pos_col = _advance(line, end, end_col, 1)
        return [_ITEM, width + 1, 0, 0], pos, pos_col
    return [_ITEM, width + content_col - end_col, 0, 0], content, content_col


def _html_block(line: str, at: int, interrupt: bool) -> tuple[re.Pattern[str] | None, int] | None:
    """The HTML block that opens at `at`: what ends it (None: a blank line) and where to look for that on this
    line; None when no block opens."""
    match = _HTML_OPEN.match(line, at)
    if match is None or (interrupt and match.lastindex == 7):
        return None
    kind = match.lastindex or 0
    if kind > 5:
        return None, 0
    # `<!-->` and `<?>` are closed already
    return _HTML_ENDS[kind - 1], at + 2 if kind == 2 else at + 1 if kind == 3 else match.end()


def _interrupts(line: str, at: int, lazy: bool) -> bool:
    """Whether the line ends the open paragraph with a block of its own (a heading, a fence, a thematic break
    or an HTML block; on a lazy line also a complete HTML tag)."""
    char = line[at]
    return bool(
        (char == "#" and _ATX.match(line, at))
        or (char in "`~" and _FENCE_OPEN.match(line, at))
        or (char in "*-_" and _THEMATIC.match(line, at))
        or (char == "<" and _html_block(line, at, not lazy))
    )


def _texts(markdown: str) -> tuple[list[str], dict[str, str]]:
    """The text of each paragraph, heading and table cell in `markdown`, its lines without their container
    marks and indentation; and the destination of each link reference definition, by label."""
    texts: list[str] = []
    definitions: dict[str, str] = {}
    stack: list[list[int]] = []
    quotes: list[int] = []  # the indexes of the quotes in `stack` (a blank line ends the outermost)
    leaf = 0
    para: list[str] = []
    lazy = False  # the paragraph's last line was lazy (it cannot head a table)
    fence = ""
    html_end: re.Pattern[str] | None = None

    def close(depth: int) -> None:
        nonlocal leaf
        if leaf == _PARA:
            text = "\n".join(para)
            texts.append(_definitions(text, definitions) if text.startswith("[") else text)
        leaf = 0
        del stack[depth:]
        while quotes and quotes[-1] >= depth:
            quotes.pop()

    for line in _LINE_END.split(markdown):
        pos = col = 0
        nn, nn_col = _nonspace(line, 0, 0)
        matched = 0
        while matched < len(stack):
            if nn == len(line):  # the rest is blank: items and footnotes go on, a quote ends
                next_quote = bisect_left(quotes, matched)
                matched = quotes[next_quote] if next_quote < len(quotes) else len(stack)
                if matched == len(stack) and stack[-1][0] == _ITEM and stack[-1][2]:
                    stack[-1][3] = 1  # an item that began blank holds no text after a blank line
                break
            container = stack[matched]
            if container[0] == _QUOTE:
                if nn_col - col > 3 or line[nn] != ">":
                    break
                pos, col = nn + 1, nn_col + 1
                if pos < len(line) and line[pos] in " \t":
                    pos, col = _advance(line, pos, col, 1)
                nn, nn_col = _nonspace(line, pos, col)
            elif container[0] == _ITEM:
                if container[3] or nn_col - col < container[1]:
                    break
                container[2] = container[3] = 0
                pos, col = _advance(line, pos, col, container[1])
            elif nn_col - col >= _TAB:
                pos, col = _advance(line, pos, col, _TAB)
            else:
                break
            matched += 1
        continued = matched == len(stack)
        if continued and leaf == _FENCE:  # code ends at its closing fence, which may hold nothing else
            run = nn
            while run < len(line) and line[run] == fence[0]:
                run += 1
            if nn_col - col < _TAB and run - nn >= len(fence) and not line[run:].strip(" \t"):
                leaf = 0
            continue
        if continued and leaf == _HTML:
            if (html_end is None and nn == len(line)) or (html_end and html_end.search(line, pos)):
                leaf = 0
            continue

        # New containers; the first one ends the open leaf and the containers this line did not continue. A
        # line that would otherwise continue a paragraph or indented code opens no empty item and no ordered
        # item other than `1.`.
        interrupt = continued and leaf in (_PARA, _CODE)
        opened = False
        tails: dict[str, int] = {}
        while nn < len(line) and nn_col - col < _TAB:
            if line[nn] == ">":
                new, pos, col = [_QUOTE, 0, 0, 0], nn + 1, nn_col + 1
                if pos < len(line) and line[pos] in " \t":
                    pos, col = _advance(line, pos, col, 1)
            elif line[nn] == "[" and (label := _FOOTNOTE.match(line, nn)):
                new = [_NOTE, _TAB, 0, 0]
                pos, col = _nonspace(line, label.end(), nn_col + label.end() - nn)
            elif item := _list_item(line, nn, nn_col, col, interrupt, tails):
                new, pos, col = item
            else:
                break
            if not opened:
                close(matched)
                opened = True
            if new[0] == _QUOTE:
                quotes.append(len(stack))
            stack.append(new)
            matched += 1
            nn, nn_col = _nonspace(line, pos, col)

        blank = nn == len(line)
        indent = nn_col - col
        left = not opened and not continued  # the line leaves containers (micromark: a lazy line)
        if left:
            if leaf == _PARA and not blank:
                if indent >= _TAB or not _interrupts(line, nn, True):
                    para.append(line[nn:])  # a lazy line: it only continues the paragraph
                    lazy = True
                    continue
                tag = _HTML_OPEN.match(line, nn)
                if tag and tag.lastindex == 7:
                    # micromark keeps a complete tag that ends a paragraph on a lazy line in the paragraph's
                    # containers: its HTML block ends at the next line that does not continue them
                    close(len(stack))
                    leaf, html_end = _HTML, None
                    continue
            close(matched)
        if leaf == _CODE:
            if blank or indent >= _TAB:
                continue
            leaf = 0
        elif leaf == _TABLE:  # a row per line, until a blank line or another block (a complete tag too)
            if not blank and indent < _TAB and not _interrupts(line, nn, True):
                texts.extend(_cells(line[nn:]))
                continue
            close(len(stack))
        elif leaf == _PARA:
            if blank:
                close(len(stack))
                continue
            if indent >= _TAB:
                para.append(line[nn:])
                lazy = False
                continue
            if not lazy and _delimits(line, nn, para[-1]):
                head = para.pop()
                close(len(stack))  # the lines before the head stay a paragraph
                texts.extend(_cells(head))
                leaf = _TABLE
                continue
            if _SETEXT.match(line, nn):
                close(len(stack))  # the paragraph is a heading
                continue
            if not _interrupts(line, nn, False):
                para.append(line[nn:])
                lazy = False
                continue
            close(len(stack))
        if blank:
            continue
        char = line[nn]
        if indent >= _TAB:
            leaf = 0 if left else _CODE  # indented code that starts on a lazy line ends with it
        elif char == "#" and (heading := _ATX.match(line, nn)):
            texts.append(line[heading.end() :])
        elif char in "`~" and (opening := _FENCE_OPEN.match(line, nn)):
            leaf, fence = _FENCE, opening.group()
        elif char == "<" and (html := _html_block(line, nn, False)):
            html_end, start = html
            leaf = 0 if html_end and html_end.search(line, start) else _HTML
        elif not (char in "*-_" and _THEMATIC.match(line, nn)):
            leaf, para, lazy = _PARA, [line[nn:]], False
    close(0)
    return texts, definitions


# --- Inline: the links in a paragraph's text ----------------------------------------------------------------
# CommonMark's order, left to right: a backslash escapes punctuation; a backtick run opens a code span that
# the next run of the same length in the text closes; `<` may open an autolink or raw HTML; `[` and `![` open
# a link or image text that the next `]` closes when a destination follows. A link deactivates the `[` before
# it (no link in a link); an image's text shows no link (the reading view keeps it as alt text).
_INLINE = re.compile(r"[\\`<!\[\]]")
_TICKS = re.compile(r"`+")
_PUNCTUATION = frozenset("!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~")
# The destination of an inline link: (url) or (<url>), or none, with an optional title ("t", 't' or (t),
# escapes allowed): such a link is a link too, so it ends the brackets around it. No bracket, parenthesis or
# space in a bare url (the app's links have none), so every match attempt stops at the next one. micromark
# lets a (title) hold a `(`: it ends at the next `)` no backslash escapes, found in a list made once.
_RESOURCE = re.compile(r"\(\s*(?:<([^<>\n]*)>|([^()\s<>\[\]]*+))")
_RESOURCE_TITLE = re.compile(r"\s+(?:\"(?:\\[\s\S]|[^\"\\])*+\"|'(?:\\[\s\S]|[^'\\])*+'|(\())")
_RESOURCE_END = re.compile(r"\s*\)")
_PAREN_CLOSE = re.compile(r"\\[\s\S]|(\))")
_AUTOLINK = re.compile(
    r"<(?:[A-Za-z][A-Za-z0-9+.-]{1,31}:[^\x00-\x20\x7f<>]*+"
    r"|[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]++@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?"
    r"(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*+)>"
)
_HTML_TAG = re.compile(
    r"<(?:[A-Za-z][A-Za-z0-9-]*+(?:[ \t\n]++[A-Za-z_:][A-Za-z0-9_.:-]*+(?:[ \t\n]*+=[ \t\n]*+"
    r"(?:\"[^\"]*+\"|'[^']*+'|[^ \t\n\"'=<>`][^ \t\n\"'=<>`/]*+))?+)*+[ \t\n]*+/?"
    r"|/[A-Za-z][A-Za-z0-9-]*+[ \t\n]*+)>"
)
# Raw HTML that runs to a closing string: comment (`<!-->` is one), processing instruction, CDATA, and a
# declaration (`<!` and a letter)
_HTML_SPAN = re.compile(r"<(?:(!--)|(\?)|(!\[CDATA\[)|![A-Za-z])")
_HTML_SPAN_ENDS = (("-->", 2), ("?>", 2), ("]]>", 9), (">", 3))


def _raw_html_end(text: str, at: int, missing: dict[str, int]) -> int:
    """The end of the autolink or raw HTML at `at`, else 0. `missing` keeps where a closing string was not
    found, so no later search runs over the same text again."""
    if match := _AUTOLINK.match(text, at) or _HTML_TAG.match(text, at):
        return match.end()
    if (span := _HTML_SPAN.match(text, at)) is None:
        return 0
    closing, skip = _HTML_SPAN_ENDS[(span.lastindex or 4) - 1]
    start = at + skip
    if missing.get(closing, len(text) + 1) <= start:
        return 0
    found = text.find(closing, start)
    if found < 0:
        missing[closing] = start
        return 0
    return found + len(closing)


# GFM autolink literals (http://, https://, www.) take the characters of their url, a backtick or bracket
# too, so these open no code span or link. One may start outside a link's text, after a character that is no
# letter (www.: after a space, a line start or one of `(*_[]~`), and runs to a space or `<`, without the
# punctuation that ends it (micromark-extension-gfm-autolink-literal).
_LITERAL = re.compile(r"(?i:https?://|www\.)")
_LITERAL_TRAIL = frozenset("!\"')*,.:;?_~")
_LITERAL_PATH_STOP = frozenset("!\"&')*,.:;<?]_~")
_UNICODE_SPACE = frozenset("\t\n\v\f\r \xa0\u1680\u2028\u2029\u202f\u205f\u3000\ufeff") | frozenset(
    map(chr, range(0x2000, 0x200B))
)


def _symbol(char: str) -> bool:
    return unicodedata.category(char)[0] in "PS"


def _trail(text: str, at: int, known: dict[int, bool]) -> bool:
    """Whether the punctuation from `at` ends a literal's url instead of belonging to it. Each position is
    worked out once (`known`), so long runs of punctuation stay linear."""
    passed: list[int] = []
    pos = at
    while pos not in known:
        char = text[pos : pos + 1]
        if char and char in _LITERAL_TRAIL:
            passed.append(pos)
            pos += 1
        elif char == "&":  # a character reference such as &amp; is punctuation too
            end = pos + 1
            while text[end : end + 1].isascii() and text[end : end + 1].isalpha():
                end += 1
            if end > pos + 1 and text.startswith(";", end):
                passed.append(pos)
                pos = end + 1
            else:
                known[pos] = False
        elif char == "]":
            after = text[pos + 1 : pos + 2]
            if not after or after in "([" or after in _UNICODE_SPACE:
                known[pos] = True
            else:
                passed.append(pos)
                pos += 1
        else:
            known[pos] = not char or char == "<" or char in _UNICODE_SPACE
    for position in passed:
        known[position] = known[pos]
    return known[pos]


def _literal_end(text: str, at: int, known: dict[int, bool]) -> int:
    """The end of the autolink literal that may start at `at` (a match of _LITERAL), else 0."""
    before = text[at - 1 : at]
    if text[at] in "hH":
        if before.isascii() and before.isalpha():
            return 0
        pos = text.index("//", at) + 2
        char = text[pos : pos + 1]
        if not char or char in _UNICODE_SPACE or ord(char) < 32 or char == "\x7f" or _symbol(char):
            return 0
    else:
        if (before and before not in "(*_[]~ \t\n\r") or at + 4 >= len(text):
            return 0
        pos = at
    seen = underscore = underscore_before = False
    while pos < len(text):  # the domain
        char = text[pos]
        if char in "._":
            if _trail(text, pos, known):
                break
            if char == "_":
                underscore = True
            else:  # a new segment
                underscore_before, underscore = underscore, False
        elif char in _UNICODE_SPACE or (char != "-" and _symbol(char)):
            break
        else:
            seen = True
        pos += 1
    if not seen or underscore or underscore_before:
        return 0
    opened = closed = 0
    while pos < len(text):  # the path
        char = text[pos]
        if char == "(":
            opened += 1
        elif char == ")" and closed < opened:
            closed += 1
        elif char in _LITERAL_PATH_STOP:
            if _trail(text, pos, known):
                break
            closed += char == ")"
        elif char in _UNICODE_SPACE:
            break
        pos += 1
    return pos


def _resource(text: str, pos: int, closers: list[int]) -> tuple[str, int] | None:
    """The url and end of the inline link destination at `pos` (just after the `]`), else None. `closers`
    lists the text's unescaped `)` once it is needed (it starts empty)."""
    head = _RESOURCE.match(text, pos)
    if head is None:
        return None
    url = head.group(2) if head.group(1) is None else head.group(1)
    if title := _RESOURCE_TITLE.match(text, head.end()):
        end = title.end()
        if title.group(1):
            if not closers:
                closers += [m.start() for m in _PAREN_CLOSE.finditer(text) if m.group(1)] or [-1]
            after = bisect_right(closers, title.start(1))
            end = closers[after] + 1 if after < len(closers) else -1
        if end >= 0 and (close := _RESOURCE_END.match(text, end)):
            return url, close.end()
    if close := _RESOURCE_END.match(text, head.end()):
        return url, close.end()
    return None


def _reference(
    text: str, start: int, end: int, definitions: dict[str, str], plain: bool
) -> tuple[str, int] | None:
    """The destination and end of the reference link whose text runs from `start` to the `]` at `end`: a
    `[label]` after it names a definition, else `[]` or nothing after it make the text itself the label (only
    a `plain` text, without brackets, can be one)."""
    defined = None
    if plain and end - start <= 2 * _LABEL_MAX:
        defined = definitions.get(_identifier(text[start:end]))
    if not text.startswith("[", end + 1):
        return None if defined is None else (defined, end + 1)
    match = _LABEL.match(text, end + 1)
    label = _label(match)
    if match and label is not None and (url := definitions.get(_identifier(label))) is not None:
        return url, match.end()
    if defined is not None and text.startswith("[]", end + 1):
        return defined, end + 3
    return None


def _destinations(text: str, definitions: dict[str, str]) -> list[str]:
    """The destinations of the links in one paragraph's, heading's or table cell's text."""
    runs: dict[int, list[int]] = defaultdict(list)
    for run in _TICKS.finditer(text):
        runs[run.end() - run.start()].append(run.start())
    literals = [literal.start() for literal in _LITERAL.finditer(text)]
    brackets: list[tuple[int, bool, int]] = []  # open `[` and `![`: (position, image, brackets read before)
    inactive = 0  # the `[` below this index in `brackets` are inactive
    read = 0  # brackets read so far
    found: list[tuple[int, str]] = []  # (position of the link's `[`, destination)
    missing: dict[str, int] = {}
    known: dict[int, bool] = {}
    closers: list[int] = []
    pos = next_literal = 0
    special = _INLINE.search(text)
    while special:
        at = special.start()
        if at < pos:
            special = _INLINE.search(text, pos)
            continue
        while next_literal < len(literals) and literals[next_literal] < pos:
            next_literal += 1
        if not brackets and next_literal < len(literals) and literals[next_literal] < at:
            pos = _literal_end(text, literals[next_literal], known) or pos
            next_literal += 1
            continue
        char = text[at]
        pos = at + 1
        if char == "\\":
            if text[pos : pos + 1] in _PUNCTUATION:
                pos += 1
        elif char == "`":
            ticks = _TICKS.match(text, at)
            length = ticks.end() - at if ticks else 1
            same = runs[length]
            closer = bisect_right(same, at)
            pos = same[closer] + length if closer < len(same) else at + length
        elif char == "<":
            pos = _raw_html_end(text, at, missing) or pos
        elif char == "!":
            if text.startswith("[", pos):
                brackets.append((at, True, read))
                read += 1
                pos += 1
        elif char == "[":
            brackets.append((at, False, read))
            read += 1
        elif brackets:
            start, image, before = brackets.pop()
            plain = read == before + 1  # no bracket between the opener and this `]`
            read += 1
            if image or len(brackets) >= inactive:
                url: str | None = None
                if resource := _resource(text, pos, closers):
                    url, pos = resource
                elif definitions and (
                    reference := _reference(text, start + image + 1, at, definitions, plain)
                ):
                    url, pos = reference
                if url is not None and image:
                    while found and found[-1][0] > start:  # an image's text shows no link
                        found.pop()
                elif url is not None:
                    found.append((start, url))
                    inactive = len(brackets)
            inactive = min(inactive, len(brackets))
    return [url for _, url in found]


def parse(markdown):  # type: ignore[no-untyped-def]
    found = defaultdict(set)
    if "](" not in markdown and "]:" not in markdown:
        return found
    texts, definitions = _texts(markdown)
    for text in texts:
        if "](" not in text and not (definitions and "]" in text):
            continue
        for destination in _destinations(text, definitions):
            try:
                url = urlsplit(destination)
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
