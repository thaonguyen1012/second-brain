import datetime as dt

from django.db.models import QuerySet
from django.shortcuts import get_object_or_404
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import CursorPagination
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.authentication import request_user
from core.i18n import tr
from weeks import services
from weeks.models import Objective, Week
from weeks.serializers import (
    ObjectiveCreateSerializer,
    ObjectiveSerializer,
    ObjectiveUpdateSerializer,
    PlanSerializer,
    PlanViewSerializer,
    ReviewUpdateSerializer,
    ReviewViewSerializer,
    WeekSerializer,
)

START = OpenApiParameter(
    "start", OpenApiTypes.DATE, OpenApiParameter.PATH, description="The week's Monday, YYYY-MM-DD."
)


def _monday(start: dt.date) -> dt.date:
    if start.weekday() != 0:
        raise ValidationError({"start": tr("Tuần bắt đầu vào thứ Hai.")})
    return start


def _open_week(request: Request, start: dt.date) -> Week:
    return services.get_or_create_week(request_user(request), _monday(start))


def _existing_week(request: Request, start: dt.date) -> Week:
    weeks = Week.objects.prefetch_related("objectives")
    return get_object_or_404(weeks, user=request_user(request), start_date=_monday(start))


class NewestWeekFirst(CursorPagination):
    ordering = ("-start_date", "-id")
    page_size = 50
    max_page_size = 200
    page_size_query_param = "limit"


@extend_schema_view(get=extend_schema(operation_id="listWeeks"))
class WeekListView(generics.ListAPIView[Week]):
    serializer_class = WeekSerializer
    pagination_class = NewestWeekFirst

    def get_queryset(self) -> QuerySet[Week]:
        return Week.objects.filter(user=request_user(self.request)).prefetch_related("objectives")


class CurrentWeekView(APIView):
    @extend_schema(responses=WeekSerializer, operation_id="getCurrentWeek")
    def get(self, request: Request) -> Response:
        """This week (Europe/Prague); an empty one with `id` null until it is first written to."""
        week = services.find_week(request_user(request), services.current_start())
        return Response(WeekSerializer(week).data)


class WeekPlanView(APIView):
    @extend_schema(responses=PlanViewSerializer, operation_id="getWeekPlan", parameters=[START])
    def get(self, request: Request, start: dt.date) -> Response:
        """The week (empty, `id` null, until first written to) and the previous week's open objectives."""
        week = services.find_week(request_user(request), _monday(start))
        return Response(
            PlanViewSerializer({"week": week, "carryCandidates": services.carry_candidates(week)}).data
        )

    @extend_schema(
        request=PlanSerializer, responses=WeekSerializer, operation_id="planWeek", parameters=[START]
    )
    def post(self, request: Request, start: dt.date) -> Response:
        week = _open_week(request, start)
        body = PlanSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        data = body.validated_data
        try:
            week = services.plan_week(week, data["carry"], data.get("planning_journal"))
        except services.PlanError as error:
            raise ValidationError({"carry": str(error)}) from error
        return Response(WeekSerializer(week).data)


class WeekReviewView(APIView):
    @extend_schema(responses=ReviewViewSerializer, operation_id="getWeekReview", parameters=[START])
    def get(self, request: Request, start: dt.date) -> Response:
        """Objective progress and body of work per day. A past week never opened answers 404; this week and
        later ones answer before they are written to (computed, nothing saved: a GET never writes)."""
        monday = _monday(start)
        week = services.find_week(request_user(request), monday)
        if week.pk is None and monday < services.current_start():
            week = _existing_week(request, start)  # 404
        return Response(ReviewViewSerializer(services.review(week)).data)

    @extend_schema(
        request=ReviewUpdateSerializer,
        responses=WeekSerializer,
        operation_id="updateWeekReview",
        parameters=[START],
    )
    def patch(self, request: Request, start: dt.date) -> Response:
        week = _open_week(request, start)
        body = ReviewUpdateSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        week = services.save_review(week, dict(body.validated_data))
        return Response(WeekSerializer(week).data)


class ObjectiveListView(APIView):
    @extend_schema(
        request=ObjectiveCreateSerializer,
        responses={201: ObjectiveSerializer},
        operation_id="createObjective",
        parameters=[START],
    )
    def post(self, request: Request, start: dt.date) -> Response:
        week = _open_week(request, start)
        body = ObjectiveCreateSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        objective = services.add_objective(week, body.validated_data["title"])
        return Response(ObjectiveSerializer(objective).data, status=status.HTTP_201_CREATED)


def _objective(request: Request, start: dt.date, pk: int) -> Objective:
    return get_object_or_404(
        Objective, pk=pk, week__user=request_user(request), week__start_date=_monday(start)
    )


class ObjectiveView(APIView):
    @extend_schema(
        request=ObjectiveUpdateSerializer,
        responses=ObjectiveSerializer,
        operation_id="updateObjective",
        parameters=[START],
    )
    def patch(self, request: Request, start: dt.date, pk: int) -> Response:
        objective = _objective(request, start, pk)
        body = ObjectiveUpdateSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        objective = services.update_objective(objective, dict(body.validated_data))
        return Response(ObjectiveSerializer(objective).data)

    @extend_schema(responses={204: None}, operation_id="deleteObjective", parameters=[START])
    def delete(self, request: Request, start: dt.date, pk: int) -> Response:
        """Objectives carried from it keep their title (carriedFrom becomes null); time entries linked to it
        stay and count as other work."""
        _objective(request, start, pk).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
