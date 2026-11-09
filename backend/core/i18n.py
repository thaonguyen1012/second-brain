"""The API's own messages in the language of the web UI (web/lib/i18n/README.md).

core.middleware.LanguageMiddleware activates the language of the page that asks (its X-UI-Lang header,
else the `lang` cookie; vi unless it says en), so Django's and DRF's own messages come in that language.
The app's messages are written in Vietnamese, the UI's first language, and keep that text as their key,
like the web app: tr("Không phải item của bạn.") is "Not your item." on an English page.
core/tests/test_i18n.py checks that every tr() text has its English and that EN keeps no unused entry.
"""

from django.utils.functional import lazy
from django.utils.translation import get_language

EN: dict[str, str] = {
    # Ownership and links between records
    "Không phải item của bạn.": "Not your item.",
    "Không phải dự án của bạn.": "Not your project.",
    "Không phải kỹ năng của bạn.": "Not your skill.",
    "Không phải mục tiêu của bạn.": "Not your objective.",
    "Không có trong dữ liệu của bạn.": "Not in your data.",
    "Không tìm thấy item.": "Item not found.",
    # Notes
    "Ghi chú vừa được lưu ở nơi khác.": "The note was just saved somewhere else.",
    # Evidence (growth, opportunities)
    "Bằng chứng loại {kind} không gắn {field}.": "Evidence of kind {kind} takes no {field}.",
    "Bằng chứng loại {kind} cần chọn mục được gắn.": "Evidence of kind {kind} needs the record it links.",
    "Bằng chứng dạng link cần tiêu đề và URL.": "Link evidence needs a title and a URL.",
    "Bằng chứng loại {kind} cần tiêu đề.": "Evidence of kind {kind} needs a title.",
    "Bằng chứng dạng link cần URL.": "Link evidence needs a URL.",
    "Mục inbox này đã là bằng chứng cho cơ hội này.": (
        "This inbox entry is already evidence for this opportunity."
    ),
    # Growth
    "Tháng có dạng YYYY-MM.": "A month is written YYYY-MM.",
    "Đã dùng cho kỹ năng khác: {name}.": "Already used by another skill: {name}.",
    "Ngày chấm lại không được trước ngày ghi.": "The scoring date cannot be before the date it was made.",
    # Weeks
    "Tuần bắt đầu vào thứ Hai.": "A week starts on a Monday.",
    "Không phải mục tiêu đang mở của tuần trước: {ids}": "Not an open objective of the previous week: {ids}",
    # Library: Item images and deletes
    "Không đọc được ảnh. Chỉ nhận JPEG, PNG, GIF hoặc WebP.": (
        "Cannot read the image. Only JPEG, PNG, GIF or WebP are accepted."
    ),
    "Item chưa có link http(s).": "The item has no http(s) link yet.",
    "Chọn một ảnh để tải lên.": "Choose an image to upload.",
    "Ảnh lớn hơn {mb} MB.": "The image is larger than {mb} MB.",
    "Dự án đã có giờ làm. Hãy xóa các mục giờ làm trước.": "The project has time entries. Delete them first.",
    # Work
    "Dự án tính theo giờ cần đơn giá mỗi giờ.": "An hourly project needs an hourly rate.",
    "Hãy dừng đồng hồ trước.": "Stop the timer first.",
    # Inbox
    "Cần một link hoặc một đoạn văn bản.": "A link or some text is needed.",
}


def tr(vi: str, **values: object) -> str:
    """`vi` in the active language, {placeholders} filled from `values`."""
    english = (get_language() or "vi").startswith("en")
    text = EN.get(vi, vi) if english else vi
    return text.format(**values) if values else text


# For module-level constants and DRF error_messages: translated when they are shown, not when imported.
tr_lazy = lazy(tr, str)
