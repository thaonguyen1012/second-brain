from django.db.models import QuerySet
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import generics
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.serializers import BaseSerializer
from rest_framework.views import APIView

from core.authentication import request_user
from core.pagination import NewestFirstCursor
from library.models import Item
from library.serializers import ItemSerializer


@extend_schema_view(
    get=extend_schema(
        operation_id="listItems",
        parameters=[
            OpenApiParameter("type", str, enum=Item.Type.values),
            OpenApiParameter("status", str, enum=Item.Status.values),
        ],
    ),
    post=extend_schema(operation_id="createItem"),
)
class ItemListView(generics.ListCreateAPIView[Item]):
    serializer_class = ItemSerializer
    pagination_class = NewestFirstCursor

    def get_queryset(self) -> QuerySet[Item]:
        items = Item.objects.filter(user=request_user(self.request))
        for field in ("type", "status"):
            if value := self.request.query_params.get(field):
                items = items.filter(**{field: value})
        return items

    def perform_create(self, serializer: BaseSerializer[Item]) -> None:
        serializer.save(user=request_user(self.request))


class ItemView(APIView):
    @extend_schema(request=ItemSerializer, responses=ItemSerializer, operation_id="updateItem")
    def patch(self, request: Request, pk: int) -> Response:
        item = get_object_or_404(Item, pk=pk, user=request_user(request))
        body = ItemSerializer(item, data=request.data, partial=True)
        body.is_valid(raise_exception=True)
        body.save()
        return Response(body.data)
