// English for the app frame: sidebar, top bar, search, lesson pages, handbooks and the roadmap. Vietnamese text (the
// key, exactly as in the code) -> English. See ../README.md.
import type { Dictionary } from '../translate';

export const shell = {
  // Sidebar (lib/app-nav.ts)
  'Hôm nay': 'Today',
  Tuần: 'Week',
  'còn {n} mục tiêu': { one: '{n} objective open', other: '{n} objectives open' },
  'Phát triển': 'Growth',
  'Sổ tay': 'Handbooks',
  'Lộ trình': 'Roadmap',
  'Kỹ năng': 'Skills',
  '{n} kỹ năng': { one: '{n} skill', other: '{n} skills' },
  'Thị trường': 'Market',
  '{n} tin tuyển dụng tháng này': { one: '{n} job ad this month', other: '{n} job ads this month' },
  'Nhật ký thành tựu': 'Achievement log',
  '{n} thành tựu tuần này': { one: '{n} achievement this week', other: '{n} achievements this week' },
  'Thư viện': 'Library',
  'nav::Item': 'Items',
  'nav::Ghi chú': 'Notes',
  '{n} ghi chú': { one: '{n} note', other: '{n} notes' },
  'nav::Cơ hội': 'Opportunities',
  '{n} cơ hội': { one: '{n} opportunity', other: '{n} opportunities' },
  'Công việc': 'Work',
  'nav::Dự án': 'Projects',
  'nav::Giờ': 'Time',
  'nav::Khác': 'More',
  'Giới thiệu': 'About',
  'Hướng dẫn': 'Guides',

  // Top bar and sidebar controls (components/app-shell.tsx, inbox-count.tsx)
  'đồng hồ đang chạy': 'timer running',
  'Ẩn menu': 'Hide menu',
  'Mở hoặc đóng menu': 'Open or close the menu',
  'Tìm mọi thứ': 'Search everything',
  // Below sm, beside the Inbox count and the EN/VI switch, shown whole or not at all (app-shell.tsx SearchButton):
  // a longer word hides it on more phones ("Search…": from about 345 px; 375, or 380 with 3 digits, beside a count)
  'Tìm…': 'Search…',
  'Tìm mọi thứ...': 'Search everything...',
  'Đổi giao diện': 'Change theme',
  'Đổi giao diện sáng/tối': 'Switch between light and dark',
  'Inbox, {count} mục chưa xử lý': 'Inbox, {count} to triage',
  'Điều hướng chính của trang.': 'Main navigation of the site.',

  // Lesson pages (app/[lang]/docs/)
  'Trang chủ': 'Home',
  '≈ {n} phút đọc': '≈ {n} min read',

  // Handbook cards, shelf and progress (components/book-card.tsx, book-actions.tsx, progress.tsx)
  '{provider} · {n} khóa': { one: '{provider} · {n} course', other: '{provider} · {n} courses' },
  'Liên kết khác của {title}': 'More links for {title}',
  'Khóa học gốc · {provider}': 'Original courses · {provider}',
  'tìm kiếm': 'search',
  'Bản gốc (HTML)': 'Original (HTML)',
  'Liên kết': 'Links',
  'Đã học xong': 'Done',
  'Đã lưu trên server': 'Saved on the server',
  'Đã lưu trên trình duyệt này': 'Saved in this browser',
  'Học ngay': 'Start',
  'Học tiếp': 'Continue',
  'Ôn lại': 'Revisit',
  'Tiến độ': 'Progress',
  '{done}/{total} bài · {pct}': '{done}/{total} lessons · {pct}',
  '{n} bài · chưa bắt đầu': { one: '{n} lesson · not started', other: '{n} lessons · not started' },
  'Xem gần nhất': 'Last viewed',
  'Tiếp tục học': 'Continue learning',
  'Gợi ý từ lộ trình': 'Suggested by the roadmap',
  'Mở đầu sổ tay': 'Handbook introduction',
  'Sổ tay khác đang học': 'Other handbooks in progress',
  '{n} sổ tay đang học': { one: '{n} handbook in progress', other: '{n} handbooks in progress' },
  '{n} đang học': '{n} in progress',
  '{n} sổ tay đã xong': { one: '{n} handbook done', other: '{n} handbooks done' },
  '{n} đã xong': '{n} done',
  '{n} sổ tay chưa bắt đầu': { one: '{n} handbook not started', other: '{n} handbooks not started' },
  '{n} chưa bắt đầu': '{n} not started',
  'Đã học {done}/{total} bài': '{done}/{total} lessons done',
  'Đang học': 'In progress',
  '{n} sổ tay': { one: '{n} handbook', other: '{n} handbooks' },
  'Gần nhất: {page}': 'Last viewed: {page}',

  // Handbooks page (app/[lang]/(home)/phat-trien/page.tsx)
  '{n} sổ tay với {lessons} bài học, chia theo nhóm.': {
    one: '{n} handbook with {lessons} lessons, in groups.',
    other: '{n} handbooks with {lessons} lessons, in groups.',
  },
  'Ghi chú khóa học của bạn, đọc theo từng bài và đánh dấu khi học xong.':
    'Your course notes, read lesson by lesson and ticked off when done.',
  'Xem lộ trình học': 'See the study roadmap',
  'Nhóm sổ tay': 'Handbook groups',
  '{books} sổ tay · {lessons} bài': '{books} handbooks · {lessons} lessons',
  "Alex's Brain là gì và được xây thế nào?": "What is Alex's Brain and how was it built?",
  'Giới thiệu và case study': 'About and case study',
  'Ghi chú dạng markdown và mọi dữ liệu khác dạng JSON, trong một tệp zip':
    'Notes as markdown and all other data as JSON, in one zip file',
  'Tải bản sao dữ liệu': 'Download a copy of my data',

  // Cmd+K search (components/search-dialog.tsx); a result's kind names one record
  'kind::Kỹ năng': 'Skill',
  'kind::Thành tựu': 'Achievement',
  'Tuyển dụng': 'Job ad',
  'Bản tin': 'Brief',
  'Mục #{id}': 'Entry #{id}',
  'chấm lại {date}': 'score on {date}',
  'ghi {date}': 'made {date}',
  'Chưa đăng nhập: chỉ tìm được trong sổ tay.': 'Not signed in: only the handbooks can be searched.',
  'Không tìm được trong bộ não thứ hai (máy chủ trả lỗi {status}).':
    'Could not search the second brain (the server returned error {status}).',
  'Tìm sổ tay, ghi chú, inbox…': 'Search handbooks, notes, inbox…',
  'Không tìm thấy kết quả': 'No results',
  'Bộ não thứ hai': 'Second brain',
  'Đi đến': 'Go to',

  // Guide frames (components/stageshow/lazy.tsx, guides/guide-frame.tsx): in the page bundle, not the guides chunk
  'thu thập và xử lý bằng phím': 'capture and triage by keyboard',
  'cài và dùng bookmarklet': 'install and use the bookmarklet',
  'lên kế hoạch và nhìn lại tuần': 'plan and review the week',
  'giả thuyết, bằng chứng và điểm': 'hypothesis, evidence and scores',
  'bấm giờ và tổng kết tuần': 'track time and sum up the week',
  'bằng chứng giữ kỹ năng còn mới': 'evidence keeps a skill fresh',
  'thêm item, xong thì viết ghi chú': 'add an item, write a note when done',
  'Hướng dẫn: {title}': 'Guide: {title}',
  'Xem lại': 'Replay',
  'Xem hướng dẫn': 'Show the guide',
  'Ẩn hướng dẫn': 'Hide the guide',

  // Placeholders in lesson content (lib/mdx/rehype-safe-html.ts)
  'Ảnh gốc không có bản offline.': 'The original picture has no offline copy.',
  'Xem ảnh trên Coursera': 'See the picture on Coursera',
  'Xem khóa học trên Coursera': 'See the course on Coursera',
  'Hình minh họa: {alt}': 'Illustration: {alt}',
  'Hình minh họa': 'Illustration',
  'Hình minh họa không có bản offline': 'Illustration with no offline copy',
  'Nội dung nhúng từ {host} (mở ở trang gốc)': 'Embedded content from {host} (open it on the original page)',
  'Nội dung nhúng (mở ở trang gốc)': 'Embedded content (open it on the original page)',

  // Home page server data (app/[lang]/(home)/page.tsx)
  'Tuần, inbox và sổ tay': 'Week, inbox and handbooks',
  '{phase} · tháng {from}–{to}': '{phase} · months {from}–{to}',
  'tháng {from}–{to}': 'months {from}–{to}',
  'Lộ trình IT · {months}': 'IT roadmap · {months}',
  'Bắt đầu từ đây': 'Start here',

  // Roadmap page (app/[lang]/lo-trinh/); its texts are the owner's data (content/roadmap.json), not in here
  'Lộ trình học': 'Study roadmap',
  'Thứ tự học gợi ý': 'Suggested order',
  'Mở bản PDF đầy đủ': 'Open the full PDF',
  'Tháng {from} đến {to}': 'Months {from} to {to}',
  'Song song': 'In parallel',
  'Sản phẩm kết giai đoạn: {outcome}': 'End-of-stage deliverable: {outcome}',

  // First-run blocks, before the first handbook and without a roadmap file (components/handbooks-start.tsx,
  // components/brain/content-empty.tsx)
  'Chưa có sổ tay nào': 'No handbooks yet',
  'Nhập sổ tay đầu tiên từ file zip GitBook hoặc một file HTML. Bài đang học và tiến độ sẽ hiện ở đây.':
    'Import your first handbook from a GitBook zip or a single HTML file. The lesson you are on and your progress will show here.',
  'Xem cách nhập sổ tay': 'See how to import a handbook',
  'Sổ tay được nhập bằng một lệnh, từ file zip GitBook hoặc một file HTML: <code>node web/scripts/import-gitbook.mjs</code>. Nhập xong, sổ tay hiện ở đây cùng tiến độ học.':
    'A handbook comes in with one command, from a GitBook zip or a single HTML file: <code>node web/scripts/import-gitbook.mjs</code>. Once imported, it shows here with its progress.',
  'Chưa có lộ trình': 'No roadmap yet',
  'Lộ trình là dữ liệu của bạn: một file <code>web/content/roadmap.json</code> với các giai đoạn, số tháng và những gì học trong từng giai đoạn. Tạo file theo mẫu trong README rồi tải lại trang.':
    'The roadmap is your own data: a file <code>web/content/roadmap.json</code> with the phases, their months and what to study in each. Create it from the sample in the README, then reload the page.',
  'Mở Sổ tay': 'Open Handbooks',

  // Handbook registry (lib/books.ts): the tracks, then the title and description of every imported handbook
  // (add both after an import: lib/i18n/coverage.test.ts asks for them)
  'Kinh doanh': 'Business',
  'Kinh doanh và vận hành doanh nghiệp.': 'Business and running a company.',
  IT: 'IT',
  'Kỹ thuật: lập trình, dữ liệu, hạ tầng.': 'Technical: programming, data, infrastructure.',
  'Cách học và kỹ năng làm việc.': 'Learning how to learn, and working skills.',
} satisfies Dictionary;
