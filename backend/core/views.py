from django.contrib.auth.models import User
from django.db import connection
from django.http import HttpRequest, JsonResponse
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView


@require_GET
def healthz(request: HttpRequest) -> JsonResponse:
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1")
    return JsonResponse({"status": "ok"})


class MeSerializer(serializers.Serializer[object]):
    id = serializers.IntegerField()
    email = serializers.EmailField()
    name = serializers.CharField()


@method_decorator(ensure_csrf_cookie, name="dispatch")
class MeView(APIView):
    @extend_schema(responses=MeSerializer, operation_id="getMe")
    def get(self, request: Request) -> Response:
        user = request.user
        assert isinstance(user, User)  # IsAuthenticated ran
        name = user.get_full_name() or user.email.split("@")[0]
        return Response({"id": user.pk, "email": user.email, "name": name})
