from typing import Any

from django.contrib import admin
from django.db import models
from django.forms import ModelForm
from django.http import HttpRequest

from core.models import Job


class OwnedAdmin[M: models.Model](admin.ModelAdmin[M]):
    """Admin for rows with a `user` FK: hidden in the form, set to the logged-in owner on create."""

    exclude = ("user",)

    def save_model(self, request: HttpRequest, obj: M, form: ModelForm[Any], change: bool) -> None:
        if not change:
            obj.user = request.user  # type: ignore[attr-defined]
        super().save_model(request, obj, form, change)


@admin.register(Job)
class JobAdmin(admin.ModelAdmin[Job]):
    list_display = ("key", "kind", "status", "attempts", "run_after", "updated_at")
    list_filter = ("status", "kind")
    search_fields = ("key",)
