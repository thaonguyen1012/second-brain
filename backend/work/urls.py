from django.urls import path

from work.api import (
    ProjectListView,
    ProjectView,
    TimeEntryListView,
    TimeEntryView,
    TimerStartView,
    TimerStopView,
    TimerView,
    WeekSummaryView,
)

urlpatterns = [
    path("api/projects", ProjectListView.as_view()),
    path("api/projects/<int:pk>", ProjectView.as_view()),
    path("api/time-entries", TimeEntryListView.as_view()),
    path("api/time-entries/<int:pk>", TimeEntryView.as_view()),
    path("api/time-entries/timer", TimerView.as_view()),
    path("api/time-entries/timer/start", TimerStartView.as_view()),
    path("api/time-entries/timer/stop", TimerStopView.as_view()),
    path("api/time-entries/summary", WeekSummaryView.as_view()),
]
