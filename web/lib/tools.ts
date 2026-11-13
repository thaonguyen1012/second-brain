// Tools (Items of type tool, the Công cụ page, owner 13/11/2026: the tools senior engineers use at each stage of
// the work, and tools for learning by reading real codebases and by doing). A tool's stages are tags with these slugs,
// the same as backend/library/tools.py STAGES (tools.test.ts compares them), in the order the page shows its groups:
// learning first, since the page sits under Phát triển. The icon of each stage is in lib/tool-icons.ts, beside this
// list (its own module, so lib/item-picture.ts can ask for a tool's first stage without shipping the icons).
import type { ApiItem, ApiItemStatus } from '@/lib/api/client';
import { msg, type Msg } from '@/lib/i18n/translate';

export const TOOL_STAGES = [
  { slug: 'explore', label: msg('Đọc & mổ xẻ codebase') },
  { slug: 'practice', label: msg('Học qua thực hành') },
  { slug: 'plan', label: msg('Lên kế hoạch & thiết kế') },
  { slug: 'code', label: msg('Viết code') },
  // UI and animation libraries, UI tools and design references (owner 13/11/2026, from haidave-com.vercel.app/resources)
  { slug: 'ui', label: msg('Giao diện & thư viện UI') },
  { slug: 'review', label: msg('Review code') },
  { slug: 'test', label: msg('Kiểm thử') },
  { slug: 'security', label: msg('Bảo mật') },
  { slug: 'deps', label: msg('Phụ thuộc & chuỗi cung ứng') },
  { slug: 'git', label: msg('Git & lịch sử') },
  { slug: 'ci', label: msg('CI/CD & deploy') },
  { slug: 'observe', label: msg('Giám sát & log') },
  { slug: 'data', label: msg('Dữ liệu & DB') },
  { slug: 'ai', label: msg('AI & LLM') },
  { slug: 'docs', label: msg('Tài liệu & sơ đồ') },
] as const satisfies readonly { slug: string; label: Msg }[];

export type ToolStage = (typeof TOOL_STAGES)[number]['slug'];

/** A group on the page: a stage, or 'other' for the tools without any stage tag ("Khác", last). */
export type ToolGroupKey = ToolStage | 'other';

const ORDER = new Map<string, number>(TOOL_STAGES.map((s, i) => [s.slug, i]));

export const isToolStage = (tag: string): tag is ToolStage => ORDER.has(tag);

/** The label of a group: the stage's, or "Khác". */
export const toolGroupLabel = (key: ToolGroupKey): Msg =>
  key === 'other' ? msg('Khác') : TOOL_STAGES[ORDER.get(key) ?? 0].label;

/** A tool's stages among its tags, in the page's order, each once. */
export function toolStagesOf(tags: readonly string[] | null | undefined): ToolStage[] {
  const set = new Set(tags ?? []);
  return TOOL_STAGES.filter((s) => set.has(s.slug)).map((s) => s.slug);
}

/** The stage a tool's picture stands for when it has no logo: its first stage in the page's order, or null. */
export function firstToolStage(tags: readonly string[] | null | undefined): ToolStage | null {
  return toolStagesOf(tags)[0] ?? null;
}

/** A tool's tags split for the dialog: the stages (the picker) and every other tag (the text field), order kept. */
export function splitStageTags(tags: readonly string[]): { stages: ToolStage[]; rest: string[] } {
  return { stages: toolStagesOf(tags), rest: tags.filter((tag) => !isToolStage(tag)) };
}

/** The status filter of the page: every tool, or one status. */
export type ToolStatusFilter = ApiItemStatus | 'all';

export interface ToolGroup<T> {
  key: ToolGroupKey;
  tools: T[];
}

/**
 * The page's groups: one per stage in TOOL_STAGES order, then "Khác" for tools without a stage; a tool with several
 * stages shows under each of them. Empty groups are left out. Within a group, tools sort by title (case and accents
 * aside). `stage` keeps one group ('all' keeps them all); `status` keeps the tools in that status.
 */
export function groupTools<T extends Pick<ApiItem, 'title' | 'tags' | 'status'>>(
  tools: readonly T[],
  { status = 'all', stage = 'all' }: { status?: ToolStatusFilter; stage?: ToolGroupKey | 'all' } = {},
): ToolGroup<T>[] {
  const shown = status === 'all' ? tools : tools.filter((tool) => tool.status === status);
  const groups = new Map<ToolGroupKey, T[]>([...TOOL_STAGES.map((s) => [s.slug, []] as [ToolGroupKey, T[]]), ['other', []]]);
  for (const tool of shown) {
    const stages = toolStagesOf(tool.tags);
    for (const key of stages.length ? stages : (['other'] as const)) groups.get(key)?.push(tool);
  }
  const byTitle = (a: T, b: T) => a.title.localeCompare(b.title, 'vi', { sensitivity: 'base' });
  return [...groups]
    .filter(([key, list]) => list.length > 0 && (stage === 'all' || key === stage))
    .map(([key, list]) => ({ key, tools: [...list].sort(byTitle) }));
}
