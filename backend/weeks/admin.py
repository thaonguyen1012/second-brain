from typing import Any

from django import forms
from django.contrib import admin
from django.http import HttpRequest

from core.admin import OwnedAdmin
from weeks.models import Objective, Week


class WeekForm(forms.ModelForm[Week]):
    owner_id: int | None = None  # set per request by WeekAdmin.get_form (user is not a form field)

    def clean_start_date(self) -> Any:
        start = self.cleaned_data["start_date"]
        if start.weekday() != 0:
            raise forms.ValidationError("A week starts on a Monday.")
        user_id = self.instance.user_id if self.instance.pk else self.owner_id
        weeks = Week.objects.filter(user_id=user_id or 0, start_date=start)
        if weeks.exclude(pk=self.instance.pk).exists():
            raise forms.ValidationError("This week already exists.")
        return start


class ObjectiveInline(admin.TabularInline[Objective, Week]):
    model = Objective
    fields = ("position", "title", "status", "carried_from")
    readonly_fields = ("carried_from",)  # set by planning, never picked by hand
    extra = 3


@admin.register(Week)
class WeekAdmin(OwnedAdmin[Week]):
    form = WeekForm
    list_display = ("__str__", "planned_at", "reviewed_at")
    date_hierarchy = "start_date"
    inlines = (ObjectiveInline,)
    readonly_fields = ("planned_at", "reviewed_at")
    fieldsets = (
        (None, {"fields": ("start_date",)}),
        ("Planning", {"fields": ("planning_journal", "planned_at")}),
        (
            "Review",
            {
                "fields": (
                    "review_win",
                    "review_distraction",
                    "review_learned",
                    "review_satisfied",
                    "review_changed_mind",
                    "review_opportunity_evidence",
                    "reviewed_at",
                )
            },
        ),
    )

    def get_form(
        self, request: HttpRequest, obj: Week | None = None, change: bool = False, **kwargs: Any
    ) -> type[forms.ModelForm[Week]]:
        form = super().get_form(request, obj, change, **kwargs)
        assert issubclass(form, WeekForm)
        form.owner_id = request.user.pk
        return form
