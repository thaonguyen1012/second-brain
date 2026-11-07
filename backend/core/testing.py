"""Helpers shared by API tests."""

import io
from typing import Any

from django.test import Client
from PIL import Image


def csrf(client: Client) -> dict[str, str]:
    client.get("/api/me")
    return {"X-CSRFToken": client.cookies["csrftoken"].value}


def send(client: Client, method: str, url: str, body: object, headers: dict[str, str]) -> Any:
    return getattr(client, method)(url, body, content_type="application/json", headers=headers)


def image_bytes(size: tuple[int, int] = (64, 32), color: str = "red", fmt: str = "PNG") -> bytes:
    """An image file made in memory with Pillow; another colour gives other bytes (another stored name)."""
    out = io.BytesIO()
    Image.new("RGB", size, color).save(out, fmt)
    return out.getvalue()
