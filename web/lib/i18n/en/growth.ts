// English for the growth area: Vietnamese text (the key, exactly as in the code) -> English. See ../README.md.
import type { Dictionary } from '../translate';

export const growth = {
  // Pages (app/[lang]/(home)/phat-trien/ky-nang, thi-truong, thanh-tuu)
  'Ma trận kỹ năng có bằng chứng, không tự chấm điểm.': 'A skills matrix backed by evidence, with no self-rating.',
  'Độ mới của kỹ năng': 'Skill freshness',
  'bằng chứng trong 3 tháng': 'evidence within 3 months',
  '3 đến 6 tháng': '3 to 6 months',
  'quá 6 tháng hoặc chưa có': 'over 6 months, or none yet',
  'Mỗi tháng dán vài tin tuyển dụng, xem kỹ năng nào được đòi và mình còn thiếu gì.':
    'Paste a few job ads each month to see which skills are asked for and what I am still missing.',
  'Việc đã làm được mỗi tuần kèm con số tác động, và các dự đoán chấm lại sau 6 tháng.':
    'What got done each week, with a number for its impact, and predictions scored after 6 months.',

  // Period stepper (growth/shared.tsx): "{name}" is "tháng" or "tuần"
  '{name} trước': 'Previous {name}',
  '{name} sau': 'Next {name}',
  tháng: 'month',
  tuần: 'week',

  // Skills matrix (growth/skills-page.tsx); the first-run suggestions are created as skills with these names
  Excel: 'Excel',
  SQL: 'SQL',
  Python: 'Python',
  'Business English': 'Business English',
  'An ninh mạng': 'Cybersecurity',
  'Quản lý dự án': 'Project management',
  'Mọi độ mới': 'Any freshness',
  'Độ mới': 'Freshness',
  'Tìm kỹ năng': 'Search skills',
  'Tìm theo tên hoặc tên khác': 'Search by any name',
  'Thêm kỹ năng': 'Add skill',
  'Chưa có kỹ năng nào': 'No skills yet',
  'Thêm kỹ năng nền và kỹ năng của vai trò nhắm tới, rồi gắn bằng chứng: thứ đã ship, case study, bài viết.':
    'Add the core skills and those of the role you are aiming for, then attach evidence: things shipped, case studies, articles.',
  'Thêm kỹ năng {name}': 'Add the skill {name}',
  'Ma trận kỹ năng': 'Skills matrix',

  // Skill dialog (growth/skill-dialog.tsx)
  'Tên khác': 'Other names',
  'Cần có tên kỹ năng.': 'The skill needs a name.',
  'Tên kỹ năng': 'Skill name',
  'Tên khác (cách nhau bằng dấu phẩy)': 'Other names (separated by commas)',
  'Tin tuyển dụng gọi kỹ năng này bằng các tên đó cũng được tính, ví dụ: postgres, psql.':
    'Job ads that call this skill by one of these names count too, for example: postgres, psql.',
  'Thêm vào ma trận': 'Add to the matrix',
  'Sửa kỹ năng': 'Edit skill',
  'Không tự chấm điểm: kỹ năng sáng lên khi có bằng chứng mới và tự mờ sau 6 tháng không có.':
    'No self-rating: a skill lights up with new evidence and fades by itself after 6 months without any.',

  // Skill sheet (growth/skill-sheet.tsx)
  'Thao tác với "{title}"': 'Actions for "{title}"',
  '"{title}" bị gỡ khỏi kỹ năng này; độ mới được tính lại. Không hoàn tác được.':
    '"{title}" is removed from this skill and its freshness is recalculated. This cannot be undone.',
  'Tên khác:': 'Other names:',
  'Sửa tên, tên khác, ghi chú': 'Edit name, other names, note',
  'Chưa có bằng chứng: thứ đã ship, case study, bài viết công khai. Không có bằng chứng thì kỹ năng ở trạng thái mờ.':
    'No evidence yet: things shipped, case studies, public articles. Without evidence the skill stays faded.',

  // Evidence form (growth/evidence-form.tsx)
  'Ghi chú thư viện': 'Library note',
  'Thư viện chưa có item nào. Thêm ở trang Thư viện trước.': 'The library has no items yet. Add one on the Library page first.',
  'Chọn item…': 'Choose an item…',
  'Chọn item': 'Choose an item',
  'Chọn ghi chú…': 'Choose a note…',
  'Chọn ghi chú': 'Choose a note',
  'Không có ghi chú nào khớp.': 'No notes match.',
  'Thư viện chưa có ghi chú nào. Thêm ở trang Ghi chú trước.': 'The library has no notes yet. Add one on the Notes page first.',
  '{n} ghi chú mới nhất khớp; gõ thêm để thu hẹp.': {
    one: '{n} newest matching note; type more to narrow the search.',
    other: '{n} newest matching notes; type more to narrow the search.',
  },
  'Tìm ghi chú': 'Search notes',
  'Gõ để tìm trong tiêu đề và nội dung…': 'Type to search titles and content…',
  'Link cần có tiêu đề và địa chỉ.': 'A link needs a title and an address.',
  'Chọn một item.': 'Choose an item.',
  'Chọn một ghi chú.': 'Choose a note.',
  'Tiêu đề (để trống thì lấy theo item hoặc ghi chú)': 'Title (leave empty to use the title of the item or note)',
  'Ngày ship hoặc viết': 'Date shipped or written',
  'Lưu bằng chứng': 'Save evidence',

  // Job ad dialog (growth/job-ad-dialog.tsx)
  'Vị trí': 'Job title',
  'Công ty': 'Company',
  Tháng: 'Month',
  'Cần có tên vị trí và nội dung tin.': 'The ad needs a job title and its text.',
  'Tháng có dạng YYYY-MM, ví dụ 2026-11.': 'The month is written YYYY-MM, for example 2026-11.',
  'Nội dung dài quá {max} ký tự, hãy bỏ bớt phần giới thiệu công ty.':
    'The text is longer than {max} characters; cut some of the company introduction.',
  'Link tin (không bắt buộc)': 'Link to the ad (optional)',
  'Nội dung tin': 'Ad text',
  '{count} / {max} ký tự': '{count} / {max} characters',
  'Dán toàn bộ phần mô tả công việc và yêu cầu…': 'Paste the whole job description and requirements…',
  'Kỹ năng (sửa tay, cách nhau bằng dấu phẩy)': 'Skills (edited by hand, separated by commas)',
  'Sửa ô này thì kết quả của bạn được giữ, không phân tích lại. Đổi vị trí, công ty hay nội dung thì tin được phân tích lại.':
    'Edit this field and your result is kept, with no new analysis. Changing the job title, company or text analyses the ad again.',
  'Lưu và phân tích': 'Save and analyse',
  'Sửa tin tuyển dụng': 'Edit job ad',
  'Dán tin tuyển dụng': 'Paste job ad',
  'Mỗi tháng 5 đến 10 tin của vai trò nhắm tới. Kỹ năng và cấp bậc được rút ra trong nền, vài phút sau sẽ có.':
    'Each month, 5 to 10 ads for the role you are aiming for. Skills and level are extracted in the background and appear a few minutes later.',

  // Market chart (growth/market-chart.tsx)
  'Chưa có trong ma trận': 'Not in the matrix yet',
  'không đổi': 'no change',
  tăng: 'up',
  giảm: 'down',
  'Chú giải': 'Legend',
  'Tháng này': 'This month',
  'Tháng trước': 'Previous month',
  'Số tin tuyển dụng đã phân tích nhắc tới từng kỹ năng, so với tháng trước':
    'Number of analysed job ads that mention each skill, compared with the previous month',
  'Kỹ năng được đòi': 'Skills asked for',
  'Biểu đồ': 'Chart',
  '/{n} tin': { one: '/{n} ad', other: '/{n} ads' },

  // Market page (growth/market-page.tsx)
  'Đã phân tích': 'Analysed',
  'Lỗi phân tích': 'Analysis failed',
  'Đang chờ phân tích': 'Waiting for analysis',
  'Cấp bậc và kỹ năng được đòi': 'Level and skills asked for',
  'AI không trả về kết quả hợp lệ. Sửa tin để phân tích lại, hoặc tự điền kỹ năng.':
    'The AI did not return a valid result. Edit the ad to analyse it again, or fill in the skills yourself.',
  'Chi tiết kỹ thuật': 'Technical details',
  'Kỹ năng và cấp bậc sẽ được rút ra trong nền, vài phút sau.':
    'Skills and level will be extracted in the background in a few minutes.',
  'Thao tác với tin "{title}"': 'Actions for the ad "{title}"',
  'Mở tin': 'Open ad',
  'Xóa tin tuyển dụng?': 'Delete this job ad?',
  '"{title}" bị xóa và không còn tính vào báo cáo thị trường tháng này. Không hoàn tác được.':
    '"{title}" is deleted and no longer counts in the market report for this month. This cannot be undone.',
  'Thị trường đòi mà mình chưa có bằng chứng': 'What the market asks for that I have no evidence of yet',
  'Không có khoảng trống: mọi kỹ năng được đòi đều có trong ma trận và chưa mờ.':
    'No gaps: every skill asked for is in the matrix and has not faded.',
  'ad::{n} tin': { one: '{n} ad', other: '{n} ads' },
  'Công cụ và kỹ năng mới từ bản tin sáng': 'New tools and skills from the morning brief',
  'Tháng này bản tin chưa gắn tin nào là công cụ hay kỹ năng mới.':
    'This month the brief has not tagged any story as a new tool or skill.',
  'Hai câu hỏi trước khi học': 'Two questions before learning',
  'Chỉ học thứ trả lời "có" cho cả hai.': 'Only learn what gets a "yes" to both.',
  'liên quan {relevance}/5': 'relevance {relevance}/5',
  '<num>{n}</num> <muted>tin trong tháng</muted>': {
    one: '<num>{n}</num> <muted>ad in the month</muted>',
    other: '<num>{n}</num> <muted>ads in the month</muted>',
  },
  '{n} đang chờ phân tích': '{n} waiting for analysis',
  'Cấp bậc': 'Level',
  'Chưa có tin nào được phân tích xong trong tháng này.': 'No ad this month has been analysed yet.',
  'Tần suất kỹ năng so với tháng trước': 'Skill frequency compared with the previous month',
  'Không tìm thấy tin tuyển dụng #{id}, có thể đã bị xóa.': 'Job ad #{id} was not found; it may have been deleted.',
  'Làm mới': 'Refresh',
  'Chưa có tin tuyển dụng nào': 'No job ads yet',
  'Dán 5 đến 10 tin của vai trò nhắm tới; kỹ năng được rút ra trong nền rồi so với ma trận.':
    'Paste 5 to 10 ads for the role you are aiming for; the skills are extracted in the background, then compared with the matrix.',
  'Dán tin đầu tiên': 'Paste the first ad',
  'Biểu đồ tần suất hiện khi có tin tuyển dụng đầu tiên.': 'The frequency chart appears with the first job ad.',
  'Tháng này chưa có tin nào': 'No ads this month yet',
  '{month} chưa có tin nào': 'No ads in {month}',
  'Tin tuyển dụng {month}': 'Job ads in {month}',
  'Đã lưu "{title}". Kỹ năng sẽ được rút ra trong nền, bấm Làm mới sau vài phút.':
    'Saved "{title}". The skills are extracted in the background; press Refresh in a few minutes.',
  'Đã thêm "{name}" vào ma trận. Gắn bằng chứng ở trang Kỹ năng để nó sáng lên.':
    'Added "{name}" to the matrix. Attach evidence on the Skills page to light it up.',

  // Quick add (growth/achievement-quick-add.tsx; also on the Tuần review)
  'Đã làm gì': 'What was done',
  'field::Thành tựu': 'Achievement',
  'Con số tác động': 'Impact in numbers',
  'Tác động (con số)': 'Impact (a number)',

  // Achievement dialog (growth/achievement-dialog.tsx)
  'Việc đã làm': 'What was done',
  'Mô tả': 'Description',
  'Ma trận kỹ năng còn trống. Thêm ở trang Kỹ năng.': 'The skills matrix is empty. Add skills on the Skills page.',
  'Kỹ năng đã dùng': 'Skills used',
  'Không gắn dự án': 'No project',
  'Cần ghi việc đã làm.': 'Write what was done.',
  'Ship trang thanh toán mới': 'Shipped the new checkout page',
  'Kết quả bằng số': 'Result in numbers',
  'Con số dùng được trong CV: thời gian, tiền, người dùng, lỗi giảm…':
    'A number a CV can use: time, money, users, fewer bugs…',
  'Thanh toán 40 s → 12 s': 'Checkout 40 s → 12 s',
  'Mô tả (không bắt buộc)': 'Description (optional)',
  'Ghi vào nhật ký': 'Add to the log',
  'Sửa thành tựu': 'Edit achievement',
  'Ghi thành tựu': 'Log achievement',
  'Mỗi việc một dòng, kèm kết quả bằng số để sau này viết CV theo kết quả.':
    'One line per thing done, with a result in numbers, so a results-based CV is easy to write later.',

  // Achievement log (growth/brag-page.tsx)
  'Xóa dòng thành tựu?': 'Delete this achievement?',
  '"{title}" bị xóa khỏi nhật ký thành tựu. Không hoàn tác được.':
    '"{title}" is removed from the achievement log. This cannot be undone.',
  'Theo tuần': 'By week',
  'Mọi tuần': 'All weeks',
  'Không tìm thấy thành tựu #{id}, có thể đã bị xóa.': 'Achievement #{id} was not found; it may have been deleted.',
  'Phạm vi': 'Range',
  'Chưa có thành tựu nào': 'No achievements yet',
  'Mỗi tuần ghi việc đã làm được, kèm kết quả bằng số: nguyên liệu cho CV và case study.':
    'Each week, log what got done with a result in numbers: material for a CV and case studies.',
  'Hoặc ghi nhanh một dòng': 'Or log one quick line',
  'Giảm build từ 14 GB xuống 1,9 GB': 'Cut the build from 14 GB to 1.9 GB',
  'Đã ghi "{title}"': 'Logged "{title}"',
  'Tuần này chưa ghi gì': 'Nothing logged this week yet',
  'Tuần {week} không có dòng nào': 'Nothing logged for {week}',
  'Nhật ký còn trống': 'The log is empty',
  'Mỗi tuần ghi những việc đã làm được, kèm kết quả bằng số. Đây là nguyên liệu cho CV và case study.':
    'Each week, log the things that got done, with a result in numbers. This is material for a CV and case studies.',

  // Predictions (growth/brag-page.tsx)
  'Mọi dự đoán': 'All',
  'Đến hạn chấm lại': 'Due for scoring',
  'chấm {date}': 'scored {date}',
  'tự tin {confidence}/10': 'confidence {confidence}/10',
  Chấm: 'Score',
  'Chấm lại': 'Score again',
  'Thao tác với dự đoán': 'Actions for the prediction',
  'Xóa dự đoán?': 'Delete this prediction?',
  '"{statement}" bị xóa, kể cả kết quả đã chấm. Không hoàn tác được.':
    '"{statement}" is deleted, including its score. This cannot be undone.',
  'Không tìm thấy dự đoán #{id}, có thể đã bị xóa.': 'Prediction #{id} was not found; it may have been deleted.',
  'Ghi dự đoán': 'Log prediction',
  '{n}{plus} dự đoán đến hạn chấm lại': {
    one: '{n}{plus} prediction due for scoring',
    other: '{n}{plus} predictions due for scoring',
  },
  'Mỗi quý xem lại danh sách dự đoán: đúng, sai, hay đúng một phần, và vì sao.':
    'Each quarter, go through the predictions: right, wrong or partly right, and why.',
  Xem: 'Show',
  'Dự đoán, chấm lại sau 6 tháng': 'Predictions, scored after 6 months',
  'Lọc dự đoán': 'Filter predictions',
  'Chưa có dự đoán nào. Ghi một dự đoán về AI, kinh tế hay địa chính trị kèm độ tự tin; 6 tháng sau app nhắc chấm lại.':
    'No predictions yet. Write one about AI, the economy or geopolitics with a confidence level; 6 months later the app reminds you to score it.',
  'list::Dự đoán': 'Predictions',
  'Đã xóa dự đoán': 'Prediction deleted',
  'Đã ghi dự đoán, chấm lại ngày {date}': 'Prediction logged; score it on {date}',
  'Đã chấm: {outcome}': 'Scored: {outcome}',
  'Đã lưu dự đoán': 'Prediction saved',

  // Prediction dialog (growth/prediction-dialog.tsx)
  'Ngày ghi': 'Made on',
  'Ngày chấm lại': 'Score on',
  'Độ tự tin': 'Confidence',
  'Cần ghi dự đoán.': 'Write the prediction.',
  'Độ tự tin là số nguyên từ 1 đến 10, hoặc để trống.': 'Confidence is a whole number from 1 to 10, or empty.',
  'Ngày chấm lại phải sau ngày ghi.': 'The scoring date must come after the date it was made.',
  'Điều mình nghĩ sẽ xảy ra, viết sao cho 6 tháng sau chấm được đúng hay sai.':
    'What I think will happen, written so that in 6 months it can be scored right or wrong.',
  'Để trống: sau 6 tháng.': 'Leave empty for 6 months later.',
  'Độ tự tin 1–10': 'Confidence 1–10',
  'Chọn kết quả trước: 1 đúng, 2 một phần, 3 sai.': 'Choose a result first: 1 right, 2 partly, 3 wrong.',
  'Chuyện gì đã xảy ra, mình học được gì': 'What happened, what I learned',
  'Lưu kết quả': 'Save result',
  'Chấm lại dự đoán': 'Score prediction',
  'Sửa dự đoán': 'Edit prediction',
  '{statement} (ghi {date}, tự tin {confidence}/10)': '{statement} (made {date}, confidence {confidence}/10)',
  '{statement} (ghi {date})': '{statement} (made {date})',
  'Đọc các nhà tiên tri để lấy khung tư duy, không để tin dự báo. Ghi lại, 6 tháng sau chấm lại.':
    'Read forecasters for their ways of thinking, not to believe their forecasts. Write it down, then score it 6 months later.',

  // Tool stages, in the Công cụ page's order (lib/tools.ts)
  'Đọc & mổ xẻ codebase': 'Reading & dissecting codebases',
  'Học qua thực hành': 'Learning by doing',
  'Lên kế hoạch & thiết kế': 'Planning & design',
  'Viết code': 'Writing code',
  'Review code': 'Code review',
  'Kiểm thử': 'Testing',
  'Bảo mật': 'Security',
  'Phụ thuộc & chuỗi cung ứng': 'Dependencies & supply chain',
  'Git & lịch sử': 'Git & history',
  'CI/CD & deploy': 'CI/CD & deploys',
  'Giám sát & log': 'Monitoring & logs',
  'Dữ liệu & DB': 'Data & databases',
  'AI & LLM': 'AI & LLMs',
  'Tài liệu & sơ đồ': 'Docs & diagrams',
  'Thêm công cụ': 'Add tool',

  // Công cụ page (app/[lang]/(home)/phat-trien/cong-cu, components/brain/tools/tools-page.tsx)
  'Công cụ engineer giỏi dùng ở từng công đoạn, và công cụ để học bằng cách mổ xẻ code thật.':
    'Tools good engineers use at each stage of the work, and tools to learn by dissecting real code.',
  'Mọi công đoạn': 'All stages',
  'Mở {site} (tab mới)': 'Open {site} (new tab)',
  'Không có công cụ nào khớp bộ lọc.': 'No tools match the filters.',
  'Chưa có công cụ nào': 'No tools yet',
  'Lưu công cụ bạn dùng hoặc muốn thử, kèm một dòng dùng để làm gì; hoặc chạy <code>manage.py seed_tools</code> một lần để có sẵn danh sách gợi ý.':
    'Keep the tools you use or want to try, each with a line on what it is for; or run <code>manage.py seed_tools</code> once for a starter list.',
} satisfies Dictionary;
