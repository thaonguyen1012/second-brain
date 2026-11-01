from django.urls import path

from progress.api import LastVisitedView, PageProgressView, ProgressView

# Mounted at "api/progress" (no trailing slash, as in API_CONTRACT.md).
urlpatterns = [
    path("", ProgressView.as_view()),
    path("/last-visited", LastVisitedView.as_view()),
    path("/<slug:book>/<path:page>", PageProgressView.as_view()),
]
