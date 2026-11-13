// English for the opportunities area: Vietnamese text (the key, exactly as in the code) -> English. See ../README.md.
import type { Dictionary } from '../translate';

export const opportunities = {
  // Vocabulary and field names (components/brain/opportunities/labels.ts)
  'Từ inbox': 'From the Inbox',
  'Item thư viện': 'Library item',
  'Cuộc nói chuyện': 'Conversation',
  'Nỗi đau': 'Pain',
  'Khả thi': 'Feasibility',
  'Thời điểm': 'Timing',
  '4 tuần không có bằng chứng': 'No evidence for 4 weeks',
  'Giả thuyết': 'Hypothesis',
  'Vì sao bây giờ': 'Why now',
  'Hành động kế tiếp': 'Next action',
  'Hạn quyết định': 'Decide by',
  'Quyết định': 'Decision',
  'Ủng hộ / phản bác': 'For / against',

  // Decide-by badges and skill fit (opportunities/bits.tsx)
  'Quá hạn quyết định {date}': 'Overdue since {date}',
  'Hạn quyết định hôm nay': 'Decision due today',
  'Quyết trước {date}': 'Decide by {date}',
  'Kỹ năng hợp với mình': 'Skills that fit me',

  // Page header (opportunities-view.tsx)
  'Giả thuyết kinh doanh: bằng chứng, điểm tự chấm và hạn quyết định giữ, bỏ hay làm.':
    'Business hypotheses: evidence, self-assessed scores and a date to decide whether to keep, drop or build.',

  // List (opportunity-list.tsx)
  'Mọi quyết định': 'All decisions',
  'Mọi tình trạng': 'All evidence',
  'Cần bằng chứng mới': 'Needs new evidence',
  'Còn bằng chứng mới': 'Has recent evidence',
  'hạn {date}': 'decide by {date}',
  'Bỏ cơ hội này': 'Drop this opportunity',
  'Đã bỏ "{title}"': 'Dropped "{title}"',
  'Cơ hội mới': 'New opportunity',
  'Chưa có cơ hội nào': 'No opportunities yet',
  'Ghi một giả thuyết: ai đang đau vì điều gì và sẽ trả tiền cho gì.':
    'Write down a hypothesis: who is hurting from what, and what they would pay for.',
  Điểm: 'Scores',

  // One opportunity (opportunity-detail.tsx)
  'Sửa bằng chứng "{title}"': 'Edit evidence "{title}"',
  '"{title}" bị gỡ khỏi cơ hội này. Mục inbox, item hay ghi chú gốc vẫn giữ nguyên. Không hoàn tác được.':
    '"{title}" is removed from this opportunity. The original Inbox entry, item or note stays as it is. This cannot be undone.',
  'Xóa bằng chứng "{title}"': 'Delete evidence "{title}"',
  'Quyết định: {decision}': 'Decision: {decision}',
  'Tất cả cơ hội': 'All opportunities',
  'Không tìm thấy cơ hội này': 'Could not find this opportunity',
  'Có thể link đã cũ. Quay lại danh sách để chọn cơ hội khác.':
    'The link may be out of date. Go back to the list to pick another opportunity.',
  'Tất cả ({n})': 'All ({n})',
  'Ủng hộ ({n})': 'For ({n})',
  'Phản bác ({n})': 'Against ({n})',
  'since::từ {date}': 'since {date}',
  'Sửa cơ hội': 'Edit opportunity',
  'Vì sao bây giờ và bước kế tiếp': 'Why now and the next step',
  'Hạn quyết giữ, bỏ hay làm': 'Decide by (keep, drop or build)',
  'Chưa đặt': 'Not set',
  'Hợp với mình': 'Fits me',
  'Chưa chọn kỹ năng nào': 'No skills chosen',
  'Bằng chứng gần nhất': 'Latest evidence',
  'Điểm tự chấm': 'Self-assessed scores',
  'Thêm link': 'Add link',
  'Chưa có bằng chứng. Ghi lại một cuộc nói chuyện thật hoặc một link; tin trong bản tin sáng và mục inbox cũng gắn được vào đây.':
    'No evidence yet. Record a real conversation or a link; news from the morning brief and Inbox entries can be attached here too.',
  'Lọc bằng chứng': 'Filter evidence',
  'Không có bằng chứng nào loại này.': 'No evidence of this kind.',
  'Đã xóa bằng chứng': 'Evidence deleted',
  'Đã lưu điểm mới': 'New scores saved',
  'Đã thêm bằng chứng': 'Evidence added',
  'Đã lưu bằng chứng': 'Evidence saved',

  // Create and edit (opportunity-form-dialog.tsx)
  '{error}: không tải được kỹ năng.': '{error}: could not load the skills.',
  'Chưa có kỹ năng nào. <link>Thêm ở trang Kỹ năng</link>.': 'No skills yet. <link>Add them on the Skills page</link>.',
  'Kỹ năng hợp với cơ hội này': 'Skills that fit this opportunity',
  'Cần có tên và giả thuyết.': 'A name and a hypothesis are required.',
  'Giả thuyết (một câu: ai, đau gì, trả tiền cho gì)':
    'Hypothesis (one sentence: who, what hurts, what they would pay for)',
  'Hợp với mình (kỹ năng)': 'Fits me (skills)',
  'Tạo cơ hội': 'Create opportunity',
  'Một giả thuyết của mình, sẽ được giữ, bỏ hoặc làm khi đủ bằng chứng.':
    'One of my hypotheses, to keep, drop or build once there is enough evidence.',

  // Evidence by hand (evidence-dialog.tsx)
  'Cuộc nói chuyện (The Mom Test)': 'Conversation (The Mom Test)',
  'Link (nguồn bên ngoài)': 'Link (outside source)',
  'Cần ghi nói chuyện với ai.': 'Enter who you spoke with.',
  'Link phải bắt đầu bằng http:// hoặc https://.': 'The link must start with http:// or https://.',
  'Ủng hộ hay phản bác': 'For or against',
  'Nói chuyện với ai (vai trò, công ty)': 'Who you spoke with (role, company)',
  'Họ nói gì (sự việc đã xảy ra, không phải lời khen)': 'What they said (things that happened, not compliments)',
  'Cuộc nói chuyện thật hoặc một nguồn bên ngoài. Tin từ bản tin sáng và mục inbox được gắn từ trang của chúng.':
    'A real conversation or an outside source. News from the morning brief and Inbox entries are attached from their own pages.',

  // Scores and their history (score-dialog.tsx, score-history-chart.tsx)
  'thị trường đủ lớn để đáng làm': 'the market is big enough to be worth it',
  'họ đau đến mức trả tiền': 'it hurts enough that they would pay',
  'mình làm được với sức hiện có': 'I can do it with what I have now',
  'bây giờ là lúc đúng': 'now is the right time',
  '{name}: cần một số nguyên từ 1 đến 10.': '{name}: enter a whole number from 1 to 10.',
  'Vì sao đổi điểm (không bắt buộc)': 'Why the scores changed (optional)',
  'Lưu điểm': 'Save scores',
  'Chấm điểm lại': 'Score again',
  'Mỗi điểm từ 1 đến 10. Lần chấm cũ được giữ làm lịch sử.': 'Each score from 1 to 10. Earlier scores are kept as history.',
  'Chưa chấm lần nào. Chấm 4 điểm để bắt đầu lịch sử.': 'Not scored yet. Enter the 4 scores to start the history.',
  'Lịch sử điểm, {n} lần chấm. Dùng phím mũi tên để xem từng lần.': {
    one: 'Score history, scored once. Use the arrow keys to see each scoring.',
    other: 'Score history, scored {n} times. Use the arrow keys to see each scoring.',
  },
  'Lần chấm gần nhất': 'Latest scoring',
  'Lần chấm {i}/{total}': 'Scoring {i} of {total}',
  'Xem dạng bảng': 'Show as a table',

  // Topics in the morning brief (topic-heatmap.tsx)
  khác: 'other',
  '4 tuần': '4 weeks',
  '8 tuần': '8 weeks',
  '12 tuần': '12 weeks',
  '26 tuần': '26 weeks',
  '<b>{n} tin</b> · {tag} · tuần {week} (từ {date})': {
    one: '<b>{n} story</b> · {tag} · week {week} (from {date})',
    other: '<b>{n} stories</b> · {tag} · week {week} (from {date})',
  },
  'Rê chuột lên ô, hoặc chọn bảng rồi dùng phím mũi tên.':
    'Hover over a cell, or select the grid and use the arrow keys.',
  'Bản đồ nhiệt chủ đề theo tuần. Phím mũi tên để đi qua từng ô.':
    'Heatmap of topics by week. The arrow keys move from cell to cell.',
  'số tin đã gắn tag': 'tagged stories',
  ít: 'fewer',
  'nhiều (tối đa {n} tin một tuần)': {
    one: 'more (at most {n} story a week)',
    other: 'more (at most {n} stories a week)',
  },
  'không có': 'none',
  'Chủ đề': 'Topic',
  'từ {date}': 'from {date}',
  '<b>Chưa có tin nào được gắn tag.</b> Bản tin sáng gắn tag chủ đề mỗi ngày; số đếm sẽ hiện ở đây.':
    '<b>No stories are tagged yet.</b> The morning brief tags topics every day; the counts will show here.',
  'Chủ đề trong bản tin theo tuần': 'Topics in the brief by week',
  'Số tin mỗi tag xuất hiện trong bản tin sáng, theo tuần ISO. Chủ đề nóng dần là gợi ý tìm bằng chứng.':
    'Stories per tag in the morning brief, by ISO week. A topic that heats up is a hint to look for evidence.',
  'Khoảng thời gian': 'Time range',

  // Picking an opportunity from other pages (opportunity-dialog.tsx in Inbox, evidence-menu.tsx in the brief)
  'Bằng chứng cho cơ hội nào?': 'Evidence for which opportunity?',
  'Đang tải…': 'Loading…',
  'Chưa có cơ hội nào đang mở. <link>Tạo ở trang Cơ hội</link>.':
    'No open opportunities. <link>Create one on the Opportunities page</link>.',
  '<k>1</k>–<k>9</k> ủng hộ · <k>Shift</k>+số phản bác · mục inbox được lưu trữ sau khi gắn':
    '<k>1</k>–<k>9</k> for · <k>Shift</k>+number against · the Inbox entry is archived once attached',
  'Đã thêm vào "{title}"': 'Added to "{title}"',
  'Đã có trong "{title}"': 'Already in "{title}"',
  'Thêm làm bằng chứng cho cơ hội: {title}': 'Add as evidence for an opportunity: {title}',
  'Thêm làm bằng chứng': 'Add as evidence',
  'Cơ hội đang mở': 'Open opportunities',
  'Chưa có cơ hội nào, tạo ở trang Cơ hội': 'No opportunities yet; create one on the Opportunities page',
} satisfies Dictionary;
