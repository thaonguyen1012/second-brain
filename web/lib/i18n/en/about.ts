// English for the pages /gioi-thieu/ (header, feature grid, case study) and /huong-dan/:
// Vietnamese text (the key, exactly as in the code) -> English. Server components only (getT, through enAll): not in
// the page dictionary and not in the intro pictures' chunk. See ../README.md.
import type { Dictionary } from '../translate';

export const about = {
  // Intro page header and feature grid (app/[lang]/(home)/gioi-thieu/page.tsx, print-button.tsx)
  "Alex's Brain là gì, làm được gì, và case study về cách nó được xây.":
    "What Alex's Brain is, what it does, and a case study of how it was built.",
  'Một nơi duy nhất cho việc học, công việc và phát triển bản thân: sổ tay học tập có tiến độ từng bài, một inbox, kế hoạch và nhìn lại mỗi tuần, cơ hội kinh doanh có bằng chứng, kỹ năng tự mờ theo thời gian và bản tin sáng. Tự host, đăng nhập mới vào được, dữ liệu là của bạn.':
    'One place for learning, work and personal growth: study handbooks with progress per lesson, an inbox, a plan and a review every week, business opportunities backed by evidence, skills that fade over time on their own, and a morning brief. Self-hosted, behind a sign-in, and the data is yours.',
  'Tính năng': 'Features',
  'In hoặc lưu PDF': 'Print or save as PDF',
  'Màn hình Hôm nay': 'The Today screen',
  'Làm được gì': 'What it does',
  'Xương sống của app là buổi nhìn lại 15 phút cuối tuần: inbox về 0 chưa, ba ưu tiên xong chưa, cơ hội nào có thêm bằng chứng, tuần tới làm gì. Tính năng nào không đổi được một quyết định trong buổi đó thì không xây.':
    'The backbone of the app is a 15-minute review at the end of the week: is the inbox at zero, are the three priorities done, which opportunities have new evidence, what to do next week. A feature that cannot change a decision in that review does not get built.',
  'Một inbox, mỗi phím một quyết định.': 'One inbox, one decision per key.',
  'Link bỏ vào được gắn tag, tóm tắt và gợi ý nơi đến trong nền; J/K để đi, L đọc sau, A lưu trữ, O làm bằng chứng cho một cơ hội.':
    'Links dropped in get tags, a summary and a suggested destination in the background; J/K to move, L read later, A archive, O evidence for an opportunity.',
  '⌘K tìm mọi thứ.': '⌘K searches everything.',
  'Bài học trong sổ tay, thư viện, ghi chú, inbox, cơ hội và bản tin, trong một ô.':
    'Handbook lessons, the library, notes, the inbox, opportunities and the brief, in one box.',
  'Tuần: ba ưu tiên, rồi nhìn lại.': 'Week: three priorities, then a review.',
  'Giờ cho mục tiêu so với giờ khác, theo từng ngày, từ giờ làm thật.':
    'Time for objectives against other time, day by day, from the hours actually worked.',
  'Cơ hội là giả thuyết.': 'An opportunity is a hypothesis.',
  'Bằng chứng ủng hộ hay phản bác, bốn điểm tự chấm có lịch sử.':
    'Evidence for or against, and four self-scores with a history.',
  'Kỹ năng tự mờ.': 'Skills fade on their own.',
  'Không có bằng chứng mới trong 6 tháng thì nhạt màu; không tự chấm điểm.':
    'No new evidence for 6 months and the colour fades; no self-rating.',
  'Bản tin sáng, 6:30.': 'Morning brief, 6:30.',
  'Tin từ nguồn tự chọn, được gắn tag; một chạm vào inbox hoặc làm bằng chứng.':
    'News from hand-picked sources, tagged; one tap sends a story to the inbox or makes it evidence.',
  'Muốn xem từng trang hoạt động thế nào?': 'Want to see how each page works?',
  'Xem mọi hướng dẫn': 'See all guides',

  // Case study (gioi-thieu/page.tsx); the owner fills in the "Số liệu" boxes
  "Alex's Brain: một second brain tự host, xây trong vài ngày với một agent":
    "Alex's Brain: a self-hosted second brain, built in a few days with an agent",
  'Next.js 16 + Fumadocs, Django 5.2 + DRF, Postgres 16, một chỗ gọi LLM có trần chi phí. Bắt đầu 31/10/2026; trang này mô tả trạng thái ngày 02/11/2026.':
    'Next.js 16 + Fumadocs, Django 5.2 + DRF, Postgres 16, one place that calls the LLM, with a cost cap. Started on 31/10/2026; this page describes the state on 02/11/2026.',
  'Số liệu: Alex điền': 'Figures: for Alex to fill in',
  'Bối cảnh': 'Background',
  'Tài liệu học của Alex là {books} sổ tay ghi chú từ các khóa Coursera và F8, ở dạng file HTML và markdown xuất từ GitBook. Việc học, dự án cho khách, tin tức và ý tưởng kinh doanh nằm ở nhiều nơi khác nhau.':
    "Alex's study material is {books} handbooks of notes from Coursera and F8 courses, as HTML and markdown files exported from GitBook. Learning, client projects, news and business ideas were spread across many different places.",
  'Vai trò của Alex trong dự án (ý tưởng, quyết định, review), số giờ đã bỏ ra.':
    "Alex's role in the project (ideas, decisions, review), hours put in.",
  'Vấn đề': 'Problem',
  'Nội dung lớn hơn dự tính: 18.792 trang cho 15 cuốn. Static export của một cuốn thử (2.434 trang) ra 1,9 GB; ngoại suy cho tất cả là 14 GB, tối ưu hết cũng còn 1,3 đến 1,6 GB, trong khi Cloudflare Pages giới hạn 20.000 file mỗi lần deploy.':
    'The content was bigger than expected: 18,792 pages for 15 books. A static export of one trial book (2,434 pages) came to 1.9 GB; extrapolated to all of them that is 14 GB, and still 1.3 to 1.6 GB fully optimised, while Cloudflare Pages allows 20,000 files per deploy.',
  'Không có chỗ nào trả lời được: tuần này có tiến lên không, kỹ năng nào đang cũ đi so với thị trường, cơ hội nào có thêm bằng chứng.':
    'Nothing could answer: did this week move things forward, which skills were going stale against the market, which opportunities had new evidence.',
  'Muốn dùng AI để gắn tag và tóm tắt, nhưng chi phí phải có trần và ghi chú riêng tư không được gửi ra ngoài.':
    'Alex wanted AI for tagging and summaries, but its cost had to be capped and private notes could not be sent out.',
  'Cách làm': 'Approach',
  'Brainstorm rồi ghi lại trong <code>DECISIONS.md</code>: mỗi quyết định có ngày, đóng vai trò ADR, để session sau không mở lại câu đã trả lời.':
    'Brainstorm, then write it down in <code>DECISIONS.md</code>: every decision is dated and serves as an ADR, so a later session does not reopen a question already answered.',
  'Pilot trước khi chốt: nhập thử một cuốn, đo thời gian build (96 giây), RAM (1,95 GB) và dung lượng, rồi đổi kiến trúc theo số đo.':
    'Pilot before committing: import one book as a trial, measure build time (96 seconds), RAM (1.95 GB) and size, then change the architecture to fit the numbers.',
  'Xây theo thứ tự phục vụ buổi nhìn lại tuần: Inbox + Item, Tuần, Công việc, Cơ hội, Kỹ năng + Thị trường, Bản tin sáng.':
    'Build in the order that serves the weekly review: Inbox + Item, Week, Work, Opportunities, Skills + Market, Morning brief.',
  'Mỗi bước một commit nhỏ, chỉ commit khi <code>make check</code> qua; sau mỗi phần lớn có một vòng review và một commit sửa riêng.':
    'One small commit per step, committed only when <code>make check</code> passes; after each large part, a review round and a separate commit with the fixes.',
  'Code được viết cùng Claude Code theo luật trong <code>CLAUDE.md</code>; quyết định sản phẩm nằm ở <code>DECISIONS.md</code>.':
    'The code is written with Claude Code under the rules in <code>CLAUDE.md</code>; product decisions live in <code>DECISIONS.md</code>.',
  'Kiến trúc': 'Architecture',
  'Sơ đồ kiến trúc': 'Architecture diagram',
  'Trình duyệt hoặc PWA': 'Browser or PWA',
  'Một origin, một lần đăng nhập.': 'One origin, one sign-in.',
  'Cloudflare Tunnel + Access: không mở cổng nào, Access đứng trước mọi request':
    'Cloudflare Tunnel + Access: no open ports, Access in front of every request',
  '<code>/api</code>, <code>/admin</code>, <code>/files</code> sang Django; mọi thứ khác sang Next.':
    '<code>/api</code>, <code>/admin</code>, <code>/files</code> to Django; everything else to Next.',
  'Chỉ render. Sổ tay là markdown trên đĩa, compile khi có request, tìm kiếm SQLite FTS5. Không có code auth; <code>web/lib/api/</code> là chỗ duy nhất gọi backend, type sinh từ OpenAPI.':
    'Rendering only. The handbooks are markdown on disk, compiled on request, searched with SQLite FTS5. No auth code; <code>web/lib/api/</code> is the only place that calls the backend, with types generated from OpenAPI.',
  'Sở hữu dữ liệu và auth (xác minh JWT của Cloudflare Access). Logic ở <code>services/</code>, view mỏng, phân trang cursor.':
    'Owns the data and auth (verifies the Cloudflare Access JWT). Logic in <code>services/</code>, thin views, cursor pagination.',
  'cron chạy manage.py run_jobs: chỗ duy nhất có request ra ngoài':
    'cron runs manage.py run_jobs: the only place with outbound requests',
  'Job nền → core/services/llm.py': 'Background jobs → core/services/llm.py',
  'Một chỗ gọi LLM: đếm token, từ chối khi chi phí tháng cộng ước tính vượt 5 USD, ghi mọi lần gọi vào <code>LlmCall</code>, cache theo hash nội dung, đầu ra là JSON theo schema và được kiểm bằng pydantic. Prompt có version, golden set chạy bằng <code>manage.py eval</code>. Hiện dùng Gemini gói miễn phí; đổi sang Claude là thêm một nhánh trong file này.':
    "One place calls the LLM: it counts tokens, refuses when the month's cost plus the estimate would go over 5 USD, records every call in <code>LlmCall</code>, caches by content hash, and its output is JSON to a schema, checked with pydantic. Prompts are versioned; golden sets run with <code>manage.py eval</code>. It uses Gemini's free tier for now; switching to Claude means adding one branch in this file.",
  'Cấu hình nginx, Cloudflare Tunnel và Access đã viết trong <code>deploy/</code>, chưa triển khai.':
    'The nginx, Cloudflare Tunnel and Access configuration is written in <code>deploy/</code>, not deployed yet.',
  'Quyết định đáng chú ý': 'Notable decisions',
  '<strong>Server mode thay static export.</strong> Next chạy <code>standalone</code>, nội dung compile khi có request và được cache; thời gian build không còn tăng theo số trang.':
    '<strong>Server mode instead of a static export.</strong> Next runs <code>standalone</code>, content is compiled on request and cached; build time no longer grows with the number of pages.',
  '<strong>Gộp bài học thành đơn vị học.</strong> Với 10 cuốn IT, 11.580 trang còn 2.257 trang; dấu "Đã học xong" tính theo nhóm bài, không theo từng video.':
    '<strong>Lessons merged into study units.</strong> For the 10 IT books, 11,580 pages became 2,257; the "Done" mark counts per lesson group, not per video.',
  '<strong>Không gọi LLM trong request của người dùng.</strong> Mọi lần gọi đi qua bảng Job và cron, nên lỗi 429 hay hết ngân sách chỉ làm job chờ lần chạy sau.':
    '<strong>No LLM calls inside a user request.</strong> Every call goes through the Job table and cron, so a 429 error or a spent budget only makes the job wait for the next run.',
  '<strong>Riêng tư theo thiết kế.</strong> Nội dung ghi chú không bao giờ được gửi cho LLM; với inbox chỉ gửi tiêu đề, tên site và 500 ký tự đầu.':
    '<strong>Private by design.</strong> Note content is never sent to an LLM; for the inbox, only the title, the site name and the first 500 characters are sent.',
  '<strong>Không request ra domain ngoài lúc chạy.</strong> Font qua next/font, Mermaid tự host, ảnh thu nhỏ tải lúc ingest qua bộ chống SSRF và lưu thành webp tối đa 200 KB.':
    '<strong>No requests to outside domains at runtime.</strong> Fonts through next/font, Mermaid self-hosted, thumbnails fetched at ingest through an SSRF guard and stored as webp of at most 200 KB.',
  '<strong>"Không bị tụt lại" không đo bằng số.</strong> Kỹ năng tự mờ theo ngày của bằng chứng mới nhất (3 và 6 tháng) và được so với tin tuyển dụng thật, không tự chấm điểm.':
    '<strong>"Not falling behind" is not measured with a number.</strong> Skills fade by the date of their newest evidence (3 and 6 months) and are compared with real job ads, with no self-rating.',
  '<strong>Phạm vi hẹp có chủ đích.</strong> Không lịch, không task manager, không hóa đơn, không CRM; sidebar tối đa 6 khu vực.':
    '<strong>A deliberately narrow scope.</strong> No calendar, no task manager, no invoices, no CRM; at most 6 areas in the sidebar.',
  'case::Kết quả': 'Results',
  'Những gì đang có (02/11/2026), chạy trên máy dev:': 'What exists (02/11/2026), running on the dev machine:',
  '{books} sổ tay, {lessons} bài học trên một site có tìm kiếm toàn văn; tiến độ học lưu qua API. Bản mã nguồn công khai kèm một sổ tay mẫu thay cho các sổ tay đó.':
    '{books} handbooks, {lessons} lessons on one site with full-text search; study progress saved through the API. The public source code ships with one sample handbook in their place.',
  'Đủ sáu bước của thứ tự xây: Inbox + Item, Tuần (kế hoạch, nhìn lại, biểu đồ giờ), Công việc (dự án, giờ, giá giờ thực tế), Cơ hội (bằng chứng, điểm có lịch sử, đánh dấu sau 4 tuần không có bằng chứng), Kỹ năng + Thị trường (độ mới, rút kỹ năng từ tin tuyển dụng), Bản tin sáng (RSS, gắn tag, một bản tin mỗi ngày).':
    'All six steps of the build order: Inbox + Item, Week (plan, review, time chart), Work (projects, time, effective hourly rate), Opportunities (evidence, scores with a history, a flag after 4 weeks without evidence), Skills + Market (freshness, skills extracted from job ads), Morning brief (RSS, tagging, one brief a day).',
  'Thêm: ghi chú markdown, nhật ký thành tựu, dự đoán chấm lại sau 6 tháng, ⌘K tìm mọi thứ, export markdown và JSON, backup pg_dump có kiểm tra restore, thu thập bằng bookmarklet và share sheet (PWA).':
    'Also: markdown notes, an achievement log, predictions scored after 6 months, ⌘K to search everything, markdown and JSON export, pg_dump backups with a restore check, capture through a bookmarklet and the share sheet (PWA).',
  'AI chạy nền với 4 prompt có version (tag inbox, kỹ năng từ tin tuyển dụng, tag tin, lời mở bản tin) và golden set cho 3 job.':
    "AI runs in the background with 4 versioned prompts (inbox tags, skills from job ads, news tags, the brief's opening line) and golden sets for 3 jobs.",
  '<code>make check</code>: typecheck và lint cho web, ruff, mypy, migrations và pytest cho backend, smoke test, ngân sách 220 kB First Load JS cho trang chủ.':
    '<code>make check</code>: typecheck and lint for the web app, ruff, mypy, migrations and pytest for the backend, a smoke test, a 220 kB First Load JS budget for the home page.',
  'Chưa có: deploy thật, Telegram, trợ lý cho buổi nhìn lại (giai đoạn 3).':
    'Not yet: a real deploy, Telegram, an assistant for the review (phase 3).',
  'Số tuần đã dùng; số lần inbox về 0; chi phí LLM thực tế mỗi tháng (dòng trạng thái ở Hôm nay); thời gian build và RAM khi deploy; số item, ghi chú và bằng chứng sau vài tuần; một quyết định thật mà app giúp đưa ra.':
    'Weeks of use; how often the inbox reached zero; the real LLM cost per month (the status line on Today); build time and RAM when deployed; the number of items, notes and pieces of evidence after a few weeks; one real decision the app helped make.',
  'case::Bài học': 'Lessons learned',
  'Bản nháp, Alex sửa theo trải nghiệm thật.': 'A draft, for Alex to revise from real experience.',
  'Đo trước khi chốt: một cuốn thử đổi cả hướng deploy, rẻ hơn nhiều so với sửa sau.':
    'Measure before committing: one trial book changed the whole deploy plan, far cheaper than fixing it later.',
  'Viết quyết định ra, có ngày: cả agent lẫn chính mình không mở lại câu đã trả lời.':
    'Write decisions down, with a date: neither the agent nor I reopen a question already answered.',
  'Đặt trần chi phí và bảng log từ lần gọi LLM đầu tiên, khi việc đó còn rẻ.':
    'Set a cost cap and a log table from the first LLM call, while that is still cheap.',
  'Golden set nhỏ, kiểm bằng code, chạy trước mỗi lần đổi prompt hay model.':
    'Small golden sets, checked by code, run before every change of prompt or model.',
  'Một nghi thức cố định (buổi nhìn lại tuần) lọc tính năng tốt hơn một danh sách mong muốn.':
    'A fixed ritual (the weekly review) filters features better than a wish list.',
  'Bài học riêng của Alex sau khi dùng app hằng ngày.': "Alex's own lessons after using the app every day.",

  // Guides page (app/[lang]/(home)/huong-dan/page.tsx); the guides themselves are in guides.ts
  'Mỗi trang có một đoạn minh họa ngắn; nếu máy bật giảm chuyển động, bạn thấy một khung hình tĩnh.':
    'Each page has a short animated demo; with reduced motion turned on, you see a still frame.',
  'Dán link vào ô Thu thập nhanh, nhấn ⌘↵. Thẻ hiện ngay, ảnh thu nhỏ và tag được thêm sau trong nền. Esc để rời ô nhập, rồi mỗi phím là một quyết định: J/K đi xuống/lên, L đọc sau, A lưu trữ, O gắn làm bằng chứng cho một cơ hội.':
    'Paste a link into the Quick capture box and press ⌘↵. The card appears at once; the thumbnail and tags are added later in the background. Esc leaves the input, then every key is a decision: J/K down/up, L read later, A archive, O attach as evidence for an opportunity.',
  'Cài một lần: tìm ô "Thu thập từ trình duyệt" trên trang Inbox (bên phải danh sách trên màn hình rộng, bên dưới trên điện thoại), nhấn ⌘⇧B để hiện thanh dấu trang rồi kéo nút Lưu vào Brain lên đó. Sau đó ở trang bất kỳ, bấm Lưu vào Brain trên thanh dấu trang (bôi đen một đoạn trước nếu muốn lưu kèm), rồi nhấn Enter trong cửa sổ nhỏ. Bookmarklet trỏ về đúng địa chỉ bạn kéo nó từ đó.':
    'Set it up once: find the "Capture from the browser" box on the Inbox page (to the right of the list on a wide screen, below it on a phone), press ⌘⇧B to show the bookmarks bar, then drag the Save to Brain button onto it. After that, on any page, click Save to Brain on the bookmarks bar (select a passage first if you want it saved too), then press Enter in the small window. The bookmarklet points back to the exact address you dragged it from.',
  'Mở Tuần': 'Open Week',
  'Mở Giờ': 'Open Time',

  // "Nhập sổ tay" on /huong-dan/ (how handbooks get in: the importer's command)
  'Nhập sổ tay': 'Import a handbook',
  'Sổ tay vào app bằng một lệnh chạy trong thư mục mã nguồn, không qua giao diện. Lệnh đọc một file zip xuất từ GitBook (có <code>SUMMARY.md</code>) hoặc một file HTML đơn, gộp các mục thành trang học, ghi vào <code>web/content/docs/</code>, đăng ký sổ tay và cập nhật chỉ mục tìm kiếm. <code>--track</code> là nhóm của sổ tay: <code>kinh-doanh</code>, <code>it</code> hoặc <code>ky-nang</code>.':
    'A handbook comes into the app with one command run in the source folder, not through the interface. The command reads a zip exported from GitBook (with <code>SUMMARY.md</code>) or a single HTML file, merges the items into learning pages, writes them to <code>web/content/docs/</code>, registers the handbook and updates the search index. <code>--track</code> is the handbook\'s group: <code>kinh-doanh</code> (business), <code>it</code> or <code>ky-nang</code> (skills).',
  'Nhập xong, chạy lại <code>npm run build</code> (hoặc tải lại trang khi đang chạy <code>npm run dev</code>): sổ tay hiện ở trang Sổ tay, tìm được bằng ⌘K, và mỗi trang có ô "Đã học xong" để ghi tiến độ.':
    'After the import, run <code>npm run build</code> again (or reload the page while <code>npm run dev</code> is running): the handbook shows on the Handbooks page, ⌘K finds it, and every page has a "Done" box to record progress.',
} satisfies Dictionary;
