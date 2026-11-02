from typing import Any

from django.contrib.auth.models import User
from rest_framework import serializers

from library.models import Item
from library.services import normalize_tags
from weeks.models import Objective
from work import services
from work.models import ProjectDetails, TimeEntry

MAX_MINUTES = 24 * 60


def _money(digits: int = 12, **kwargs: Any) -> serializers.DecimalField:
    return serializers.DecimalField(max_digits=digits, decimal_places=2, min_value=0, **kwargs)


class ProjectSerializer(serializers.Serializer[Any]):
    """A project Item with its details and computed totals (minutes of finished entries only)."""

    id = serializers.IntegerField()
    title = serializers.CharField()
    status = serializers.ChoiceField(choices=Item.Status.choices)
    tags = serializers.ListField(child=serializers.CharField())
    source = serializers.CharField()  # type: ignore[assignment]
    client = serializers.CharField()
    billing = serializers.ChoiceField(choices=ProjectDetails.Billing.choices)
    price = _money(allow_null=True)
    hourlyRate = _money(10, allow_null=True)
    currency = serializers.CharField()
    minutesTotal = serializers.IntegerField()
    minutesBillable = serializers.IntegerField()
    minutesNonBillable = serializers.IntegerField()
    earned = serializers.DecimalField(max_digits=14, decimal_places=2, allow_null=True)
    effectiveRate = serializers.DecimalField(max_digits=14, decimal_places=2, allow_null=True)
    createdAt = serializers.DateTimeField()
    updatedAt = serializers.DateTimeField()
    startedAt = serializers.DateTimeField(allow_null=True)
    finishedAt = serializers.DateTimeField(allow_null=True)

    def to_representation(self, instance: Item) -> Any:
        details = services.details_of(instance)
        return super().to_representation(
            {
                "id": instance.pk,
                "title": instance.title,
                "status": instance.status,
                "tags": instance.tags,
                "source": instance.source,
                "client": details.client,
                "billing": details.billing,
                "price": details.price,
                "hourlyRate": details.hourly_rate,
                "currency": details.currency,
                **services.totals(instance),
                "createdAt": instance.created_at,
                "updatedAt": instance.updated_at,
                "startedAt": instance.started_at,
                "finishedAt": instance.finished_at,
            }
        )


class ProjectWriteSerializer(serializers.Serializer[object]):
    """Create (title required) or partial update; context["details"] is the current details on update."""

    title = serializers.CharField(max_length=300)
    status = serializers.ChoiceField(choices=Item.Status.choices, required=False)
    tags = serializers.ListField(child=serializers.CharField(max_length=50), required=False, max_length=30)
    source = serializers.CharField(max_length=2000, required=False, allow_blank=True)  # type: ignore[assignment]
    startedAt = serializers.DateTimeField(source="started_at", required=False, allow_null=True)
    finishedAt = serializers.DateTimeField(source="finished_at", required=False, allow_null=True)
    client = serializers.CharField(max_length=200, required=False, allow_blank=True)
    billing = serializers.ChoiceField(choices=ProjectDetails.Billing.choices, required=False)
    price = _money(required=False, allow_null=True)
    hourlyRate = _money(10, source="hourly_rate", required=False, allow_null=True)
    currency = serializers.RegexField(r"^[A-Z]{3}$", required=False)

    def validate_tags(self, value: list[str]) -> list[str]:
        return normalize_tags(value)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        current: ProjectDetails | None = self.context.get("details")
        billing = attrs.get("billing", current.billing if current else ProjectDetails.Billing.FIXED)
        rate = attrs.get("hourly_rate", current.hourly_rate if current else None)
        if billing == ProjectDetails.Billing.HOURLY and rate is None:
            raise serializers.ValidationError({"hourlyRate": "An hourly project needs an hourly rate."})
        return attrs


class TimeEntrySerializer(serializers.ModelSerializer[TimeEntry]):
    projectTitle = serializers.CharField(source="project.title", read_only=True)
    startedAt = serializers.DateTimeField(source="started_at", read_only=True, allow_null=True)
    running = serializers.BooleanField(read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)

    class Meta:
        model = TimeEntry
        fields = [
            "id",
            "project",
            "projectTitle",
            "objective",
            "date",
            "minutes",
            "startedAt",
            "running",
            "note",
            "billable",
            "createdAt",
            "updatedAt",
        ]
        read_only_fields = fields


class _EntryLinks(serializers.Serializer[object]):
    """Project and objective ids, checked against the owner in context["user"]."""

    project = serializers.IntegerField()
    objective = serializers.IntegerField(required=False, allow_null=True)

    def validate_project(self, value: int) -> Item:
        user: User = self.context["user"]
        project = Item.objects.filter(pk=value, user=user, type=Item.Type.PROJECT).first()
        if project is None:
            raise serializers.ValidationError("Not one of your projects.")
        return project

    def validate_objective(self, value: int | None) -> Objective | None:
        if value is None:
            return None
        objective = Objective.objects.filter(pk=value, week__user=self.context["user"]).first()
        if objective is None:
            raise serializers.ValidationError("Not one of your objectives.")
        return objective


class TimeEntryCreateSerializer(_EntryLinks):
    date = serializers.DateField()
    minutes = serializers.IntegerField(min_value=1, max_value=MAX_MINUTES)
    note = serializers.CharField(max_length=5000, required=False, allow_blank=True)
    billable = serializers.BooleanField(required=False)


class TimeEntryUpdateSerializer(TimeEntryCreateSerializer):
    """Used with partial=True: every field is optional."""


class TimerStartSerializer(_EntryLinks):
    note = serializers.CharField(max_length=5000, required=False, allow_blank=True)
    billable = serializers.BooleanField(required=False)


class TimerSerializer(serializers.Serializer[object]):
    running = TimeEntrySerializer(allow_null=True)


class ProjectWeekSerializer(serializers.Serializer[object]):
    id = serializers.IntegerField()
    title = serializers.CharField()
    client = serializers.CharField()
    minutesTotal = serializers.IntegerField()
    minutesBillable = serializers.IntegerField()
    minutesNonBillable = serializers.IntegerField()


class WeekSummarySerializer(serializers.Serializer[object]):
    weekStart = serializers.DateField()
    minutesTotal = serializers.IntegerField()
    minutesBillable = serializers.IntegerField()
    minutesNonBillable = serializers.IntegerField()
    projects = ProjectWeekSerializer(many=True)
