from django.urls import path

from growth.api import (
    JobAdListView,
    JobAdView,
    MarketReportView,
    SkillEvidenceListView,
    SkillEvidenceView,
    SkillListView,
    SkillView,
)

urlpatterns = [
    path("api/skills", SkillListView.as_view()),
    path("api/skills/<int:pk>", SkillView.as_view()),
    path("api/skills/<int:pk>/evidence", SkillEvidenceListView.as_view()),
    path("api/skills/<int:pk>/evidence/<int:evidence_id>", SkillEvidenceView.as_view()),
    path("api/market/job-ads", JobAdListView.as_view()),
    path("api/market/job-ads/<int:pk>", JobAdView.as_view()),
    path("api/market/report", MarketReportView.as_view()),
]
