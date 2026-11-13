// The icon of each tool stage (owner 13/11/2026: "mỗi nhóm bạn làm 1 cái icon tương ứng để dễ hình dung", and the
// picture of a tool without an uploaded logo). The stage list itself is lib/tools.ts; this map sits beside it and is
// typed by it, so a new stage cannot go without an icon. lucide only, drawn in ink with the page title's 1.5 line (no
// colour per stage, no tile: DESIGN.md §5); never imported on Hôm nay.
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Bot,
  Boxes,
  CodeXml,
  Database,
  DraftingCompass,
  FileText,
  FlaskConical,
  GitBranch,
  GitPullRequest,
  GraduationCap,
  Microscope,
  PanelsTopLeft,
  Rocket,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import type { ToolGroupKey } from '@/lib/tools';

export const toolStageIcons: Readonly<Record<ToolGroupKey, LucideIcon>> = {
  explore: Microscope,
  practice: GraduationCap,
  plan: DraftingCompass,
  code: CodeXml,
  // an app window: the interface itself
  ui: PanelsTopLeft,
  review: GitPullRequest,
  test: FlaskConical,
  security: ShieldCheck,
  deps: Boxes,
  git: GitBranch,
  ci: Rocket,
  observe: Activity,
  data: Database,
  ai: Bot,
  docs: FileText,
  // "Khác": a tool without a stage (also the Công cụ row's icon in the sidebar)
  other: Wrench,
};
