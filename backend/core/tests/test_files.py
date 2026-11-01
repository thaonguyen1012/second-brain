from pathlib import Path
from typing import Any

import pytest
from django.test import Client

pytestmark = pytest.mark.django_db


@pytest.fixture
def files_dir(settings: Any, tmp_path: Path) -> Path:
    root = tmp_path / "files"
    (root / "book one").mkdir(parents=True)
    (root / "book one" / "slides.pdf").write_bytes(b"%PDF-1.4")
    (tmp_path / "secret.txt").write_text("outside")
    (root / "escape.txt").symlink_to(tmp_path / "secret.txt")
    settings.FILES_DIR = root
    return root


def test_file_is_handed_to_nginx(client: Client, files_dir: Path) -> None:
    response = client.get("/files/book%20one/slides.pdf")
    assert response.status_code == 200
    assert response["X-Accel-Redirect"] == "/internal/files/book%20one/slides.pdf"
    assert response["Content-Type"] == "application/pdf"
    assert response.content == b""
    assert "Content-Disposition" not in response


def test_html_attachments_download(client: Client, files_dir: Path) -> None:
    (files_dir / "page.html").write_text("<script>alert(1)</script>")
    response = client.get("/files/page.html")
    assert response.status_code == 200
    assert response["Content-Disposition"] == "attachment"


@pytest.mark.parametrize(
    "path", ["../secret.txt", "book%20one/../../secret.txt", "escape.txt", "missing.pdf", "book%20one"]
)
def test_traversal_symlinks_and_missing_are_404(client: Client, files_dir: Path, path: str) -> None:
    response = client.get(f"/files/{path}")
    assert response.status_code == 404
    assert "X-Accel-Redirect" not in response


def test_files_require_auth(anon_client: Client, files_dir: Path) -> None:
    response = anon_client.get("/files/book%20one/slides.pdf")
    assert response.status_code == 401
    assert "X-Accel-Redirect" not in response
