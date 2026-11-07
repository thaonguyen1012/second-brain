"""Background job for Item images (run by `manage.py run_jobs`, never inside a request; DECISIONS 9.6)."""

import logging
from typing import Any

from core.services import jobs, safe_fetch, thumbnails, unfurl
from library import services
from library.models import Item

logger = logging.getLogger(__name__)


@jobs.handler(services.IMAGE_JOB)
def fetch_item_image(payload: dict[str, Any]) -> None:
    """The image of a link for an Item: the URL's own bytes when it answers with an image, else the page's
    og:image (twitter:image), fetched through the SSRF guard and re-encoded at ITEM_SIZES.

    Refused URLs, unreadable images and pages without an image are final (logged, no image). A network
    error raises, so the queue retries. The image is set only while the Item still has the image it had when
    the fetch was requested (`expect`) and no other change has ended the fetch since (services.set_image): an
    upload, a removal or an inbox link made meanwhile wins and the fetched file is discarded.
    """
    item_id, url, expect = payload["item_id"], payload["url"], payload["expect"]
    current = Item.objects.filter(pk=item_id).values_list("image_path", flat=True).first()
    if current is None or current != expect:
        return  # deleted, or its image changed (or the fetch was ended) since the request: nothing to fetch
    try:
        page = safe_fetch.fetch(url, safe_fetch.HTML_TYPES + safe_fetch.IMAGE_TYPES)
        if page.content_type in safe_fetch.IMAGE_TYPES:
            body = page.body
        elif image_url := unfurl.parse(page).image_url:
            body = safe_fetch.fetch(image_url, safe_fetch.IMAGE_TYPES).body
        else:
            logger.info("no item image", extra={"item": item_id, "reason": "page without og:image"})
            return
        name = thumbnails.store(thumbnails.to_webp(body, thumbnails.ITEM_SIZES))
    except (safe_fetch.FetchBlocked, thumbnails.ThumbnailError) as exc:
        logger.warning("item image refused", extra={"item": item_id, "reason": str(exc)})
        return
    services.set_image(item_id, name, expect=expect, fetched=True)
