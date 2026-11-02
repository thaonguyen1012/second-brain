from django.urls import path, re_path

from brief.api import BriefView, NewsListView, TodayBriefView, TopicCountsView

urlpatterns = [
    path("api/news", NewsListView.as_view()),
    path("api/news/topics", TopicCountsView.as_view()),
    path("api/brief/today", TodayBriefView.as_view()),
    re_path(r"^api/brief/(?P<day>\d{4}-\d{2}-\d{2})$", BriefView.as_view()),
]
