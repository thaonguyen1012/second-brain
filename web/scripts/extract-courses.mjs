#!/usr/bin/env node
// Collect course facts from the raw materials and attach course links to the registry.
//  1. Reads raw/*.json.gz (and the two inside archive/bo-cong-cu-*.zip), the roadmap PDF links
//     (pdftohtml) and coursera.org URLs inside web/content; writes raw/courses-extracted.json.
//  2. For each book, maps its programs by name to a URL that appears in that data; a program whose
//     URL/slug does not appear gets url: null (the UI then shows a Coursera search link).
// Never prints file contents. Usage: node web/scripts/extract-courses.mjs
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import AdmZip from 'adm-zip';
import { WEB_DIR, CONTENT_DIR } from './lib/book-import.mjs';
import { readRegistry, writeRegistry } from './lib/registry.mjs';

const ROOT = path.resolve(WEB_DIR, '..');
const RAW = path.join(ROOT, 'raw');
const COURSERA = 'https://www.coursera.org/';
const URL_RE = /https?:\/\/(?:www\.)?coursera\.org\/((?:learn|specializations|professional-certificates)\/[a-z0-9-]+)/g;

const known = new Map(); // "learn/x" | "specializations/x" | "professional-certificates/x" -> source
const courses = [];
const add = (key, from) => !known.has(key) && known.set(key, from);

// 1a. materials json
const materials = fs
  .readdirSync(RAW)
  .filter((f) => f.endsWith('.json.gz'))
  .map((f) => ({ name: f, buf: fs.readFileSync(path.join(RAW, f)) }));
for (const e of new AdmZip(path.join(ROOT, 'archive/bo-cong-cu-gitbook-2-cuon-con-lai.zip')).getEntries())
  if (e.entryName.endsWith('.json.gz')) materials.push({ name: path.basename(e.entryName), buf: e.getData() });

// image URL (without query string) -> Coursera lesson that contains it
const imageSources = {};
const imgKey = (u) => u.split('?')[0];

for (const { name, buf } of materials) {
  const text = zlib.gunzipSync(buf).toString('utf8');
  const data = JSON.parse(text);
  for (const c of data.courses ?? []) {
    // item URLs follow the pattern seen in the data: coursera.org/learn/<course>/<type>/<item id>
    for (const m of c.modules ?? [])
      for (const l of m.lessons ?? [])
        for (const it of l.items ?? [])
          for (const img of String(it.html ?? '').matchAll(/<img[^>]+src="([^"]+)"/g))
            if (c.slug && it.id && it.type)
              imageSources[imgKey(img[1].replace(/&amp;/g, '&'))] ??= `${COURSERA}learn/${c.slug}/${it.type}/${it.id}`;
    courses.push({ file: name, slug: c.slug, name: c.name, program: c.program ?? data.program, section: c.section ?? null });
    if (c.slug) add(`learn/${c.slug}`, `${name}: course slug`);
    if (/^(learn|specializations|professional-certificates)\/[a-z0-9-]+$/.test(c.program ?? '')) add(c.program, `${name}: program`);
  }
  if (data.course && data.tracks) courses.push({ file: name, slug: null, name: data.course, program: data.course, section: null });
  for (const m of text.matchAll(URL_RE)) add(m[1], `${name}: url`);
}

fs.writeFileSync(path.join(WEB_DIR, 'content/image-sources.json'), JSON.stringify(imageSources, null, 0) + '\n');
const missingImages = JSON.parse(fs.readFileSync(path.join(RAW, 'missing-images.json'), 'utf8'));
const covered = missingImages.filter((m) => imageSources[imgKey(m.url)]).length;
console.log(`image sources: ${Object.keys(imageSources).length} mapped, ${covered}/${missingImages.length} placeholders link to their lesson`);

