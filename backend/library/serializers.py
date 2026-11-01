from rest_framework import serializers

from library.models import Item
from library.services import normalize_tags


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
