from django.conf import settings
from django.contrib.auth.models import User
from django.core.validators import URLValidator
from rest_framework import serializers

from core.i18n import tr, tr_lazy
from growth.models import Freshness
from library.models import Item, Note
from library.services import image_url, normalize_tags
from opportunities.models import Evidence, Opportunity

MAX_MARKDOWN = 200_000
# The most Items a note may have: the shortest link (`[a](/thu-vien/item/?id=1)`) is 24 characters
MAX_NOTE_ITEMS = 10_000
# Translated when shown, in the language of the request (core.i18n)
IMAGE_UNREADABLE = tr_lazy("Không đọc được ảnh. Chỉ nhận JPEG, PNG, GIF hoặc WebP.")
NO_HTTP_LINK = tr_lazy("Item chưa có link http(s).")
_PICK_IMAGE = tr_lazy("Chọn một ảnh để tải lên.")


def image_too_large() -> str:
    """'Ảnh lớn hơn 10 MB.' with the configured limit (ITEM_IMAGE_MAX_BYTES)."""
    return tr("Ảnh lớn hơn {mb} MB.", mb=f"{round(settings.ITEM_IMAGE_MAX_BYTES / 2**20, 1):g}")


class ItemSerializer(serializers.ModelSerializer[Item]):
    tags = serializers.ListField(child=serializers.CharField(max_length=50), required=False, max_length=30)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)
    startedAt = serializers.DateTimeField(source="started_at", required=False, allow_null=True)
    finishedAt = serializers.DateTimeField(source="finished_at", required=False, allow_null=True)
    # Annotated by services.items() (no per-row query); a new Item has none yet.
    noteCount = serializers.IntegerField(source="note_count", read_only=True, default=0)
    # The image is changed only through /api/items/{id}/image*, never by this body.
    imageUrl = serializers.SerializerMethodField()
    # Annotated by services.items(): an image fetch for the Item waits for run_jobs or runs.
    imagePending = serializers.BooleanField(source="image_pending", read_only=True, default=False)

    class Meta:
        model = Item
        fields = [
            "id",
            "type",
            "status",
            "title",
            "tags",
            "source",
            "rating",
            "createdAt",
            "updatedAt",
            "startedAt",
            "finishedAt",
            "noteCount",
            "imageUrl",
            "imagePending",
        ]

    def validate_tags(self, value: list[str]) -> list[str]:
        return normalize_tags(value)

    def get_imageUrl(self, item: Item) -> str | None:
        return image_url(item)


class ItemImageUploadSerializer(serializers.Serializer[object]):
    """POST /api/items/{id}/image as multipart/form-data. The bytes are read by Pillow and re-encoded as webp;
    the content type the browser sends is ignored."""

    file = serializers.FileField(
        help_text="JPEG, PNG, GIF or WebP, at most 10 MB.",
        error_messages={
            "required": _PICK_IMAGE,
            "null": _PICK_IMAGE,
            "invalid": _PICK_IMAGE,
            "no_name": _PICK_IMAGE,
            "empty": IMAGE_UNREADABLE,
        },
    )


class ItemImageFetchSerializer(serializers.Serializer[object]):
    """POST /api/items/{id}/image/fetch: the link to take the image from; empty or left out = the Item's
    source."""

    url = serializers.CharField(
        max_length=2000,
        required=False,
        allow_blank=True,
        validators=[URLValidator(schemes=["http", "https"])],
        help_text="An http(s) page (its og:image is taken) or image; default the Item's source.",
    )


class ItemLabelSerializer(serializers.ModelSerializer[Item]):
    """Just enough of an Item to label a link to it (badges on notes), so lists never need every Item."""

    class Meta:
        model = Item
        fields = ["id", "title", "type"]
        read_only_fields = fields


class NoteSerializer(serializers.ModelSerializer[Note]):
    """`items` are the ids of the linked Items, `itemLabels` their titles and types (prefetch `items`)."""

    items = serializers.SerializerMethodField()
    itemLabels = ItemLabelSerializer(source="items", many=True, read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)

    class Meta:
        model = Note
        fields = ["id", "title", "markdown", "items", "itemLabels", "createdAt", "updatedAt"]
        read_only_fields = fields

    def get_items(self, note: Note) -> list[int]:
        return sorted(item.pk for item in note.items.all())


