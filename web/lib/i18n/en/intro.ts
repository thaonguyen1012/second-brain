// English for the intro pictures (components/stageshow/intro/pictures.tsx): their lazy chunk carries this dictionary
// (useT(intro)), so it holds only what the pictures show; the pages' own text is in about.ts. Words the real app
// shows (sidebar rows, badges, buttons) come from the page dictionary, so the pictures read like the English app.
// See ../README.md.
import type { Dictionary } from '../translate';

export const intro = {
  // Intro pictures: descriptions for screen readers and example data (components/stageshow/intro/pictures.tsx)
  "Màn hình Hôm nay của Alex's Brain: thanh bên chia theo nhóm như trong app, Hôm nay (đang mở) và Tuần ở trên, rồi các nhóm Phát triển, Thư viện, Cơ hội và Công việc với trang của từng nhóm, biểu tượng cùng một màu xanh và số đếm ở cuối dòng; thanh trên có ô Tìm mọi thứ với phím tắt Cmd K và nút Inbox có số đếm; nội dung gồm Tiếp tục học (Nhánh và merge trong Git), 3 ưu tiên tuần (Viết case study, Ôn lại React hooks, Gửi 2 báo giá) và Inbox.":
    "The Today screen of Alex's Brain: the sidebar in groups as in the app, Today (open) and Week at the top, then the groups Growth, Library, Opportunities and Work with each group's pages, the icons all in the same blue and counts at the end of the rows; the top bar has the Search everything box with the Cmd K shortcut and the Inbox button with a count; the content holds Continue learning (Branching and merging in Git), 3 priorities this week (Write a case study, Revise React hooks, Send 2 quotes) and the Inbox.",
  'Học tiếp, giữ 3 ưu tiên của tuần, dọn inbox và đọc bản tin sáng.':
    "Keep learning, stick to the week's 3 priorities, clear the inbox and read the morning brief.",
  'Nhánh và merge trong Git': 'Branching and merging in Git',
  'intro::Viết case study': 'Write a case study',
  'intro::Ôn lại React hooks': 'Revise React hooks',
  'intro::Gửi 2 báo giá': 'Send 2 quotes',
  // Shorter than the Today page's '3 priorities this week' (today.ts), which overflows its panel in a hero under 800 px
  'intro::3 ưu tiên tuần': '3 priorities',
  'Inbox xử lý bằng phím: hàng phím tắt J/K xuống lên, L đọc sau, A lưu trữ, O bằng chứng cho cơ hội. Nhấn L (CSS Grid: hướng dẫn đầy đủ) rồi A (Mẹo tập trung khi làm việc), hai mục rời danh sách; mục đã được gắn tag #postgres #tim-kiem và gợi ý Đọc sau lên đầu, đang được chọn.':
    'An Inbox triaged with keys: the shortcut row J/K down and up, L read later, A archive, O evidence for an opportunity. Press L (CSS Grid: a complete guide), then A (Tips for staying focused at work), and two entries leave the list; the entry tagged #postgres #search with the suggestion Read later rises to the top, selected.',
  'intro::CSS Grid: hướng dẫn đầy đủ': 'CSS Grid: a complete guide',
  'intro::Mẹo tập trung khi làm việc': 'Tips for staying focused at work',
  '#tim-kiem': '#search',
  // The key legend's wording in the inbox guide (guides.ts); the Inbox page's is too long for the tile on a phone
  'intro::bằng chứng cho cơ hội': 'opportunity evidence',
  'Hai phím Command và K: phím tắt mở ô tìm kiếm chung.':
    'The Command and K keys: the shortcut that opens the search across everything.',
  'Biểu đồ cột theo ngày từ thứ Hai tới Chủ nhật: phần giờ cho mục tiêu của tuần ở dưới, giờ khác ở trên.':
    "A column chart by day from Monday to Sunday: time for the week's objectives at the bottom, other time on top.",
  'Một cơ hội ví dụ, Đặt lịch online cho tiệm nail: bốn điểm tự chấm Cơ hội, Nỗi đau, Khả thi, Thời điểm, và hai bằng chứng: ủng hộ, nói chuyện với 3 tiệm nail; phản bác, đã có app đặt lịch miễn phí.':
    'An example opportunity, Online booking for nail salons: four self-scores Opportunity, Pain, Feasibility, Timing, and two pieces of evidence: for, talked to 3 nail salons; against, free booking apps already exist.',
  'Đặt lịch online cho tiệm nail': 'Online booking for nail salons',
  'Nói chuyện với 3 tiệm nail': 'Talked to 3 nail salons',
  'Đã có app đặt lịch miễn phí': 'Free booking apps exist',
  'Ma trận kỹ năng: Django còn mới, Docker đang cũ dần, Figma đã mờ. Kỹ năng không có bằng chứng mới thì nhạt màu dần.':
    'Skills matrix: Django fresh, Docker ageing, Figma faded. A skill without new evidence slowly fades.',
  'Một tin trong bản tin sáng, Trợ lý viết code chạy offline ra mắt, có tag Công cụ mới và #ai, với các nút Đưa vào Inbox, hữu ích hoặc không, và Bằng chứng cho cơ hội.':
    'A story in the morning brief, Offline coding assistant launches, tagged New tool and #ai, with the buttons Send to Inbox, useful or not, and Opportunity evidence.',
  'Trợ lý viết code chạy offline ra mắt': 'Offline coding assistant launches',
  'Tóm tắt hai câu, vì sao đáng quan tâm.': 'A two-sentence summary of why it matters.',
  'Bằng chứng cho cơ hội…': 'Opportunity evidence…',
} satisfies Dictionary;
