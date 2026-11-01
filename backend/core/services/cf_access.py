"""Cloudflare Access JWT verification (Cf-Access-Jwt-Assertion header, RS256, keys from the team's JWKS)."""

import logging
from functools import cache

import jwt
from django.conf import settings

logger = logging.getLogger(__name__)


@cache
def _jwks_client(team_domain: str) -> jwt.PyJWKClient:
    return jwt.PyJWKClient(f"https://{team_domain}/cdn-cgi/access/certs", cache_keys=True, lifespan=3600)


def signing_key(token: str) -> object:
    """Public key for the token's `kid` (fetched from Cloudflare, cached for an hour)."""
    return _jwks_client(settings.CF_ACCESS_TEAM_DOMAIN).get_signing_key_from_jwt(token).key


def verified_email(token: str) -> str | None:
    """The token's email if signature, audience, issuer and expiry are valid, else None."""
    if not (token and settings.CF_ACCESS_TEAM_DOMAIN and settings.CF_ACCESS_AUD):
        return None
    try:
        claims = jwt.decode(
            token,
            key=signing_key(token),  # type: ignore[arg-type]
            algorithms=["RS256"],
            audience=settings.CF_ACCESS_AUD,
            issuer=f"https://{settings.CF_ACCESS_TEAM_DOMAIN}",
            options={"require": ["exp", "iat", "aud", "iss"]},
        )
    except jwt.PyJWTError as exc:
        logger.warning("cf_access: rejected token", extra={"reason": type(exc).__name__})
        return None
    email = claims.get("email")
    return email.lower() if isinstance(email, str) else None
