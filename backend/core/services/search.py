"""The `?q=` search of list endpoints: case-insensitive substring on titles and short text fields."""

MAX_QUERY = 200


def normalize_query(query: str) -> str:
    """Single spaces, at most MAX_QUERY characters; "" means no search."""
    return " ".join(query.split())[:MAX_QUERY]