// 1b. roadmap PDF links (anchor text kept for the lo-trinh page)
const pdfHtml = execFileSync('pdftohtml', ['-q', '-i', '-s', '-noframes', '-stdout', path.join(WEB_DIR, 'public/lo-trinh.pdf')], {
  maxBuffer: 64 * 1024 * 1024,
}).toString('utf8');
const pdfLinks = [];
for (const m of pdfHtml.matchAll(/<a href="(https?:\/\/[^"]+)">([\s\S]*?)<\/a>/g)) {
  const text = m[2].replace(/<[^>]+>/g, ' ').replace(/&#160;|&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  if (!pdfLinks.some((l) => l.url === m[1])) pdfLinks.push({ url: m[1], text });
  const k = m[1].match(/coursera\.org\/((?:learn|specializations|professional-certificates)\/[a-z0-9-]+)/);
  if (k) add(k[1], 'roadmap PDF');
}

// 1c. URLs inside the imported markdown
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.md')) for (const m of fs.readFileSync(p, 'utf8').matchAll(URL_RE)) add(m[1], 'handbook content');
  }
})(CONTENT_DIR);

fs.writeFileSync(
  path.join(RAW, 'courses-extracted.json'),
  JSON.stringify({ generated: new Date().toISOString(), known: Object.fromEntries(known), courses, pdfLinks }, null, 1),
);

