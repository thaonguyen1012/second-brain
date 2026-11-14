// English for the work area: Vietnamese text (the key, exactly as in the code) -> English. See ../README.md.
import type { Dictionary } from '../translate';

export const work = {
  // Billing and compact hours (work/format.ts)
  'Theo giờ': 'Hourly',
  'Trọn gói': 'Fixed price',
  '{h} giờ {mm}': '{h}:{mm} h',

  // Page headers (app/[lang]/(home)/cong-viec/)
  'Bấm giờ hoặc nhập tay giờ đã làm cho từng dự án.':
    'Start the timer or enter the hours worked by hand, for each project.',

  // A project's price and meta line (work/project-meta.ts, project-card.tsx)
  '{money}/giờ': '{money}/h',
  '{money} trọn gói': '{money} fixed price',
  'chưa có giá': 'no price yet',
  'Chưa ghi khách': 'No client yet',
  'thực tế {money}/giờ': 'effective {money}/h',
  'Đang bấm giờ.': 'Timer running.',
  'Xem giờ': 'See time entries',

  // Billable bars (work/billable-bar.tsx, week-summary.tsx)
  '{label}: {total}, {billable} tính tiền, {nonBillable} không tính tiền':
    '{label}: {total}, {billable} billable, {nonBillable} not billable',
  'Tính tiền: {time}': 'Billable: {time}',
  'Không tính tiền: {time}': 'Not billable: {time}',
  '{time} tính tiền': '{time} billable',
  '{time} không tính tiền': '{time} not billable',
  '{billable} tính tiền, {nonBillable} không tính tiền': '{billable} billable, {nonBillable} not billable',

  // Week summary (work/week-summary.tsx)
  '0 giờ': '0 h',
  'Tuần {range}': 'Week {range}',
  'Đang tải tổng kết tuần': 'Loading the week summary',
  'tổng trong tuần': 'in total for the week',
  'Chưa có giờ nào trong tuần này.': 'No time logged in this week yet.',
  'Theo dự án': 'By project',
  'Xem mục giờ của {title} trong tuần này': 'See entries for {title} in this week',
  'Xem mục giờ của {title} trong tuần {range}': 'See entries for {title} in the week of {range}',
  'Xem mục': 'See entries',

  // Project dialog (work/project-dialog.tsx)
  'Cần có tên dự án.': 'The project needs a name.',
  'Giá là số không âm, tối đa 2 chữ số thập phân (ví dụ 800 hoặc 1200,50).':
    'The hourly rate or fixed price must be 0 or more, with at most 2 decimal places (for example 800 or 1200.50).',
  'Dự án theo giờ cần giá giờ.': 'An hourly project needs an hourly rate.',
  'Tiền tệ là mã 3 chữ cái, ví dụ CZK, EUR.': 'The currency is a 3-letter code, for example CZK or EUR.',
  'Tên dự án': 'Project name',
  'Đã kiếm = giờ tính tiền × giá giờ.': 'Earned = billable hours × hourly rate.',
  'Đã kiếm = giá trọn gói. Giá giờ thực tế = giá chia cho mọi giờ đã làm, kể cả giờ không tính tiền.':
    'Earned = the fixed price. Effective hourly rate = the price divided by all hours worked, including non-billable hours.',
  'Nguồn (kênh tìm được khách, link)': 'Source (where the client came from, a link)',
  'Sửa dự án': 'Edit project',
  'Khách, cách tính tiền và giá. Không làm hóa đơn.': 'Client, billing and price. No invoices.',

  // Projects page, list and notices (work/projects-page.tsx)
  '(đang bấm giờ)': '(timer running)',
  'Bấm giờ cho {title}': 'Start the timer for {title}',
  'column::Giờ': 'Hours',
  'Giá giờ thực tế': 'Effective hourly rate',
  'Số tiền chia cho mọi giờ đã làm, kể cả giờ không tính tiền.':
    'The amount divided by all hours worked, including non-billable hours.',
  'Đã kiếm': 'Earned',
  'Đã dừng giờ của "{stopped}" và bắt đầu bấm giờ cho "{title}", chưa gắn mục tiêu tuần':
    'Stopped the timer for "{stopped}" and started timing "{title}", not linked to a week objective',
  'Bắt đầu bấm giờ cho "{title}", chưa gắn mục tiêu tuần': 'Started timing "{title}", not linked to a week objective',
  'Chưa có dự án nào': 'No projects yet',
  'Thêm dự án freelance với khách và giá; giờ làm sẽ cho ra giá giờ thực tế.':
    'Add a freelance project with its client and price; the hours worked then give the effective hourly rate.',
  'Đã thêm "{title}", nhưng chưa lưu được logo: {error}.': 'Added "{title}", but the logo was not saved: {error}.',
  'Đã lưu "{title}", nhưng chưa lưu được logo: {error}.': 'Saved "{title}", but the logo was not saved: {error}.',

  // Time entry dialog (work/time-entry-dialog.tsx)
  'Không gắn mục tiêu': 'No objective',
  'Mục tiêu của tuần khác (giữ nguyên)': "Another week's objective (kept)",
  'Chọn một dự án.': 'Choose a project.',
  'Chọn ngày.': 'Choose a date.',
  'Thời gian từ 1 phút đến 24 giờ, ví dụ 90, 1:30, 1h30 hoặc 1,5h.':
    'The duration must be between 1 minute and 24 hours, for example 90, 1:30, 1h30 or 1.5h.',
  'Thời gian': 'Duration',
  'Đang chạy': 'Running',
  'Dừng bộ bấm giờ trước khi sửa thời gian.': 'Stop the timer before changing the duration.',
  'Phút (90), giờ:phút (1:30), 1h30 hoặc 1,5h.': 'Minutes (90), hours:minutes (1:30), 1h30 or 1.5h.',
  'Mục tiêu tuần này (không bắt buộc)': "This week's objective (optional)",
  'Mục tiêu tuần này': "This week's objective",
  'Tính tiền cho khách': 'Billable to the client',
  'Thêm giờ': 'Add time',
  'Sửa giờ': 'Edit time',
  'Nhập giờ': 'Enter time',
  'Chưa có dự án. Thêm một dự án ở trang Dự án trước.': 'No projects yet. Add a project on the Projects page first.',

  // Time page: entries, filters and notices (work/time-page.tsx)
  'Mục tiêu: {title}': 'Objective: {title}',
  'mục tiêu tuần': 'week objective',
  // an entry's Sửa / Xóa: the project, the day and the duration (or that it runs), as the row shows them
  'Sửa giờ của {title} ngày {day} ({time})': 'Edit time for {title} on {day} ({time})',
  'Sửa giờ của {title} ngày {day} (đang chạy)': 'Edit time for {title} on {day} (running)',
  'Xóa mục giờ này?': 'Delete this time entry?',
  'Bộ bấm giờ của "{title}" đang chạy sẽ bị hủy, không ghi phút nào.':
    'The running timer for "{title}" will be cancelled without logging any minutes.',
  '{time} cho "{title}" ngày {day}. Không hoàn tác được.': '{time} for "{title}" on {day}. This cannot be undone.',
  'Xóa giờ của {title} ngày {day} ({time})': 'Delete time for {title} on {day} ({time})',
  'Xóa giờ của {title} ngày {day} (đang chạy)': 'Delete time for {title} on {day} (running)',
  'Mọi dự án': 'All projects',
  'Dự án #{id}': 'Project #{id}',
  'Đã xóa mục giờ của "{title}"': 'Deleted the time entry for "{title}"',
  'Đang tải bộ bấm giờ': 'Loading the timer',
  'Không có dự án đang mở': 'No open projects',
  'Các mục giờ': 'Time entries',
  'Chưa có giờ nào. Bấm giờ ở trên, hoặc nhập tay giờ đã làm.':
    'No time yet. Start the timer above, or enter the hours worked by hand.',
  'Lọc theo dự án': 'Filter by project',
  'Từ ngày': 'From date',
  'Đến ngày': 'To date',
  '"Từ ngày" phải trước hoặc bằng "Đến ngày".': '"From date" must be on or before "To date".',
  'Đã thêm "{title}".': 'Added "{title}".',
  'Chưa lưu được logo: {error}.': 'The logo was not saved: {error}.',
  'Bấm Bắt đầu để bấm giờ.': 'Press Start to start the timer.',
  'Đã thêm {time} cho "{title}"': 'Added {time} for "{title}"',
  'Đã lưu mục giờ của "{title}"': 'Saved the time entry for "{title}"',

  // Timer (work/timer-panel.tsx)
  'Bắt đầu bấm giờ cho "{title}"': 'Started timing "{title}"',
  // the start button's name: what it shows (the word, its key), then the picked project
  'Bắt đầu, {key}: bấm giờ cho "{title}"': 'Start, {key}: the timer for "{title}"',
  // the same with single-key shortcuts off (no key shown); the Vietnamese is also the notice above
  'button::Bắt đầu bấm giờ cho "{title}"': 'Start the timer for "{title}"',
  'Đã dừng: {time} cho "{title}"': 'Stopped: {time} for "{title}"',
  'Bộ bấm giờ đã dừng từ trước.': 'The timer had already stopped.',
  Dừng: 'Stop',
  'Đang bấm giờ': 'Timer running',
  'Đang bấm giờ cho {title}': 'Timer running for {title}',
  'timer::Bấm giờ': 'Timer',
  'không tính tiền': 'not billable',
  'bắt đầu lúc {time}': 'started at {time}',
  'Ghi chú (đang làm gì)': 'Note (what I am working on)',
  'Đang làm gì? (không bắt buộc)': 'What am I working on? (optional)',
} satisfies Dictionary;
