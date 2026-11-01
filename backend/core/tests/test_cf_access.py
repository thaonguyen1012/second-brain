"""Cf-Access JWT middleware, with a locally generated RSA key standing in for Cloudflare's JWKS."""

import time
from typing import Any

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from django.test import Client

from core.services import cf_access

pytestmark = pytest.mark.django_db

TEAM = "example.cloudflareaccess.com"
AUD = "test-aud"
OWNER = "alex@example.com"
KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
OTHER_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture(autouse=True)
def cf_settings(settings: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    settings.AUTH_MODE = "cf_access"
    settings.CF_ACCESS_TEAM_DOMAIN = TEAM
    settings.CF_ACCESS_AUD = AUD
    settings.OWNER_EMAIL = OWNER
    monkeypatch.setattr(cf_access, "signing_key", lambda token: KEY.public_key())


def token(key: Any = KEY, **overrides: Any) -> str:
    now = int(time.time())
    claims = {"email": OWNER, "aud": [AUD], "iss": f"https://{TEAM}", "iat": now, "exp": now + 300}
    claims.update(overrides)
    return jwt.encode(claims, key, algorithm="RS256")


def me(client: Client, jwt_token: str | None) -> int:
    headers = {"Cf-Access-Jwt-Assertion": jwt_token} if jwt_token else {}
    return client.get("/api/me", headers=headers).status_code


def test_valid_token_logs_in_owner() -> None:
    client = Client()
    response = client.get("/api/me", headers={"Cf-Access-Jwt-Assertion": token()})
    assert response.status_code == 200
    assert response.json()["email"] == OWNER


@pytest.mark.parametrize(
    "bad",
    [
        pytest.param({"key": OTHER_KEY}, id="wrong-signature"),
        pytest.param({"aud": ["other-app"]}, id="wrong-audience"),
        pytest.param({"iss": "https://evil.cloudflareaccess.com"}, id="wrong-issuer"),
        pytest.param({"exp": int(time.time()) - 10}, id="expired"),
        pytest.param({"email": "someone@example.com"}, id="not-the-owner"),
    ],
)
def test_invalid_tokens_are_anonymous(bad: dict[str, Any]) -> None:
    assert me(Client(), token(**bad)) == 401


def test_unsigned_token_is_rejected() -> None:
    unsigned = jwt.encode({"email": OWNER, "aud": AUD, "iss": f"https://{TEAM}"}, "", algorithm="none")
    assert me(Client(), unsigned) == 401


def test_session_is_dropped_without_token() -> None:
    client = Client()
    assert me(client, token()) == 200
    assert me(client, None) == 401
    assert me(client, None) == 401  # the session cookie alone is not enough


def test_healthz_needs_no_token() -> None:
    assert Client().get("/healthz").status_code == 200
