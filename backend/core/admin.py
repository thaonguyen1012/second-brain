from typing import Any

from django.contrib import admin
from django.db import models
from django.forms import ModelForm
from django.http import HttpRequest


class OwnedAdmin[M: models.Model](admin.ModelAdmin[M]):
    """Admin for rows with a `user` FK: hidden in the form, set to the logged-in owner on create."""

    exclude = ("user",)

    def save_model(self, request: HttpRequest, obj: M, form: ModelForm[Any], change: bool) -> None:
        if not change:
            obj.user = request.user  # type: ignore[attr-defined]
        super().save_model(request, obj, form, change)
