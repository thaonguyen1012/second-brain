from django.contrib import admin

from core.admin import OwnedAdmin
from library.models import Item, Note


@admin.register(Item)
class ItemAdmin(OwnedAdmin[Item]):
    list_display = ("title", "type", "status", "rating", "created_at")
    list_filter = ("type", "status")
    search_fields = ("title", "source")


@admin.register(Note)
class NoteAdmin(OwnedAdmin[Note]):
    list_display = ("__str__", "created_at")
    search_fields = ("title", "markdown")
    filter_horizontal = ("items",)
