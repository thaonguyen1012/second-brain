from collections.abc import Callable

from django.conf import settings
from django.contrib.auth import login, logout
from django.http import HttpRequest, HttpResponse
from django.utils import translation
from django.utils.cache import patch_vary_headers

from core.services import cf_access
from core.services.users import get_or_create_owner

_BACKEND = "django.contrib.auth.backends.ModelBackend"
_SKIP = ("/healthz",)


class LanguageMiddleware:
    """Answers in the language of the web UI: its `lang` cookie (web/lib/i18n/config.ts), Vietnamese
    unless it says en. Django's and DRF's own messages follow it, and the app's through core.i18n.tr.
    Not Django's LocaleMiddleware: that one follows the browser's Accept-Language, while the UI
    language is the owner's switch.
    """

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        language = "en" if request.COOKIES.get("lang") == "en" else settings.LANGUAGE_CODE
        request.LANGUAGE_CODE = language
        # override, not activate: the next request on this thread (or a test) starts from the default
        with translation.override(language):
            response = self.get_response(request)
        patch_vary_headers(response, ("Cookie",))
        response.headers.setdefault("Content-Language", language)
        return response


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
