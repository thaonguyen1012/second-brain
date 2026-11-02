from typing import Any

from django.contrib import admin
from django.forms import ModelForm
from django.http import HttpRequest

from core.admin import OwnedAdmin
from growth import services
from growth.models import JobAd, Skill, SkillEvidence


class SkillEvidenceInline(admin.TabularInline[SkillEvidence, Skill]):
    model = SkillEvidence
    extra = 0
    fields = ("kind", "title", "date", "item", "library_note", "url", "note")
    raw_id_fields = ("item", "library_note")


@admin.register(Skill)
class SkillAdmin(OwnedAdmin[Skill]):
    """Freshness is computed (API). Names and aliases are normalised here too; the API also refuses an alias
    that another skill already uses."""

    list_display = ("name", "key", "aliases", "updated_at")
    search_fields = ("name", "key")
    readonly_fields = ("key",)
    inlines = (SkillEvidenceInline,)

    def save_model(self, request: HttpRequest, obj: Skill, form: ModelForm[Any], change: bool) -> None:
        obj.key, obj.aliases = services.skill_keys(obj.name, obj.aliases)
        super().save_model(request, obj, form, change)


@admin.register(JobAd)
class JobAdAdmin(OwnedAdmin[JobAd]):
    list_display = ("title", "company", "month", "seniority", "processed", "created_at")
    list_filter = ("month", "processed", "seniority")
    search_fields = ("title", "company")
    readonly_fields = ("processed_at", "error")
