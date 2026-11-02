from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from brief.models import NewsItem, Source


class SourceRefSerializer(serializers.ModelSerializer[Source]):
    class Meta:
        model = Source
        fields = ["id", "name", "area"]
        read_only_fields = fields


class NewsItemSerializer(serializers.ModelSerializer[NewsItem]):
    """`select_related("source")` on lists."""

    source = SourceRefSerializer(read_only=True)  # type: ignore[assignment]  # the JSON key, not Field.source
    newTool = serializers.BooleanField(source="new_tool", read_only=True)
    tagStatus = serializers.ChoiceField(
        source="tag_status", choices=NewsItem.TagStatus.choices, read_only=True
    )
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    feedback = serializers.SerializerMethodField()

    class Meta:
        model = NewsItem
        fields = [
            "id",
            "source",
            "title",
            "url",
            "published",
            "excerpt",
            "tags",
            "summary",
            "newTool",
            "relevance",
            "tagStatus",
            "createdAt",
            "feedback",
        ]
        read_only_fields = fields

    @extend_schema_field(
        serializers.ChoiceField(
            choices=NewsItem.Feedback.choices, allow_null=True, help_text="null: not rated."
        )
    )
    def get_feedback(self, item: NewsItem) -> str | None:
        return item.feedback or None


class NewsFeedbackSerializer(serializers.Serializer[object]):
    feedback = serializers.ChoiceField(choices=NewsItem.Feedback.choices, allow_null=True)


class DailyBriefSerializer(serializers.Serializer[object]):
    date = serializers.DateField()
    intro = serializers.CharField()
    generatedAt = serializers.DateTimeField()
    items = NewsItemSerializer(many=True)


class TopicCountSerializer(serializers.Serializer[object]):
    tag = serializers.CharField()
    count = serializers.IntegerField()


class TopicWeekSerializer(serializers.Serializer[object]):
    week = serializers.CharField(help_text="ISO week, e.g. 2026-W45.")
    start = serializers.DateField(help_text="The Monday of the week (Europe/Prague).")
    items = serializers.IntegerField(help_text="Tagged news items fetched that week.")
    topics = TopicCountSerializer(many=True)


class TopicCountsSerializer(serializers.Serializer[object]):
    weeks = TopicWeekSerializer(many=True)
