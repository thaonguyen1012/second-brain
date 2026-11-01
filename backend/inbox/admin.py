from django.contrib import admin
from django.utils.html import format_html

from core.admin import OwnedAdmin
from inbox.models import InboxEntry


@admin.register(InboxEntry)
class InboxEntryAdmin(OwnedAdmin[InboxEntry]):
    list_display = ("__str__", "status", "processed", "suggested_destination", "created_at")
    list_filter = ("status", "processed", "suggested_destination")
    search_fields = ("url", "text", "og_title", "summary")
    readonly_fields = (
        "processed",
        "processed_at",
        "error",
        "og_title",
        "og_description",
        "og_site_name",
        "thumbnail",
        "unfurled_at",
        "suggested_tags",
        "summary",
        "suggested_destination",
    )

    @admin.display(description="thumbnail")
    def thumbnail(self, entry: InboxEntry) -> str:
        if not entry.og_image_path:
            return "-"
        return format_html('<img src="/api/inbox/{}/thumbnail" alt="" style="max-width:320px">', entry.pk)
