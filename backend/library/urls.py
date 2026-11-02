from django.urls import path

from library.api import ItemListView, ItemView, NoteListView, NoteView

urlpatterns = [
    path("api/items", ItemListView.as_view()),
    path("api/items/<int:pk>", ItemView.as_view()),
    path("api/notes", NoteListView.as_view()),
    path("api/notes/<int:pk>", NoteView.as_view()),
]
