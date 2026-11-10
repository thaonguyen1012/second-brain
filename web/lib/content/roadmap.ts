// The study roadmap is the owner's data, like the handbooks: a JSON file on disk beside CONTENT_DIR
// (content/roadmap.json, or ROADMAP_FILE), never bundled. /lo-trinh/ reads it on every request; the sidebar row,
// the Sổ tay button and the "Hôm nay" blocks follow the file as it was when the app was built (they sit in
// prerendered shells, like the handbook registry). No file: no row, and the page shows how to add one.
//
// Shape (README "Roadmap"): a main timeline of phases, each with a month range and its items, and an optional
// second timeline of stages (what to study and the piece of work that closes the stage), shown on "Hôm nay" while
// the last visited handbook is of the `it` track. Every text is a string, or { "vi": "...", "en": "..." } to show
// English on English pages; `books` are handbook slugs of lib/books.ts (unknown ones are ignored by the pages).
import fs from 'node:fs';
import path from 'node:path';
import { CONTENT_DIR } from './config';

export const ROADMAP_FILE = path.resolve(process.env.ROADMAP_FILE ?? path.join(CONTENT_DIR, '..', 'roadmap.json'));

/** A text of the roadmap: one string for both languages, or one per language (English falls back to `vi`). */
export type RoadmapText = string | { vi: string; en?: string };

export interface RoadmapLink {
  label: string;
  url: string;
}

export interface RoadmapItem {
  text: RoadmapText;
  books: string[];
  links: RoadmapLink[];
}

export interface RoadmapPhase {
  /** "Giai đoạn 1, nền": its number, a comma, its theme (the part before the comma names the phase on "Hôm nay"). */
  name: RoadmapText;
  /** Month from and to, counted from the start. */
  months: [number, number];
  items: RoadmapItem[];
}

export interface RoadmapStage {
  /** Month from and to; null for a stage that runs alongside the others. */
  months: [number, number] | null;
  study: RoadmapText;
  outcome: RoadmapText;
  books: string[];
  links: RoadmapLink[];
}

export interface Roadmap {
  roadmapIntro: RoadmapText;
  businessPhases: RoadmapPhase[];
  /** Heading of the second timeline; with no stages the section is not shown. */
  itTitle: RoadmapText;
  itStages: RoadmapStage[];
  /** A fuller document under public/ (a same-origin path such as "/roadmap.pdf") and one line about it. */
  pdf: { href: string; note: RoadmapText } | null;
}

/** The text in the page's language. */
export function roadmapText(text: RoadmapText, locale: string): string {
  if (typeof text === 'string') return text;
  return locale === 'en' ? (text.en ?? text.vi) : text.vi;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

function text(v: unknown): RoadmapText | null {
  if (typeof v === 'string') return v.trim() ? v : null;
  if (isRecord(v) && typeof v.vi === 'string' && v.vi.trim()) {
    return typeof v.en === 'string' && v.en.trim() ? { vi: v.vi, en: v.en } : { vi: v.vi };
  }
  return null;
}

function months(v: unknown): [number, number] | null {
  if (!Array.isArray(v) || v.length !== 2) return null;
  const [from, to] = v;
  return typeof from === 'number' && typeof to === 'number' && Number.isFinite(from) && Number.isFinite(to)
    ? [from, to]
    : null;
}

const slugs = (v: unknown): string[] => list(v).filter((s): s is string => typeof s === 'string' && s.length > 0);

/** Only http(s) links leave the site; anything else in the file is dropped. */
function links(v: unknown): RoadmapLink[] {
  return list(v).flatMap((l) => {
    if (!isRecord(l) || typeof l.label !== 'string' || typeof l.url !== 'string') return [];
    return /^https?:\/\/\S+$/i.test(l.url) && l.label.trim() ? [{ label: l.label, url: l.url }] : [];
  });
}

/**
 * The roadmap a parsed JSON value describes: malformed phases, items, stages and links are left out instead of
 * failing the page. Null when nothing usable is left (no phase with an item and no stage).
 */
export function parseRoadmap(json: unknown): Roadmap | null {
  if (!isRecord(json)) return null;
  const businessPhases = list(json.businessPhases).flatMap((p): RoadmapPhase[] => {
    if (!isRecord(p)) return [];
    const name = text(p.name);
    const range = months(p.months);
    const items = list(p.items).flatMap((i): RoadmapItem[] => {
      if (!isRecord(i)) return [];
      const label = text(i.text);
      return label ? [{ text: label, books: slugs(i.books), links: links(i.links) }] : [];
    });
    return name && range && items.length ? [{ name, months: range, items }] : [];
  });
  const itStages = list(json.itStages).flatMap((s): RoadmapStage[] => {
    if (!isRecord(s)) return [];
    const study = text(s.study);
    const outcome = text(s.outcome);
    return study && outcome
      ? [{ months: months(s.months), study, outcome, books: slugs(s.books), links: links(s.links) }]
      : [];
  });
  if (businessPhases.length === 0 && itStages.length === 0) return null;
  const pdf = isRecord(json.pdf) && typeof json.pdf.href === 'string' && /^\/[^/]/.test(json.pdf.href) ? json.pdf : null;
  return {
    roadmapIntro: text(json.roadmapIntro) ?? '',
    businessPhases,
    itTitle: text(json.itTitle) ?? '',
    itStages,
    pdf: pdf ? { href: pdf.href as string, note: text(pdf.note) ?? '' } : null,
  };
}

/** Whether a roadmap file exists (the sidebar row and the Sổ tay button follow it). */
export function hasRoadmap(): boolean {
  return fs.existsSync(ROADMAP_FILE);
}

/** The roadmap on disk, or null when there is no file or it cannot be read (the reason is logged). */
export function loadRoadmap(): Roadmap | null {
  let raw: string;
  try {
    raw = fs.readFileSync(ROADMAP_FILE, 'utf8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') console.error(`roadmap: cannot read ${ROADMAP_FILE}`, e);
    return null;
  }
  try {
    return parseRoadmap(JSON.parse(raw));
  } catch (e) {
    console.error(`roadmap: ${ROADMAP_FILE} is not valid JSON`, e);
    return null;
  }
}
