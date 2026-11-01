from django.contrib import admin
from django.urls import path
from drf_spectacular.views import SpectacularAPIView

from core import views as core_views

urlpatterns = [
    path("healthz", core_views.healthz),
    path("admin/", admin.site.urls),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/me", core_views.MeView.as_view()),
]
