from functools import cache

from django.conf import settings
from django.contrib.auth.models import User

from progress.models import LastVisited, PageProgress

INDEX_PAGE = "_index"
MAX_PAGE_LENGTH = 500  # PageProgress.page max_length


@cache
def known_books() -> frozenset[str]:
    """Book slugs = <CONTENT_DIR>/<track>/<book>/ directories (read once per process)."""
    root = settings.CONTENT_DIR
    return frozenset(b.name for t in root.iterdir() if t.is_dir() for b in t.iterdir() if b.is_dir())


def normalize_page(page: str) -> str:
    page = page.strip("/")
    return "" if page == INDEX_PAGE else page


def snapshot(user: User) -> dict[str, object]:
    done: dict[str, dict[str, bool]] = {}
    for book, page in PageProgress.objects.filter(user=user, done=True).values_list("book", "page"):
        done.setdefault(book, {})[page] = True
    last = LastVisited.objects.filter(user=user).first()
    return {"done": done, "lastVisited": last_visited_payload(last) if last else None}


def set_done(user: User, book: str, page: str, done: bool) -> PageProgress:
    row, _ = PageProgress.objects.update_or_create(user=user, book=book, page=page, defaults={"done": done})
    return row


def set_last_visited(user: User, book: str, page: str, title: str) -> LastVisited:
    row, _ = LastVisited.objects.update_or_create(
        user=user, defaults={"book": book, "page": page, "title": title}
    )
    return row


def last_visited_payload(row: LastVisited) -> dict[str, object]:
    payload: dict[str, object] = {"bookSlug": row.book, "pageSlug": row.page, "at": row.at}
    if row.title:
        payload["title"] = row.title
    return payload
