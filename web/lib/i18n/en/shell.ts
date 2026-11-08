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
  'Tìm…': 'Search…',
  'Tìm mọi thứ...': 'Search everything...',
  'Đổi giao diện': 'Change theme',
  'Đổi giao diện sáng/tối': 'Switch between light and dark',
  'Inbox, {count} mục chưa xử lý': 'Inbox, {count} to triage',
  'Điều hướng chính của trang.': 'Main navigation of the site.',

  // Lesson pages (app/[lang]/docs/)
  'Trang chủ': 'Home',
  '≈ {n} phút đọc': '≈ {n} min read',
} satisfies Dictionary;
