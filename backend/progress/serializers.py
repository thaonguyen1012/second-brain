from rest_framework import serializers

from progress.services import known_books


def validate_book(value: str) -> None:
    if value not in known_books():
        raise serializers.ValidationError("Unknown book.")


class LastVisitedSerializer(serializers.Serializer[object]):
    bookSlug = serializers.CharField()
    pageSlug = serializers.CharField(allow_blank=True)
    title = serializers.CharField(required=False)
    at = serializers.DateTimeField()


class ProgressSnapshotSerializer(serializers.Serializer[object]):
    done = serializers.DictField(child=serializers.DictField(child=serializers.BooleanField()))
    lastVisited = LastVisitedSerializer(allow_null=True)


class SetDoneSerializer(serializers.Serializer[object]):
    done = serializers.BooleanField()


class SetDoneResponseSerializer(serializers.Serializer[object]):
    book = serializers.CharField()
    page = serializers.CharField(allow_blank=True)
    done = serializers.BooleanField()
    updatedAt = serializers.DateTimeField()


class SetLastVisitedSerializer(serializers.Serializer[object]):
    book = serializers.CharField(max_length=100, validators=[validate_book])
    page = serializers.CharField(max_length=500, allow_blank=True)
    title = serializers.CharField(max_length=300, required=False, allow_blank=True)
