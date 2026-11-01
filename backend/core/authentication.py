from drf_spectacular.extensions import OpenApiAuthenticationExtension
from rest_framework.authentication import SessionAuthentication
from rest_framework.request import Request


class SessionAuthentication401(SessionAuthentication):
    """Session auth (with DRF's CSRF check) that answers 401 instead of 403 when not logged in."""

    def authenticate_header(self, request: Request) -> str:
        return "Session"


class SessionAuthentication401Scheme(OpenApiAuthenticationExtension):  # type: ignore[no-untyped-call]
    target_class = "core.authentication.SessionAuthentication401"
    name = "sessionAuth"

    def get_security_definition(self, auto_schema: object) -> dict[str, str]:
        return {"type": "apiKey", "in": "cookie", "name": "sessionid"}
