from django.urls import path

from inbox.api import InboxEntryView, InboxListView, InboxThumbnailView

urlpatterns = [
    path("api/inbox", InboxListView.as_view()),
    path("api/inbox/<int:pk>", InboxEntryView.as_view()),
    path("api/inbox/<int:pk>/thumbnail", InboxThumbnailView.as_view()),
]
