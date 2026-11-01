from typing import Any

import pytest
from django.test import Client


@pytest.fixture
def client() -> Client:
    """Logged in as the owner through AUTH_MODE=dev, with CSRF checks enforced like a browser."""
    return Client(enforce_csrf_checks=True)


@pytest.fixture
def anon_client(settings: Any) -> Client:
    settings.AUTH_MODE = "cf_access"  # no JWT header -> anonymous
    return Client(enforce_csrf_checks=True)
