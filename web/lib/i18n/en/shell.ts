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
  '{books} sổ tay từ các khóa Coursera và F8, {lessons} bài học, chia theo ba nhóm.':
    '{books} handbooks from Coursera and F8 courses, {lessons} lessons, in three groups.',
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

  // Roadmap page (app/[lang]/lo-trinh/)

  // Handbook registry (lib/books.ts): titles, descriptions, tracks
  'Kinh doanh': 'Business',
  'Vận hành doanh nghiệp: nền tảng, tiếng Anh, dữ liệu, marketing, kế toán.':
    'Running a business: foundations, English, data, marketing, accounting.',
  IT: 'IT',
  'Đi sâu kỹ thuật: AI, an ninh mạng, dữ liệu, DevOps, web.': 'Going deep on tech: AI, cybersecurity, data, DevOps, web.',
  'Học cách học và quản lý dự án.': 'Learning how to learn, and project management.',
  'Sổ tay 1 – Nền tảng kinh doanh': 'Handbook 1 – Business foundations',
  'Marketing, kế toán, tài chính, vận hành, khởi nghiệp, chiến lược và Excel: 19 khóa của Wharton, Darden và Macquarie.':
    'Marketing, accounting, finance, operations, entrepreneurship, strategy and Excel: 19 courses from Wharton, Darden and Macquarie.',
  'Sổ tay 2 – Tiếng Anh thương mại': 'Handbook 2 – Business English',
  'Tiếng Anh giao tiếp công việc: networking, họp, đàm phán, thuyết trình, viết email và tiếng Anh chuyên ngành.':
    'English for work: networking, meetings, negotiation, presentations, emails and English for your field.',
  'Sổ tay 3 – Phân tích dữ liệu': 'Handbook 3 – Data analysis',
  'Phân tích dữ liệu từ Google, IBM và Microsoft: bảng tính, SQL, Python, Power BI, thống kê và machine learning.':
    'Data analysis from Google, IBM and Microsoft: spreadsheets, SQL, Python, Power BI, statistics and machine learning.',
  'Sổ tay 4 – Marketing & bán hàng': 'Handbook 4 – Marketing & sales',
  'Digital marketing, thương mại điện tử, mạng xã hội, marketing analytics và bán hàng với CRM.':
    'Digital marketing, e-commerce, social media, marketing analytics and selling with a CRM.',
  'Sổ tay 5 – Kế toán & tài chính': 'Handbook 5 – Accounting & finance',
  'Kế toán sổ sách, báo cáo tài chính, tài chính doanh nghiệp và kế toán quản trị.':
    'Bookkeeping, financial statements, corporate finance and management accounting.',
  'Sổ tay AI Engineering': 'AI Engineering handbook',
  'Machine learning, deep learning, generative AI, RAG và agent, đưa mô hình vào production.':
    'Machine learning, deep learning, generative AI, RAG and agents, taking models to production.',
  'Sổ tay AI & tự động hóa': 'AI & automation handbook',
  'AI cho mọi người và cho doanh nghiệp, prompting, agent, tự động hóa với Python, Git và Power Automate.':
    'AI for everyone and for business, prompting, agents, automation with Python, Git and Power Automate.',
  'Sổ tay An ninh mạng': 'Cybersecurity handbook',
  'An ninh mạng từ nền tảng tới chuyên sâu: Google, IBM và Microsoft Cybersecurity Analyst.':
    'Cybersecurity from the basics to an advanced level: Google, IBM and Microsoft Cybersecurity Analyst.',
  'Sổ tay Data Engineering & Robotics': 'Data Engineering & Robotics handbook',
  'Data engineering trên AWS và Google Cloud, cùng robotics và xe tự lái.':
    'Data engineering on AWS and Google Cloud, plus robotics and self-driving cars.',
  'Sổ tay DevOps, Cloud & IT': 'DevOps, Cloud & IT handbook',
  'DevOps và kỹ nghệ phần mềm, cloud (Google Cloud, AWS) và IT support.':
    'DevOps and software engineering, cloud (Google Cloud, AWS) and IT support.',
  'Sổ tay Fullstack Web (F8)': 'Fullstack Web handbook (F8)',
  'Lộ trình Fullstack Web của F8: HTML, CSS, JavaScript và các bài thực hành.':
    "F8's Fullstack Web path: HTML, CSS, JavaScript and hands-on exercises.",
  'Sổ tay Meta Front-End': 'Meta Front-End handbook',
  'Front-end với HTML, CSS, JavaScript, React và UX/UI theo chương trình của Meta.':
    "Front-end with HTML, CSS, JavaScript, React and UX/UI, following Meta's programme.",
  'Sổ tay Meta Full-Stack': 'Meta Full-Stack handbook',
  'Front-end và back-end theo Meta: React, Python, Django, API và cơ sở dữ liệu.':
    'Front-end and back-end the Meta way: React, Python, Django, APIs and databases.',
  'Sổ tay Learning How to Learn': 'Learning How to Learn handbook',
  'Kỹ thuật học hiệu quả: tập trung và phân tán, chunking, chống trì hoãn, ghi nhớ.':
    'Techniques for learning well: focused and diffuse modes, chunking, beating procrastination, memory.',
  'Sổ tay Google Project Management': 'Google Project Management handbook',
  'Quản lý dự án theo Google: khởi tạo, lập kế hoạch, thực thi, Agile và Scrum.':
    'Project management the Google way: initiation, planning, execution, Agile and Scrum.',
} satisfies Dictionary;
