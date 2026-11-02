from django.urls import path

from opportunities.api import (
    AttachInboxView,
    EvidenceListView,
    EvidenceView,
    OpportunityListView,
    OpportunityView,
    ScoresView,
)

urlpatterns = [
    path("api/opportunities", OpportunityListView.as_view()),
    path("api/opportunities/<int:pk>", OpportunityView.as_view()),
    path("api/opportunities/<int:pk>/scores", ScoresView.as_view()),
    path("api/opportunities/<int:pk>/evidence", EvidenceListView.as_view()),
    path("api/opportunities/<int:pk>/evidence/<int:evidence_id>", EvidenceView.as_view()),
    path("api/opportunities/<int:pk>/evidence/inbox", AttachInboxView.as_view()),
]
