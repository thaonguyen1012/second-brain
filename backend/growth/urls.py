from django.urls import path

from growth.api import (
    AchievementListView,
    AchievementView,
    JobAdListView,
    JobAdView,
    MarketReportView,
    PredictionListView,
    PredictionView,
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
    path("api/achievements", AchievementListView.as_view()),
    path("api/achievements/<int:pk>", AchievementView.as_view()),
    path("api/predictions", PredictionListView.as_view()),
    path("api/predictions/<int:pk>", PredictionView.as_view()),
]
