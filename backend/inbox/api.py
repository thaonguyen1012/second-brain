from django.db.models import QuerySet
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import generics
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.serializers import BaseSerializer
from rest_framework.views import APIView

from core.authentication import request_user
from core.pagination import NewestFirstCursor
from inbox import services
from inbox.models import InboxEntry
from inbox.serializers import InboxEntrySerializer, InboxTriageSerializer


@extend_schema_view(
    get=extend_schema(
        operation_id="listInbox",
        parameters=[OpenApiParameter("status", str, enum=InboxEntry.Status.values)],
    ),
    post=extend_schema(operation_id="createInboxEntry"),
)
class InboxListView(generics.ListCreateAPIView[InboxEntry]):
    serializer_class = InboxEntrySerializer
    pagination_class = NewestFirstCursor

    def get_queryset(self) -> QuerySet[InboxEntry]:
        entries = InboxEntry.objects.filter(user=request_user(self.request)).select_related("item")
        if status := self.request.query_params.get("status"):
            entries = entries.filter(status=status)
        return entries

    def perform_create(self, serializer: BaseSerializer[InboxEntry]) -> None:
        data = serializer.validated_data
        serializer.instance = services.add_entry(
            request_user(self.request), data.get("url", ""), data.get("text", "")
        )


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
