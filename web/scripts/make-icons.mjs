#!/usr/bin/env node
// Renders the PNG app icons from public/icons/icon.svg (the mark, also drawn by components/brand-mark.tsx).
//
//   node scripts/make-icons.mjs        (run from web/ after changing icon.svg; commit the PNGs)
//
// icon-192/512 ('any'): the mark alone on transparency, as in the sidebar. apple-touch-icon and the maskable icon
// need an opaque square (iOS fills transparency with black; Android crops maskable icons to a circle of 80%), so they
// get a full-bleed ivory ground, no drawn border; the OS rounds or masks it. The light ink is used (sharp's librsvg
// does not apply the dark media query).
import path from 'node:path';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';

const dir = path.join(import.meta.dirname, '..', 'public', 'icons');
const svg = readFileSync(path.join(dir, 'icon.svg'), 'utf8');
const IVORY = '#faf9f5';

/** The mark as a PNG buffer, `size` px square, transparent around it. */
function mark(size) {
  const sized = svg.replace('<svg ', `<svg width="${size}" height="${size}" `);
  return sharp(Buffer.from(sized)).png().toBuffer();
}

/** The mark scaled to `share` of a `size` px square on the ivory ground, without an alpha channel. */
async function onGround(size, share) {
  const inner = Math.round(size * share);
  const offset = Math.round((size - inner) / 2);
  return sharp({ create: { width: size, height: size, channels: 4, background: IVORY } })
    .composite([{ input: await mark(inner), left: offset, top: offset }])
    .removeAlpha()
    .png()
    .toBuffer();
}

const outputs = [
  ['icon-192.png', () => mark(192)],
  ['icon-512.png', () => mark(512)],
  ['apple-touch-icon.png', () => onGround(180, 0.76)],
  // The mark's farthest corner is 0.55 of its box from the centre: 0.70 keeps it inside the 0.4 safe radius
  ['icon-maskable-512.png', () => onGround(512, 0.7)],
];
for (const [name, render] of outputs) {
  await sharp(await render()).toFile(path.join(dir, name));
  console.log('icons: wrote', name);
}
