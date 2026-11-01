from rest_framework.pagination import CursorPagination


class NewestFirstCursor(CursorPagination):
    """Cursor pagination for list endpoints (DECISIONS 10.2): stable under inserts, no COUNT query."""

    ordering = ("-created_at", "-id")
    page_size = 50
    max_page_size = 200
    page_size_query_param = "limit"