// 2. programs per book (names from each book's SUMMARY groups / course list); candidate keys are
//    only used when they appear in the extracted data above.
const PROGRAMS = {
  'handbook-01': [
    ['Business Foundations (Wharton)', 'specializations/wharton-business-foundations'],
    ['Entrepreneurship (Wharton)', 'specializations/wharton-entrepreneurship'],
    ['Business Strategy (Darden)', 'specializations/business-strategy'],
    ['Excel Skills for Business (Macquarie)', 'specializations/excel'],
  ],
  'handbook-02': [
    ['Business English Communication Skills (UW)', 'specializations/business-english'],
    ['Business English for Non-Native Speakers (HKUST)', 'specializations/business-english-speakers'],
    ['Business English (Arizona State)', 'specializations/english-for-business'],
    ['Improve Your English Communication Skills (Georgia Tech)', 'specializations/improve-english'],
    ['Essential English for Business Professionals (UC Irvine)', 'specializations/essential-english-business-professionals'],
  ],
  'handbook-03': [
    ['Google Data Analytics', 'professional-certificates/google-data-analytics'],
    ['IBM Data Analyst', 'professional-certificates/ibm-data-analyst'],
    ['Microsoft Power BI Data Analyst', 'professional-certificates/microsoft-power-bi-data-analyst'],
    ['Google Advanced Data Analytics', 'professional-certificates/google-advanced-data-analytics'],
  ],
  'handbook-04': [
    ['Google Digital Marketing & E-commerce', 'professional-certificates/google-digital-marketing-ecommerce'],
    ['Meta Social Media Marketing', 'professional-certificates/facebook-social-media-marketing'],
    ['Marketing Analytics (Darden)', 'learn/uva-darden-market-analytics'],
    ['HubSpot Sales Representative', null],
  ],
  'handbook-05': [
    ['Intuit Academy Bookkeeping', 'professional-certificates/intuit-bookkeeping'],
    ['Introduction to Finance and Accounting (Wharton)', 'specializations/finance-accounting'],
    ['Finance for Non-Financial Professionals', 'learn/finance-for-non-finance-managers'],
    ['Managerial Accounting', 'learn/accounting-for-managers'],
  ],
  'handbook-06': [
    ['Machine Learning Specialization', 'specializations/machine-learning-introduction'],
    ['Deep Learning Specialization', 'specializations/deep-learning'],
    ['IBM Generative AI Engineering', 'professional-certificates/ibm-generative-handbook-06'],
    ['IBM RAG and Agentic AI', 'professional-certificates/ibm-rag-and-agentic-ai'],
    ['IBM AI Engineering', 'professional-certificates/ai-engineer'],
    ['Machine Learning in Production', 'learn/introduction-to-machine-learning-in-production'],
  ],
  'handbook-07': [
    ['AI for Everyone', 'learn/ai-for-everyone'],
    ['Generative AI for Everyone', 'learn/generative-ai-for-everyone'],
    ['Google AI Essentials', 'specializations/ai-essentials-google'],
    ['Google Prompting Essentials', 'specializations/prompting-essentials-google'],
    ['Google AI Professional Certificate', 'professional-certificates/google-ai'],
    ['Generative AI for Executives and Business Leaders (IBM)', 'specializations/generative-ai-for-executives-and-business-leaders'],
    ['Generative AI in Business (Michigan)', 'specializations/generative-ai-in-business'],
    ['AI for Business (Wharton)', 'specializations/ai-for-business-wharton'],
    ['Agentic AI and AI Agents for Leaders (Vanderbilt)', 'specializations/ai-agents-for-leaders'],
    ['AI Agent Skills for Leaders (Vanderbilt)', 'learn/agent-skills'],
    ['Google IT Automation with Python', 'professional-certificates/google-it-automation'],
    ['Power Automate', 'learn/power-automate-building-and-managing-automated-workflows'],
  ],
  'handbook-08': [
    ['Cybersecurity for Everyone (Maryland)', 'learn/cybersecurity-for-everyone'],
    ['Google Cybersecurity', 'professional-certificates/google-cybersecurity'],
    ['IBM Cybersecurity Analyst', 'professional-certificates/ibm-cybersecurity-analyst'],
    ['Microsoft Cybersecurity Analyst', 'professional-certificates/microsoft-cybersecurity-analyst'],
  ],
  'handbook-09': [
    ['DeepLearning.AI Data Engineering', 'professional-certificates/data-engineering'],
    ['Google Cloud Data Engineering', 'professional-certificates/gcp-data-engineering'],
    ['Modern Robotics (Northwestern)', 'specializations/modernrobotics'],
    ['Self-Driving Cars (Toronto)', 'specializations/self-driving-cars'],
  ],
  'handbook-10': [
    ['IBM DevOps and Software Engineering', 'professional-certificates/devops-and-software-engineering'],
    ['Google Cloud DevOps / SRE', 'professional-certificates/sre-devops-engineer-google-cloud'],
    ['Google Cloud Digital Leader', 'professional-certificates/google-cloud-digital-leader-training'],
    ['AWS Cloud Practitioner Essentials', 'learn/aws-cloud-practitioner-essentials'],
    ['Google IT Support', 'professional-certificates/google-it-support'],
  ],
  'handbook-12': [['Meta Front-End Developer', 'professional-certificates/handbook-12-developer']],
  'handbook-13': [
    ['Meta Front-End Developer', 'professional-certificates/handbook-12-developer'],
    ['Meta Back-End Developer', 'professional-certificates/meta-back-end-developer'],
  ],
  'handbook-14': [['Learning How to Learn', 'learn/handbook-14']],
  'handbook-15': [['Google Project Management', 'professional-certificates/handbook-15']],
  // F8 course: no course URL exists in the data, so the button stays hidden
  'handbook-11': [],
};

const books = readRegistry();
const report = [];
for (const b of books) {
  const list = PROGRAMS[b.slug];
  if (!list) continue;
  b.courseraUrls = list.map(([title, key]) => ({
    title,
    url: key && known.has(key) ? COURSERA + key : null,
    provider: 'Coursera',
  }));
  report.push(`${b.slug}: ${b.courseraUrls.filter((c) => c.url).length}/${b.courseraUrls.length} linked`);
}
writeRegistry(books);
console.log(`extracted: ${courses.length} courses, ${known.size} Coursera URLs/slugs, ${pdfLinks.length} PDF links`);
for (const r of report) console.log(`  ${r}`);