class NoteWriteSerializer(serializers.Serializer[object]):
    """Create (markdown required) or partial update; `items` replaces the links with ids of the owner's Items
    (context["user"]); another user's Item answers 400."""

    title = serializers.CharField(max_length=300, required=False, allow_blank=True)
    markdown = serializers.CharField(max_length=MAX_MARKDOWN, trim_whitespace=False)
    # As many as a note's text can link (200,000 characters of links), so the Item field always saves
    items = serializers.ListField(child=serializers.IntegerField(), max_length=MAX_NOTE_ITEMS, required=False)
    # Create only: the editor's id for a new note; the same id again answers the note it made (200).
    clientId = serializers.UUIDField(required=False)
    # Update only: the `updatedAt` the edit started from; a note saved since then answers 409 with it.
    baseUpdatedAt = serializers.DateTimeField(required=False)

    def validate_items(self, value: list[int]) -> list[Item]:
        user: User = self.context["user"]
        items = list(Item.objects.filter(user=user, pk__in=value))
        if len(items) != len(set(value)):
            raise serializers.ValidationError(tr("Không phải item của bạn."))
        return items


class NoteConflictSerializer(serializers.Serializer[object]):
    """409 on PATCH /api/notes/{id}: the note was saved elsewhere since `baseUpdatedAt`; `note` is it now."""

    detail = serializers.CharField()
    note = NoteSerializer()


class NoteSearchHitSerializer(serializers.Serializer[object]):
    """A note in Cmd+K: `title` is the title or the first line ("" when the note has neither)."""

    id = serializers.IntegerField()
    title = serializers.CharField()
    excerpt = serializers.CharField()
    updatedAt = serializers.DateTimeField()


class NoteSearchSerializer(serializers.Serializer[object]):
    results = NoteSearchHitSerializer(many=True)


class OpportunityMentionEvidenceSerializer(serializers.Serializer[object]):
    """One evidence row of an opportunity that points at the Item."""

    id = serializers.IntegerField()
    stance = serializers.ChoiceField(choices=Evidence.Stance.choices)
    title = serializers.CharField()
    note = serializers.CharField()
    date = serializers.DateField()


class OpportunityMentionSerializer(serializers.Serializer[object]):
    """An opportunity that uses the Item as evidence (supports or contradicts)."""

    id = serializers.IntegerField()
    title = serializers.CharField()
    decision = serializers.ChoiceField(choices=Opportunity.Decision.choices)
    evidence = OpportunityMentionEvidenceSerializer(many=True)


class SkillMentionEvidenceSerializer(serializers.Serializer[object]):
    """One evidence row of a skill that points at the Item."""

    id = serializers.IntegerField()
    title = serializers.CharField()
    note = serializers.CharField()
    date = serializers.DateField()


class SkillMentionSerializer(serializers.Serializer[object]):
    """A skill that uses the Item as evidence, with its freshness from all its evidence."""

    id = serializers.IntegerField()
    name = serializers.CharField()
    freshness = serializers.ChoiceField(choices=Freshness.choices)
    evidence = SkillMentionEvidenceSerializer(many=True)


class NoteMentionSerializer(serializers.Serializer[object]):
    """A note that links the Item or note in its text: its title, else its first line."""

    id = serializers.IntegerField()
    title = serializers.CharField()
    updatedAt = serializers.DateTimeField()


class ItemMentionsSerializer(serializers.Serializer[object]):
    """GET /api/items/{id}/mentions ("Được nhắc tới ở", DECISIONS 9.8): newest evidence first in the first
    two, the most recently changed note first."""

    opportunities = OpportunityMentionSerializer(many=True)
    skills = SkillMentionSerializer(many=True)
    notes = NoteMentionSerializer(many=True)


class NoteMentionsSerializer(serializers.Serializer[object]):
    """GET /api/notes/{id}/mentions: the notes whose text links this note (its backlinks)."""

    notes = NoteMentionSerializer(many=True)
