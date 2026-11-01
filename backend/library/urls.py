from django.urls import path

from library.api import ItemListView, ItemView

urlpatterns = [
    path("api/items", ItemListView.as_view()),
    path("api/items/<int:pk>", ItemView.as_view()),
]
