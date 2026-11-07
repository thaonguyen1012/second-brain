from django.db.models import QuerySet
from django.http.response import HttpResponseBase
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.serializers import BaseSerializer
from rest_framework.views import APIView

from core.authentication import request_user
from core.pagination import NewestFirstCursor
from core.views import thumbnail_response
from inbox import services
from inbox.models import InboxEntry
from inbox.serializers import InboxCountSerializer, InboxEntrySerializer, InboxTriageSerializer


@extend_schema_view(
    get=extend_schema(
        operation_id="listInbox",
        parameters=[
            OpenApiParameter("status", str, enum=InboxEntry.Status.values),
            OpenApiParameter("q", str, description="Case-insensitive match in the OG title, text or URL."),
        ],
    ),
    post=extend_schema(operation_id="createInboxEntry"),
)
class InboxListView(generics.ListCreateAPIView[InboxEntry]):
    serializer_class = InboxEntrySerializer
    pagination_class = NewestFirstCursor

    def get_queryset(self) -> QuerySet[InboxEntry]:
        params = self.request.query_params
        return services.entries(request_user(self.request), params.get("status"), params.get("q", ""))

    def perform_create(self, serializer: BaseSerializer[InboxEntry]) -> None:
        data = serializer.validated_data
        serializer.instance = services.add_entry(
            request_user(self.request), data.get("url", ""), data.get("text", "")
        )


class InboxCountView(APIView):
    @extend_schema(
        responses=InboxCountSerializer,
        operation_id="countInbox",
        parameters=[
            OpenApiParameter("status", str, enum=InboxEntry.Status.values, description="Default inbox.")
        ],
    )
    def get(self, request: Request) -> Response:
        """How many entries have the status (the Inbox badge in the top bar and on Hôm nay), one COUNT."""
        state = request.query_params.get("status", InboxEntry.Status.INBOX)
        if state not in InboxEntry.Status.values:
            raise ValidationError({"status": f"One of {InboxEntry.Status.values}."})
        count = InboxEntry.objects.filter(user=request_user(request), status=state).count()
        return Response(InboxCountSerializer({"count": count}).data)


class InboxEntryView(APIView):
    @extend_schema(
        request=InboxTriageSerializer, responses=InboxEntrySerializer, operation_id="updateInboxEntry"
    )
    def patch(self, request: Request, pk: int) -> Response:
        user = request_user(request)
        entry = get_object_or_404(InboxEntry, pk=pk, user=user)
        body = InboxTriageSerializer(data=request.data, context={"user": user})
        body.is_valid(raise_exception=True)
        entry = services.triage_entry(entry, dict(body.validated_data))
        return Response(InboxEntrySerializer(entry).data)

    @extend_schema(responses={204: None}, operation_id="deleteInboxEntry")
    def delete(self, request: Request, pk: int) -> Response:
        """Evidence made from it keeps its title snapshot."""
        services.delete_entry(get_object_or_404(InboxEntry, pk=pk, user=request_user(request)))
        return Response(status=status.HTTP_204_NO_CONTENT)


class InboxThumbnailView(APIView):
    """The entry's webp thumbnail; nginx serves the bytes (X-Accel-Redirect), Django only in DEBUG."""

    @extend_schema(exclude=True)
    def get(self, request: Request, pk: int) -> HttpResponseBase:
        entry = get_object_or_404(InboxEntry, pk=pk, user=request_user(request))
        return thumbnail_response(entry.og_image_path)
