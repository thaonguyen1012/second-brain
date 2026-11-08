// English for the Stageshow guides (components/stageshow/): Vietnamese text (the key, exactly as in the code) ->
// English. Not in the page dictionary: the guides load lazily and pass this to useT(guides). See ../README.md.
import type { Dictionary } from '../translate';

export const guides = {
  // Bookmarklet (guides/capture-bookmarklet.tsx): the Inbox help, an example article, the capture popup
  'tintuc.example/gia-vang': 'news.example/gold-price',
  'Giá vàng hôm nay tăng mạnh': 'Gold prices surge today',
  'kéo nút': 'drag',
  'lên thanh dấu trang': 'to the bookmarks bar',
  'Hình minh họa cách cài và dùng bookmarklet: nhấn Cmd+Shift+B để hiện thanh dấu trang, kéo nút Lưu vào Brain ở trang Inbox lên thanh đó. Sau đó, ở một trang bất kỳ, bấm Lưu vào Brain trên thanh dấu trang: một cửa sổ nhỏ mở ra với link và tiêu đề đã điền sẵn; nhấn Enter để lưu vào inbox.':
    'Illustration of how to install and use the bookmarklet: press Cmd+Shift+B to show the bookmarks bar, then drag the Save to Brain button from the Inbox page onto it. Then, on any page, click Save to Brain in the bookmarks bar: a small window opens with the link and title already filled in; press Enter to save it to the inbox.',

  // Inbox (guides/inbox-triage.tsx): capture box, key legend, cards, the opportunity dialog, inbox zero
  'CSS Grid: hướng dẫn đầy đủ': 'CSS Grid: a complete guide',
  'Mẹo tập trung khi làm việc': 'Tips for staying focused at work',
  'Ý tưởng: email nhắc trả tiền': 'Idea: payment reminder emails',
  // Shorter than the Inbox page's "evidence for an opportunity": the guide's key legend is one fixed-width row
  'guide::bằng chứng cho cơ hội': 'opportunity evidence',
  '#hoc-lap-trinh': '#learn-to-code',
  'tag và tóm tắt được thêm sau, trong nền': 'tags and a summary are added later, in the background',
  'Inbox đã về 0': 'Inbox zero',
  'Mọi thứ đã được xử lý.': 'Everything has been triaged.',
  'Khóa học Next.js tiếng Việt': 'Next.js course in Vietnamese',
  'Hình minh họa cách dùng Inbox: dán một link vào ô Thu thập nhanh rồi nhấn Cmd+Enter; thẻ mới hiện ảnh thu nhỏ, tag do AI gợi ý và nơi nên chuyển tới. Nhấn Esc để rời ô nhập, rồi dùng phím: J và K để xuống và lên, L để đọc sau, A để lưu trữ, O để gắn làm bằng chứng cho một cơ hội, cho tới khi inbox về 0.':
    'Illustration of how to use the Inbox: paste a link into the Quick capture box and press Cmd+Enter; the new card shows a thumbnail, tags suggested by AI and where it should go. Press Esc to leave the box, then use the keys: J and K to move down and up, L for read later, A to archive, O to attach it as evidence for an opportunity, until the inbox is at zero.',

  // Library (guides/library-item.tsx): toolbar, item card, done-output reminder, item and note dialogs
  'Thói quen nhỏ, lặp lại mỗi ngày': 'Tiny habits, repeated every day',
  '## 3 ý chính': '## 3 key ideas',
  'Hình minh họa trang Thư viện: bấm Thêm item, nhập tên một cuốn sách rồi lưu; thẻ mới hiện trong thư viện. Bấm Xong khi đọc xong: thẻ nhắc "Xong rồi, nhưng chưa có đầu ra" và đề nghị ghi highlights và 3 ý chính. Bấm Viết ghi chú, viết vài dòng rồi Tạo ghi chú: lời nhắc biến mất.':
    'Illustration of the Library page: click Add item, type the title of a book and save; the new card appears in the library. Click Done when the book is finished: the card says "Done, but no output yet" and suggests writing down highlights and 3 key ideas. Click Write a note, write a few lines, then Create note: the reminder disappears.',

  // Opportunities (guides/opportunity-evidence.tsx): list, detail, the create, evidence and score dialogs
  'Mẫu hợp đồng cho freelancer': 'Contract templates for freelancers',
  'Freelancer mới vào nghề trả tiền cho mẫu hợp đồng dễ hiểu.':
    'New freelancers pay for contract templates in plain words.',
  'Kế toán của một văn phòng dịch vụ': 'Accountant at a service office',
  'Mẫu miễn phí trên một diễn đàn': 'Free template on a forum',
  'https://diendan.example/mau-hop-dong': 'https://forum.example/contract-template',
  'Ghi một giả thuyết: ai, đau gì, trả tiền cho gì.': 'Write down a hypothesis: who, what pain, what they pay for.',
  '{n} ủng hộ': '{n} for',
  '{n} phản bác': '{n} against',
  'Cuộc nói chuyện thật hoặc một nguồn bên ngoài.': 'A real conversation or an outside source.',
  'Hình minh họa trang Cơ hội: viết một giả thuyết (ai, đau gì, trả tiền cho gì) trong hộp thoại Cơ hội mới rồi bấm Tạo cơ hội; mở cơ hội vừa tạo; thêm một cuộc nói chuyện làm bằng chứng ủng hộ và một link làm bằng chứng phản bác; nhấn S để chấm bốn điểm từ 1 đến 10: cơ hội, nỗi đau, khả thi, thời điểm.':
    'Illustration of the Opportunities page: write a hypothesis (who, what pain, what they pay for) in the New opportunity dialog and click Create opportunity; open the new opportunity; add a conversation as evidence for it and a link as evidence against it; press S to give the four scores from 1 to 10: opportunity, pain, feasibility, timing.',

  // Skills (guides/skill-freshness.tsx): the matrix toolbar, the skill sheet, the time notes
  'Bài viết: generics trong dự án thật': 'Article: generics in a real project',
  '3 tháng sau': '3 months later',
  '6 tháng sau': '6 months later',
  'Hình minh họa trang Kỹ năng: mở một kỹ năng đã mờ, bấm Thêm bằng chứng và thêm một link; kỹ năng chuyển sang Còn mới. Nếu không có bằng chứng mới, ô kỹ năng tự đổi màu theo thời gian: sau 3 tháng là Đang cũ dần, sau 6 tháng là Đã mờ.':
    'Illustration of the Skills page: open a faded skill, click Add evidence and add a link; the skill turns Fresh. Without new evidence, the skill tile changes colour over time: after 3 months it is Ageing, after 6 months Faded.',

  // Week (guides/week-ritual.tsx): plan tab (carry over, objectives), review tab (time chart, journal)
  'Viết case study': 'Write a case study',
  'Ôn lại React hooks': 'Revise React hooks',
  'Gửi 2 báo giá': 'Send 2 quotes',
  'Chọn 3–5 mục tiêu cho tuần: kết quả muốn có, không phải danh sách task.':
    'Pick 3–5 objectives for the week: outcomes you want, not a task list.',
  'Đang có 2 mục tiêu. 3–5 là vừa cho một tuần, ít hơn cũng được.':
    '2 objectives so far. 3–5 is right for a week; fewer is fine too.',
  '3 mục tiêu: vừa đủ cho một tuần.': '3 objectives: just right for a week.',
  'Nhìn biểu đồ giờ cho mục tiêu và giờ khác ở bên trái.':
    'Look at the chart of time for objectives and other time on the left.',
  'Nhìn biểu đồ giờ cho mục tiêu và giờ khác ở trên.':
    'Look at the chart of time for objectives and other time above.',
  'Kéo mục tiêu chưa xong sang': 'Carry over unfinished objectives',
  'Mục tiêu còn mở của tuần trước. Bỏ chọn cái không còn quan trọng.':
    "Last week's open objectives. Untick any that no longer matter.",
  'Kéo 2 mục tiêu sang tuần này': 'Carry 2 objectives over to this week',
  'Thêm mục tiêu, ví dụ: Gửi báo giá cho 2 khách': 'Add an objective, e.g. Send quotes to 2 clients',
  // Shorter than the Tuần page's English: in the guide, the chart's title and the questions are one line in half
  // the page (about 214 and 220 px)
  'guide::Giờ cho mục tiêu và giờ khác': 'Objective time vs other time',
  'guide::Cái gì kéo thời gian khỏi ưu tiên?': 'What pulled time from the priorities?',
  'Hình minh họa trang Tuần. Đầu tuần, ở thẻ Kế hoạch: bấm "Kéo 2 mục tiêu sang tuần này" để mang mục tiêu chưa xong của tuần trước sang, rồi thêm mục tiêu mới; gợi ý cho biết 3 đến 5 mục tiêu là vừa. Cuối tuần, nhấn R để mở Nhìn lại: biểu đồ cho thấy giờ cho mục tiêu so với giờ khác theo từng ngày, bên cạnh sáu câu hỏi của nhật ký nhìn lại, như "Cái gì kéo thời gian khỏi ưu tiên?".':
    'Illustration of the Week page. At the start of the week, on the Plan tab: click "Carry 2 objectives over to this week" to bring last week\'s unfinished objectives over, then add a new objective; the hint says 3 to 5 objectives is right. At the end of the week, press R to open Review: a chart shows time for objectives against other time for each day, next to the six questions of the review journal, such as "What pulled time from the priorities?".',

  // Time (guides/work-timer.tsx): the timer card and the week summary
  'Website cho tiệm bánh': 'Bakery website',
  'Tiệm bánh Hoa Mai': 'Hoa Mai Bakery',
  '{pct}% tổng giờ': '{pct}% of total',
  '1 giờ 30 phút sau': '1 h 30 min later',
  'Tổng giờ': 'Total time',
  'Hình minh họa trang Công việc, phần Giờ: chọn dự án rồi bấm Bắt đầu để bấm giờ; đồng hồ chạy, rồi nhấn T để dừng. Phiên vừa ghi được cộng ngay vào tổng kết tuần: tổng giờ và giờ tính tiền tăng, và dự án có một thanh mới ở đầu phần Theo dự án.':
    'Illustration of the Work area, Time page: pick a project and click Start to time it; the clock runs, then press T to stop it. The session just logged is added to the week summary at once: total time and billable time go up, and the project gets a new bar at the top of By project.',
} satisfies Dictionary;
