import datetime as dt

from django.contrib.auth.models import User
from django.db.models import Prefetch, Q, QuerySet
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.fields import DateField
from rest_framework.pagination import CursorPagination
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.authentication import request_user
from core.pagination import NewestFirstCursor
from growth import services
from growth.models import Achievement, Freshness, JobAd, Prediction, Skill, SkillEvidence
from growth.serializers import (
    AchievementSerializer,
    AchievementWriteSerializer,
    JobAdSerializer,
    JobAdWriteSerializer,
    MarketReportSerializer,
    PredictionSerializer,
    PredictionWriteSerializer,
    SkillDetailSerializer,
    SkillEvidenceCreateSerializer,
    SkillEvidenceSerializer,
    SkillEvidenceUpdateSerializer,
    SkillSerializer,
    SkillWriteSerializer,
    parse_month,
)

BOOLEAN = {"true": True, "false": False}
MONTH_PARAM = OpenApiParameter("month", str, description="YYYY-MM; default: this month (Europe/Prague).")


class ByNameCursor(CursorPagination):
    """The skills matrix reads alphabetically (normalised name, unique per owner)."""

    ordering = ("key", "id")
    page_size = 100
    max_page_size = 200
    page_size_query_param = "limit"


def _detail(user: User, pk: int) -> Skill:
    evidence = Prefetch("evidence", queryset=SkillEvidence.objects.order_by("-date", "-id"))
    return get_object_or_404(services.skills(user).prefetch_related(evidence), pk=pk)


def _own(request: Request, pk: int) -> Skill:
    return get_object_or_404(Skill, pk=pk, user=request_user(request))


def _month(request: Request) -> str | None:
    return request.query_params.get("month")


def _save(skill: Skill, data: dict[str, object]) -> None:
    try:
        services.save_skill(skill, data)
    except services.SkillConflict as error:
        raise ValidationError({"name": f"Đã dùng cho kỹ năng khác: {error}."}) from error


@extend_schema_view(
    get=extend_schema(
        operation_id="listSkills",
        parameters=[OpenApiParameter("freshness", str, enum=Freshness.values)],
    )
)
class SkillListView(generics.ListAPIView[Skill]):
    serializer_class = SkillSerializer
    pagination_class = ByNameCursor

    def get_queryset(self) -> QuerySet[Skill]:
        rows = services.skills(request_user(self.request))
        if freshness := self.request.query_params.get("freshness"):
            if freshness not in Freshness.values:
                raise ValidationError({"freshness": f"One of {Freshness.values}."})
            rows = rows.filter(Q(freshness=freshness))  # annotation, unknown to the type checker
        return rows

    @extend_schema(
        request=SkillWriteSerializer, responses={201: SkillDetailSerializer}, operation_id="createSkill"
    )
    def post(self, request: Request) -> Response:
        user = request_user(request)
        body = SkillWriteSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        skill = Skill(user=user)
        _save(skill, dict(body.validated_data))
        return Response(SkillDetailSerializer(_detail(user, skill.pk)).data, status=status.HTTP_201_CREATED)


class SkillView(APIView):
    @extend_schema(responses=SkillDetailSerializer, operation_id="getSkill")
    def get(self, request: Request, pk: int) -> Response:
        """With its evidence, newest date first."""
        return Response(SkillDetailSerializer(_detail(request_user(request), pk)).data)

    @extend_schema(request=SkillWriteSerializer, responses=SkillDetailSerializer, operation_id="updateSkill")
    def patch(self, request: Request, pk: int) -> Response:
        skill = _own(request, pk)
        body = SkillWriteSerializer(data=request.data, partial=True)
        body.is_valid(raise_exception=True)
        _save(skill, dict(body.validated_data))
        return Response(SkillDetailSerializer(_detail(request_user(request), pk)).data)


class SkillEvidenceListView(APIView):
    @extend_schema(
        request=SkillEvidenceCreateSerializer,
        responses={201: SkillEvidenceSerializer},
        operation_id="addSkillEvidence",
    )
    def post(self, request: Request, pk: int) -> Response:
        """Evidence linked to a library Item (a work project too) or Note, or an external link."""
        skill = _own(request, pk)
        body = SkillEvidenceCreateSerializer(data=request.data, context={"user": request_user(request)})
        body.is_valid(raise_exception=True)
        evidence = services.add_evidence(skill, dict(body.validated_data))
        return Response(SkillEvidenceSerializer(evidence).data, status=status.HTTP_201_CREATED)


