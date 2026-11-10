"""One test per API_CONTRACT.md endpoint, plus the error cases the contract names."""

from typing import Any

import pytest
from django.test import Client

pytestmark = pytest.mark.django_db

BOOK = "garden-notes"
PAGE = "01-soil-and-water/001-what-plants-need"
PAGE_URL = PAGE.replace("/", "%2F")


def csrf(client: Client) -> dict[str, str]:
    client.get("/api/me")
    return {"X-CSRFToken": client.cookies["csrftoken"].value}


def put(client: Client, url: str, body: object, headers: dict[str, str]) -> Any:
    return client.put(url, body, content_type="application/json", headers=headers)


def test_get_progress_empty(client: Client) -> None:
    response = client.get("/api/progress")
    assert response.status_code == 200
    assert response.json() == {"done": {}, "lastVisited": None}
    assert "csrftoken" in response.cookies


def test_put_page_done_and_undone(client: Client) -> None:
    headers = csrf(client)
    response = put(client, f"/api/progress/{BOOK}/{PAGE_URL}", {"done": True}, headers)
    assert response.status_code == 200
    body = response.json()
    assert (body["book"], body["page"], body["done"]) == (BOOK, PAGE, True)
    assert body["updatedAt"]
    assert client.get("/api/progress").json()["done"] == {BOOK: {PAGE: True}}

    # Idempotent, and un-marking removes the page from the snapshot.
    assert put(client, f"/api/progress/{BOOK}/{PAGE_URL}", {"done": True}, headers).status_code == 200
    assert put(client, f"/api/progress/{BOOK}/{PAGE_URL}", {"done": False}, headers).json()["done"] is False
    assert client.get("/api/progress").json()["done"] == {}


def test_put_index_page(client: Client) -> None:
    response = put(client, f"/api/progress/{BOOK}/_index", {"done": True}, csrf(client))
    assert response.json()["page"] == ""
    assert client.get("/api/progress").json()["done"] == {BOOK: {"": True}}


def test_put_page_rejects_unknown_book_and_bad_body(client: Client) -> None:
    headers = csrf(client)
    assert put(client, f"/api/progress/no-such-book/{PAGE_URL}", {"done": True}, headers).status_code == 400
    assert put(client, f"/api/progress/{BOOK}/{PAGE_URL}", {"done": "maybe"}, headers).status_code == 400
    assert put(client, f"/api/progress/{BOOK}/{PAGE_URL}", {}, headers).status_code == 400
    assert put(client, f"/api/progress/{BOOK}/{'a' * 501}", {"done": True}, headers).status_code == 400


def test_put_last_visited(client: Client) -> None:
    headers = csrf(client)
    body = {"book": BOOK, "page": PAGE, "title": "What plants need"}
    response = put(client, "/api/progress/last-visited", body, headers)
    assert response.status_code == 200
    data = response.json()
    assert (data["bookSlug"], data["pageSlug"], data["title"]) == (BOOK, PAGE, body["title"])
    assert data["at"]
    assert client.get("/api/progress").json()["lastVisited"]["pageSlug"] == PAGE

    # title is optional; the second visit replaces the first.
    data = put(client, "/api/progress/last-visited", {"book": BOOK, "page": ""}, headers).json()
    assert data["pageSlug"] == "" and "title" not in data
    assert put(client, "/api/progress/last-visited", {"book": "nope", "page": ""}, headers).status_code == 400


def test_unsafe_methods_require_csrf(client: Client) -> None:
    client.get("/api/me")
    response = put(client, f"/api/progress/{BOOK}/{PAGE_URL}", {"done": True}, {})
    assert response.status_code == 403


def test_progress_requires_auth(anon_client: Client) -> None:
    assert anon_client.get("/api/progress").status_code == 401
    response = put(anon_client, f"/api/progress/{BOOK}/{PAGE_URL}", {"done": True}, {})
    assert response.status_code == 401


def test_openapi_schema(client: Client) -> None:
    response = client.get("/api/schema/")
    assert response.status_code == 200
    text = response.content.decode()
    for op in ("getMe", "getProgress", "setPageDone", "setLastVisited"):
        assert op in text


def test_a_handbook_imported_while_the_server_runs_is_accepted(client: Client, handbooks: Any) -> None:
    headers = csrf(client)
    url = "/api/progress/bread-notes/01-flour"
    assert put(client, url, {"done": True}, headers).status_code == 400  # not on disk yet
    (handbooks / "kinh-doanh" / "bread-notes").mkdir(parents=True)
    assert put(client, url, {"done": True}, headers).status_code == 200  # found without a restart


def test_no_content_folder_means_no_known_book(client: Client, settings: Any, handbooks: Any) -> None:
    from progress import services

    settings.CONTENT_DIR = handbooks / "missing"
    services.known_books.cache_clear()
    assert put(client, f"/api/progress/{BOOK}/{PAGE_URL}", {"done": True}, csrf(client)).status_code == 400
