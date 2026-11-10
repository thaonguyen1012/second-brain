from pathlib import Path
from typing import Any

import pytest
from django.test import Client

from progress import services as progress_services


@pytest.fixture
def client() -> Client:
    """Logged in as the owner through AUTH_MODE=dev, with CSRF checks enforced like a browser."""
    return Client(enforce_csrf_checks=True)


@pytest.fixture
def anon_client(settings: Any) -> Client:
    settings.AUTH_MODE = "cf_access"  # no JWT header -> anonymous
    return Client(enforce_csrf_checks=True)


@pytest.fixture(autouse=True)
def handbooks(settings: Any, tmp_path_factory: pytest.TempPathFactory) -> Path:
    """A content folder with one made-up handbook (ky-nang/garden-notes), so no test depends on which
    handbooks are imported into web/content/docs. A folder of its own: tests look inside their tmp_path."""
    root = tmp_path_factory.mktemp("content-docs")
    (root / "ky-nang" / "garden-notes").mkdir(parents=True)
    settings.CONTENT_DIR = root
    progress_services.known_books.cache_clear()
    return root


@pytest.fixture(autouse=True)
def no_real_llm(settings: Any) -> None:
    """Tests never reach a real LLM provider, even when backend/.env has a key; fakes patch get_provider."""
    settings.GEMINI_API_KEY = ""
