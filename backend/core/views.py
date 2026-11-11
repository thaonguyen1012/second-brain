import mimetypes
from urllib.parse import quote

from django.conf import settings
from django.contrib.auth.models import User
from django.db import connection
from django.http import FileResponse, Http404, HttpRequest, HttpResponse, JsonResponse, StreamingHttpResponse
from django.http.response import HttpResponseBase
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_safe
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.authentication import request_user
from core.serializers import CountsSerializer, StatusSerializer
from core.services import counts, export, status, thumbnails
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


class CountsView(APIView):
    @extend_schema(responses=CountsSerializer, operation_id="getCounts")
    def get(self, request: Request) -> Response:
        """The sidebar's numbers: each list's row count with its page's default filters; a running timer."""
        return Response(CountsSerializer(counts.snapshot(request_user(request))).data)


class ExportView(APIView):
    @extend_schema(
        operation_id="downloadExport",
        responses={
            (200, "application/zip"): OpenApiResponse(
                OpenApiTypes.BINARY, description="alex-brain-<date>.zip, streamed."
            )
        },
    )
    def get(self, request: Request) -> StreamingHttpResponse:
        """A copy of all the owner's data (DECISIONS 4.7) as a zip, the same files as `manage.py export`:
        notes/*.md, data/*.json, images/*.webp (Item images), manifest.json. No secrets: no password hash,
        sessions, jobs or LLM rows."""
        folder = f"alex-brain-{timezone.localdate().isoformat()}"
        response = StreamingHttpResponse(
            export.stream_zip(request_user(request), folder), content_type="application/zip"
        )
        response["Content-Disposition"] = f'attachment; filename="{folder}.zip"'
        response["Cache-Control"] = "no-store"
        response["X-Content-Type-Options"] = "nosniff"
        response["X-Accel-Buffering"] = "no"  # nginx passes the chunks on as they come
        return response


def thumbnail_response(name: str) -> HttpResponseBase:
    """A stored image (core/services/thumbnails.py: inbox thumbnails, Item images), once the caller has
    checked the owner of the row naming it. nginx sends the bytes from its internal /internal/thumbs/ location
    (X-Accel-Redirect); Django streams them itself only in DEBUG. 404 when there is no such file."""
    path = thumbnails.path_of(name)
    if path is None:
        raise Http404
    if settings.DEBUG:
        response: HttpResponseBase = FileResponse(path.open("rb"), content_type="image/webp")
    else:
        response = HttpResponse(content_type="image/webp")
        response["X-Accel-Redirect"] = f"/internal/thumbs/{path.name}"
    response["Cache-Control"] = "private, max-age=86400"
    return response


# Types a browser may show inline; everything else (HTML, SVG, XML, office files...) downloads.
INLINE_TYPES = frozenset(
    {"application/pdf", "image/png", "image/jpeg", "image/gif", "image/webp", "text/plain"}
)


@require_safe
def attachment(request: HttpRequest, path: str) -> HttpResponseBase:
    """Authorise /files/<path>; nginx serves the bytes from its internal /internal/files/ location. In
    DEBUG Django streams them itself, so the dev proxy can route /files/ here as nginx does (audit P-11)."""
    if not request.user.is_authenticated:
        return JsonResponse({"detail": "Authentication credentials were not provided."}, status=401)
    target = resolve_attachment(path)
    if target is None:
        return JsonResponse({"detail": "Not found."}, status=404)
    rel = target.relative_to(attachments_root()).as_posix()
    content_type = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
    if settings.DEBUG:
        response: HttpResponseBase = FileResponse(target.open("rb"), content_type=content_type)
    else:
        response = HttpResponse()
        response["X-Accel-Redirect"] = "/internal/files/" + quote(rel)
    response["Content-Type"] = content_type
    response["X-Content-Type-Options"] = "nosniff"
    if response["Content-Type"] not in INLINE_TYPES:
        response["Content-Disposition"] = "attachment"  # never render HTML/SVG/XML same-origin
    return response
