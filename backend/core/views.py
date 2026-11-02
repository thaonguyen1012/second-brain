import mimetypes
from urllib.parse import quote

from django.contrib.auth.models import User
from django.db import connection
from django.http import HttpRequest, HttpResponse, JsonResponse
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_safe
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.authentication import request_user
from core.serializers import StatusSerializer
from core.services import status
from core.services.files import attachments_root, resolve_attachment


@require_GET
def healthz(request: HttpRequest) -> JsonResponse:
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1")
    return JsonResponse({"status": "ok"})


class MeSerializer(serializers.Serializer[object]):
    id = serializers.IntegerField()
    email = serializers.EmailField()
    name = serializers.CharField()


@method_decorator(ensure_csrf_cookie, name="dispatch")
class MeView(APIView):
    @extend_schema(responses=MeSerializer, operation_id="getMe")
    def get(self, request: Request) -> Response:
        user = request.user
        assert isinstance(user, User)  # IsAuthenticated ran
        name = user.get_full_name() or user.email.split("@")[0]
        return Response({"id": user.pk, "email": user.email, "name": name})


class StatusView(APIView):
    @extend_schema(responses=StatusSerializer, operation_id="getStatus")
    def get(self, request: Request) -> Response:
        """This month's LLM cost at paid prices vs the budget, calls this month, the last morning brief and
        the background jobs waiting or failed, by kind."""
        return Response(StatusSerializer(status.snapshot(request_user(request))).data)


# Types a browser may show inline; everything else (HTML, SVG, XML, office files...) downloads.
INLINE_TYPES = frozenset(
    {"application/pdf", "image/png", "image/jpeg", "image/gif", "image/webp", "text/plain"}
)


@require_safe
def attachment(request: HttpRequest, path: str) -> HttpResponse:
    """Authorise /files/<path>; nginx serves the bytes from its internal /internal/files/ location."""
    if not request.user.is_authenticated:
        return JsonResponse({"detail": "Authentication credentials were not provided."}, status=401)
    target = resolve_attachment(path)
    if target is None:
        return JsonResponse({"detail": "Not found."}, status=404)
    rel = target.relative_to(attachments_root()).as_posix()
    response = HttpResponse()
    response["X-Accel-Redirect"] = "/internal/files/" + quote(rel)
    response["Content-Type"] = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
    response["X-Content-Type-Options"] = "nosniff"
    if response["Content-Type"] not in INLINE_TYPES:
        response["Content-Disposition"] = "attachment"  # never render HTML/SVG/XML same-origin
    return response
