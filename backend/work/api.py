import datetime as dt

from django.db.models import QuerySet
from django.shortcuts import get_object_or_404
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import generics, status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.fields import DateField
from rest_framework.pagination import CursorPagination
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.authentication import request_user
from core.pagination import NewestFirstCursor
from library.models import Item
from weeks import services as week_services
from work import services
from work.models import TimeEntry
from work.serializers import (
    ProjectSerializer,
    ProjectWriteSerializer,
    TimeEntryCreateSerializer,
    TimeEntrySerializer,
    TimeEntryUpdateSerializer,
    TimerSerializer,
    TimerStartSerializer,
    WeekSummarySerializer,
)


class NewestDateFirst(CursorPagination):
    ordering = ("-date", "-id")
    page_size = 50
    max_page_size = 200
    page_size_query_param = "limit"


def _date_param(request: Request, name: str) -> dt.date | None:
    raw = request.query_params.get(name)
    if raw is None:
        return None
    try:
        value: dt.date = DateField().to_internal_value(raw)
    except ValidationError as error:
        raise ValidationError({name: error.detail}) from error
    return value


def _int_param(request: Request, name: str) -> int | None:
    raw = request.query_params.get(name)
    if raw is None:
        return None
    if not raw.isdigit():
        raise ValidationError({name: "A positive integer."})
    return int(raw)


@extend_schema_view(
    get=extend_schema(
        operation_id="listProjects",
        parameters=[OpenApiParameter("status", str, enum=Item.Status.values)],
    )
)
class ProjectListView(generics.ListAPIView[Item]):
    serializer_class = ProjectSerializer
    pagination_class = NewestFirstCursor

    def get_queryset(self) -> QuerySet[Item]:
        projects = services.projects(request_user(self.request))
        if value := self.request.query_params.get("status"):
            projects = projects.filter(status=value)
        return projects

    @extend_schema(
        request=ProjectWriteSerializer, responses={201: ProjectSerializer}, operation_id="createProject"
    )
    def post(self, request: Request) -> Response:
        """An Item with type=project plus its client and price, in one write."""
        user = request_user(request)
        body = ProjectWriteSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        item = services.create_project(user, dict(body.validated_data))
        item = services.projects(user).get(pk=item.pk)
        return Response(ProjectSerializer(item).data, status=status.HTTP_201_CREATED)


class ProjectView(APIView):
    @extend_schema(responses=ProjectSerializer, operation_id="getProject")
    def get(self, request: Request, pk: int) -> Response:
        item = get_object_or_404(services.projects(request_user(request)), pk=pk)
        return Response(ProjectSerializer(item).data)

    @extend_schema(request=ProjectWriteSerializer, responses=ProjectSerializer, operation_id="updateProject")
    def patch(self, request: Request, pk: int) -> Response:
        user = request_user(request)
        item = get_object_or_404(services.projects(user), pk=pk)
        details = services.details_of(item)
        body = ProjectWriteSerializer(data=request.data, partial=True, context={"details": details})
        body.is_valid(raise_exception=True)
        services.update_project(item, dict(body.validated_data))
        return Response(ProjectSerializer(services.projects(user).get(pk=pk)).data)


@extend_schema_view(
    get=extend_schema(
        operation_id="listTimeEntries",
        parameters=[
            OpenApiParameter("project", int, description="Project (Item) id."),
            OpenApiParameter("from", OpenApiTypes.DATE, description="First day, inclusive."),
            OpenApiParameter("to", OpenApiTypes.DATE, description="Last day, inclusive."),
        ],
    )
)
class TimeEntryListView(generics.ListAPIView[TimeEntry]):
    serializer_class = TimeEntrySerializer
    pagination_class = NewestDateFirst

    def get_queryset(self) -> QuerySet[TimeEntry]:
        entries = TimeEntry.objects.filter(user=request_user(self.request)).select_related("project")
        if (project := _int_param(self.request, "project")) is not None:
            entries = entries.filter(project_id=project)
        if (first := _date_param(self.request, "from")) is not None:
            entries = entries.filter(date__gte=first)
        if (last := _date_param(self.request, "to")) is not None:
            entries = entries.filter(date__lte=last)
        return entries

    @extend_schema(
        request=TimeEntryCreateSerializer,
        responses={201: TimeEntrySerializer},
        operation_id="createTimeEntry",
    )
    def post(self, request: Request) -> Response:
        """Time typed in by hand."""
        user = request_user(request)
        body = TimeEntryCreateSerializer(data=request.data, context={"user": user})
        body.is_valid(raise_exception=True)
        entry = services.create_entry(user, dict(body.validated_data))
        return Response(TimeEntrySerializer(entry).data, status=status.HTTP_201_CREATED)


class TimeEntryView(APIView):
    @extend_schema(
        request=TimeEntryUpdateSerializer, responses=TimeEntrySerializer, operation_id="updateTimeEntry"
    )
    def patch(self, request: Request, pk: int) -> Response:
        user = request_user(request)
        entry = get_object_or_404(TimeEntry.objects.select_related("project"), pk=pk, user=user)
        body = TimeEntryUpdateSerializer(data=request.data, partial=True, context={"user": user})
        body.is_valid(raise_exception=True)
        if entry.running and "minutes" in body.validated_data:
            raise ValidationError({"minutes": "Stop the timer first."})
        entry = services.update_entry(entry, dict(body.validated_data))
        return Response(TimeEntrySerializer(entry).data)


class TimerView(APIView):
    @extend_schema(responses=TimerSerializer, operation_id="getTimer")
    def get(self, request: Request) -> Response:
        """The running timer entry, or null."""
        return Response(TimerSerializer({"running": services.running_entry(request_user(request))}).data)


class TimerStartView(APIView):
    @extend_schema(
        request=TimerStartSerializer, responses={201: TimeEntrySerializer}, operation_id="startTimer"
    )
    def post(self, request: Request) -> Response:
        """Start a timer; a timer already running is stopped first."""
        user = request_user(request)
        body = TimerStartSerializer(data=request.data, context={"user": user})
        body.is_valid(raise_exception=True)
        try:
            entry = services.start_timer(user, dict(body.validated_data))
        except services.TimerConflict:
            return Response({"detail": "A timer was started at the same time."}, status.HTTP_409_CONFLICT)
        return Response(TimeEntrySerializer(entry).data, status=status.HTTP_201_CREATED)


class TimerStopView(APIView):
    @extend_schema(request=None, responses=TimeEntrySerializer, operation_id="stopTimer")
    def post(self, request: Request) -> Response:
        """Stop the running timer; 404 when nothing runs."""
        entry = services.stop_timer(request_user(request))
        if entry is None:
            raise NotFound("No timer is running.")
        return Response(TimeEntrySerializer(entry).data)


class WeekSummaryView(APIView):
    @extend_schema(
        responses=WeekSummarySerializer,
        operation_id="getTimeSummary",
        parameters=[
            OpenApiParameter(
                "week", OpenApiTypes.DATE, description="The week's Monday, YYYY-MM-DD; default this week."
            )
        ],
    )
    def get(self, request: Request) -> Response:
        """Billable and non-billable minutes of one week, in total and per project."""
        start = _date_param(request, "week") or week_services.current_start()
        if start.weekday() != 0:
            raise ValidationError({"week": "A week starts on a Monday."})
        summary = services.week_summary(request_user(request), start)
        return Response(WeekSummarySerializer(summary).data)
