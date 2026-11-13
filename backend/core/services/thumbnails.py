"""Stored images: inbox link thumbnails and Item images (covers, logos; DECISIONS 9.6, 9.10). Decode with
Pillow (decompression-bomb limit), re-encode as webp <= MAX_BYTES, store under THUMBS_DIR (outside any web
root; served through X-Accel-Redirect).

A file's name is the hash of its bytes, so rows of either table and of any owner can share one file: a file
goes only through discard_if_unused, never while a row still names it. store() skips a file that exists,
so a row that names a file is saved in a transaction that first calls claim(): it waits for a running
discard of the same name and writes the file again if that discard removed it (security audit S-16).
"""

import hashlib
import io
import os
import tempfile
import warnings
from pathlib import Path
from typing import cast

from django.conf import settings
from django.db import connection, transaction
from PIL import IcoImagePlugin, Image, ImageOps

from inbox.models import InboxEntry
from library.models import Item

MAX_BYTES = 200 * 1024
MAX_PIXELS = 20_000_000  # decoded size above this is refused (bomb)
FORMATS = frozenset({"JPEG", "PNG", "GIF", "WEBP"})
SIZES = (1200, 800, 600, 400)  # inbox link cards
# Item images are shown at most ~280 css px wide: 600 px covers 2x screens and keeps lists light.
ITEM_SIZES = (600, 400)
QUALITIES = (80, 65, 50)
# A site's icon taken as a logo (a tool's, DECISIONS 9.10) shows at most 56 css px wide: 256 px covers 3x
# screens. A smaller side under LOGO_MIN_SIDE is a 16 px favicon, which would only show blurred.
LOGO_SIZE = 256
LOGO_MIN_SIDE = 32
LOGO_LOSSLESS_BYTES = 32 * 1024  # flat logos stay well under it; a photo-like avatar goes lossy
LOGO_QUALITIES = (90, 80)  # flat colours and sharp edges: lossy webp needs more quality than a photo
ICON_FORMATS = FORMATS | {"ICO"}
Image.MAX_IMAGE_PIXELS = MAX_PIXELS  # Pillow warns above this and raises above twice this


class ThumbnailError(Exception):
    pass


class NotALogo(ThumbnailError):
    """A readable image that makes no logo: too small, or of one colour (a blank or transparent pixel)."""


def to_webp(data: bytes, sizes: tuple[int, ...] = SIZES) -> bytes:
    """The first frame, turned by its EXIF orientation, as a webp whose longer side is at most the first of
    `sizes` that fits in MAX_BYTES (each size tried at QUALITIES). Pillow reads the bytes themselves (JPEG,
    PNG, GIF or WebP only), whatever type the sender claimed; anything else, a bomb or an image that does not
    fit raises ThumbnailError."""
    largest = sizes[0]
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data), formats=sorted(FORMATS)) as source:
                source.seek(0)  # first frame of animations
                source.draft("RGB", (largest, largest))  # JPEG: decode at reduced scale
                source.thumbnail((largest, largest))  # shrink before any full-size copy
                image = ImageOps.exif_transpose(source).convert("RGBA")
    except Exception as exc:  # third-party bytes: Pillow raises many types (struct.error on bad EXIF, S-06)
        raise ThumbnailError(f"cannot decode image: {type(exc).__name__}") from exc
    for size in sizes:
        frame = image.copy()
        frame.thumbnail((size, size))
        for quality in QUALITIES:
            out = io.BytesIO()
            frame.save(out, "WEBP", quality=quality, method=4)
            if out.tell() <= MAX_BYTES:
                return out.getvalue()
    raise ThumbnailError("cannot fit the thumbnail in the size limit")


