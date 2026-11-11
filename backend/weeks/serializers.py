from rest_framework import serializers

from growth.serializers import AchievementSerializer
from opportunities.serializers import WeekOpportunitiesSerializer
from weeks.models import Objective, Week


class ObjectiveSerializer(serializers.ModelSerializer[Objective]):
    carriedFrom = serializers.IntegerField(source="carried_from_id", read_only=True, allow_null=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)

    class Meta:
        model = Objective
        fields = ["id", "title", "status", "position", "carriedFrom", "createdAt", "updatedAt"]
        read_only_fields = ["position"]


class ObjectiveCreateSerializer(serializers.Serializer[object]):
    title = serializers.CharField(max_length=300)


class ObjectiveUpdateSerializer(serializers.Serializer[object]):
    title = serializers.CharField(max_length=300, required=False)
    status = serializers.ChoiceField(choices=Objective.Status.choices, required=False)
    position = serializers.IntegerField(min_value=0, max_value=1000, required=False)


class WeekSerializer(serializers.ModelSerializer[Week]):
    startDate = serializers.DateField(source="start_date", read_only=True)
    planningJournal = serializers.CharField(source="planning_journal", read_only=True)
    plannedAt = serializers.DateTimeField(source="planned_at", read_only=True, allow_null=True)
    reviewWin = serializers.CharField(source="review_win", read_only=True)
    reviewDistraction = serializers.CharField(source="review_distraction", read_only=True)
    reviewLearned = serializers.CharField(source="review_learned", read_only=True)
    reviewSatisfied = serializers.CharField(source="review_satisfied", read_only=True)
    reviewChangedMind = serializers.CharField(source="review_changed_mind", read_only=True)
    reviewOpportunityEvidence = serializers.CharField(source="review_opportunity_evidence", read_only=True)
    reviewedAt = serializers.DateTimeField(source="reviewed_at", read_only=True, allow_null=True)
    id = serializers.IntegerField(read_only=True, allow_null=True, help_text="null: a week never written to")
    objectives = ObjectiveSerializer(many=True, read_only=True, source="objective_list")
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)

    class Meta:
        model = Week
        fields = [
            "id",
            "startDate",
            "planningJournal",
            "plannedAt",
            "reviewWin",
            "reviewDistraction",
            "reviewLearned",
            "reviewSatisfied",
            "reviewChangedMind",
            "reviewOpportunityEvidence",
            "reviewedAt",
            "objectives",
            "createdAt",
            "updatedAt",
        ]


class CarryCandidateSerializer(serializers.Serializer[object]):
    id = serializers.IntegerField()
    title = serializers.CharField()
    weekStart = serializers.DateField()
    carried = serializers.BooleanField()


class PlanViewSerializer(serializers.Serializer[object]):
    week = WeekSerializer()
    carryCandidates = CarryCandidateSerializer(many=True)


class PlanSerializer(serializers.Serializer[object]):
    carry = serializers.ListField(
        child=serializers.IntegerField(), required=False, default=list, max_length=50
    )
    planningJournal = serializers.CharField(
        source="planning_journal", required=False, allow_blank=True, max_length=20_000
    )


def _journal(source: str) -> serializers.CharField:
    return serializers.CharField(source=source, required=False, allow_blank=True, max_length=20_000)


class ReviewUpdateSerializer(serializers.Serializer[object]):
    reviewWin = _journal("review_win")
    reviewDistraction = _journal("review_distraction")
    reviewLearned = _journal("review_learned")
    reviewSatisfied = _journal("review_satisfied")
    reviewChangedMind = _journal("review_changed_mind")
    reviewOpportunityEvidence = _journal("review_opportunity_evidence")


class InboxWorkSerializer(serializers.Serializer[object]):
    id = serializers.IntegerField()
    title = serializers.CharField()


class ItemWorkSerializer(serializers.Serializer[object]):
    id = serializers.IntegerField()
    title = serializers.CharField()
    type = serializers.CharField()


class PageWorkSerializer(serializers.Serializer[object]):
    book = serializers.CharField()
    page = serializers.CharField()


class DayWorkSerializer(serializers.Serializer[object]):
    date = serializers.DateField()
    inboxArchived = InboxWorkSerializer(many=True)
    itemsFinished = ItemWorkSerializer(many=True)
    pagesDone = PageWorkSerializer(many=True)
    minutesForObjectives = serializers.IntegerField()
    minutesOther = serializers.IntegerField()


class ObjectiveCountsSerializer(serializers.Serializer[object]):
    open = serializers.IntegerField()
    done = serializers.IntegerField()
    dropped = serializers.IntegerField()


class ObjectiveTimeSerializer(serializers.Serializer[object]):
    id = serializers.IntegerField()
    title = serializers.CharField()
    minutes = serializers.IntegerField()


class WeekTimeSerializer(serializers.Serializer[object]):
    minutesForObjectives = serializers.IntegerField()
    minutesOther = serializers.IntegerField()
    byObjective = ObjectiveTimeSerializer(many=True)


class RhythmMonthSerializer(serializers.Serializer[object]):
    month = serializers.CharField(help_text="The month that just ended, YYYY-MM.")
    booksFinished = serializers.IntegerField(help_text="Book items finished in that month.")
    notes = serializers.IntegerField(help_text="Notes created in that month.")


class RhythmQuarterSerializer(serializers.Serializer[object]):
    year = serializers.IntegerField()
    quarter = serializers.IntegerField(help_text="1-4: the quarter that just ended.")
    achievements = serializers.IntegerField(help_text="Brag-document lines dated in that quarter.")
    projectsFinished = serializers.IntegerField(help_text="Project items finished in that quarter.")
    predictionsOpen = serializers.IntegerField(help_text="Predictions not scored yet, any date.")


class RhythmSerializer(serializers.Serializer[object]):
    notes = serializers.IntegerField(help_text="Notes created in the week.")
    achievements = serializers.IntegerField(help_text="Brag-document lines dated in the week.")
    predictionsDue = serializers.IntegerField(help_text="Open predictions, checkOn on or before Sunday.")
    month = RhythmMonthSerializer(
        allow_null=True, help_text="Only on the first review of a month (its Sunday is day 1-7)."
    )
    quarter = RhythmQuarterSerializer(
        allow_null=True, help_text="Only on the first review of January, April, July and October."
    )


class ReviewViewSerializer(serializers.Serializer[object]):
    week = WeekSerializer()
    objectiveCounts = ObjectiveCountsSerializer()
    days = DayWorkSerializer(many=True)
    time = WeekTimeSerializer()
    opportunities = WeekOpportunitiesSerializer()
    achievements = AchievementSerializer(many=True, help_text="The week's brag-document lines, oldest first.")
    rhythm = RhythmSerializer(help_text="Practice-rhythm reminders (DECISIONS 6.5).")
