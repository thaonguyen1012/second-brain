import datetime as dt

from django.urls import path, register_converter

from weeks.api import (
    CurrentWeekView,
    ObjectiveListView,
    ObjectiveView,
    WeekListView,
    WeekPlanView,
    WeekReviewView,
)


class IsoDateConverter:
    """YYYY-MM-DD; an impossible date (2026-02-30) does not match and answers 404."""

    regex = r"\d{4}-\d{2}-\d{2}"

    def to_python(self, value: str) -> dt.date:
        return dt.date.fromisoformat(value)

    def to_url(self, value: dt.date) -> str:
        return value.isoformat()


register_converter(IsoDateConverter, "isodate")

urlpatterns = [
    path("api/weeks", WeekListView.as_view()),
    path("api/weeks/current", CurrentWeekView.as_view()),
    path("api/weeks/<isodate:start>/plan", WeekPlanView.as_view()),
    path("api/weeks/<isodate:start>/review", WeekReviewView.as_view()),
    path("api/weeks/<isodate:start>/objectives", ObjectiveListView.as_view()),
    path("api/weeks/<isodate:start>/objectives/<int:pk>", ObjectiveView.as_view()),
]
