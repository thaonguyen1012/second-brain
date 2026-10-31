// Copy static assets next to the standalone server (Next does not do this itself).
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const standalone = path.join(root, '.next/standalone');
if (fs.existsSync(standalone)) {
  fs.cpSync(path.join(root, '.next/static'), path.join(standalone, '.next/static'), { recursive: true });
  // public/ holds the original HTML (large); clone where the filesystem supports it
  fs.cpSync(path.join(root, 'public'), path.join(standalone, 'public'), {
    recursive: true,
    mode: fs.constants.COPYFILE_FICLONE,
    // attachments (/files/) are served separately in production, see ARCHITECTURE.md
    filter: (src) => !src.startsWith(path.join(root, 'public/files')),
  });
}
