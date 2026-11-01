from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.authentication import request_user as _user
from progress import services
from progress.serializers import (
    LastVisitedSerializer,
    ProgressSnapshotSerializer,
    SetDoneResponseSerializer,
    SetDoneSerializer,
    SetLastVisitedSerializer,
)


@method_decorator(ensure_csrf_cookie, name="dispatch")
class ProgressView(APIView):
    @extend_schema(responses=ProgressSnapshotSerializer, operation_id="getProgress")
    def get(self, request: Request) -> Response:
        return Response(services.snapshot(_user(request)))


class PageProgressView(APIView):
    @extend_schema(
        request=SetDoneSerializer,
        responses=SetDoneResponseSerializer,
        operation_id="setPageDone",
        parameters=[
            OpenApiParameter(
                "page", str, OpenApiParameter.PATH, description="Page path, '/' as %2F; '_index'."
            ),
        ],
    )
    def put(self, request: Request, book: str, page: str) -> Response:
        if book not in services.known_books():
            return Response({"detail": "Unknown book."}, status=status.HTTP_400_BAD_REQUEST)
        body = SetDoneSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        page = services.normalize_page(page)
        if len(page) > services.MAX_PAGE_LENGTH:
            return Response({"detail": "Page path too long."}, status=status.HTTP_400_BAD_REQUEST)
        row = services.set_done(_user(request), book, page, body.validated_data["done"])
        return Response({"book": row.book, "page": row.page, "done": row.done, "updatedAt": row.updated_at})


class LastVisitedView(APIView):
    @extend_schema(
        request=SetLastVisitedSerializer,
        responses=LastVisitedSerializer,
        operation_id="setLastVisited",
    )
    def put(self, request: Request) -> Response:
        body = SetLastVisitedSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        data = body.validated_data
        row = services.set_last_visited(
            _user(request), data["book"], services.normalize_page(data["page"]), data.get("title", "")
        )
        return Response(services.last_visited_payload(row))
