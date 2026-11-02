from django.contrib import admin

from core.admin import OwnedAdmin
from work.models import ProjectDetails, TimeEntry


@admin.register(ProjectDetails)
class ProjectDetailsAdmin(admin.ModelAdmin[ProjectDetails]):
    list_display = ("item", "client", "billing", "price", "hourly_rate", "currency")
    list_filter = ("billing",)
    search_fields = ("item__title", "client")
    list_select_related = ("item",)


@admin.register(TimeEntry)
class TimeEntryAdmin(OwnedAdmin[TimeEntry]):
    list_display = ("date", "project", "minutes", "billable", "objective", "note")
    list_filter = ("billable",)
    date_hierarchy = "date"
    search_fields = ("note", "project__title")
    list_select_related = ("project", "objective")
    raw_id_fields = ("objective",)
