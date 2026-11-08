import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowDown, CircleAlert } from 'lucide-react';
import { books } from '@/lib/books';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/brain/page-header';
import {
  IntroBrief,
  IntroHero,
  IntroInbox,
  IntroOpportunity,
  IntroSearch,
  IntroSkills,
  IntroWeek,
} from '@/components/stageshow/intro/lazy';
import { PrintButton } from './print-button';
import './intro.css';

export const metadata: Metadata = {
  title: 'Giới thiệu',
  description: "Alex's Brain là gì, làm được gì, và case study về cách nó được xây.",
};

/*
 * Intro page and portfolio case study. Text is server-rendered (it prints and reads without JavaScript); the
 * pictures are Stageshow stages loaded lazily in the browser (components/stageshow/intro/lazy.tsx), so no kit
 * code reaches any page's first load. Facts come from DECISIONS.md (§2, §4, §9, §10), ARCHITECTURE.md and the git
 * history; outcomes the code cannot know are marked "Số liệu: Alex điền" for the owner to fill in.
 */

/** One tile of the feature grid: run-in copy on top, the picture pinned under it. */
function Tile({ area, lead, children, picture }: { area: string; lead: string; children: ReactNode; picture: ReactNode }) {
  return (
    <li className={`intro-tile intro-tile--${area}`}>
      <p className="intro-copy">
        <strong>{lead}</strong> {children}
      </p>
      <div className="intro-pic">{picture}</div>
    </li>
  );
}

/** A slot for a real outcome only the owner knows: visible on screen and on paper until it is filled. */
function Todo({ children }: { children: ReactNode }) {
  return (
    <Alert variant="warning" role="note" className="intro-keep max-w-3xl" data-todo>
      <CircleAlert aria-hidden />
      <AlertTitle>Số liệu: Alex điền</AlertTitle>
      <AlertDescription className="leading-relaxed">{children}</AlertDescription>
    </Alert>
  );
}

function CaseSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="intro-keep flex flex-col gap-3" aria-labelledby={id}>
      <h3 id={id} className="text-sm font-semibold">
        {title}
      </h3>
      {children}
    </section>
  );
}

const p = 'max-w-3xl text-sm leading-relaxed';
const list =
  'flex max-w-3xl list-disc flex-col gap-2 ps-5 text-sm leading-relaxed marker:text-muted-foreground [&_strong]:font-semibold';
const code = 'rounded bg-secondary px-1 py-0.5 font-mono text-[13px]';

/** One box of the architecture figure: a surface (border + card fill, DESIGN.md D29), no shadow. */
function Box({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-card p-4">
      <span className="text-sm font-semibold">{title}</span>
      <span className="text-[13px] leading-relaxed text-muted-foreground">{children}</span>
    </div>
  );
}

function Arrow({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 ps-6 text-xs text-muted-foreground">
      <ArrowDown className="size-4 shrink-0" aria-hidden />
      {children}
    </div>
  );
}

