"""Background job for Item images (run by `manage.py run_jobs`, never in a request; DECISIONS 9.6, 9.10)."""

import logging
from typing import Any

from core.services import jobs, safe_fetch, thumbnails, unfurl
from library import logos, services
from library.models import Item

logger = logging.getLogger(__name__)


@jobs.handler(services.IMAGE_JOB)
def fetch_item_image(payload: dict[str, Any]) -> None:
    """The picture of a link for an Item, fetched through the SSRF guard: for a tool (SITE_ICON_TYPES) the
    logo of its site (library/logos.py: the site's icon; for a GitHub repository its homepage's icon or its
    organisation's avatar), re-encoded by thumbnails.logo_to_webp; for any other type the URL's own bytes
    when it answers with an image, else the page's og:image (twitter:image), re-encoded at ITEM_SIZES.

    Refused URLs, unreadable images and links without a picture are final (logged, no image). An error that
    may go away raises, so the queue retries (3 attempts); while the GitHub API's hourly limit is used up the
    job waits until it resets (RetryLater with a delay: only this job waits, the other Items' images go on).
    The image is set only while the Item still has the image it had when the fetch was requested (`expect`)
    and no other change has ended the fetch since (services.set_image): an upload, a removal or an inbox link
    made meanwhile wins and the fetched file is discarded.
    """
    item_id, url, expect = payload["item_id"], payload["url"], payload["expect"]
    row = Item.objects.filter(pk=item_id).values_list("image_path", "type").first()
    if row is None or row[0] != expect:
        return  # deleted, or its image changed (or the fetch was ended) since the request: nothing to fetch
    logo = row[1] in services.SITE_ICON_TYPES
    try:
        webp = _logo(url) if logo else _picture(url)
        if webp is None:
            reason = "no logo on the site" if logo else "page without og:image"
            logger.info("no item image", extra={"item": item_id, "reason": reason})
            return
        name = thumbnails.store(webp)
    except (safe_fetch.FetchBlocked, thumbnails.ThumbnailError) as exc:
        logger.warning("item image refused", extra={"item": item_id, "reason": str(exc)})
        return
    except logos.RateLimited as exc:
        raise jobs.RetryLater(str(exc), delay=exc.wait) from exc
    services.set_image(item_id, name, expect=expect, fetched=True, webp=webp)


def _picture(url: str) -> bytes | None:
    """The URL's own image, else the page's og:image, at ITEM_SIZES; None for a page without one."""
    page = safe_fetch.fetch(url, safe_fetch.HTML_TYPES + safe_fetch.IMAGE_TYPES)
    if page.content_type in safe_fetch.IMAGE_TYPES:
        body = page.body
    elif image_url := unfurl.parse(page).image_url:
        body = safe_fetch.fetch(image_url, safe_fetch.IMAGE_TYPES).body
    else:
        return None
    return thumbnails.to_webp(body, thumbnails.ITEM_SIZES)


def _logo(url: str) -> bytes | None:
    logo = logos.tool_logo(url)
    return logo.webp if logo is not None else None
