// The English version stays complete (lib/i18n/README.md). Reads every source file under app/, components/ and lib/
// with the TypeScript parser and fails when:
// * Vietnamese text is shown without t(): JSX text, a string or template literal outside the first argument of
//   t(), t.rich() or msg() (a line marked `i18n-ignore` and a file marked `i18n-ignore-file` are skipped);
// * a text given to t()/msg() has no English entry in a dictionary the file can reach (server files: all of them;
//   client files: the page dictionary, plus intro/guides when they import it), even one that reads the same;
// * an English entry is unused, sits in two area files, or loses a {placeholder} or <tag> of its Vietnamese key;
// * a client file imports the server dictionary, or a lazy dictionary outside components/stageshow/.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { books, tracks } from '../books';
import { enAll, enAreas, enPage } from './en';
import { dictKey, type Dictionary, type Entry } from './translate';

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** Letters only Vietnamese (and a few accents it shares) uses; a diacritic-free word ("Phim") goes unseen. */
const VIETNAMESE = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/iu;

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) {
        out.push(file);
      }
    }
  };
  for (const root of ['app', 'components', 'lib']) walk(path.join(web, root));
  // The dictionaries hold the Vietnamese keys themselves
  return out.filter((f) => !f.startsWith(path.join(web, 'lib/i18n/en/')));
}

interface Use {
  key: string;
  file: string;
  line: number;
}

interface Problem {
  file: string;
  line: number;
  text: string;
}

const isT = (callee: ts.Expression) =>
  (ts.isIdentifier(callee) && (callee.text === 't' || callee.text === 'msg')) ||
  (ts.isPropertyAccessExpression(callee) && callee.name.text === 'rich' && ts.isIdentifier(callee.expression));

/** Where the context string of a translation call sits: t(text, vars, ctx), t.rich(text, values, ctx), msg(text, ctx). */
const contextIndex = (callee: ts.Expression) => (ts.isIdentifier(callee) && callee.text === 'msg' ? 1 : 2);

/**
 * The translation call whose first argument is `node`, through `a ? 'x' : 'y'`, `a ?? 'x'`, `a || 'x'` and
 * parentheses; otherwise undefined.
 */
function translationCall(node: ts.Node): ts.CallExpression | undefined {
  let child: ts.Node = node;
  let parent = node.parent;
  while (
    ts.isParenthesizedExpression(parent) ||
    (ts.isConditionalExpression(parent) && parent.condition !== child) ||
    (ts.isBinaryExpression(parent) &&
      (parent.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken ||
        parent.operatorToken.kind === ts.SyntaxKind.BarBarToken))
  ) {
    child = parent;
    parent = parent.parent;
  }
  if (ts.isCallExpression(parent) && parent.arguments[0] === child && isT(parent.expression)) return parent;
  return undefined;
}

