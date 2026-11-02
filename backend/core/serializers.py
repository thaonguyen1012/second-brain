from rest_framework import serializers


class ErrorSerializer(serializers.Serializer[object]):
    """DRF's error body: `{"detail": "..."}`."""

    detail = serializers.CharField()


class LlmStatusSerializer(serializers.Serializer[object]):
    provider = serializers.CharField()
    model = serializers.CharField()
    freeTier = serializers.BooleanField(help_text="Calls cost 0 on the provider's free tier.")
    monthStart = serializers.DateTimeField()
    monthCostUsd = serializers.DecimalField(
        max_digits=12,
        decimal_places=6,
        coerce_to_string=False,
        help_text="This month at paid-tier prices: what the budget guard compares with budgetUsd.",
    )
    budgetUsd = serializers.DecimalField(max_digits=12, decimal_places=2, coerce_to_string=False)
    calls = serializers.IntegerField(help_text="LLM calls recorded this month, refused and failed ones too.")
    failedCalls = serializers.IntegerField()


class JobCountSerializer(serializers.Serializer[object]):
    kind = serializers.CharField()
    count = serializers.IntegerField()


class JobCountsSerializer(serializers.Serializer[object]):
    pending = JobCountSerializer(many=True)
    failed = JobCountSerializer(many=True)


class StatusSerializer(serializers.Serializer[object]):
    llm = LlmStatusSerializer()
    lastBriefDate = serializers.DateField(allow_null=True)
    jobs = JobCountsSerializer()
