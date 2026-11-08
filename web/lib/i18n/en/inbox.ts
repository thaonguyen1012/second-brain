// English for the inbox area: Vietnamese text (the key, exactly as in the code) -> English. See ../README.md.
import type { Dictionary } from '../translate';

export const inbox = {
  // Inbox and capture pages (app/[lang]/(home)/inbox/)
  'Chỗ duy nhất được phép bừa: thu thập một chạm, mỗi tuần xử lý bằng phím.':
    'The one place allowed to be messy: capture in one tap, triage with the keyboard every week.',
  'Cách thu thập': 'Ways to capture',
  'Thêm vào Inbox': 'Add to Inbox',
  'Xem lại link và ghi chú rồi lưu. Tag và tóm tắt được thêm sau, trong nền.':
    'Check the link and the note, then save. Tags and a summary are added later, in the background.',

  // Quick capture (components/brain/inbox-page.tsx), shared with the capture page
  'Link không hợp lệ (chỉ nhận http và https).': 'Invalid link (only http and https are accepted).',
  'Thu thập nhanh': 'Quick capture',
  'Dán một link hoặc ghi một ý tưởng…': 'Paste a link or jot down an idea…',
  'Lưu vào inbox': 'Save to inbox',
  'Đã lưu vào inbox': 'Saved to inbox',

  // Entry cards (components/brain/inbox-page.tsx)
  'Gợi ý tự động: {destination}': 'Auto suggestion: {destination}',
  'Ghi chú của item này': "This item's notes",
  'Đang xử lý': 'Processing',
  'Lỗi xử lý': 'Processing failed',
  'verb::Lưu trữ': 'Archive',
  'Về inbox': 'Back to inbox',
  'Thành item': 'Turn into item',

  // Keyboard legend (components/brain/inbox-page.tsx)
  'Phím tắt của Inbox': 'Inbox keyboard shortcuts',
  'đọc sau': 'read later',
  'lưu trữ': 'archive',
  'về inbox': 'back to inbox',
  'bằng chứng cho cơ hội': 'evidence for an opportunity',
  'thành item': 'turn into item',
  'ghi chú': 'note',
  'mở link': 'open link',
  'thu thập': 'capture',

  // Notices and empty states (components/brain/inbox-page.tsx)
  'Không thấy mục này trong {n} mục mới nhất của tab: bấm "Tải thêm" để xem tiếp.': {
    one: 'This entry is not among the newest {n} entry in this tab: press "Load more" to see more.',
    other: 'This entry is not among the newest {n} entries in this tab: press "Load more" to see more.',
  },
  'Không thấy mục này: có thể đã bị xóa hoặc đổi trạng thái.':
    'Entry not found: it may have been deleted or moved to another status.',
  'Chưa lưu được ảnh: {error}.': 'The picture was not saved: {error}.',
  'Đã thêm "{title}" vào thư viện và liên kết mục inbox.{picture} Nhấn A để lưu trữ mục.':
    'Added "{title}" to the library and linked the inbox entry.{picture} Press A to archive the entry.',
  'Đã thêm "{title}" nhưng chưa liên kết được: {reason}.{picture}':
    'Added "{title}" but could not link it: {reason}.{picture}',
  'Đã thêm làm bằng chứng cho "{title}", mục đã lưu trữ': 'Added as evidence for "{title}"; entry archived',
  'Đã có sẵn làm bằng chứng cho "{title}", mục đã lưu trữ': 'Already evidence for "{title}"; entry archived',
  'Chưa có mục nào trong Inbox': 'Nothing in the Inbox yet',
  'Dán một link hoặc ghi một ý tưởng vào ô ở trên; mỗi mục sẽ hiện ở đây thành một thẻ để xử lý bằng phím.':
    'Paste a link or jot down an idea in the box above; each entry shows up here as a card to triage with the keyboard.',
  'Không có mục nào ở “{status}”.': 'Nothing in “{status}”.',
  'Đã xử lý hết.': 'All triaged.',
  'Mục mới sẽ hiện ở đây.': 'New entries will show up here.',
  'Xóa mục inbox?': 'Delete this inbox entry?',
  '"{title}" bị xóa hẳn, kể cả ảnh thu nhỏ. Item và ghi chú đã tạo từ mục này vẫn giữ nguyên. Không hoàn tác được.':
    '"{title}" is deleted for good, thumbnail included. Items and notes made from this entry stay as they are. This cannot be undone.',
  'Từ inbox: {title}': 'From the inbox: {title}',
  'Đã tạo ghi chú "{title}". Nhấn A để lưu trữ mục inbox.': 'Created the note "{title}". Press A to archive the inbox entry.',

  // Capture page form (components/capture/capture-form.tsx)
  'Chỉ nhận link http hoặc https.': 'Only http or https links are accepted.',
  'Sửa link hoặc xóa trống để chỉ lưu ghi chú.': 'Fix the link, or clear it to save only the note.',
  'Ghi chú kèm theo': 'Accompanying note',
  'Tiêu đề, đoạn trích hoặc vì sao lưu…': "Title, excerpt or why I'm saving it…",
  'Quay lại trang trước': 'Back to the previous page',
  'Mở Inbox': 'Open Inbox',
  'Trình duyệt không cho trang này tự đóng. Hãy đóng tab bằng tay.':
    'The browser does not let this page close itself. Close the tab by hand.',

  // Bookmarklet help rail (components/capture/bookmarklet-help.tsx)
  'Sao chép mã bookmarklet': 'Copy the bookmarklet code',
  'Thu thập từ điện thoại': 'Capture from a phone',
  'Thu thập từ trình duyệt': 'Capture from the browser',
  'Kéo nút {button} lên thanh dấu trang, rồi bấm nó ở trang bất kỳ để gửi link (và đoạn đang chọn) vào inbox.':
    'Drag {button} to the bookmarks bar, then click it on any page to send its link (and the selected text) to the inbox.',
  'Kéo lên thanh dấu trang': 'Drag to the bookmarks bar',
  'Lưu vào Brain': 'Save to Brain',
  'Nút này không bấm ở đây: kéo nó lên thanh dấu trang ({key}+Shift+B để hiện thanh này), hoặc sao chép mã bên dưới.':
    'This button does nothing here: drag it to the bookmarks bar ({key}+Shift+B to show the bar), or copy the code below.',
  'Không kéo được?': "Can't drag it?",
  'Sao chép mã, rồi tạo một dấu trang mới và dán mã vào ô địa chỉ (URL) của nó.':
    'Copy the code, then create a new bookmark and paste the code into its address (URL) field.',
  "Trên Android: cài app (Thêm vào màn hình chính), rồi Chia sẻ → Alex's Brain. Trên iPhone, iPad: Safari chưa hỗ trợ chia sẻ thẳng vào app, hãy dùng bookmarklet.":
    "On Android: install the app (Add to Home screen), then Share → Alex's Brain. On iPhone and iPad, Safari cannot share straight into the app yet: use the bookmarklet.",
  "Gửi link từ app khác: cài app (Thêm vào màn hình chính), rồi Chia sẻ → Alex's Brain.":
    "Send links from other apps: install the app (Add to Home screen), then Share → Alex's Brain.",
  'Safari trên iPhone, iPad chưa hỗ trợ chia sẻ thẳng vào app. Dùng bookmarklet: sao chép mã, lưu một dấu trang bất kỳ, rồi sửa dấu trang đó và dán mã vào ô địa chỉ.':
    'Safari on iPhone and iPad cannot share straight into the app yet. Use the bookmarklet: copy the code, save any bookmark, then edit that bookmark and paste the code into its address field.',
  'Đã sao chép mã bookmarklet. Tạo dấu trang mới và dán mã vào ô địa chỉ (URL).':
    'Copied the bookmarklet code. Create a new bookmark and paste the code into its address (URL) field.',
  'Không sao chép được. Trên máy tính, hãy kéo nút Lưu vào Brain lên thanh dấu trang.':
    'Could not copy. On a computer, drag the Save to Brain button to the bookmarks bar.',
  'Xem hướng dẫn có hình': 'See the illustrated guide',
} satisfies Dictionary;
