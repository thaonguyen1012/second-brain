from typing import Any

from django.contrib import admin
from django.forms import ModelForm
from django.http import HttpRequest
from django.utils.html import format_html

from core.admin import OwnedAdmin
from inbox.models import InboxEntry
from inbox.services import set_status


@admin.register(InboxEntry)
class InboxEntryAdmin(OwnedAdmin[InboxEntry]):
    list_display = ("__str__", "status", "processed", "suggested_destination", "created_at")
    list_filter = ("status", "processed", "suggested_destination")
    search_fields = ("url", "text", "og_title", "summary")
    readonly_fields = (
        "archived_at",
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

    def save_model(self, request: HttpRequest, obj: InboxEntry, form: ModelForm[Any], change: bool) -> None:
        """`archived_at` follows the status as in the API."""
        if "status" in form.changed_data:
            new = obj.status
            obj.status = form.initial.get("status", InboxEntry.Status.INBOX)
            set_status(obj, new)
        super().save_model(request, obj, form, change)

    @admin.display(description="thumbnail")
    def thumbnail(self, entry: InboxEntry) -> str:
        if not entry.og_image_path:
            return "-"
        return format_html('<img src="/api/inbox/{}/thumbnail" alt="" style="max-width:320px">', entry.pk)
