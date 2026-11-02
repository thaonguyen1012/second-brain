import datetime as dt
import re
from typing import Any

from django.contrib.auth.models import User
from django.core.validators import URLValidator
from rest_framework import serializers

from growth.models import Freshness, JobAd, Skill, SkillEvidence
from library.models import Item, Note

LINKS = {SkillEvidence.Kind.ITEM: "item", SkillEvidence.Kind.NOTE: "library_note"}
MONTH = re.compile(r"^(\d{4})-(0[1-9]|1[0-2])$")


def _url(**kwargs: Any) -> serializers.CharField:
    validator = URLValidator(schemes=["http", "https"])
    return serializers.CharField(max_length=2000, allow_blank=True, validators=[validator], **kwargs)


def parse_month(value: str) -> dt.date:
    """ "2026-11" -> 2026-11-01; raises ValueError."""
    match = MONTH.match(value)
    if match is None:
        raise ValueError("A month as YYYY-MM.")
    return dt.date(int(match[1]), int(match[2]), 1)


class MonthField(serializers.CharField):
    """A month as "YYYY-MM" on the wire, the first day of that month in the database."""

    def to_internal_value(self, data: Any) -> Any:
        try:
            return parse_month(str(super().to_internal_value(data)))
        except ValueError as error:
            raise serializers.ValidationError(str(error)) from error

    def to_representation(self, value: Any) -> str:
        return f"{value:%Y-%m}"


# --- Skills -----------------------------------------------------------------------------------------


class SkillEvidenceSerializer(serializers.ModelSerializer[SkillEvidence]):
    item = serializers.IntegerField(source="item_id", read_only=True, allow_null=True)
    libraryNote = serializers.IntegerField(source="library_note_id", read_only=True, allow_null=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)

    class Meta:
        model = SkillEvidence
        fields = [
            "id",
            "kind",
            "title",
            "url",
            "note",
            "date",
            "item",
            "libraryNote",
            "createdAt",
            "updatedAt",
        ]
        read_only_fields = fields


class SkillSerializer(serializers.Serializer[Skill]):
    """A skill annotated by `services.skills()`."""

    id = serializers.IntegerField()
    name = serializers.CharField()
    aliases = serializers.ListField(child=serializers.CharField())
    note = serializers.CharField()
    freshness = serializers.ChoiceField(choices=Freshness.choices)
    lastEvidenceOn = serializers.DateField(source="last_evidence_on", allow_null=True)
    evidenceCount = serializers.IntegerField(source="evidence_count")
    createdAt = serializers.DateTimeField(source="created_at")
    updatedAt = serializers.DateTimeField(source="updated_at")


class SkillDetailSerializer(SkillSerializer):
    """With the evidence, newest date first (prefetch it)."""

    evidence = SkillEvidenceSerializer(many=True)


class SkillWriteSerializer(serializers.Serializer[object]):
    """Create (name required) or partial update; there is no self-rating to type (DECISIONS 9.1)."""

    name = serializers.CharField(max_length=60)
    aliases = serializers.ListField(child=serializers.CharField(max_length=60), max_length=20, required=False)
    note = serializers.CharField(max_length=5000, required=False, allow_blank=True)


class FitSkillSerializer(serializers.Serializer[Skill]):
    """A skill an opportunity fits, with its freshness (annotated by `services.with_freshness()`)."""

    id = serializers.IntegerField()
    name = serializers.CharField()
    freshness = serializers.ChoiceField(choices=Freshness.choices)


class SkillEvidenceUpdateSerializer(serializers.Serializer[object]):
    """Used with partial=True; the kind and the linked row do not change."""

    title = serializers.CharField(max_length=300)
    url = _url()
    note = serializers.CharField(max_length=20_000, allow_blank=True)
    date = serializers.DateField()


class SkillEvidenceCreateSerializer(serializers.Serializer[object]):
    """Links resolve against the owner in context["user"]; another user's row answers 400."""

    kind = serializers.ChoiceField(choices=SkillEvidence.Kind.choices)
    title = serializers.CharField(max_length=300, required=False, allow_blank=True)
    url = _url(required=False)
    note = serializers.CharField(max_length=20_000, required=False, allow_blank=True)
    date = serializers.DateField(required=False)
    item = serializers.IntegerField(required=False, allow_null=True)
    libraryNote = serializers.IntegerField(source="library_note", required=False, allow_null=True)

    def _owned(self, model: type[Item] | type[Note], pk: int | None) -> Any:
        if pk is None:
            return None
        user: User = self.context["user"]
        row = model.objects.filter(pk=pk, user=user).first()
        if row is None:
            raise serializers.ValidationError("Not one of yours.")
        return row

    def validate_item(self, value: int | None) -> Item | None:
        item: Item | None = self._owned(Item, value)
        return item

    def validate_libraryNote(self, value: int | None) -> Note | None:
        note: Note | None = self._owned(Note, value)
        return note

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        kind = attrs["kind"]
        needed = LINKS.get(kind)
        for field in LINKS.values():
            if field != needed and attrs.get(field) is not None:
                raise serializers.ValidationError(f"A {kind} evidence links no {field}.")
        if needed and attrs.get(needed) is None:
            raise serializers.ValidationError(f"A {kind} evidence needs its link.")
        if kind == SkillEvidence.Kind.LINK and not (attrs.get("title") and attrs.get("url")):
            raise serializers.ValidationError({"url": "A link evidence needs a title and a url."})
        return attrs


# --- Job ads and market -----------------------------------------------------------------------------


class JobAdSerializer(serializers.ModelSerializer[JobAd]):
    month = MonthField(read_only=True)
    processedAt = serializers.DateTimeField(source="processed_at", read_only=True, allow_null=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)

    class Meta:
        model = JobAd
        fields = [
            "id",
            "title",
            "company",
            "url",
            "text",
            "month",
            "skills",
            "seniority",
            "processed",
            "processedAt",
            "error",
            "createdAt",
            "updatedAt",
        ]
        read_only_fields = fields


class JobAdWriteSerializer(serializers.Serializer[object]):
    """Create (title and text required) or partial update. `skills` set by hand skips the extraction."""

    title = serializers.CharField(max_length=200)
    company = serializers.CharField(max_length=200, required=False, allow_blank=True)
    url = _url(required=False)
    text = serializers.CharField(max_length=20_000)
    month = MonthField(required=False)
    skills = serializers.ListField(child=serializers.CharField(max_length=60), max_length=30, required=False)


class MirrorSkillSerializer(serializers.Serializer[object]):
    id = serializers.IntegerField()
    name = serializers.CharField()
    freshness = serializers.ChoiceField(choices=Freshness.choices)
    lastEvidenceOn = serializers.DateField(allow_null=True)


class MarketSkillSerializer(serializers.Serializer[object]):
    name = serializers.CharField()
    count = serializers.IntegerField()
    previousCount = serializers.IntegerField()
    skill = MirrorSkillSerializer(allow_null=True)
    gap = serializers.BooleanField()


class SeniorityCountSerializer(serializers.Serializer[object]):
    level = serializers.ChoiceField(choices=JobAd.Seniority.choices)
    count = serializers.IntegerField()


class MarketReportSerializer(serializers.Serializer[object]):
    month = MonthField()
    jobAds = serializers.IntegerField()
    processed = serializers.IntegerField()
    seniority = SeniorityCountSerializer(many=True)
    skills = MarketSkillSerializer(many=True)
    gaps = MarketSkillSerializer(many=True)
