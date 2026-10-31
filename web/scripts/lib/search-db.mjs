// Build the full-text search index (SQLite FTS5 via node:sqlite) from web/content/docs.
// One row per heading section; text inside <details> (transcripts, answers) goes to the
// `transcript` column, everything else to `notes`. Ranking: bm25(title 10, notes 5, transcript 1).
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import Slugger from 'github-slugger';
import { WEB_DIR, CONTENT_DIR } from './book-import.mjs';

export const SEARCH_DB = path.resolve(process.env.SEARCH_DB ?? path.join(WEB_DIR, 'data/search.sqlite'));

function openDb() {
  fs.mkdirSync(path.dirname(SEARCH_DB), { recursive: true });
  const db = new DatabaseSync(SEARCH_DB);
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS sections USING fts5(
      title, notes, transcript,
      book UNINDEXED, url UNINDEXED, anchor UNINDEXED, page_title UNINDEXED, heading UNINDEXED,
      tokenize = "unicode61 remove_diacritics 0"
    );
  `);
  return db;
}

function stripFrontmatter(text) {
  if (!text.startsWith('---\n')) return { title: '', body: text };
  const end = text.indexOf('\n---\n', 4);
  const head = text.slice(4, end);
  const m = head.match(/^title:\s*(.*)$/m);
  let title = '';
  if (m) {
    try {
      title = JSON.parse(m[1]);
    } catch {
      title = m[1];
    }
  }
  return { title, body: text.slice(end + 5) };
}

const plain = (s) =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^:::\w*\s*$/gm, ' ')
    .replace(/[*_`>#|~]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Split a page body into heading sections; anchors follow Fumadocs remarkHeading rules. */
export function pageSections(body) {
  const slugger = new Slugger();
  const sections = [{ heading: null, anchor: null, lines: [] }];
  let fence = null;
  for (const line of body.split('\n')) {
    const f = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (f) {
      if (!fence) fence = f[1];
      else if (f[1][0] === fence[0] && f[1].length >= fence.length) fence = null;
    }
    const h = !fence && !f && line.match(/^#{1,6}\s+(.+?)\s*#*\s*$/);
    if (h) {
      let text = h[1];
      let anchor;
      const custom = text.match(/\s*\[#([^\]]+)\]$/);
      if (custom) {
        anchor = custom[1];
        text = text.slice(0, custom.index);
      } else {
        anchor = slugger.slug(plain(text));
      }
      sections.push({ heading: plain(text), anchor, lines: [] });
    } else sections[sections.length - 1].lines.push(line);
  }
  return sections.map((s) => {
    const raw = s.lines.join('\n');
    const transcript = [...raw.matchAll(/<details[\s\S]*?<\/details>/g)].map((m) => m[0]).join('\n');
    const notes = raw.replace(/<details[\s\S]*?<\/details>/g, ' ');
    return { heading: s.heading, anchor: s.anchor, notes: plain(notes), transcript: plain(transcript) };
  });
}

function urlOf(relPath) {
  return `/docs/${relPath.replace(/(^|\/)index\.md$/, '').replace(/\.md$/, '')}`.replace(/\/$/, '') + '/';
}

/** Re-index one book (or every book when `only` is empty). Returns { pages, rows }. */
export function rebuildSearch(only = []) {
  const db = openDb();
  const insert = db.prepare(
    'INSERT INTO sections (title, notes, transcript, book, url, anchor, page_title, heading) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  );
  let pages = 0;
  let rows = 0;
  db.exec('BEGIN');
  try {
    if (only.length === 0) db.exec('DELETE FROM sections');
    else for (const b of only) db.prepare('DELETE FROM sections WHERE book = ?').run(b);

    for (const track of fs.readdirSync(CONTENT_DIR, { withFileTypes: true })) {
      if (!track.isDirectory()) continue;
      for (const book of fs.readdirSync(path.join(CONTENT_DIR, track.name), { withFileTypes: true })) {
        if (!book.isDirectory() || (only.length && !only.includes(book.name))) continue;
        const walk = (dir) => {
          for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const abs = path.join(dir, e.name);
            if (e.isDirectory()) walk(abs);
            else if (e.name.endsWith('.md')) {
              const { title, body } = stripFrontmatter(fs.readFileSync(abs, 'utf8'));
              const url = urlOf(path.relative(CONTENT_DIR, abs).split(path.sep).join('/'));
              for (const s of pageSections(body)) {
                if (!s.heading && !s.notes && !s.transcript) continue;
                insert.run(s.heading ?? title, s.notes, s.transcript, book.name, url, s.anchor ?? '', title, s.heading ?? '');
                rows++;
              }
              // the page title itself is always findable
              insert.run(title, '', '', book.name, url, '', title, '');
              rows++;
              pages++;
            }
          }
        };
        walk(path.join(CONTENT_DIR, track.name, book.name));
      }
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  db.exec("INSERT INTO sections(sections) VALUES ('optimize')");
  db.close();
  return { pages, rows };
}
