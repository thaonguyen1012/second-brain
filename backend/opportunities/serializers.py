from typing import Any

from django.contrib.auth.models import User
from django.core.validators import URLValidator
from rest_framework import serializers

from growth.models import Skill
from growth.serializers import FitSkillSerializer
from inbox.models import InboxEntry
from library.models import Item, Note
from opportunities import services
from opportunities.models import Evidence, Opportunity, ScoreSnapshot

LINKS = {Evidence.Kind.INBOX: "inbox_entry", Evidence.Kind.ITEM: "item", Evidence.Kind.NOTE: "library_note"}


def _score(**kwargs: Any) -> serializers.IntegerField:
    return serializers.IntegerField(min_value=1, max_value=10, **kwargs)


def _url(**kwargs: Any) -> serializers.CharField:
    validator = URLValidator(schemes=["http", "https"])
    return serializers.CharField(max_length=2000, allow_blank=True, validators=[validator], **kwargs)


class ScoresSerializer(serializers.Serializer[object]):
    """The current (newest) scores."""

    opportunity = serializers.IntegerField()
    pain = serializers.IntegerField()
    feasibility = serializers.IntegerField()
    timing = serializers.IntegerField()
    createdAt = serializers.DateTimeField()


class ScoreSnapshotSerializer(serializers.ModelSerializer[ScoreSnapshot]):
    opportunity = serializers.IntegerField(source="opportunity_score", read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = ScoreSnapshot
        fields = ["id", "opportunity", "pain", "feasibility", "timing", "note", "createdAt"]
        read_only_fields = fields


class ScoresWriteSerializer(serializers.Serializer[object]):
    opportunity = _score(source="opportunity_score")
    pain = _score()
    feasibility = _score()
    timing = _score()
    note = serializers.CharField(max_length=5000, required=False, allow_blank=True)


class EvidenceSerializer(serializers.ModelSerializer[Evidence]):
    inboxEntry = serializers.IntegerField(source="inbox_entry_id", read_only=True, allow_null=True)
    item = serializers.IntegerField(source="item_id", read_only=True, allow_null=True)
    libraryNote = serializers.IntegerField(source="library_note_id", read_only=True, allow_null=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)

    class Meta:
        model = Evidence
        fields = [
            "id",
            "kind",
            "stance",
            "title",
            "url",
            "note",
            "date",
            "inboxEntry",
            "item",
            "libraryNote",
            "createdAt",
            "updatedAt",
        ]
        read_only_fields = fields


class OpportunitySerializer(serializers.Serializer[Any]):
    """An opportunity annotated by `services.opportunities()`."""

    id = serializers.IntegerField()
    title = serializers.CharField()
    hypothesis = serializers.CharField()
    whyNow = serializers.CharField()
    nextAction = serializers.CharField()
    decideBy = serializers.DateField(allow_null=True)
    decision = serializers.ChoiceField(choices=Opportunity.Decision.choices)
    decidedAt = serializers.DateTimeField(allow_null=True)
    scores = ScoresSerializer(allow_null=True)
    evidenceSupports = serializers.IntegerField()
    evidenceContradicts = serializers.IntegerField()
    lastEvidenceAt = serializers.DateTimeField(allow_null=True)
    stale = serializers.BooleanField()
    fit = FitSkillSerializer(many=True)
    createdAt = serializers.DateTimeField()
    updatedAt = serializers.DateTimeField()

    def fields_of(self, instance: Opportunity) -> dict[str, Any]:
        return {
            "id": instance.pk,
            "title": instance.title,
            "hypothesis": instance.hypothesis,
            "whyNow": instance.why_now,
            "nextAction": instance.next_action,
            "decideBy": instance.decide_by,
            "decision": instance.decision,
            "decidedAt": instance.decided_at,
            "scores": services.current_scores(instance),
            "evidenceSupports": getattr(instance, "evidence_supports", 0),
            "evidenceContradicts": getattr(instance, "evidence_contradicts", 0),
            "lastEvidenceAt": services.last_evidence(instance),
            "stale": getattr(instance, "stale", False),
            "fit": instance.fit.all(),  # prefetched with freshness (api.py)
            "createdAt": instance.created_at,
            "updatedAt": instance.updated_at,
        }

    def to_representation(self, instance: Opportunity) -> Any:
        return super().to_representation(self.fields_of(instance))


class OpportunityDetailSerializer(OpportunitySerializer):
    """With the evidence (newest date first) and the score history (newest first); prefetch both."""

    evidence = EvidenceSerializer(many=True)
    scoreHistory = ScoreSnapshotSerializer(many=True)

    def fields_of(self, instance: Opportunity) -> dict[str, Any]:
        return {
            **super().fields_of(instance),
            "evidence": instance.evidence.all(),
            "scoreHistory": instance.scores.all(),
        }


class OpportunityWriteSerializer(serializers.Serializer[object]):
    """Create (title and hypothesis required) or partial update. `fit` replaces the fitting skills (ids of
    the owner's skills in context["user"])."""

    title = serializers.CharField(max_length=200)
    hypothesis = serializers.CharField(max_length=1000)
    whyNow = serializers.CharField(source="why_now", max_length=5000, required=False, allow_blank=True)
    nextAction = serializers.CharField(source="next_action", max_length=500, required=False, allow_blank=True)
    decideBy = serializers.DateField(source="decide_by", required=False, allow_null=True)
    decision = serializers.ChoiceField(choices=Opportunity.Decision.choices, required=False)
    fit = serializers.ListField(child=serializers.IntegerField(), max_length=50, required=False)

    def validate_fit(self, value: list[int]) -> list[Skill]:
        user: User = self.context["user"]
        skills = list(Skill.objects.filter(user=user, pk__in=value))
        if len(skills) != len(set(value)):
            raise serializers.ValidationError("Not one of your skills.")
        return skills


class OpportunityCreateSerializer(OpportunityWriteSerializer):
    scores = ScoresWriteSerializer(required=False)  # the first snapshot


class EvidenceUpdateSerializer(serializers.Serializer[object]):
    """Used with partial=True; the kind and the linked row do not change."""

    stance = serializers.ChoiceField(choices=Evidence.Stance.choices)
    title = serializers.CharField(max_length=300)
    url = _url()
    note = serializers.CharField(max_length=20_000, allow_blank=True)
    date = serializers.DateField()


class _Owned(serializers.Serializer[object]):
    """Resolves linked ids against the owner in context["user"]; another user's row answers 400."""

    def owned(self, model: type[InboxEntry] | type[Item] | type[Note], pk: int | None) -> Any:
        if pk is None:
            return None
        user: User = self.context["user"]
        row = model.objects.filter(pk=pk, user=user).first()
        if row is None:
            raise serializers.ValidationError("Not one of yours.")
        return row


class EvidenceCreateSerializer(_Owned):
    kind = serializers.ChoiceField(choices=Evidence.Kind.choices)
    stance = serializers.ChoiceField(choices=Evidence.Stance.choices)
    title = serializers.CharField(max_length=300, required=False, allow_blank=True)
    url = _url(required=False)
    note = serializers.CharField(max_length=20_000, required=False, allow_blank=True)
    date = serializers.DateField(required=False)
    inboxEntry = serializers.IntegerField(source="inbox_entry", required=False, allow_null=True)
    item = serializers.IntegerField(required=False, allow_null=True)
    libraryNote = serializers.IntegerField(source="library_note", required=False, allow_null=True)

    def validate_inboxEntry(self, value: int | None) -> InboxEntry | None:
        entry: InboxEntry | None = self.owned(InboxEntry, value)
        return entry

    def validate_item(self, value: int | None) -> Item | None:
        item: Item | None = self.owned(Item, value)
        return item

    def validate_libraryNote(self, value: int | None) -> Note | None:
        note: Note | None = self.owned(Note, value)
        return note

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        kind = attrs["kind"]
        needed = LINKS.get(kind)
        for field in LINKS.values():
            if field != needed and attrs.get(field) is not None:
                raise serializers.ValidationError(f"A {kind} evidence links no {field}.")
        if needed and attrs.get(needed) is None:
            raise serializers.ValidationError(f"A {kind} evidence needs its link.")
        if needed is None and not attrs.get("title"):
            raise serializers.ValidationError({"title": f"A {kind} evidence needs a title."})
        if kind == Evidence.Kind.LINK and not attrs.get("url"):
            raise serializers.ValidationError({"url": "A link evidence needs a url."})
        return attrs


class AttachInboxSerializer(_Owned):
    inboxEntry = serializers.IntegerField(source="inbox_entry")
    stance = serializers.ChoiceField(choices=Evidence.Stance.choices)
    title = serializers.CharField(max_length=300, required=False, allow_blank=True)
    note = serializers.CharField(max_length=20_000, required=False, allow_blank=True)
    date = serializers.DateField(required=False)
    archive = serializers.BooleanField(required=False, default=True)

    def validate_inboxEntry(self, value: int) -> InboxEntry:
        entry: InboxEntry = self.owned(InboxEntry, value)
        return entry


class AttachResultSerializer(serializers.Serializer[object]):
    evidence = EvidenceSerializer()
    created = serializers.BooleanField()
    inboxStatus = serializers.ChoiceField(choices=InboxEntry.Status.choices)


class WeekOpportunitySerializer(serializers.Serializer[object]):
    id = serializers.IntegerField()
    title = serializers.CharField()
    decision = serializers.ChoiceField(choices=Opportunity.Decision.choices)
    supports = serializers.IntegerField()
    contradicts = serializers.IntegerField()


class StaleOpportunitySerializer(serializers.Serializer[object]):
    id = serializers.IntegerField()
    title = serializers.CharField()
    decision = serializers.ChoiceField(choices=Opportunity.Decision.choices)
    lastEvidenceAt = serializers.DateTimeField(allow_null=True)


class WeekOpportunitiesSerializer(serializers.Serializer[object]):
    withEvidence = WeekOpportunitySerializer(many=True)
    stale = StaleOpportunitySerializer(many=True)
