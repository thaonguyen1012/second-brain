from django.contrib.auth.models import User
from django.db.models import Prefetch, Q, QuerySet
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.authentication import request_user
from core.pagination import NewestFirstCursor
from growth.models import Skill
from growth.services import with_freshness
from opportunities import services
from opportunities.models import Evidence, Opportunity
from opportunities.serializers import (
    AttachInboxSerializer,
    AttachNewsResultSerializer,
    AttachNewsSerializer,
    AttachResultSerializer,
    EvidenceCreateSerializer,
    EvidenceSerializer,
    EvidenceUpdateSerializer,
    OpportunityCreateSerializer,
    OpportunityDetailSerializer,
    OpportunitySerializer,
    OpportunityWriteSerializer,
    ScoreSnapshotSerializer,
    ScoresWriteSerializer,
)

BOOLEAN = {"true": True, "false": False}


def _fit() -> Prefetch[str]:
    """The fitting skills with their freshness."""
    return Prefetch("fit", queryset=with_freshness(Skill.objects.order_by("key")))


def _detail(user: User, pk: int) -> Opportunity:
    evidence = Prefetch("evidence", queryset=Evidence.objects.order_by("-date", "-id"))
    rows = services.opportunities(user).prefetch_related(evidence, "scores", _fit())
    return get_object_or_404(rows, pk=pk)


def _own(request: Request, pk: int) -> Opportunity:
    return get_object_or_404(Opportunity, pk=pk, user=request_user(request))


@extend_schema_view(
    get=extend_schema(
        operation_id="listOpportunities",
        parameters=[
            OpenApiParameter("decision", str, enum=Opportunity.Decision.values),
            OpenApiParameter("stale", bool, description="true: only stale ones; false: only fresh ones."),
        ],
    )
)
class OpportunityListView(generics.ListAPIView[Opportunity]):
    serializer_class = OpportunitySerializer
    pagination_class = NewestFirstCursor

    def get_queryset(self) -> QuerySet[Opportunity]:
        rows = services.opportunities(request_user(self.request)).prefetch_related(_fit())
        if decision := self.request.query_params.get("decision"):
            if decision not in Opportunity.Decision.values:
                raise ValidationError({"decision": f"One of {Opportunity.Decision.values}."})
            rows = rows.filter(decision=decision)
        if (stale := self.request.query_params.get("stale")) is not None:
            if stale not in BOOLEAN:
                raise ValidationError({"stale": "true or false."})
            rows = rows.filter(Q(stale=BOOLEAN[stale]))
        return rows

    @extend_schema(
        request=OpportunityCreateSerializer,
        responses={201: OpportunityDetailSerializer},
        operation_id="createOpportunity",
    )
    def post(self, request: Request) -> Response:
        """The opportunity and, with `scores`, its first score snapshot."""
        user = request_user(request)
        body = OpportunityCreateSerializer(data=request.data, context={"user": user})
        body.is_valid(raise_exception=True)
        opportunity = services.create_opportunity(user, dict(body.validated_data))
        data = OpportunityDetailSerializer(_detail(user, opportunity.pk)).data
        return Response(data, status=status.HTTP_201_CREATED)


class OpportunityView(APIView):
    @extend_schema(responses=OpportunityDetailSerializer, operation_id="getOpportunity")
    def get(self, request: Request, pk: int) -> Response:
        """With its evidence and score history."""
        return Response(OpportunityDetailSerializer(_detail(request_user(request), pk)).data)

    @extend_schema(
        request=OpportunityWriteSerializer,
        responses=OpportunityDetailSerializer,
        operation_id="updateOpportunity",
    )
    def patch(self, request: Request, pk: int) -> Response:
        """Text fields, deadline and decision; scores change only through POST .../scores."""
        user = request_user(request)
        opportunity = _own(request, pk)
        body = OpportunityWriteSerializer(data=request.data, partial=True, context={"user": user})
        body.is_valid(raise_exception=True)
        services.update_opportunity(opportunity, dict(body.validated_data))
        return Response(OpportunityDetailSerializer(_detail(user, pk)).data)


