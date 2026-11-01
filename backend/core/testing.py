"""Helpers shared by API tests."""

from typing import Any

from django.test import Client


def csrf(client: Client) -> dict[str, str]:
    client.get("/api/me")
    return {"X-CSRFToken": client.cookies["csrftoken"].value}


def send(client: Client, method: str, url: str, body: object, headers: dict[str, str]) -> Any:
    return getattr(client, method)(url, body, content_type="application/json", headers=headers)
