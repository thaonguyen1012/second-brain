from typing import Any

from django.contrib.auth.models import User
from django.db.models import QuerySet
from django.http.response import HttpResponseBase
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import MultiPartParser
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.serializers import BaseSerializer
from rest_framework.views import APIView

from core.authentication import request_user
from core.i18n import tr
from core.pagination import NewestFirstCursor
from core.serializers import ErrorSerializer
from core.services import thumbnails
from core.views import thumbnail_response
from library import mentions, services
from library.models import Item, Note
from library.serializers import (
    IMAGE_UNREADABLE,
    NO_HTTP_LINK,
    ItemImageFetchSerializer,
    ItemImageUploadSerializer,
    ItemMentionsSerializer,
    ItemSerializer,
    NoteSearchSerializer,
    NoteSerializer,
    NoteWriteSerializer,
    image_too_large,
)


def _item_json(user: User, pk: int) -> Any:
    """The Item as every Item response sends it: read through services.items, so noteCount and imagePending
    are the list's annotations (also right after a write that queued an image job). 404 when the Item was
    deleted while the request ran."""
    return ItemSerializer(get_object_or_404(services.items(user), pk=pk)).data


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
        """A status other than planned sets the start or finish date (services.apply_status_dates); an http(s)
        source of an Item that is not a project queues its image (imagePending)."""
        user = request_user(self.request)
        item = services.create_item(user, dict(serializer.validated_data))
        serializer.instance = services.items(user).get(pk=item.pk)


class ItemView(APIView):
    @extend_schema(responses=ItemSerializer, operation_id="getItem")
    def get(self, request: Request, pk: int) -> Response:
        """One Item with its noteCount (Cmd+K deep link /thu-vien/?item=N)."""
        return Response(ItemSerializer(get_object_or_404(services.items(request_user(request)), pk=pk)).data)

    @extend_schema(request=ItemSerializer, responses=ItemSerializer, operation_id="updateItem")
    def patch(self, request: Request, pk: int) -> Response:
        """A status change moves startedAt / finishedAt unless the body sets them (apply_status_dates); a new
        http(s) source of an Item without an image queues its image."""
        user = request_user(request)
        item = get_object_or_404(Item, pk=pk, user=user)
        body = ItemSerializer(item, data=request.data, partial=True)
        body.is_valid(raise_exception=True)
        services.update_item(item, dict(body.validated_data))
        return Response(_item_json(user, pk))

    @extend_schema(responses={204: None, 409: ErrorSerializer}, operation_id="deleteItem")
    def delete(self, request: Request, pk: int) -> Response:
        """Links to it are cleared (notes, inbox, evidence, achievements); 409 for a project with time
        entries."""
        item = get_object_or_404(Item, pk=pk, user=request_user(request))
        try:
            services.delete_item(item)
        except services.ItemInUse:
            detail = tr("Dự án đã có giờ làm. Hãy xóa các mục giờ làm trước.")
            return Response({"detail": detail}, status=status.HTTP_409_CONFLICT)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ItemMentionsView(APIView):
    @extend_schema(responses=ItemMentionsSerializer, operation_id="getItemMentions")
    def get(self, request: Request, pk: int) -> Response:
        """Where the Item is used ("Được nhắc tới ở" on the Item page): the opportunities that hold it as
        evidence, with the stance of each row, and the skills that do, with their freshness. 404 for another
        owner's Item."""
        user = request_user(request)
        item = get_object_or_404(Item, pk=pk, user=user)
        return Response(ItemMentionsSerializer(mentions.item_mentions(user, item)).data)


class ItemImageView(APIView):
    """The Item's image (a cover; a project's logo). The upload is the app's only multipart body: this view
    parses multipart and nothing else, so a JSON body answers 415."""

    parser_classes = [MultiPartParser]

    @extend_schema(exclude=True)
    def get(self, request: Request, pk: int) -> HttpResponseBase:
        """The webp (404 without an image); nginx sends the bytes (X-Accel-Redirect), Django only in DEBUG."""
        item = get_object_or_404(Item, pk=pk, user=request_user(request))
        return thumbnail_response(item.image_path)

    @extend_schema(
        request={"multipart/form-data": ItemImageUploadSerializer},
        responses=ItemSerializer,
        operation_id="uploadItemImage",
    )
    def post(self, request: Request, pk: int) -> Response:
        """Set (or replace) the image from a file: JPEG, PNG, GIF or WebP up to 10 MB, stored re-encoded as a
        webp of at most 600 px. Answers the Item; the replaced file goes unless another row uses it, and a
        fetch from a link that waits or runs is ended (the upload wins)."""
        user = request_user(request)
        item = get_object_or_404(Item, pk=pk, user=user)
        body = ItemImageUploadSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        try:
            services.upload_image(item, body.validated_data["file"])
        except services.ImageTooLarge as error:
            raise ValidationError({"file": [image_too_large()]}) from error
        except thumbnails.ThumbnailError as error:
            raise ValidationError({"file": [IMAGE_UNREADABLE]}) from error
        return Response(_item_json(user, pk))

    @extend_schema(responses={204: None}, operation_id="deleteItemImage")
    def delete(self, request: Request, pk: int) -> Response:
        """Remove the image (also when there is none) and end a fetch from a link that waits or runs, so it
        never puts an image back; the file goes unless another row uses it."""
        item = get_object_or_404(Item, pk=pk, user=request_user(request))
        services.set_image(item.pk, "")
        return Response(status=status.HTTP_204_NO_CONTENT)


class ItemImageFetchView(APIView):
    @extend_schema(
        request=ItemImageFetchSerializer, responses={202: ItemSerializer}, operation_id="fetchItemImage"
    )
    def post(self, request: Request, pk: int) -> Response:
        """Take the image from a link, in the background: the og:image of the page, or the URL itself when it
        is an image (`url`, default the Item's source). Answers 202 with the Item (imagePending true) at once;
        run_jobs makes the request, so the image appears within about 5 minutes. It replaces only the image
        the Item had when asked: an upload, a removal or an inbox link made meanwhile ends the fetch."""
        user = request_user(request)
        item = get_object_or_404(Item, pk=pk, user=user)
        body = ItemImageFetchSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        url = body.validated_data.get("url") or item.source.strip()
        if not services.is_http_url(url):
            raise ValidationError({"url": [NO_HTTP_LINK]})
        services.request_fetch(item, url)
        return Response(_item_json(user, pk), status=status.HTTP_202_ACCEPTED)


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


SEARCH_LIMIT = 20


class NoteSearchView(APIView):
    @extend_schema(
        responses=NoteSearchSerializer,
        operation_id="searchNotes",
        parameters=[
            OpenApiParameter(
                "q", str, required=True, description="Case-insensitive match in title or markdown."
            ),
            OpenApiParameter("limit", int, description=f"1-{SEARCH_LIMIT}, default 5."),
        ],
    )
    def get(self, request: Request) -> Response:
        """Cmd+K: the newest matching notes with an excerpt around the match, never the whole markdown."""
        raw = request.query_params.get("limit", "5")
        if not raw.isdigit() or not 1 <= int(raw) <= SEARCH_LIMIT:
            raise ValidationError({"limit": f"A number from 1 to {SEARCH_LIMIT}."})
        hits = services.search_notes(request_user(request), request.query_params.get("q", ""), int(raw))
        return Response(NoteSearchSerializer({"results": hits}).data)


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
