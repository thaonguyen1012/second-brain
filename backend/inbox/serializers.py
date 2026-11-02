from django.core.validators import URLValidator
from rest_framework import serializers

from inbox.models import InboxEntry
from library.models import Item

MAX_TEXT = 20_000


class InboxEntrySerializer(serializers.ModelSerializer[InboxEntry]):
    url = serializers.CharField(
        max_length=2000,
        required=False,
        allow_blank=True,
        validators=[URLValidator(schemes=["http", "https"])],
    )
    text = serializers.CharField(max_length=MAX_TEXT, required=False, allow_blank=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    archivedAt = serializers.DateTimeField(source="archived_at", read_only=True, allow_null=True)
    processedAt = serializers.DateTimeField(source="processed_at", read_only=True, allow_null=True)
    ogTitle = serializers.CharField(source="og_title", read_only=True)
    ogDescription = serializers.CharField(source="og_description", read_only=True)
    ogSiteName = serializers.CharField(source="og_site_name", read_only=True)
    thumbnailUrl = serializers.SerializerMethodField()
    suggestedTags = serializers.ListField(
        source="suggested_tags", child=serializers.CharField(), read_only=True
    )
    suggestedDestination = serializers.CharField(source="suggested_destination", read_only=True)
    # Label of the linked Item (select_related("item") in the list), so the inbox never loads every Item.
    itemTitle = serializers.CharField(source="item.title", read_only=True, allow_null=True)
    itemType = serializers.CharField(source="item.type", read_only=True, allow_null=True)

    class Meta:
        model = InboxEntry
        fields = [
            "id",
            "url",
            "text",
            "status",
            "item",
            "itemTitle",
            "itemType",
            "createdAt",
            "archivedAt",
            "processed",
            "processedAt",
            "error",
            "ogTitle",
            "ogDescription",
            "ogSiteName",
            "thumbnailUrl",
            "suggestedTags",
            "summary",
            "suggestedDestination",
        ]
        read_only_fields = ["status", "item", "processed", "error", "summary"]

    def get_thumbnailUrl(self, entry: InboxEntry) -> str | None:
        return f"/api/inbox/{entry.pk}/thumbnail" if entry.og_image_path else None

    def validate(self, attrs: dict[str, object]) -> dict[str, object]:
        if not attrs.get("url") and not attrs.get("text"):
            raise serializers.ValidationError("Cần một link hoặc một đoạn văn bản.")
        return attrs


class InboxTriageSerializer(serializers.Serializer[object]):
    status = serializers.ChoiceField(choices=InboxEntry.Status.choices, required=False)
    item = serializers.PrimaryKeyRelatedField(queryset=Item.objects.all(), allow_null=True, required=False)

    def validate_item(self, item: Item | None) -> Item | None:
        if item is not None and item.user_id != self.context["user"].pk:
            raise serializers.ValidationError("Không tìm thấy item.")
        return item


class InboxCountSerializer(serializers.Serializer[object]):
    count = serializers.IntegerField()
