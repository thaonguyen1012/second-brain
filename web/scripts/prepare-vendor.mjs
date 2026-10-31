// Copy prebuilt browser bundles from node_modules into public/vendor/ (served locally, never from a CDN).
// Mermaid is loaded at runtime from here so the bundler does not have to compile it (saves ~8 s per dev start).
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const src = path.join(root, 'node_modules/mermaid/dist');
const dest = path.join(root, 'public/vendor/mermaid');
const version = JSON.parse(fs.readFileSync(path.join(root, 'node_modules/mermaid/package.json'), 'utf8')).version;
const stamp = path.join(dest, '.version');

if (fs.existsSync(stamp) && fs.readFileSync(stamp, 'utf8') === version) process.exit(0);
fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(path.join(dest, 'chunks'), { recursive: true });
fs.copyFileSync(path.join(src, 'mermaid.esm.min.mjs'), path.join(dest, 'mermaid.esm.min.mjs'));
fs.cpSync(path.join(src, 'chunks/mermaid.esm.min'), path.join(dest, 'chunks/mermaid.esm.min'), { recursive: true });
fs.writeFileSync(stamp, version);
console.log(`mermaid ${version} copied to public/vendor/mermaid`);
