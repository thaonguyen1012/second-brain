from django.db.models import QuerySet
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
from core.serializers import ErrorSerializer
from library import services
from library.models import Item, Note
from library.serializers import ItemSerializer, NoteSerializer, NoteWriteSerializer


@extend_schema_view(
    get=extend_schema(
        operation_id="listItems",
        parameters=[
            OpenApiParameter("type", str, enum=Item.Type.values),
            OpenApiParameter("status", str, enum=Item.Status.values),
            OpenApiParameter(
                "q", str, description="Case-insensitive match in title or source, or one exact tag."
            ),
        ],
    ),
    post=extend_schema(operation_id="createItem"),
)
class ItemListView(generics.ListCreateAPIView[Item]):
    serializer_class = ItemSerializer
    pagination_class = NewestFirstCursor

    def get_queryset(self) -> QuerySet[Item]:
        items = services.items(request_user(self.request), self.request.query_params.get("q", ""))
        for field in ("type", "status"):
            if value := self.request.query_params.get(field):
                items = items.filter(**{field: value})
        return items

    def perform_create(self, serializer: BaseSerializer[Item]) -> None:
        serializer.save(user=request_user(self.request))


class ItemView(APIView):
    @extend_schema(request=ItemSerializer, responses=ItemSerializer, operation_id="updateItem")
    def patch(self, request: Request, pk: int) -> Response:
        item = get_object_or_404(services.items(request_user(request)), pk=pk)
        body = ItemSerializer(item, data=request.data, partial=True)
        body.is_valid(raise_exception=True)
        body.save()
        return Response(body.data)

    @extend_schema(responses={204: None, 409: ErrorSerializer}, operation_id="deleteItem")
    def delete(self, request: Request, pk: int) -> Response:
        """Links to it are cleared (notes, inbox, evidence, achievements); 409 for a project with time
        entries."""
        item = get_object_or_404(Item, pk=pk, user=request_user(request))
        try:
            services.delete_item(item)
        except services.ItemInUse:
            detail = "Dự án đã có giờ làm. Hãy xóa các mục giờ làm trước."
            return Response({"detail": detail}, status=status.HTTP_409_CONFLICT)
        return Response(status=status.HTTP_204_NO_CONTENT)


def _note(request: Request, pk: int) -> Note:
    return get_object_or_404(Note.objects.prefetch_related("items"), pk=pk, user=request_user(request))


@extend_schema_view(
    get=extend_schema(
        operation_id="listNotes",
        parameters=[
            OpenApiParameter("q", str, description="Case-insensitive match in title or markdown."),
            OpenApiParameter("item", int, description="Only notes linked to this Item id."),
        ],
    )
)
class NoteListView(generics.ListAPIView[Note]):
    serializer_class = NoteSerializer
    pagination_class = NewestFirstCursor

    def get_queryset(self) -> QuerySet[Note]:
        raw = self.request.query_params.get("item")
        if raw is not None and not raw.isdigit():
            raise ValidationError({"item": "A positive integer."})
        query = self.request.query_params.get("q", "")
        rows = services.notes(request_user(self.request), query, int(raw) if raw is not None else None)
        return rows.prefetch_related("items")

    @extend_schema(request=NoteWriteSerializer, responses={201: NoteSerializer}, operation_id="createNote")
    def post(self, request: Request) -> Response:
        user = request_user(request)
        body = NoteWriteSerializer(data=request.data, context={"user": user})
        body.is_valid(raise_exception=True)
        note = services.save_note(Note(user=user), dict(body.validated_data))
        return Response(NoteSerializer(_note(request, note.pk)).data, status=status.HTTP_201_CREATED)


class NoteView(APIView):
    @extend_schema(responses=NoteSerializer, operation_id="getNote")
    def get(self, request: Request, pk: int) -> Response:
        return Response(NoteSerializer(_note(request, pk)).data)

    @extend_schema(request=NoteWriteSerializer, responses=NoteSerializer, operation_id="updateNote")
    def patch(self, request: Request, pk: int) -> Response:
        note = get_object_or_404(Note, pk=pk, user=request_user(request))
        body = NoteWriteSerializer(data=request.data, partial=True, context={"user": request_user(request)})
        body.is_valid(raise_exception=True)
        services.save_note(note, dict(body.validated_data))
        return Response(NoteSerializer(_note(request, pk)).data)

    @extend_schema(responses={204: None}, operation_id="deleteNote")
    def delete(self, request: Request, pk: int) -> Response:
        """Evidence that pointed at the note keeps its title snapshot."""
        get_object_or_404(Note, pk=pk, user=request_user(request)).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
