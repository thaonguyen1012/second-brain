from django.urls import path

from inbox.api import InboxEntryView, InboxListView

urlpatterns = [
    path("api/inbox", InboxListView.as_view()),
    path("api/inbox/<int:pk>", InboxEntryView.as_view()),
]
