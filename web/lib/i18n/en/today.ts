// English for the today area: Vietnamese text (the key, exactly as in the code) -> English. See ../README.md.
import type { Dictionary } from '../translate';

export const today = {
  // Rail tiles: objectives, inbox (components/brain/today-main.tsx)
  '3 ưu tiên tuần': '3 priorities this week',
  'Cuối tuần: nhìn lại 15 phút.': 'End of the week: a 15-minute review.',
  'Chọn ưu tiên tuần tới': "Choose next week's priorities",
  'Chọn 3 ưu tiên': 'Choose 3 priorities',
  'Xử lý': 'Triage',
  'Chưa đọc được inbox': 'Could not load the inbox',
  'Inbox trống.': 'The Inbox is empty.',
  'Ghi nhanh': 'Quick note',
  '+ {n} mục nữa': '+ {n} more',

  // Today's brief (components/brain/today-main.tsx)
  'Bản tin hôm nay': "Today's brief",
  '{n} tin': { one: '{n} story', other: '{n} stories' },
  '{n} công cụ mới': { one: '{n} new tool', other: '{n} new tools' },
  'Bản tin chưa chạy lần nào. Tác vụ nền (make jobs) lấy tin lúc 6:30.':
    'The brief has never run. The background jobs (make jobs) fetch the news at 06:30.',
  'Chưa có bản tin hôm nay (bản gần nhất {date}).': 'No brief today yet (the latest is from {date}).',
  'Chưa có bản tin hôm nay.': 'No brief today yet.',
  'Công cụ mới': 'New tool',
  'Tóm tắt tự động: {summary}': 'Auto summary: {summary}',

  // Brief card actions (components/brain/brief-actions.tsx)
  'Đã vào Inbox: {title}': 'Sent to Inbox: {title}',
  'Đưa vào Inbox: {title}': 'Send to Inbox: {title}',
  'Đã vào Inbox': 'Sent to Inbox',
  'Đưa vào Inbox': 'Send to Inbox',
  'Hữu ích': 'Useful',
  'Không hữu ích': 'Not useful',
  'Hữu ích: {title}': 'Useful: {title}',
  'Không hữu ích: {title}': 'Not useful: {title}',
  'Tin "{title}" có hữu ích không?': 'Is the story "{title}" useful?',
  '{label} (bấm lần nữa để bỏ)': '{label} (press again to clear)',

  // Week rhythm and handbooks tiles (components/brain/today-learning.tsx)
  'chỉ có việc khác': 'other work only',
  'có bài học': 'lesson done',
  'còn {n} ngày': { one: '{n} day left', other: '{n} days left' },
  'Chưa đọc được tuần này': 'Could not load this week',
  'ngày học': 'study days',
  'Nhắm tới {n} ngày có bài học mỗi tuần': {
    one: 'Aim for {n} day with a lesson each week',
    other: 'Aim for {n} days with a lesson each week',
  },
  '<b>{done} / {total}</b> bài · {started} đang học': '<b>{done} / {total}</b> lessons · {started} in progress',

  // Setup checklist (components/brain/today-learning.tsx)
  'Thiết lập bộ não thứ hai': 'Set up the second brain',
  'Tiến độ thiết lập': 'Setup progress',
  'Tùy chọn thiết lập': 'Setup options',
  Ẩn: 'Hide',
  'Thêm khóa học vào Thư viện': 'Add a course to the Library',
  'Khóa học, sách hay bài viết đang theo: mỗi thứ là một item.':
    'Courses, books or articles in progress: each one is an item.',
  'Mở Thư viện': 'Open Library',
  'Chọn 3 ưu tiên tuần này': "Choose this week's 3 priorities",
  'Chọn 3 ưu tiên tuần tới': "Choose next week's 3 priorities",
  'Ba kết quả muốn có trong tuần, nhìn lại vào cuối tuần.': 'Three results to aim for in the week, reviewed at the end of it.',
  'Chọn ưu tiên': 'Choose priorities',
  'Viết ghi chú đầu tiên': 'Write the first note',
  'Kỹ năng được giữ mới bằng bằng chứng: item, ghi chú, link.': 'Skills stay fresh through evidence: items, notes, links.',
  'Mở Kỹ năng': 'Open Skills',
  'Tạo dự án để bấm giờ': 'Create a project to track time',
  'Mở Dự án': 'Open Projects',

  // Roadmap's next steps (components/brain/today-learning.tsx)
  'Tiếp theo trong lộ trình': 'Next on the roadmap',
  'Chưa có sổ tay': 'No handbook yet',

  // Predictions due and the background status line (components/brain/today-extras.tsx)
  'Dự đoán cần chấm lại': 'Predictions due',
  'Chưa đọc được dự đoán': 'Could not load the predictions',
  'lấy thẻ link': 'fetch link cards',
  'gắn tag inbox': 'tag the inbox',
  'tải nguồn tin': 'load news feeds',
  'dựng bản tin': 'build the brief',
  'gắn tag tin': 'tag news',
  'lời mở bản tin': 'brief intro',
  'đọc tin tuyển dụng': 'read job ads',
  'LLM tháng này {cost} / {budget}': 'LLM this month {cost} / {budget}',
  'Gói miễn phí, tính theo giá trả phí': 'Free tier, priced at the paid rate',
  '{n} lần gọi': { one: '{n} call', other: '{n} calls' },
  '{n} lần gọi, {failed} lỗi': { one: '{n} call, {failed} failed', other: '{n} calls, {failed} failed' },
  'Bản tin gần nhất {date}': 'Latest brief {date}',
  'Chưa có bản tin nào': 'No brief yet',
  '{n} tác vụ đang chờ': { one: '{n} job waiting', other: '{n} jobs waiting' },
  'Không có tác vụ chờ': 'No jobs waiting',
  '{n} tác vụ lỗi': { one: '{n} failed job', other: '{n} failed jobs' },
  'AI và tác vụ nền': 'AI and background jobs',

  // Moving old progress to the server (components/progress-migration-banner.tsx)
  'Đã chuyển tiến độ học lên server': 'Study progress moved to the server',
  '{n} bài đã lên server.': { one: '{n} lesson is now on the server.', other: '{n} lessons are now on the server.' },
  '{n} bài thuộc sổ tay không còn trên server nên được bỏ qua.': {
    one: '{n} lesson from a handbook no longer on the server was skipped.',
    other: '{n} lessons from handbooks no longer on the server were skipped.',
  },
  'Bản trên trình duyệt này vẫn được giữ.': 'The copy in this browser is kept.',
  'Chuyển tiến độ học cũ lên server': 'Move old study progress to the server',
  'Trình duyệt này còn {n} bài đã đánh dấu "Đã học xong" từ trước khi có server. Chuyển lên để mọi thiết bị đều thấy. Bản trên trình duyệt vẫn được giữ; trong tổng kết tuần, các bài này được tính là học xong hôm nay.':
    {
      one: 'This browser still has {n} lesson marked "Done" from before there was a server. Move it to the server so every device sees it. The copy in the browser is kept; in the week review, this lesson counts as done today.',
      other:
        'This browser still has {n} lessons marked "Done" from before there was a server. Move them to the server so every device sees them. The copy in the browser is kept; in the week review, these lessons count as done today.',
    },
  'Đang chuyển {handled}/{n} bài…': { one: 'Moving {handled}/{n} lesson…', other: 'Moving {handled}/{n} lessons…' },
  'Các bài đã chuyển được giữ trên server; bấm lại để chuyển phần còn lại.':
    'The lessons already moved stay on the server; press again to move the rest.',
  'Chuyển lên server': 'Move to the server',
  'Bỏ qua, không hỏi lại': "Skip, don't ask again",
  'Bỏ qua': 'Skip',
} satisfies Dictionary;
