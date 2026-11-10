# UI languages: Vietnamese and English

Since 08/11/2026 (DECISIONS 9.9): Vietnamese stays the default and the language the code is written in; English is a
second language for the whole app UI. Lesson content (the imported handbooks), the owner's data and LLM output are
not translated.

## How it works

* **One URL, two prerendered pages.** Every page lives under `app/[lang]/` and is prerendered for `vi` and `en`
  (`generateStaticParams` in `app/[lang]/layout.tsx`; lesson pages render on request per language). The rewrites in
  `next.config.mjs` send `/thu-vien/` to `/vi/thu-vien/` or, with the cookie `lang=en`, to `/en/thu-vien/`. `/en/...`
  also opens a page in English directly. Route handlers (`/api/search`, `/trees/`) and `public/` files are not
  rewritten.
* **The switch** (`components/language-switch.tsx` in the top bar; Fumadocs' own switch in the lesson sidebar) sets
  the cookie and reloads (`switchLocale` in `client.tsx`). Django answers in the page's language: `lib/api/client.ts`
  sends the page's `<html lang>` as the `X-UI-Lang` header, and the same cookie is the fallback
  (`backend/core/middleware.py`).
* **Paths:** `usePathname()` says `/en/thu-vien` on the server and `/thu-vien/` in the browser. Render with
  `useAppPathname()` (`lib/use-app-pathname.ts`, the path without the language); navigate within a page
  (`router.replace`/`push`) with `useRoutePathname()`, the browser's own path, so a page opened at `/en/...` stays
  English. ESLint forbids `usePathname()` itself.
* **Text:** the Vietnamese text stays in the code and is its own key (gettext style). `t('Lưu')` shows "Lưu" in
  Vietnamese and looks up "Save" in English. The English lives in `lib/i18n/en/<area>.ts`.
* **No English in the JS bundles.** The root layout sends the page dictionary (`enPage`) inside the RSC payload of
  English pages only; Vietnamese pages need no dictionary. The Stageshow guides and the intro pictures load lazily
  and bring their own dictionary: `useT(guides)`, `useT(intro)`.

## Writing UI text

| Where | How |
| --- | --- |
| Client component | `const t = useT();` (`@/lib/i18n/client`), then `{t('Lưu')}`, `aria-label={t('Đóng')}` |
| Server component, `generateMetadata` | `const t = await getT();` (`@/lib/i18n/server`) |
| Data, label lists, nav rows | `label: msg('Dự định')` (`@/lib/i18n/translate`, type `Msg`), shown with `t(label)`. JSX refuses a `Msg`, so a missing `t()` is a type error |
| A helper that builds text | takes `t: T` as a parameter: `formatMinutes(m, t)` |
| Numbers | `t.num(4746)` -> "4.746" / "4,746"; `{n}` is grouped in English only ("4746" / "4,746"), like `t.count(x)` for another count in the same text; a number Vietnamese showed grouped goes through `t.num` in its own placeholder; `Intl` gets `t.intl` ("vi-VN" / "en-GB") |
| Placeholders | `t('Đã lưu {title}', { title })`. Never glue translated pieces into a sentence |
| A count | `t('{n} ghi chú', { n })`, English `{ one: '{n} note', other: '{n} notes' }` (the count is always `n`) |
| Markup inside a sentence | `t.rich('Bấm <k>⌘K</k> để tìm', { k: (c) => <Kbd>{c}</Kbd> })`; `{name}` takes a node too |
| Same Vietnamese, two meanings | `t('Mở', null, 'status')` / `msg('Dự án', 'nav')`, English key `'status::Mở'` / `'nav::Dự án'` (rare; the sidebar uses `nav`: "Projects" beside the type "Project") |
| Text that must stay Vietnamese | end the line with `// i18n-ignore: <why>`; a whole file: `i18n-ignore-file` |
| Handbook text outside its lesson (a page or folder title, a description, a heading) | `{contentText(title, t.locale)}` (`@/lib/i18n/content-lang`), never `t()`: on English pages its Vietnamese parts get `lang="vi"`, see below |

Then add the English to the area file (`common.ts` for words that several areas share, `shell.ts`, `today.ts`,
`inbox.ts`, `library.ts`, `week.ts`, `work.ts`, `opportunities.ts`, `growth.ts`, `about.ts` for the text of
/gioi-thieu/ and /huong-dan/, `intro.ts` for the intro pictures only, `guides.ts`): the key is the Vietnamese
exactly as in the code, including its punctuation. One key lives in one file.

`lib/i18n/coverage.test.ts` (part of `make check`) fails on Vietnamese shown without `t()`, a key without English, an
unused or duplicated entry, and a `{placeholder}` or `<tag>` the English lost. It cannot see Vietnamese written
without diacritics ("Phim"): those need `t()`/`msg()` by hand.

## Handbook text in the UI

The lessons are not translated, and the lesson page marks its title, headings and body `lang="vi"` as one block. A
handbook title or description quoted anywhere else (the Hôm nay hero, "Gần nhất: …" on Sổ tay, the lesson sidebar and
the page name in its table-of-contents bar, breadcrumbs, previous/next links, Cmd+K) is printed with
`contentText(text, t.locale)` (`content-lang.ts`). On English pages the text is cut where titles join their parts
(" · ", " — ", " – ", ". ") and each run of parts with a Vietnamese letter goes in `<span lang="vi">` (ă đ ĩ ũ ơ ư
or a tone mark only Vietnamese writes; à é ô and the other accents French and Spanish share count only inside one
Vietnamese syllable, so "clichés" or "Ángel" in an English lesson stays unmarked); the rest keeps the page's language.
A mixed title comes back as one `<span>` around its runs: the lesson sidebar's rows are flex rows, where loose runs
would become side-by-side flex items. Of the author's 5,917 page, folder and separator titles in 11/2026,
4,200 have no Vietnamese letter ("31.2. MCP Server", Coursera names), 842 are Vietnamese and 875 are an English title
with a Vietnamese label ("Module 8.4 · Week 8: Deferred Taxes — Phần 4", "Khóa 1. …"), so a whole title marked
`lang="vi"` would have a screen reader read English with a Vietnamese voice (WCAG 2.2 SC 3.1.2, Language of Parts).
Vietnamese pages print the text as it is. Pass the text you print, never a stored title that UI text replaces (the
hero's `t('Mở đầu sổ tay')`). Vietnamese written without diacritics ("2.20 Comment trong HTML?") stays unmarked, and
the Vietnamese UI marks nothing `lang="en"`.

## English style

* British English (en-GB formats and a 24-hour clock, but dates without leading zeros, as in Vietnamese: 8/11/2026,
  through `unpadded()` in `lib/labels.ts`): colour, organise, programme for a study programme, but "program" for
  software.
* Sentence case like the Vietnamese ("Thêm item" -> "Add item"), short, plain; the same tone as the Vietnamese:
  friendly, direct, no exclamation marks, no "please" in buttons.
* Keep names: Alex's Brain, Inbox, Coursera, F8, Cloudflare, Django, Gemini, handbook names in `lib/books.ts`
  (translated in `en/shell.ts` from the registry), keyboard keys.

## Glossary

| Vietnamese | English | Note |
| --- | --- | --- |
| Hôm nay | Today | page |
| Tuần, tuần này, tuần tới | Week, this week, next week | page; week starts Monday |
| Phát triển | Growth | sidebar group |
| Sổ tay | Handbooks (page), handbook | the imported study handbooks |
| Lộ trình | Roadmap | |
| Kỹ năng | Skills | |
| Thị trường | Market | |
| Nhật ký thành tựu, thành tựu | Achievement log, achievement | the brag document |
| Dự đoán | Prediction | |
| Thư viện | Library | |
| Item | Item | an Item record (book, film, course, article, project) |
| Ghi chú | Note(s) | |
| Cơ hội | Opportunities, opportunity | |
| Bằng chứng | Evidence | for an opportunity or a skill |
| Công việc | Work | sidebar group |
| Dự án | Project(s) | |
| Giờ | Time | the time page; "giờ" as a unit is "h" / "hours" |
| Đồng hồ (bấm giờ) | Timer | |
| Khách | Client | |
| Theo giờ, trọn gói | Hourly, fixed price | billing |
| Giá giờ | Hourly rate | |
| Tính tiền | Billable | |
| Mục tiêu, ưu tiên | Objective, priority | the week's 3 priorities are objectives |
| Nhìn lại (tuần) | Review | |
| Kế hoạch | Plan | |
| Bản tin sáng, bản tin | Morning brief, brief | |
| Tin tuyển dụng | Job ad | |
| Khác | More | sidebar's last group |
| Giới thiệu | About | |
| Hướng dẫn | Guides | |
| Thu thập | Capture | inbox capture |
| Xử lý (inbox) | Triage | |
| Đọc sau | Read later | inbox status |
| Lưu trữ | Archive, archived | |
| Dự định, đang làm, xong, bỏ | Planned, in progress, done, dropped | Item statuses |
| Chưa quyết, giữ, làm, bỏ | Undecided, keep, build, drop | opportunity decisions |
| Còn mới, đang cũ dần, đã mờ | Fresh, ageing, faded | skill freshness |
| tự động | auto | the AI label (DESIGN.md D18) |
| Lưu, Hủy, Xóa, Thêm, Sửa, Đóng | Save, Cancel, Delete, Add, Edit, Close | |
| Thử lại, Tải thêm, Xem tất cả | Try again, Load more, See all | |
| Phím tắt | Keyboard shortcuts | |
| Danh sách, Bảng | List, Board | view switch |
| Bài học, đã học xong | Lesson, done | handbook progress |
| Học ngay, Học tiếp, Ôn lại | Start, Continue, Revisit | the handbook button by progress (`bookVerb`); never "Review", which is the week's (Nhìn lại) |
