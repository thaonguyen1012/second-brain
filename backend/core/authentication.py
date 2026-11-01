from rest_framework.authentication import SessionAuthentication
from rest_framework.request import Request


class SessionAuthentication401(SessionAuthentication):
    """Session auth (with DRF's CSRF check) that answers 401 instead of 403 when not logged in."""

    def authenticate_header(self, request: Request) -> str:
        return "Session"