export default function IntroPage() {
  const lessons = books.reduce((n, b) => n + b.lessonCount, 0);
  const lessonsText = lessons.toLocaleString('vi-VN');

  return (
    <div className="intro-page flex w-full flex-col">
      <PageHeader
        title="Alex's Brain"
        description={
          <>
            Một nơi duy nhất cho việc học, công việc và phát triển bản thân: {books.length} sổ tay với {lessonsText} bài
            học, một inbox, kế hoạch và nhìn lại mỗi tuần, cơ hội kinh doanh có bằng chứng, kỹ năng tự mờ theo thời gian
            và bản tin sáng. Tự host, đăng nhập mới vào được, dữ liệu là của Alex.
          </>
        }
      >
        <div className="intro-noprint flex flex-wrap gap-2">
          <Button variant="ghost" render={<a href="#tinh-nang" />}>
            Tính năng
          </Button>
          <Button variant="ghost" render={<a href="#case-study" />}>
            Case study
          </Button>
          <PrintButton className="max-sm:hidden" />
        </div>
      </PageHeader>

      <section className="px-4 pb-10 sm:px-8" aria-label="Màn hình Hôm nay">
        <div className="intro-cq">
          <div className="intro-tile intro-hero">
            <div className="intro-pic">
              <IntroHero />
            </div>
          </div>
        </div>
      </section>

      <section
        id="tinh-nang"
        className="flex flex-col gap-6 border-t px-4 py-10 sm:px-8 md:py-12"
        aria-labelledby="tinh-nang-title"
      >
        <div className="flex flex-col gap-2">
          <h2 id="tinh-nang-title" className="font-heading text-lg font-semibold tracking-tight">
            Làm được gì
          </h2>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Xương sống của app là buổi nhìn lại 15 phút cuối tuần: inbox về 0 chưa, ba ưu tiên xong chưa, cơ hội nào có
            thêm bằng chứng, tuần tới làm gì. Tính năng nào không đổi được một quyết định trong buổi đó thì không xây.
          </p>
        </div>
        <div className="intro-cq">
          <ul className="intro-grid">
            <Tile area="inbox" lead="Một inbox, mỗi phím một quyết định." picture={<IntroInbox />}>
              Link bỏ vào được gắn tag, tóm tắt và gợi ý nơi đến trong nền; J/K để đi, L đọc sau, A lưu trữ, O làm bằng
              chứng cho một cơ hội.
            </Tile>
            <Tile area="search" lead="⌘K tìm mọi thứ." picture={<IntroSearch />}>
              Bài học trong sổ tay, thư viện, ghi chú, inbox, cơ hội và bản tin, trong một ô.
            </Tile>
            <Tile area="week" lead="Tuần: ba ưu tiên, rồi nhìn lại." picture={<IntroWeek />}>
              Giờ cho mục tiêu so với giờ khác, theo từng ngày, từ giờ làm thật.
            </Tile>
            <Tile area="opp" lead="Cơ hội là giả thuyết." picture={<IntroOpportunity />}>
              Bằng chứng ủng hộ hay phản bác, bốn điểm tự chấm có lịch sử.
            </Tile>
            <Tile area="skills" lead="Kỹ năng tự mờ." picture={<IntroSkills />}>
              Không có bằng chứng mới trong 6 tháng thì nhạt màu; không tự chấm điểm.
            </Tile>
            <Tile area="brief" lead="Bản tin sáng, 6:30." picture={<IntroBrief />}>
              Tin từ nguồn tự chọn, được gắn tag; một chạm vào inbox hoặc làm bằng chứng.
            </Tile>
          </ul>
        </div>
        <p className="intro-noprint text-sm text-muted-foreground">
          Muốn xem từng trang hoạt động thế nào?{' '}
          <Link href="/huong-dan/" className="text-primary underline-offset-4 hover:underline">
            Xem mọi hướng dẫn
          </Link>
        </p>
      </section>

      <section
        id="case-study"
        className="intro-case flex flex-col gap-8 border-t px-4 py-10 sm:px-8 md:py-12"
        aria-labelledby="case-study-title"
      >
        <div className="flex flex-col gap-2">
          <h2 id="case-study-title" className="font-heading text-lg font-semibold tracking-tight">
            Alex&apos;s Brain: một second brain tự host, xây trong vài ngày với một agent
          </h2>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Next.js 16 + Fumadocs, Django 5.2 + DRF, Postgres 16, một chỗ gọi LLM có trần chi phí. Bắt đầu 31/10/2026;
            trang này mô tả trạng thái ngày 02/11/2026.
          </p>
        </div>

        <CaseSection id="cs-boi-canh" title="Bối cảnh">
          <p className={p}>
            Alex là người dùng duy nhất của app.
            Tài liệu học là {books.length} sổ tay từ các khóa Coursera và F8, ở dạng file HTML và markdown xuất từ GitBook.
            Việc học, dự án cho khách, tin tức và ý tưởng kinh doanh nằm ở nhiều nơi khác nhau.
          </p>
          <Todo>Vai trò của Alex trong dự án (ý tưởng, quyết định, review), số giờ đã bỏ ra.</Todo>
        </CaseSection>

        <CaseSection id="cs-van-de" title="Vấn đề">
          <ul className={list}>
            <li>
              Nội dung lớn hơn dự tính: 18.792 trang cho 15 cuốn. Static export của một cuốn thử (2.434 trang) ra 1,9 GB;
              ngoại suy cho tất cả là 14 GB, tối ưu hết cũng còn 1,3 đến 1,6 GB, trong khi Cloudflare Pages giới hạn
              20.000 file mỗi lần deploy.
            </li>
            <li>
              Không có chỗ nào trả lời được: tuần này có tiến lên không, kỹ năng nào đang cũ đi so với thị trường, cơ hội
              nào có thêm bằng chứng.
            </li>
            <li>
              Muốn dùng AI để gắn tag và tóm tắt, nhưng chi phí phải có trần và ghi chú riêng tư không được gửi ra ngoài.
            </li>
          </ul>
        </CaseSection>

        <CaseSection id="cs-cach-lam" title="Cách làm">
          <ul className={list}>
            <li>
              Brainstorm rồi ghi lại trong <code className={code}>DECISIONS.md</code>: mỗi quyết định có ngày, đóng vai
              trò ADR, để session sau không mở lại câu đã trả lời.
            </li>
            <li>
              Pilot trước khi chốt: nhập thử một cuốn, đo thời gian build (96 giây), RAM (1,95 GB) và dung lượng, rồi đổi
              kiến trúc theo số đo.
            </li>
            <li>
              Xây theo thứ tự phục vụ buổi nhìn lại tuần: Inbox + Item, Tuần, Công việc, Cơ hội, Kỹ năng + Thị trường, Bản
              tin sáng.
            </li>
            <li>
              Mỗi bước một commit nhỏ, chỉ commit khi <code className={code}>make check</code> qua; sau mỗi phần lớn có một
              vòng review và một commit sửa riêng.
            </li>
            <li>
              Code được viết cùng Claude Code theo luật trong <code className={code}>CLAUDE.md</code>; quyết định sản phẩm
              nằm ở <code className={code}>DECISIONS.md</code>.
            </li>
          </ul>
        </CaseSection>

        <CaseSection id="cs-kien-truc" title="Kiến trúc">
          <figure className="intro-keep flex max-w-3xl flex-col gap-2" aria-label="Sơ đồ kiến trúc">
            <Box title="Trình duyệt hoặc PWA">Một origin, một lần đăng nhập.</Box>
            <Arrow>Cloudflare Tunnel + Access: không mở cổng nào, Access đứng trước mọi request</Arrow>
            <Box title="nginx">
              <code>/api</code>, <code>/admin</code>, <code>/files</code> sang Django; mọi thứ khác sang Next.
            </Box>
            <div className="grid gap-2 sm:grid-cols-2">
              <Box title="Next.js 16 + Fumadocs">
                Chỉ render. Sổ tay là markdown trên đĩa, compile khi có request, tìm kiếm SQLite FTS5. Không có code auth;{' '}
                <code>web/lib/api/</code> là chỗ duy nhất gọi backend, type sinh từ OpenAPI.
              </Box>
              <Box title="Django 5.2 + DRF → Postgres 16">
                Sở hữu dữ liệu và auth (xác minh JWT của Cloudflare Access). Logic ở <code>services/</code>, view mỏng,
                phân trang cursor.
              </Box>
            </div>
            <Arrow>cron chạy manage.py run_jobs: chỗ duy nhất có request ra ngoài</Arrow>
            <Box title="Job nền → core/services/llm.py">
              Một chỗ gọi LLM: đếm token, từ chối khi chi phí tháng cộng ước tính vượt 5 USD, ghi mọi lần gọi vào{' '}
              <code>LlmCall</code>, cache theo hash nội dung, đầu ra là JSON theo schema và được kiểm bằng pydantic. Prompt
              có version, golden set chạy bằng <code>manage.py eval</code>. Hiện dùng Gemini gói miễn phí; đổi sang Claude
              là thêm một nhánh trong file này.
            </Box>
            <figcaption className="pt-1 text-xs text-muted-foreground">
              Cấu hình nginx, Cloudflare Tunnel và Access đã viết trong <code>deploy/</code>, chưa triển khai.
            </figcaption>
          </figure>
        </CaseSection>

        <CaseSection id="cs-quyet-dinh" title="Quyết định đáng chú ý">
          <ul className={list}>
            <li>
              <strong>Server mode thay static export.</strong> Next chạy <code className={code}>standalone</code>, nội dung
              compile khi có request và được cache; thời gian build không còn tăng theo số trang.
            </li>
            <li>
              <strong>Gộp bài học thành đơn vị học.</strong> Với 10 cuốn IT, 11.580 trang còn 2.257 trang; dấu &quot;Đã
              học xong&quot; tính theo nhóm bài, không theo từng video.
            </li>
            <li>
              <strong>Không gọi LLM trong request của người dùng.</strong> Mọi lần gọi đi qua bảng Job và cron, nên lỗi
              429 hay hết ngân sách chỉ làm job chờ lần chạy sau.
            </li>
            <li>
              <strong>Riêng tư theo thiết kế.</strong> Nội dung ghi chú không bao giờ được gửi cho LLM; với inbox chỉ gửi
              tiêu đề, tên site và 500 ký tự đầu.
            </li>
            <li>
              <strong>Không request ra domain ngoài lúc chạy.</strong> Font qua next/font, Mermaid tự host, ảnh thu nhỏ tải
              lúc ingest qua bộ chống SSRF và lưu thành webp tối đa 200 KB.
            </li>
            <li>
              <strong>&quot;Không bị tụt lại&quot; không đo bằng số.</strong> Kỹ năng tự mờ theo ngày của bằng chứng mới
              nhất (3 và 6 tháng) và được so với tin tuyển dụng thật, không tự chấm điểm.
            </li>
            <li>
              <strong>Phạm vi hẹp có chủ đích.</strong> Không lịch, không task manager, không hóa đơn, không CRM; sidebar
              tối đa 6 khu vực.
            </li>
          </ul>
        </CaseSection>

        <CaseSection id="cs-ket-qua" title="Kết quả">
          <p className={p}>Những gì đang có (02/11/2026), chạy trên máy dev:</p>
          <ul className={list}>
            <li>
              {books.length} sổ tay, {lessonsText} bài học trên một site có tìm kiếm toàn văn; tiến độ học lưu qua API.
            </li>
            <li>
              Đủ sáu bước của thứ tự xây: Inbox + Item, Tuần (kế hoạch, nhìn lại, biểu đồ giờ), Công việc (dự án, giờ, giá
              giờ thực tế), Cơ hội (bằng chứng, điểm có lịch sử, đánh dấu sau 4 tuần không có bằng chứng), Kỹ năng + Thị
              trường (độ mới, rút kỹ năng từ tin tuyển dụng), Bản tin sáng (RSS, gắn tag, một bản tin mỗi ngày).
            </li>
            <li>
              Thêm: ghi chú markdown, nhật ký thành tựu, dự đoán chấm lại sau 6 tháng, ⌘K tìm mọi thứ, export markdown và
              JSON, backup pg_dump có kiểm tra restore, thu thập bằng bookmarklet và share sheet (PWA).
            </li>
            <li>
              AI chạy nền với 4 prompt có version (tag inbox, kỹ năng từ tin tuyển dụng, tag tin, lời mở bản tin) và golden
              set cho 3 job.
            </li>
            <li>
              <code className={code}>make check</code>: typecheck và lint cho web, ruff, mypy, migrations và pytest cho
              backend, smoke test, ngân sách 220 kB First Load JS cho trang chủ.
            </li>
            <li>Chưa có: deploy thật, Telegram, trợ lý cho buổi nhìn lại (giai đoạn 3).</li>
          </ul>
          <Todo>
            Số tuần đã dùng; số lần inbox về 0; chi phí LLM thực tế mỗi tháng (dòng trạng thái ở Hôm nay); thời gian build và RAM
            khi deploy; số item, ghi chú và bằng chứng sau vài tuần; một quyết định thật mà app giúp đưa ra.
          </Todo>
        </CaseSection>

        <CaseSection id="cs-bai-hoc" title="Bài học">
          <p className="max-w-3xl text-sm text-muted-foreground">Bản nháp, Alex sửa theo trải nghiệm thật.</p>
          <ul className={list}>
            <li>Đo trước khi chốt: một cuốn thử đổi cả hướng deploy, rẻ hơn nhiều so với sửa sau.</li>
            <li>Viết quyết định ra, có ngày: cả agent lẫn chính mình không mở lại câu đã trả lời.</li>
            <li>Đặt trần chi phí và bảng log từ lần gọi LLM đầu tiên, khi việc đó còn rẻ.</li>
            <li>Golden set nhỏ, kiểm bằng code, chạy trước mỗi lần đổi prompt hay model.</li>
            <li>Một nghi thức cố định (buổi nhìn lại tuần) lọc tính năng tốt hơn một danh sách mong muốn.</li>
          </ul>
          <Todo>Bài học riêng của Alex sau khi dùng app hằng ngày.</Todo>
        </CaseSection>
      </section>

      <footer className="intro-noprint flex flex-wrap items-center gap-x-4 gap-y-2 border-t px-4 py-6 text-sm text-muted-foreground sm:px-8">
        <Link href="/" className="hover:text-foreground">
          ← Hôm nay
        </Link>
        <Link href="/phat-trien/" className="hover:text-foreground">
          Sổ tay
        </Link>
        <Link href="/huong-dan/" className="hover:text-foreground">
          Hướng dẫn
        </Link>
      </footer>
    </div>
  );
}
