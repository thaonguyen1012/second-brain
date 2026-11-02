import datetime as dt

from django.db.models import QuerySet
from django.http import Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import generics
from rest_framework.exceptions import ValidationError
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from brief import services
from brief.models import DailyBrief, NewsItem
from brief.serializers import (
    DailyBriefSerializer,
    NewsFeedbackSerializer,
    NewsItemSerializer,
    TopicCountsSerializer,
)
from core.authentication import request_user
from core.pagination import NewestFirstCursor

BOOLEAN = {"true": True, "false": False}
MAX_WEEKS = 52


def _int(request: Request, name: str, low: int, high: int) -> int | None:
    raw = request.query_params.get(name)
    if raw is None:
        return None
    if not raw.isdigit() or not low <= int(raw) <= high:
        raise ValidationError({name: f"A number from {low} to {high}."})
    return int(raw)


def _date(raw: str, name: str) -> dt.date:
    try:
        return dt.date.fromisoformat(raw)
    except ValueError as error:
        raise ValidationError({name: "A date as YYYY-MM-DD."}) from error


@extend_schema_view(
    get=extend_schema(
        operation_id="listNews",
        parameters=[
            OpenApiParameter("tag", str, description="Only items with this topic tag."),
            OpenApiParameter("newTool", bool, description='true: only "new tool/skill" items.'),
            OpenApiParameter("date", str, description="YYYY-MM-DD: fetched that day (Europe/Prague)."),
            OpenApiParameter("minRelevance", int, description="1-5."),
            OpenApiParameter("source", int),
            OpenApiParameter("tagStatus", str, enum=NewsItem.TagStatus.values),
        ],
    )
)
class NewsListView(generics.ListAPIView[NewsItem]):
    serializer_class = NewsItemSerializer
    pagination_class = NewestFirstCursor

    def get_queryset(self) -> QuerySet[NewsItem]:
        params = self.request.query_params
        rows = services.news(request_user(self.request))
        if tag := params.get("tag"):
            rows = rows.filter(tags__contains=[" ".join(tag.lower().split())])
        if (new_tool := params.get("newTool")) is not None:
            if new_tool not in BOOLEAN:
                raise ValidationError({"newTool": "true or false."})
            rows = rows.filter(new_tool=BOOLEAN[new_tool])
        if (day := params.get("date")) is not None:
            start, end = services.day_bounds(_date(day, "date"))
            rows = rows.filter(created_at__gte=start, created_at__lt=end)
        if (relevance := _int(self.request, "minRelevance", 1, 5)) is not None:
            rows = rows.filter(relevance__gte=relevance)
        if (source := _int(self.request, "source", 1, 2**62)) is not None:
            rows = rows.filter(source_id=source)
        if status := params.get("tagStatus"):
            if status not in NewsItem.TagStatus.values:
                raise ValidationError({"tagStatus": f"One of {NewsItem.TagStatus.values}."})
            rows = rows.filter(tag_status=status)
        return rows


class NewsItemView(APIView):
    @extend_schema(request=NewsFeedbackSerializer, responses=NewsItemSerializer, operation_id="rateNewsItem")
    def patch(self, request: Request, pk: int) -> Response:
        """The "useful / not useful" button: `feedback` is useful, not_useful or null (clears the rating)."""
        item = get_object_or_404(services.news(request_user(request)), pk=pk)
        body = NewsFeedbackSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        return Response(NewsItemSerializer(services.set_feedback(item, body.validated_data["feedback"])).data)


def _brief(request: Request, day: dt.date) -> Response:
    brief: DailyBrief | None = services.brief_of(request_user(request), day)
    if brief is None:
        raise Http404("No brief for this day yet.")
    data = {
        "date": brief.date,
        "intro": brief.intro,
        "generatedAt": brief.generated_at,
        "items": [entry.news_item for entry in brief.entries.all()],
    }
    return Response(DailyBriefSerializer(data).data)


class TodayBriefView(APIView):
    @extend_schema(responses=DailyBriefSerializer, operation_id="getTodayBrief")
    def get(self, request: Request) -> Response:
        """Today's brief (Europe/Prague); 404 until the morning job has built it."""
        return _brief(request, timezone.localdate())


class BriefView(APIView):
    @extend_schema(responses=DailyBriefSerializer, operation_id="getBrief")
    def get(self, request: Request, day: str) -> Response:
        """The brief of a day (YYYY-MM-DD); 404 when there is none."""
        return _brief(request, _date(day, "date"))


class TopicCountsView(APIView):
    @extend_schema(
        responses=TopicCountsSerializer,
        operation_id="getNewsTopicCounts",
        parameters=[OpenApiParameter("weeks", int, description=f"1-{MAX_WEEKS}, default 8.")],
    )
    def get(self, request: Request) -> Response:
        """How often each topic tag appeared in the fetched news per ISO week, oldest week first."""
        weeks = _int(request, "weeks", 1, MAX_WEEKS) or 8
        data = {"weeks": services.topic_counts(request_user(request), weeks)}
        return Response(TopicCountsSerializer(data).data)
