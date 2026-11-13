"""Helpers shared by API tests."""

import io
from typing import Any

from django.test import Client
from PIL import Image, ImageDraw


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


def icon_bytes(size: tuple[int, int] = (64, 64), color: str = "red", fmt: str = "PNG") -> bytes:
    """A logo-like picture made with Pillow: a disc of `color` on a transparent ground (an image of one colour
    all over is no logo, thumbnails.logo_to_webp)."""
    image = Image.new("RGBA", size, (0, 0, 0, 0))
    ImageDraw.Draw(image).ellipse((0, 0, size[0] - 1, size[1] - 1), fill=color)
    out = io.BytesIO()
    image.save(out, fmt)
    return out.getvalue()