class SkillEvidenceView(APIView):
    def _evidence(self, request: Request, pk: int, evidence_id: int) -> SkillEvidence:
        return get_object_or_404(
            SkillEvidence, pk=evidence_id, skill_id=pk, skill__user=request_user(request)
        )

    @extend_schema(
        request=SkillEvidenceUpdateSerializer,
        responses=SkillEvidenceSerializer,
        operation_id="updateSkillEvidence",
    )
    def patch(self, request: Request, pk: int, evidence_id: int) -> Response:
        evidence = self._evidence(request, pk, evidence_id)
        body = SkillEvidenceUpdateSerializer(data=request.data, partial=True)
        body.is_valid(raise_exception=True)
        return Response(
            SkillEvidenceSerializer(services.update_evidence(evidence, dict(body.validated_data))).data
        )

    @extend_schema(responses={204: None}, operation_id="deleteSkillEvidence")
    def delete(self, request: Request, pk: int, evidence_id: int) -> Response:
        self._evidence(request, pk, evidence_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema_view(get=extend_schema(operation_id="listJobAds", parameters=[MONTH_PARAM]))
class JobAdListView(generics.ListAPIView[JobAd]):
    serializer_class = JobAdSerializer
    pagination_class = NewestFirstCursor

    def get_queryset(self) -> QuerySet[JobAd]:
        rows = JobAd.objects.filter(user=request_user(self.request))
        if (month := _month(self.request)) is not None:
            try:
                rows = rows.filter(month=parse_month(month))
            except ValueError as error:
                raise ValidationError({"month": str(error)}) from error
        return rows

    @extend_schema(request=JobAdWriteSerializer, responses={201: JobAdSerializer}, operation_id="createJobAd")
    def post(self, request: Request) -> Response:
        """Stores the ad and returns at once; a background job extracts the skills it asks for."""
        body = JobAdWriteSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        ad = services.create_job_ad(request_user(request), dict(body.validated_data))
        return Response(JobAdSerializer(ad).data, status=status.HTTP_201_CREATED)


class JobAdView(APIView):
    @extend_schema(request=JobAdWriteSerializer, responses=JobAdSerializer, operation_id="updateJobAd")
    def patch(self, request: Request, pk: int) -> Response:
        """Changed title, company or text re-runs the extraction; `skills` corrects it by hand."""
        ad = get_object_or_404(JobAd, pk=pk, user=request_user(request))
        body = JobAdWriteSerializer(data=request.data, partial=True)
        body.is_valid(raise_exception=True)
        return Response(JobAdSerializer(services.update_job_ad(ad, dict(body.validated_data))).data)


class MarketReportView(APIView):
    @extend_schema(responses=MarketReportSerializer, operation_id="getMarketReport", parameters=[MONTH_PARAM])
    def get(self, request: Request) -> Response:
        """Skill frequency in the month's job ads vs the previous month, next to the skills matrix."""
        raw = _month(request)
        try:
            month = parse_month(raw) if raw is not None else services.month_start(timezone.localdate())
        except ValueError as error:
            raise ValidationError({"month": str(error)}) from error
        report = services.market_report(request_user(request), month)
        return Response(MarketReportSerializer(report).data)


# --- Brag document ----------------------------------------------------------------------------------


class NewestDateFirst(CursorPagination):
    ordering = ("-date", "-id")
    page_size = 50
    max_page_size = 200
    page_size_query_param = "limit"


def _week(request: Request) -> dt.date | None:
    raw = request.query_params.get("week")
    if raw is None:
        return None
    try:
        start: dt.date = DateField().to_internal_value(raw)
    except ValidationError as error:
        raise ValidationError({"week": error.detail}) from error
    if start.weekday() != 0:
        raise ValidationError({"week": "Tuần bắt đầu vào thứ Hai."})
    return start


def _achievement(request: Request, pk: int) -> Achievement:
    return get_object_or_404(services.achievements(request_user(request)), pk=pk)


@extend_schema_view(
    get=extend_schema(
        operation_id="listAchievements",
        parameters=[
            OpenApiParameter("week", OpenApiTypes.DATE, description="Only that week: its Monday, YYYY-MM-DD.")
        ],
    )
)
class AchievementListView(generics.ListAPIView[Achievement]):
    """The brag document, newest date first."""

    serializer_class = AchievementSerializer
    pagination_class = NewestDateFirst

    def get_queryset(self) -> QuerySet[Achievement]:
        return services.achievements(request_user(self.request), _week(self.request))

    @extend_schema(
        request=AchievementWriteSerializer,
        responses={201: AchievementSerializer},
        operation_id="createAchievement",
    )
    def post(self, request: Request) -> Response:
        user = request_user(request)
        body = AchievementWriteSerializer(data=request.data, context={"user": user})
        body.is_valid(raise_exception=True)
        row = services.save_achievement(Achievement(user=user), dict(body.validated_data))
        return Response(
            AchievementSerializer(_achievement(request, row.pk)).data, status=status.HTTP_201_CREATED
        )


class AchievementView(APIView):
    @extend_schema(
        request=AchievementWriteSerializer, responses=AchievementSerializer, operation_id="updateAchievement"
    )
    def patch(self, request: Request, pk: int) -> Response:
        user = request_user(request)
        row = get_object_or_404(Achievement, pk=pk, user=user)
        body = AchievementWriteSerializer(data=request.data, partial=True, context={"user": user})
        body.is_valid(raise_exception=True)
        services.save_achievement(row, dict(body.validated_data))
        return Response(AchievementSerializer(_achievement(request, pk)).data)


# --- Predictions ------------------------------------------------------------------------------------


def _save_prediction(prediction: Prediction, data: dict[str, object]) -> Prediction:
    try:
        return services.save_prediction(prediction, data)
    except services.PredictionDates as error:
        raise ValidationError({"checkOn": "Ngày chấm lại không được trước ngày ghi."}) from error


@extend_schema_view(
    get=extend_schema(
        operation_id="listPredictions",
        parameters=[
            OpenApiParameter(
                "due",
                bool,
                description="true: open ones whose checkOn has come (Europe/Prague); false: the others.",
            ),
            OpenApiParameter("outcome", str, enum=Prediction.Outcome.values),
        ],
    )
)
class PredictionListView(generics.ListAPIView[Prediction]):
    serializer_class = PredictionSerializer
    pagination_class = NewestFirstCursor

    def get_queryset(self) -> QuerySet[Prediction]:
        params = self.request.query_params
        due = params.get("due")
        if due is not None and due not in BOOLEAN:
            raise ValidationError({"due": "true or false."})
        rows = services.predictions(request_user(self.request), BOOLEAN[due] if due is not None else None)
        if outcome := params.get("outcome"):
            if outcome not in Prediction.Outcome.values:
                raise ValidationError({"outcome": f"One of {Prediction.Outcome.values}."})
            rows = rows.filter(outcome=outcome)
        return rows

    @extend_schema(
        request=PredictionWriteSerializer,
        responses={201: PredictionSerializer},
        operation_id="createPrediction",
    )
    def post(self, request: Request) -> Response:
        body = PredictionWriteSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        row = _save_prediction(Prediction(user=request_user(request)), dict(body.validated_data))
        return Response(PredictionSerializer(row).data, status=status.HTTP_201_CREATED)


class PredictionView(APIView):
    @extend_schema(
        request=PredictionWriteSerializer, responses=PredictionSerializer, operation_id="updatePrediction"
    )
    def patch(self, request: Request, pk: int) -> Response:
        """Re-score with `outcome` (right, wrong, partial; open again clears `scoredAt`) and `note`."""
        row = get_object_or_404(Prediction, pk=pk, user=request_user(request))
        body = PredictionWriteSerializer(data=request.data, partial=True)
        body.is_valid(raise_exception=True)
        return Response(PredictionSerializer(_save_prediction(row, dict(body.validated_data))).data)