def logo_to_webp(data: bytes) -> bytes:
    """A site's icon as a logo: a webp of at most LOGO_SIZE px on its longer side, never enlarged, its
    transparency kept; lossless when that stays under LOGO_LOSSLESS_BYTES (a small icon stays sharp), else
    lossy at LOGO_QUALITIES. Pillow reads the bytes themselves, whatever type the sender claimed: JPEG, PNG,
    GIF, WebP (their first frame) or ICO (its largest frame, in its most colours). SVG, anything else and a
    bomb raise ThumbnailError; NotALogo when the smaller side is under LOGO_MIN_SIDE px or every pixel has
    one colour (a blank or fully transparent icon)."""
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data), formats=sorted(ICON_FORMATS)) as source:
                frame = _icon_frame(source)
                if min(frame.size) < LOGO_MIN_SIDE:
                    raise NotALogo(f"icon of {frame.width}x{frame.height} px is too small")
                frame.thumbnail((LOGO_SIZE, LOGO_SIZE), Image.Resampling.LANCZOS)
                image = ImageOps.exif_transpose(frame).convert("RGBA")
    except ThumbnailError:
        raise
    except Exception as exc:  # third-party bytes: Pillow raises many types (S-06)
        raise ThumbnailError(f"cannot decode image: {type(exc).__name__}") from exc
    bands = cast("tuple[tuple[int, int], ...]", image.getextrema())  # RGBA: (lowest, highest) per band
    if bands[3][1] == 0 or all(low == high for low, high in bands):
        raise NotALogo("icon of one colour")
    lossless = _encode(image, lossless=True)
    if len(lossless) <= LOGO_LOSSLESS_BYTES:
        return lossless
    for quality in LOGO_QUALITIES:
        if len(lossy := _encode(image, quality=quality)) <= MAX_BYTES:
            return lossy
    raise ThumbnailError("cannot fit the logo in the size limit")


def _icon_frame(source: Image.Image) -> Image.Image:
    """The frame a logo is made of: an ICO's largest, in its most colours (Pillow opens the largest, but in
    its fewest colours when one size comes in several depths), else the first frame (a JPEG decoded at a
    reduced scale that still covers LOGO_SIZE)."""
    if isinstance(source, IcoImagePlugin.IcoImageFile):
        entries = source.ico.entry
        best = max(range(len(entries)), key=lambda i: (entries[i].square, entries[i].color_depth))
        return source.ico.frame(best)
    source.seek(0)
    source.draft("RGB", (LOGO_SIZE, LOGO_SIZE))
    return source


def _encode(image: Image.Image, *, lossless: bool = False, quality: int = 100) -> bytes:
    out = io.BytesIO()
    image.save(out, "WEBP", lossless=lossless, quality=quality, method=6)
    return out.getvalue()


def store(webp: bytes) -> str:
    """Write the image (content addressed) and return its file name. The file is world-readable (0644, not
    mkstemp's 0600): in production nginx, another user than the app, sends it (X-Accel-Redirect)."""
    name = hashlib.sha256(webp).hexdigest()[:32] + ".webp"
    root = Path(settings.THUMBS_DIR)
    root.mkdir(parents=True, exist_ok=True)
    target = root / name
    if not target.exists():
        fd, tmp = tempfile.mkstemp(dir=root, suffix=".tmp")
        try:
            with os.fdopen(fd, "wb") as f:
                f.write(webp)
            os.chmod(tmp, 0o644)
            os.replace(tmp, target)
        except BaseException:
            Path(tmp).unlink(missing_ok=True)
            raise
    return name


def path_of(name: str) -> Path | None:
    """Existing image file for a stored name, or None (also for "" and anything that is not a stored name)."""
    if len(name) != 37 or not name.endswith(".webp") or not name[:32].isalnum():
        return None
    target = Path(settings.THUMBS_DIR) / name
    return target if target.is_file() else None


def in_use(name: str) -> bool:
    """Whether a row still names the file: an inbox thumbnail or an Item image, of any owner."""
    return (
        InboxEntry.objects.filter(og_image_path=name).exists()
        or Item.objects.filter(image_path=name).exists()
    )


def _lock(name: str) -> None:
    """A Postgres advisory lock on the file name until the transaction ends (the name is hex: its first 15
    digits fit a bigint)."""
    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_advisory_xact_lock(%s)", [int(name[:15], 16)])


def claim(name: str, webp: bytes) -> None:
    """Inside the transaction that saves a row naming `name` (the result of store(webp)): wait for a discard
    of the same file, then make sure the file is there. "" does nothing."""
    if not name:
        return
    _lock(name)
    if path_of(name) is None:
        store(webp)


def discard_if_unused(name: str) -> None:
    """Remove the file unless a row still names it ("" does nothing). Call it once the change that dropped the
    reference is committed (transaction.on_commit), so the check sees it. The check and the removal hold the
    file's lock, so a row being saved with the same file (claim) either is seen or finds the file gone and
    writes it again."""
    if not name or path_of(name) is None:
        return
    with transaction.atomic():
        _lock(name)
        if not in_use(name):
            _unlink(name)


def _unlink(name: str) -> None:
    if (target := path_of(name)) is not None:
        target.unlink(missing_ok=True)
