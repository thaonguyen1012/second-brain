from django.contrib.auth.models import User
from rest_framework import serializers

from library.models import Item, Note
from library.services import normalize_tags

MAX_MARKDOWN = 200_000


class ItemSerializer(serializers.ModelSerializer[Item]):
    tags = serializers.ListField(child=serializers.CharField(max_length=50), required=False, max_length=30)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)
    startedAt = serializers.DateTimeField(source="started_at", required=False, allow_null=True)
    finishedAt = serializers.DateTimeField(source="finished_at", required=False, allow_null=True)

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
        ]

    def validate_tags(self, value: list[str]) -> list[str]:
        return normalize_tags(value)


class NoteSerializer(serializers.ModelSerializer[Note]):
    """`items` are the ids of the linked Items (prefetch them)."""

    items = serializers.SerializerMethodField()
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)

    class Meta:
        model = Note
        fields = ["id", "title", "markdown", "items", "createdAt", "updatedAt"]
        read_only_fields = fields

    def get_items(self, note: Note) -> list[int]:
        return sorted(item.pk for item in note.items.all())


class NoteWriteSerializer(serializers.Serializer[object]):
    """Create (markdown required) or partial update; `items` replaces the links with ids of the owner's Items
    (context["user"]); another user's Item answers 400."""

    title = serializers.CharField(max_length=300, required=False, allow_blank=True)
    markdown = serializers.CharField(max_length=MAX_MARKDOWN, trim_whitespace=False)
    items = serializers.ListField(child=serializers.IntegerField(), max_length=50, required=False)

    def validate_items(self, value: list[int]) -> list[Item]:
        user: User = self.context["user"]
        items = list(Item.objects.filter(user=user, pk__in=value))
        if len(items) != len(set(value)):
            raise serializers.ValidationError("Not one of your items.")
        return items
