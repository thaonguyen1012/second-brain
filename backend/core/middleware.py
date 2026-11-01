from collections.abc import Callable

from django.conf import settings
from django.contrib.auth import login
from django.http import HttpRequest, HttpResponse

from core.services.users import get_or_create_owner


class AccessAuthMiddleware:
    """Maps the request to the single owner user and keeps a Django session for it.

    AUTH_MODE=dev trusts DEV_USER_EMAIL (settings refuse it without DEBUG).
    """

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        if settings.AUTH_MODE == "dev" and not request.user.is_authenticated:
            login(
                request,
                get_or_create_owner(settings.DEV_USER_EMAIL),
                backend="django.contrib.auth.backends.ModelBackend",
            )
        return self.get_response(request)
