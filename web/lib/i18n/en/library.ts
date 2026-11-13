// English for the library area: Vietnamese text (the key, exactly as in the code) -> English. See ../README.md.
import type { Dictionary } from '../translate';

export const library = {
  // Pages (app/[lang]/(home)/thu-vien/)
  'Sách, phim, khóa học, bài viết, dự án và công cụ.': 'Books, films, courses, articles, projects and tools.',
  'Ghi chú markdown; item xong cần có ghi chú.': 'Markdown notes; a done item needs a note.',

  // Items page (components/brain/library-page.tsx)
  'Mọi loại': 'All types',
  'Không tìm thấy item #{id}, có thể đã bị xóa.': 'Item #{id} not found; it may have been deleted.',
  'Đã thêm {n} khóa học từ Sổ tay': {
    one: 'Added {n} course from the handbooks',
    other: 'Added {n} courses from the handbooks',
  },
  'Đã thêm {n} khóa học từ Sổ tay ({active} {status})': {
    one: 'Added {n} course from the handbooks ({active} {status})',
    other: 'Added {n} courses from the handbooks ({active} {status})',
  },
  '{n} khóa đã có trong thư viện': {
    one: '{n} course was already in the library',
    other: '{n} courses were already in the library',
  },
  'dừng lại vì lỗi: {error}': 'stopped because of an error: {error}',
  'Chưa có item nào': 'No items yet',
  'Thêm sách, phim, khóa học, bài viết hoặc dự án; mục từ inbox cũng có thể thành item.':
    'Add books, films, courses, articles or projects; an inbox entry can become an item too.',
  'Đang thêm {sent}/{n} khóa học…': { one: 'Adding {sent}/{n} course…', other: 'Adding {sent}/{n} courses…' },
  'Thêm {n} khóa học từ Sổ tay': { one: 'Add {n} handbook course', other: 'Add {n} handbook courses' },
  'Đã thêm "{title}", nhưng chưa lưu được ảnh: {error}.': 'Added "{title}", but the image was not saved: {error}.',
  'Đã lưu "{title}", nhưng chưa lưu được ảnh: {error}.': 'Saved "{title}", but the image was not saved: {error}.',
  'Đầu ra cho: {title}': 'Output for: {title}',
  'Đã tạo ghi chú "{title}"': 'Created note "{title}"',

  // Item dialog (components/brain/item-dialog.tsx)
  'Sửa item': 'Edit item',
  'Điểm là số nguyên từ 1 đến 10, hoặc để trống.': 'The rating is a whole number from 1 to 10, or empty.',
  'Nguồn (tác giả, nền tảng, link)': 'Source (author, platform, link)',
  'Điểm 1–10': 'Rating 1–10',
  'Xóa item?': 'Delete this item?',
  '"{title}" bị xóa hẳn. Dự án còn giờ làm thì phải xóa các giờ đó trước. Ghi chú liên kết vẫn giữ, chỉ mất liên kết. Không hoàn tác được.':
    '"{title}" is deleted for good. A project with logged time needs that time deleted first. Linked notes stay; only the link goes. This cannot be undone.',
  '"{title}" bị xóa hẳn. Ghi chú liên kết vẫn giữ, chỉ mất liên kết; bằng chứng cho cơ hội giữ lại tiêu đề. Không hoàn tác được.':
    '"{title}" is deleted for good. Linked notes stay, only the link goes; evidence for an opportunity keeps the title. This cannot be undone.',
  'Thêm vào thư viện': 'Add to library',
  // the one-line summary (every type; a tool's says what it is for) and a tool's stages (lib/tools.ts)
  'Tóm tắt một dòng': 'One-line summary',
  'Dùng để làm gì': 'What it is for',
  'Tóm tắt': 'Summary',
  'Công đoạn': 'Stages',
  'Tag khác (cách nhau bằng dấu phẩy)': 'Other tags (separated by commas)',
  // a tool's tags field, as a refused save's summary names it
  'Tag khác': 'Other tags',
  'Sửa công cụ': 'Edit tool',

  // A done Item needs an output (components/brain/library/done-output.tsx); "rating" = an Item's 1-10 rating
  '## Highlights\n\n- \n\n## 3 ý chính\n\n1. \n2. \n3. \n': '## Highlights\n\n- \n\n## 3 key ideas\n\n1. \n2. \n3. \n',
  '## Nhận xét\n\n- ': '## Review\n\n- ',
  '## Học được gì\n\n- \n\n## Sẽ áp dụng vào đâu\n\n- \n': '## What I learned\n\n- \n\n## Where I will use it\n\n- \n',
  '## Ý chính\n\n- \n\n## Vì sao đáng nhớ\n\n': '## Key ideas\n\n- \n\n## Why it is worth remembering\n\n',
  '## Kết quả (kèm con số)\n\n- \n\n## Bài học rút ra\n\n- \n': '## Results (with numbers)\n\n- \n\n## Lessons learned\n\n- \n',
  '## Dùng vào việc gì\n\n- \n\n## Lệnh và cấu hình hay dùng\n\n- \n\n## Mẹo, giới hạn\n\n- \n':
    '## What I use it for\n\n- \n\n## Commands and settings I use\n\n- \n\n## Tips, limits\n\n- \n',
  'Ghi highlights và 3 ý chính.': 'Write down the highlights and 3 key ideas.',
  'Ghi một câu nhận xét.': 'Write a one-line review.',
  'Ghi lại những gì đã học được.': 'Write down what you learned.',
  'Ghi vài ý chính đáng nhớ.': 'Write down a few key ideas worth remembering.',
  'Ghi kết quả và bài học rút ra.': 'Write down the result and the lessons learned.',
  'Ghi cách mình dùng nó: lệnh, cấu hình, mẹo.': 'Write down how you use it: commands, settings, tips.',
  'Ghi một câu nhận xét và chấm điểm 1–10.': 'Write a one-line review and rate it 1–10.',
  'Ghi lại vài dòng về nó.': 'Write a few lines about it.',
  'Còn thiếu điểm 1–10.': 'The 1–10 rating is still missing.',
  'Chưa có ghi chú, chưa chấm điểm': 'No note yet, not rated yet',
  'Chưa có ghi chú': 'No note yet',
  'rating::Chưa chấm điểm': 'Not rated yet',
  'Xong rồi, nhưng chưa có đầu ra.': 'Done, but no output yet.',
  'rating::Chấm điểm': 'Rate',

  // Item pictures (components/brain/library/item-image-field.tsx, lib/item-picture.ts); also the project logo
  Logo: 'Logo',
  'Ảnh bìa': 'Cover image',
  'Logo hiện tại': 'Current logo',
  'Ảnh bìa hiện tại': 'Current cover image',
  'Tải ảnh lên': 'Upload image',
  'Đổi ảnh': 'Change image',
  'Lấy ảnh từ link': 'Fetch image from link',
  'Lấy logo từ trang': 'Fetch logo from site',
  'Bỏ ảnh': 'Remove image',
  'Đang đọc ảnh…': 'Reading the image…',
  'Ảnh sẽ được lấy từ link sau khi lưu; nó hiện sau vài phút.':
    'The image will be fetched from the link after saving; it shows up in a few minutes.',
  'Logo sẽ được lấy từ trang sau khi lưu; nó hiện sau vài phút.':
    'The logo will be fetched from the site after saving; it shows up in a few minutes.',
  'Ảnh mới được lưu khi bấm Lưu.': 'The new image is saved when you press Save.',
  'Ảnh được bỏ khi bấm Lưu.': 'The image is removed when you press Save.',
  'Đang lấy ảnh từ link; nó hiện sau vài phút.': 'Fetching the image from the link; it shows up in a few minutes.',
  'Đang lấy logo từ trang; nó hiện sau vài phút.': 'Fetching the logo from the site; it shows up in a few minutes.',
  'Khi lưu, ảnh sẽ được lấy từ link; nó hiện sau vài phút.':
    'On saving, the image will be fetched from the link; it shows up in a few minutes.',
  'Khi lưu, logo sẽ được lấy từ trang; nó hiện sau vài phút.':
    'On saving, the logo will be fetched from the site; it shows up in a few minutes.',
  'Trang không có logo dùng được; hãy tải logo lên.': 'The site has no usable logo; upload one.',
  'Link không có ảnh dùng được; hãy tải ảnh lên.': 'The link has no usable image; upload one.',
  'Chưa có ảnh.': 'No image yet.',
  'Chưa có logo.': 'No logo yet.',
  'Không đọc được ảnh này. Chỉ nhận JPEG, PNG, GIF hoặc WebP.':
    'Cannot read this image. Only JPEG, PNG, GIF or WebP are accepted.',
  'Chỉ nhận ảnh JPEG, PNG, GIF hoặc WebP.': 'Only JPEG, PNG, GIF or WebP images are accepted.',
  'Ảnh lớn hơn 10 MB.': 'The image is larger than 10 MB.',
  'ảnh lớn hơn giới hạn của máy chủ': 'the image is larger than the server allows',
  'mục này không còn nữa': 'this item no longer exists',
  'ảnh không hợp lệ': 'invalid image',

  // Item rows and board cards (components/brain/library/item-parts.tsx)
  'Mở ở Công việc': 'Open in Work',
  điểm: 'rating',
  '{n}<sr> ghi chú</sr>': { one: '{n}<sr> note</sr>', other: '{n}<sr> notes</sr>' },
  'Viết ghi chú cho “{title}”': 'Write a note for “{title}”',
  'Chấm điểm cho “{title}”': 'Rate “{title}”',

  // Linking a note to Items (components/brain/library/item-picker.tsx)
  'Item đã liên kết': 'Linked items',
  'Bỏ liên kết {title}': 'Unlink {title}',
  'Gõ tên sách, phim, khóa học…': 'Type the title of a book, film, course…',
  'Item khớp': 'Matching items',
  'Không có item nào khớp (hoặc đã liên kết hết).': 'No matching items (or they are all linked already).',

  // Note dialog (components/brain/library/note-dialog.tsx)
  'Ghi chú mới': 'New note',
  'Sửa ghi chú': 'Edit note',
  'Ghi chú cần có nội dung.': 'A note needs some content.',
  'Nội dung dài quá {max} ký tự.': 'The content is longer than {max} characters.',
  'Tiêu đề (không bắt buộc)': 'Title (optional)',
  'Để trống thì lấy dòng đầu của nội dung': 'Leave empty to use the first line',
  'Nội dung (markdown)': 'Content (markdown)',
  '# Ba ý chính\n\n- …': '# Three key ideas\n\n- …',
  'Ghi chú là riêng tư, không gửi cho AI. Viết bằng markdown: ## tiêu đề, - danh sách, - [ ] việc cần làm.':
    'Notes are private and never sent to AI. Write markdown: ## heading, - list, - [ ] to-do.',
  'Liên kết tới item': 'Link to items',
  'Tạo ghi chú': 'Create note',
  'Bỏ các thay đổi chưa lưu?': 'Discard unsaved changes?',
  'Nội dung vừa gõ trong ghi chú này sẽ mất.': 'What you just typed in this note will be lost.',
  'Tiếp tục sửa': 'Keep editing',
  'Bỏ thay đổi': 'Discard changes',

  // Notes page (components/brain/library/notes-page.tsx)
  'Ghi chú sách': 'Book note',
  'Nhận xét phim': 'Film review',
  'sửa {date}': 'edited {date}',
  'Chưa liên kết item': 'Not linked to an item',
  'Lọc ghi chú theo item này': 'Filter notes by this item',
  'đọc ghi chú': 'read the note',
  sửa: 'edit',
  'ghi chú mới': 'new note',
  tìm: 'search',
  'Phím tắt của Ghi chú': 'Keyboard shortcuts for Notes',
  'Tìm trong ghi chú': 'Search notes',
  'Tìm trong tiêu đề và nội dung…': 'Search titles and content…',
  'Item: {title}, bỏ lọc': 'Item: {title}, clear the filter',
  'Bỏ lọc theo item': 'Clear the item filter',
  'Không có ghi chú nào khớp bộ lọc.': 'No notes match the filters.',
  'Chưa có ghi chú nào': 'No notes yet',
  'Xóa ghi chú?': 'Delete this note?',
  '"{title}" bị xóa hẳn. Item liên kết vẫn giữ nguyên. Không hoàn tác được.':
    '"{title}" is deleted for good. Linked items stay as they are. This cannot be undone.',

  // The Item page (components/brain/library/item-detail.tsx, item-notes.tsx, item-mentions.tsx; DECISIONS 9.8)
  'Đã chuyển sang {status}': 'Moved to {status}',
  'rating::Điểm': 'Rating',
  'Nguồn': 'Source',
  'Tag': 'Tags',
  'Mở trang đầy đủ': 'Open full page',
  'Đã lưu, nhưng chưa lưu được ảnh: {error}.': 'Saved, but the picture was not saved: {error}.',
  'Được nhắc tới ở': 'Mentioned in',
  'Chưa có cơ hội, kỹ năng hay ghi chú nào nhắc tới item này.':
    'No opportunity, skill or note mentions this item yet.',
  'Chưa có ghi chú nào nhắc tới ghi chú này.': 'No note mentions this note yet.',
  '{freshness} · bằng chứng {dates}': '{freshness} · evidence {dates}',
  'Tiêu đề ghi chú (không bắt buộc)': 'Note title (optional)',
  'Nội dung ghi chú': 'Note text',
  'Đang tải ghi chú': 'Loading notes',
  'Chưa có ghi chú nào.': 'No notes yet.',
  'Ghi chú của item': "The item's notes",
  ' · cũng gắn với {items}': ' · also linked to {items}',
  // the name of a note whose title only repeats its Item's, in the controls above: the title, then its date line
  '{title}, {date}': '{title}, {date}',
  'Sửa ghi chú “{title}”': 'Edit the note “{title}”',
  'Thao tác cho ghi chú “{title}”': 'Actions for the note “{title}”',
  'Xong ghi chú “{title}”': 'Done editing “{title}”',
  // the other buttons an open editor repeats, named after its note (item-notes.tsx, save-status.tsx)
  'Khôi phục “{title}”': 'Restore “{title}”',
  'Bỏ bản nháp “{title}”': 'Discard draft: “{title}”',
  'Thử lại: lưu “{title}”': 'Try again: save “{title}”',
  'Xóa ghi chú “{title}”': 'Delete note “{title}”',
  'Mở để khôi phục “{title}”': 'Open to restore “{title}”',
  'Mở để xem “{title}”': 'Open to review “{title}”',
  'Mở ở trang Ghi chú': 'Open on the Notes page',
  '"{title}" bị xóa hẳn, cả ở các item khác nó gắn với. Không hoàn tác được.':
    '"{title}" is deleted for good, also from the other items it is linked to. This cannot be undone.',
  'Đã xóa ghi chú "{title}"': 'Deleted the note "{title}"',
  'Không tìm thấy item này': 'This item was not found',
  'Có thể item đã bị xóa hoặc link đã cũ. Quay lại Thư viện để chọn item khác.':
    'It may have been deleted, or the link is old. Go back to the Library to pick another item.',
  'Đã xong: ': 'Done: ',
  'Chưa xong: ': 'To do: ',
  'Ảnh: {alt}': 'Picture: {alt}',
  'Ảnh': 'Picture',
  // Writing a note (note-editor.tsx, use-note-autosave.ts, save-status.tsx) and the note page (note-page.tsx)
  'Gõ / để chèn khối, hoặc viết luôn': 'Type / to insert a block, or just write',
  'Đang mở trình soạn thảo': 'Opening the editor',
  'Chưa lưu được: {reason}': 'Not saved: {reason}',
  'Có bản nháp chưa lưu trong trình duyệt này': 'There is an unsaved draft in this browser',
  'Viết lúc {date}. Khôi phục sẽ thay nội dung đang có.': 'Written {date}. Restoring replaces the current text.',
  'Khôi phục': 'Restore',
  'Mở để khôi phục': 'Open to restore',
  '{items} vẫn gắn với ghi chú vì nội dung có liên kết tới nó; bỏ liên kết trong nội dung trước.':
    '{items} stays linked because the note’s text links to it; remove that link from the text first.',
  'Bỏ bản nháp': 'Discard draft',
  'Không có tiêu đề': 'Untitled',
  'Chưa lưu được liên kết: {reason}': 'The links were not saved: {reason}',
  'Không tìm thấy ghi chú này': 'This note was not found',
  'Có thể ghi chú đã bị xóa hoặc link đã cũ.': 'It may have been deleted, or the link is old.',
  // Why a save failed (use-note-autosave.ts)
  'Máy chủ không nhận nội dung này.': 'The server did not accept this content.',
  'Ghi chú không còn trên máy chủ.': 'The note is no longer on the server.',
  'Máy chủ trả lỗi {status}.': 'The server answered with error {status}.',
  'Máy chủ không trả lời.': 'The server did not answer.',
  // A note saved elsewhere while it was being written here (item-notes.tsx, note-page.tsx)
  'Ghi chú vừa được lưu ở nơi khác': 'The note was just saved somewhere else',
  'Đang hiện bản đó. Chữ gõ ở đây chưa lưu được giữ làm bản nháp (lúc {date}): Khôi phục sẽ thay nội dung đang có.':
    'That version is shown now. What you typed here and was not saved is kept as a draft ({date}): restoring replaces the current text.',
  'Ghi chú vừa được lưu ở nơi khác: đang hiện bản đó.': 'The note was just saved somewhere else: that version is shown now.',
  // A copy written over a version the note was saved after since, perhaps by its own save (use-note-autosave.ts)
  'Có bản nháp viết trên bản cũ hơn của ghi chú': 'There is a draft written on an older version of this note',
  'Ghi chú đã được lưu lại sau khi bản nháp này được viết (lúc {date}), ở đây hay ở nơi khác. Khôi phục sẽ thay bản mới hơn đang hiện.':
    'The note was saved again after this draft was written ({date}), here or somewhere else. Restoring replaces the newer version shown.',
  'Mở để xem': 'Open to review',
  'Xóa ghi chú': 'Delete note',
  // The editor's "/" menu, "[[" picker and task boxes (note-editor.tsx)
  'Văn bản': 'Text',
  'Tiêu đề 1': 'Heading 1',
  'Tiêu đề 2': 'Heading 2',
  'Tiêu đề 3': 'Heading 3',
  'Danh sách số': 'Numbered list',
  'Việc cần làm': 'To-do',
  'Trích dẫn': 'Quote',
  'Khối mã': 'Code block',
  'Đường kẻ': 'Divider',
  'Chèn khối': 'Insert a block',
  'Liên kết tới': 'Link to',
  'Chưa tìm được, thử lại sau.': 'The search failed; try again later.',
  'Không tìm thấy “{query}”': 'Nothing found for “{query}”',
  'Gõ để tìm item, ghi chú, cơ hội, kỹ năng': 'Type to find items, notes, opportunities, skills',
  'Đã xong': 'Done',
  'Đã xong: {task}': 'Done: {task}',
  // The notes page's "Theo item" view (notes-page.tsx)
  'Theo item': 'By item',
  'Ghi chú rời': 'Loose notes',
} satisfies Dictionary;
