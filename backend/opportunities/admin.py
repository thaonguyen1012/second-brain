from django.contrib import admin

from core.admin import OwnedAdmin
from opportunities.models import Evidence, Opportunity, ScoreSnapshot


class EvidenceInline(admin.TabularInline[Evidence, Opportunity]):
    model = Evidence
    extra = 0
    fields = ("kind", "stance", "title", "date", "inbox_entry", "item", "library_note", "url", "note")
    raw_id_fields = ("inbox_entry", "item", "library_note")


class ScoreSnapshotInline(admin.TabularInline[ScoreSnapshot, Opportunity]):
    """Read-only: the score history is append-only (new scores through the API)."""

    model = ScoreSnapshot
    extra = 0
    can_delete = False
    fields = ("created_at", "opportunity_score", "pain", "feasibility", "timing", "note")
    readonly_fields = fields

    def has_add_permission(self, request: object, obj: object = None) -> bool:
        return False


@admin.register(Opportunity)
class OpportunityAdmin(OwnedAdmin[Opportunity]):
    list_display = ("title", "decision", "decide_by", "next_action", "updated_at")
    list_filter = ("decision",)
    search_fields = ("title", "hypothesis")
    readonly_fields = ("decided_at",)
    inlines = (EvidenceInline, ScoreSnapshotInline)
