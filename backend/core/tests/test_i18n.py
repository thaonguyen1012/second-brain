"""The API answers in the web UI's language (core.middleware.LanguageMiddleware, core.i18n)."""

import ast
import re
from pathlib import Path

import pytest
from django.test import Client
from django.utils import translation

from core.i18n import EN, tr
from core.testing import csrf, send

BACKEND = Path(__file__).resolve().parents[2]
VIETNAMESE = re.compile(r"[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]", re.I)
# Text that stays Vietnamese on purpose: settings.LANGUAGES names each language in itself
ALLOWED = {"Tiếng Việt"}
MARKS = re.compile(r"\{(\w+)\}")


def _scan() -> tuple[set[str], list[str]]:
    """The texts given to tr() / tr_lazy(), and every other Vietnamese string in the code (not docstrings)."""
    keys: set[str] = set()
    loose: list[str] = []
    skip = {"tests", "migrations", ".venv", "__pycache__"}
    for path in sorted(BACKEND.rglob("*.py")):
        rel = path.relative_to(BACKEND)
        if skip & set(rel.parts):
            continue
        tree = ast.parse(path.read_text(encoding="utf-8"))
        allowed: set[int] = set()
        for node in ast.walk(tree):
            body = getattr(node, "body", None)
            if isinstance(body, list) and body and isinstance(body[0], ast.Expr):
                allowed.add(id(body[0].value))  # docstrings
            called = node.func.id if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) else None
            if isinstance(node, ast.Call) and called in ("tr", "tr_lazy"):
                arg = node.args[0] if node.args else None
                if isinstance(arg, ast.Constant) and isinstance(arg.value, str):
                    keys.add(arg.value)
                    allowed.add(id(arg))
        if rel == Path("core/i18n.py"):
            continue  # the catalog itself
        for node in ast.walk(tree):
            if (
                isinstance(node, ast.Constant)
                and isinstance(node.value, str)
                and VIETNAMESE.search(node.value)
                and id(node) not in allowed
                and node.value not in ALLOWED
            ):
                loose.append(f"{rel}:{node.lineno} {node.value!r}")
    return keys, loose


KEYS, LOOSE = _scan()


def test_every_message_goes_through_tr() -> None:
    assert LOOSE == []


def test_every_message_has_english_and_none_is_unused() -> None:
    assert sorted(KEYS - EN.keys()) == []
    assert sorted(EN.keys() - KEYS) == []


def test_english_keeps_the_placeholders() -> None:
    wrong = [vi for vi, en in EN.items() if sorted(MARKS.findall(vi)) != sorted(MARKS.findall(en))]
    assert wrong == []


def test_tr_follows_the_active_language() -> None:
    assert tr("Hãy dừng đồng hồ trước.") == "Hãy dừng đồng hồ trước."
    with translation.override("en"):
        assert tr("Hãy dừng đồng hồ trước.") == "Stop the timer first."
        assert tr("Ảnh lớn hơn {mb} MB.", mb="10") == "The image is larger than 10 MB."
    assert tr("Ảnh lớn hơn {mb} MB.", mb="10") == "Ảnh lớn hơn 10 MB."


@pytest.mark.django_db
def test_the_api_answers_in_the_language_of_the_cookie(client: Client) -> None:
    tuesday = "/api/weeks/2026-10-27/plan"
    vi = client.get(tuesday)
    assert vi.status_code == 400 and vi.json() == {"start": "Tuần bắt đầu vào thứ Hai."}
    assert vi.headers["Content-Language"] == "vi"

    client.cookies["lang"] = "en"
    en = client.get(tuesday)
    assert en.status_code == 400 and en.json() == {"start": "A week starts on a Monday."}
    assert en.headers["Content-Language"] == "en" and "Cookie" in en.headers["Vary"]
    # DRF's own messages too
    headers = csrf(client)
    blank = send(client, "post", "/api/weeks/2026-10-26/objectives", {"title": ""}, headers)
    assert blank.status_code == 400 and blank.json() == {"title": ["This field may not be blank."]}

    client.cookies["lang"] = "fr"  # anything else is Vietnamese
    assert client.get(tuesday).json() == {"start": "Tuần bắt đầu vào thứ Hai."}
    # the override ends with the request: code after it runs in the default language again
    assert translation.get_language() == "vi"


@pytest.mark.django_db
def test_the_page_language_header_comes_before_the_cookie(client: Client) -> None:
    tuesday = "/api/weeks/2026-10-27/plan"
    # a page opened at /en/... without the cookie
    en = client.get(tuesday, headers={"X-UI-Lang": "en"})
    assert en.json() == {"start": "A week starts on a Monday."}
    assert en.headers["Content-Language"] == "en" and "X-UI-Lang" in en.headers["Vary"]
    # a page opened at /vi/... with the cookie lang=en
    client.cookies["lang"] = "en"
    vi = client.get(tuesday, headers={"X-UI-Lang": "vi"})
    assert vi.json() == {"start": "Tuần bắt đầu vào thứ Hai."}
    assert vi.headers["Content-Language"] == "vi"