function scan() {
  const uses: Use[] = [];
  const untranslated: Problem[] = [];
  const missing: Problem[] = [];
  const imports: Problem[] = [];

  for (const file of sourceFiles()) {
    const text = fs.readFileSync(file, 'utf8');
    if (text.includes('i18n-ignore-file')) continue;
    const rel = path.relative(web, file);
    const lines = text.split('\n');
    const source = ts.createSourceFile(
      file,
      text,
      ts.ScriptTarget.Latest,
      true,
      file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const lineOf = (node: ts.Node) => source.getLineAndCharacterOfPosition(node.getStart(source)).line;
    const ignored = (node: ts.Node) => lines[lineOf(node)].includes('i18n-ignore');

    // The dictionaries this file can reach
    const isClient = /^\s*['"]use client['"]/.test(text);
    const lazy: Dictionary[] = [];
    for (const decl of source.statements.filter(ts.isImportDeclaration)) {
      const from = (decl.moduleSpecifier as ts.StringLiteral).text;
      if (!from.startsWith('@/lib/i18n/') && !from.startsWith('./')) continue;
      const area = /^@\/lib\/i18n\/en\/(\w+)$/.exec(from)?.[1];
      if (area === 'intro' || area === 'guides') lazy.push(enAreas[area]);
      if (!isClient) continue;
      const line = lineOf(decl) + 1;
      if (from === '@/lib/i18n/en' || from === '@/lib/i18n/server') {
        imports.push({ file: rel, line, text: `client file imports ${from}` });
      } else if (area && !rel.startsWith('components/stageshow/')) {
        imports.push({ file: rel, line, text: `${from} outside components/stageshow/ ships it in a page bundle` });
      }
    }
    const reach: Dictionary = /\bgetT\(/.test(text) ? enAll : Object.assign({}, enPage, ...lazy);

    const visit = (node: ts.Node) => {
      if (ts.isJsxText(node) && VIETNAMESE.test(node.text) && !ignored(node)) {
        untranslated.push({ file: rel, line: lineOf(node) + 1, text: node.text.trim() });
      } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        const call = translationCall(node);
        if (call) {
          const ctxArg = call.arguments[contextIndex(call.expression)];
          const ctx = ctxArg && ts.isStringLiteral(ctxArg) ? ctxArg.text : undefined;
          const key = dictKey(node.text, ctx);
          uses.push({ key, file: rel, line: lineOf(node) + 1 });
          // Every text, also one without diacritics ("Xong", "Phim"): an entry that is the same word is explicit
          if (!(key in reach)) {
            missing.push({ file: rel, line: lineOf(node) + 1, text: key });
          }
        } else if (VIETNAMESE.test(node.text) && !ignored(node) && !ts.isImportDeclaration(node.parent)) {
          untranslated.push({ file: rel, line: lineOf(node) + 1, text: node.text });
        }
      } else if (ts.isTemplateExpression(node)) {
        const parts = [node.head.text, ...node.templateSpans.map((s) => s.literal.text)];
        if (parts.some((p) => VIETNAMESE.test(p)) && !ignored(node)) {
          untranslated.push({ file: rel, line: lineOf(node) + 1, text: `\`${parts.join('${…}')}\`` });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return { uses, untranslated, missing, imports };
}

const { uses, untranslated, missing, imports } = scan();

/** The handbook registry is data (lib/books.ts): its texts are shown through t(variable), so they count as used. */
const registry = [...books.flatMap((b) => [b.title, b.description]), ...tracks.flatMap((t) => [t.title, t.description])];
for (const key of registry) uses.push({ key, file: 'lib/books.ts', line: 0 });
const list = (problems: Problem[]) => problems.map((p) => `${p.file}:${p.line}  ${p.text}`);

const forms = (entry: Entry) => (typeof entry === 'string' ? [entry] : [entry.one, entry.other]);
const marks = (s: string) => [...s.matchAll(/\{(\w+)\}|<(\w+)>/g)].map((m) => m[0]).sort();

describe('English version', () => {
  it('shows no Vietnamese text without t()', () => {
    expect(list(untranslated)).toEqual([]);
  });

  it('has an English entry for every text given to t() or msg()', () => {
    expect(list(missing)).toEqual([]);
  });

  it('has English for every handbook title, description and track in the registry', () => {
    expect(registry.filter((key) => !(key in enPage))).toEqual([]);
  });

  it('keeps English dictionaries out of client bundles', () => {
    expect(list(imports)).toEqual([]);
  });

  it('keeps each English entry in one area file, and uses it', () => {
    const used = new Set(uses.map((u) => u.key));
    const seen = new Map<string, string>();
    const twice: string[] = [];
    const unused: string[] = [];
    for (const [area, dict] of Object.entries(enAreas)) {
      for (const key of Object.keys(dict)) {
        if (seen.has(key)) twice.push(`${key}  (${seen.get(key)} and ${area})`);
        seen.set(key, area);
        if (!used.has(key)) unused.push(`${area}: ${key}`);
      }
    }
    expect(twice).toEqual([]);
    expect(unused).toEqual([]);
  });

  it('keeps every {placeholder} and <tag> of the Vietnamese in the English', () => {
    const wrong: string[] = [];
    for (const [area, dict] of Object.entries(enAreas)) {
      for (const [key, entry] of Object.entries(dict as Dictionary)) {
        const msgid = key.includes('::') ? key.slice(key.indexOf('::') + 2) : key;
        const want = marks(msgid).join(' ');
        for (const form of forms(entry)) {
          const got = marks(form);
          // The singular may write the count as a word ("one note"), so {n} is optional there
          const ok =
            got.join(' ') === want ||
            (typeof entry !== 'string' && form === entry.one && got.join(' ') === marks(msgid).filter((m) => m !== '{n}').join(' '));
          if (!ok) wrong.push(`${area}: ${key} -> ${form}`);
        }
        if (typeof entry !== 'string' && !msgid.includes('{n}')) wrong.push(`${area}: plural without {n}: ${key}`);
      }
    }
    expect(wrong).toEqual([]);
  });
});