class ScoresView(APIView):
    @extend_schema(
        request=ScoresWriteSerializer,
        responses={201: ScoreSnapshotSerializer},
        operation_id="recordOpportunityScores",
    )
    def post(self, request: Request, pk: int) -> Response:
        """A new snapshot of the four scores; older snapshots are kept as history."""
        opportunity = _own(request, pk)
        body = ScoresWriteSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        snapshot = services.record_scores(opportunity, dict(body.validated_data))
        return Response(ScoreSnapshotSerializer(snapshot).data, status=status.HTTP_201_CREATED)


class EvidenceListView(APIView):
    @extend_schema(
        request=EvidenceCreateSerializer,
        responses={201: EvidenceSerializer},
        operation_id="addOpportunityEvidence",
    )
    def post(self, request: Request, pk: int) -> Response:
        """Evidence linked to an inbox entry, Item or Note, or a conversation / link record."""
        user = request_user(request)
        opportunity = _own(request, pk)
        body = EvidenceCreateSerializer(data=request.data, context={"user": user})
        body.is_valid(raise_exception=True)
        try:
            evidence = services.add_evidence(opportunity, dict(body.validated_data))
        except services.DuplicateEvidence as error:
            raise ValidationError({"inboxEntry": "Already evidence for this opportunity."}) from error
        return Response(EvidenceSerializer(evidence).data, status=status.HTTP_201_CREATED)


class EvidenceView(APIView):
    @extend_schema(
        request=EvidenceUpdateSerializer,
        responses=EvidenceSerializer,
        operation_id="updateOpportunityEvidence",
    )
    def patch(self, request: Request, pk: int, evidence_id: int) -> Response:
        evidence = get_object_or_404(
            Evidence, pk=evidence_id, opportunity_id=pk, opportunity__user=request_user(request)
        )
        body = EvidenceUpdateSerializer(data=request.data, partial=True)
        body.is_valid(raise_exception=True)
        evidence = services.update_evidence(evidence, dict(body.validated_data))
        return Response(EvidenceSerializer(evidence).data)


class AttachInboxView(APIView):
    @extend_schema(
        request=AttachInboxSerializer,
        responses={200: AttachResultSerializer, 201: AttachResultSerializer},
        operation_id="attachInboxEntryAsEvidence",
    )
    def post(self, request: Request, pk: int) -> Response:
        """Weekly triage in one action: the inbox entry becomes evidence and (by default) is archived.

        201 when the evidence is new, 200 when the entry was already attached to this opportunity.
        """
        user = request_user(request)
        opportunity = _own(request, pk)
        body = AttachInboxSerializer(data=request.data, context={"user": user})
        body.is_valid(raise_exception=True)
        data = dict(body.validated_data)
        entry, archive = data.pop("inbox_entry"), data.pop("archive")
        evidence, created = services.attach_inbox_entry(opportunity, entry, data, archive)
        result = {"evidence": evidence, "created": created, "inboxStatus": entry.status}
        code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(AttachResultSerializer(result).data, status=code)


class AttachNewsView(APIView):
    @extend_schema(
        request=AttachNewsSerializer,
        responses={200: AttachNewsResultSerializer, 201: AttachNewsResultSerializer},
        operation_id="attachNewsItemAsEvidence",
    )
    def post(self, request: Request, pk: int) -> Response:
        """The morning-brief button: this news item is evidence for this opportunity (kind link).

        201 when the evidence is new, 200 when the item's URL is already link evidence of this opportunity.
        """
        user = request_user(request)
        opportunity = _own(request, pk)
        body = AttachNewsSerializer(data=request.data, context={"user": user})
        body.is_valid(raise_exception=True)
        data = dict(body.validated_data)
        evidence, created = services.attach_news_item(opportunity, data.pop("news_item"), data)
        code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(
            AttachNewsResultSerializer({"evidence": evidence, "created": created}).data, status=code
        )
