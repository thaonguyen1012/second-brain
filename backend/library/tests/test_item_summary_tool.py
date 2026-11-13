"""The tool type and the one-line summary of an Item (the Công cụ page, 13/11/2026)."""

import pytest
from django.contrib.auth.models import User
from django.test import Client

from core.testing import csrf, send
from library.models import Item

pytestmark = pytest.mark.django_db


def owner(client: Client) -> User:
    client.get("/api/me")
    return User.objects.get(username="dev@localhost")


def stranger() -> User:
    return User.objects.get_or_create(username="other@x", email="other@x")[0]


def test_a_tool_is_created_and_edited_with_its_summary(client: Client) -> None:
    headers = csrf(client)
    body = {
        "type": "tool",
        "title": "gitleaks",
        "summary": "  Quét repo tìm secret\n  bị commit   nhầm ",
        "tags": ["security", "git"],
        "source": "https://github.com/gitleaks/gitleaks",
    }
    response = send(client, "post", "/api/items", body, headers)
    assert response.status_code == 201
    data = response.json()
    assert (data["type"], data["status"]) == ("tool", "planned")
    assert data["summary"] == "Quét repo tìm secret bị commit nhầm"  # one line
    assert data["tags"] == ["security", "git"]

    url = f"/api/items/{data['id']}"
    patched = send(client, "patch", url, {"summary": "Tìm secret trong lịch sử git"}, headers).json()
    assert patched["summary"] == "Tìm secret trong lịch sử git" and patched["title"] == "gitleaks"
    assert client.get(url).json()["summary"] == "Tìm secret trong lịch sử git"
    assert send(client, "patch", url, {"summary": ""}, headers).json()["summary"] == ""


def test_every_type_takes_a_summary_and_it_stays_short(client: Client) -> None:
    headers = csrf(client)
    book = send(client, "post", "/api/items", {"type": "book", "title": "Dune", "summary": "Sa mạc"}, headers)
    assert book.status_code == 201 and book.json()["summary"] == "Sa mạc"
    # left out: empty, as on Items made before the field
    film = send(client, "post", "/api/items", {"type": "film", "title": "Up"}, headers)
    assert film.json()["summary"] == ""
    too_long = {"type": "tool", "title": "x", "summary": "a" * 301}
    response = send(client, "post", "/api/items", too_long, headers)
    assert response.status_code == 400 and "summary" in response.json()


def test_items_filter_by_type_tool_and_search_the_summary(client: Client) -> None:
    user = owner(client)
    Item.objects.create(user=user, type="tool", title="Semgrep", summary="Quét code tìm lỗi theo luật")
    Item.objects.create(user=user, type="tool", title="pytest", summary="Framework test Python")
    Item.objects.create(user=user, type="book", title="Bảo mật web", summary="Sách về OWASP")
    Item.objects.create(user=stranger(), type="tool", title="Their scanner", summary="Quét code của họ")

    def titles(query: dict[str, str]) -> list[str]:
        return sorted(i["title"] for i in client.get("/api/items", query).json()["results"])

    assert titles({"type": "tool"}) == ["Semgrep", "pytest"]  # never another owner's tool
    assert titles({"q": "quét CODE"}) == ["Semgrep"]  # the summary, case-insensitive
    assert titles({"q": "owasp"}) == ["Bảo mật web"]  # any type's summary
    assert titles({"q": "python", "type": "tool"}) == ["pytest"]
    assert client.get("/api/items", {"type": "hammer"}).status_code == 200  # unknown types list nothing
    assert titles({"type": "hammer"}) == []
