from django.contrib import admin

from brief.models import BriefEntry, DailyBrief, NewsItem, Source
from core.admin import OwnedAdmin


@admin.register(Source)
class SourceAdmin(OwnedAdmin[Source]):
    """The curated feeds (DECISIONS 5, 6.2); also `manage.py brief_sources`."""

    list_display = ("name", "area", "active", "feed_url", "last_fetched_at", "last_error")
    list_filter = ("area", "active")
    search_fields = ("name", "feed_url")
    readonly_fields = ("last_fetched_at", "last_error")


@admin.register(NewsItem)
class NewsItemAdmin(OwnedAdmin[NewsItem]):
    list_display = ("title", "source", "relevance", "new_tool", "tag_status", "created_at")
    list_filter = ("tag_status", "new_tool", "source")
    search_fields = ("title", "summary")
    readonly_fields = (
        "source",
        "title",
        "url",
        "published",
        "excerpt",
        "dedupe_key",
        "tags",
        "summary",
        "new_tool",
        "relevance",
        "tag_status",
        "tagged_at",
        "error",
    )


class BriefEntryInline(admin.TabularInline[BriefEntry, DailyBrief]):
    model = BriefEntry
    extra = 0
    fields = ("position", "news_item")
    raw_id_fields = ("news_item",)


@admin.register(DailyBrief)
class DailyBriefAdmin(OwnedAdmin[DailyBrief]):
    list_display = ("date", "generated_at", "error")
    readonly_fields = ("generated_at", "error")
    inlines = (BriefEntryInline,)
