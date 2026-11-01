import pytest
from django.test import Client

pytestmark = pytest.mark.django_db


def test_healthz(client: Client) -> None:
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_me_returns_owner_and_sets_csrf_cookie(client: Client) -> None:
    response = client.get("/api/me")
    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "dev@localhost"
    assert body["name"] == "dev"
    assert isinstance(body["id"], int)
    assert "csrftoken" in response.cookies


def test_me_requires_auth(anon_client: Client) -> None:
    response = anon_client.get("/api/me")
    assert response.status_code == 401
    assert "detail" in response.json()
