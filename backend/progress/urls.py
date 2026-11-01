from django.urls import path

from progress.api import LastVisitedView, PageProgressView, ProgressView

# Paths have no trailing slash, as in API_CONTRACT.md.
urlpatterns = [
    path("api/progress", ProgressView.as_view()),
    path("api/progress/last-visited", LastVisitedView.as_view()),
    path("api/progress/<slug:book>/<path:page>", PageProgressView.as_view()),
]
