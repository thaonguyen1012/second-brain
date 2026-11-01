from collections.abc import Callable

from django.conf import settings
from django.contrib.auth import login, logout
from django.http import HttpRequest, HttpResponse

from core.services import cf_access
from core.services.users import get_or_create_owner

_BACKEND = "django.contrib.auth.backends.ModelBackend"
_SKIP = ("/healthz",)


class AccessAuthMiddleware:
    """Maps the request to the single owner user and keeps a Django session for it.

    AUTH_MODE=cf_access: every request must carry a valid Cloudflare Access JWT for OWNER_EMAIL, otherwise
    the session is dropped and the request is anonymous (API answers 401). AUTH_MODE=dev trusts
    DEV_USER_EMAIL (settings refuse it without DEBUG).
    """

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        if request.path not in _SKIP:
            if settings.AUTH_MODE == "dev":
                self._ensure_login(request, settings.DEV_USER_EMAIL)
            else:
                email = cf_access.verified_email(request.headers.get("Cf-Access-Jwt-Assertion", ""))
                if email and email == settings.OWNER_EMAIL.lower():
                    self._ensure_login(request, email)
                elif request.user.is_authenticated:
                    logout(request)
        return self.get_response(request)

    @staticmethod
    def _ensure_login(request: HttpRequest, email: str) -> None:
        if not (request.user.is_authenticated and request.user.get_username() == email.lower()):
            login(request, get_or_create_owner(email), backend=_BACKEND)
