from django.urls import path

from library.api import (
    ItemImageFetchView,
    ItemImageView,
    ItemListView,
    ItemMentionsView,
    ItemView,
    NoteListView,
    NoteMentionsView,
    NoteSearchView,
    NoteView,
)

urlpatterns = [
    path("api/items", ItemListView.as_view()),
    path("api/items/<int:pk>", ItemView.as_view()),
    path("api/items/<int:pk>/image", ItemImageView.as_view()),
    path("api/items/<int:pk>/image/fetch", ItemImageFetchView.as_view()),
    path("api/items/<int:pk>/mentions", ItemMentionsView.as_view()),
    path("api/notes", NoteListView.as_view()),
    path("api/notes/search", NoteSearchView.as_view()),
    path("api/notes/<int:pk>", NoteView.as_view()),
    path("api/notes/<int:pk>/mentions", NoteMentionsView.as_view()),
]
