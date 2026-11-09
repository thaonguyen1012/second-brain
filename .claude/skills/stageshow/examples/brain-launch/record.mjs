// Records the launch video frame by frame on the kit's virtual clock (kit/clock.ts) and encodes it with ffmpeg.
//
//   node examples/brain-launch/record.mjs [--base http://127.0.0.1:5199] [--out launch.mp4]
//        [--fps 30] [--seconds 46] [--size 1080] [--from 0] [--every 0] [--stills dir]
//
// The playground must be running (npx vite playground --config playground/vite.config.ts --port 5199).
// --stills dir: instead of a video, write one PNG every --every ms (a contact check of the beats).
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { launch } from '../../scripts/browser.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const base = opt('base', 'http://127.0.0.1:5199')
const fps = Number(opt('fps', 30))
const seconds = Number(opt('seconds', 46))
const size = Number(opt('size', 1080))
const from = Number(opt('from', 0))
const every = Number(opt('every', 0))
const stills = opt('stills', null)
const out = resolve(opt('out', 'launch.mp4'))
const DESIGN = 640

// The virtual clock as a self-contained init script
const bundled = await build({
  stdin: {
    contents: `import { installVirtualClock } from './kit/clock.ts'; installVirtualClock({ fps: ${fps}, epoch: Date.UTC(2026, 10, 9, 6, 30) })`,
    resolveDir: resolve(here, '../..'),
    loader: 'ts',
  },
  bundle: true,
  format: 'iife',
  write: false,
})
const clockSource = bundled.outputFiles[0].text

const browser = await launch()
const page = await browser.newPage({
  viewport: { width: DESIGN, height: DESIGN },
  deviceScaleFactor: (size / DESIGN) * 2,
})
page.on('pageerror', (e) => console.error('page error:', e.message))
page.on('console', (m) => ['error', 'warning'].includes(m.type()) && console.error(`${m.type()}: ${m.text()}`))
await page.addInitScript({ content: clockSource })
await page.goto(`${base}/?capture=brain-launch`)
await page.waitForSelector('.ss-stage')
await page.evaluate(() => document.fonts.ready)
const step = (n = 1) => page.evaluate((n) => window.__stageshow.clock.step(n), n)
// Let the stage mount and measure before frame 0
await page.evaluate(() => window.__stageshow.clock.settle())
await page.waitForTimeout(300)
await page.evaluate(() => window.__stageshow.clock.settle())

const total = Math.round(seconds * fps)
const startFrame = Math.round((from / 1000) * fps)
if (startFrame) await step(startFrame)
const shot = () => page.screenshot({ clip: { x: 0, y: 0, width: DESIGN, height: DESIGN }, type: 'png' })

if (stills) {
  mkdirSync(stills, { recursive: true })
  const gap = Math.max(1, Math.round(((every || 1000) / 1000) * fps))
  for (let f = startFrame; f < total; f += gap) {
    const ms = Math.round((f / fps) * 1000)
    await page.screenshot({ path: `${stills}/f-${String(ms).padStart(6, '0')}.png`, clip: { x: 0, y: 0, width: DESIGN, height: DESIGN } })
    await step(gap)
  }
  console.log(`stills in ${resolve(stills)}`)
} else {
  const ff = spawn('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
    '-vf', `scale=${size}:${size}:flags=lanczos,format=yuv420p`,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-profile:v', 'high', '-tune', 'animation',
    '-movflags', '+faststart', '-r', String(fps),
    out,
  ], { stdio: ['pipe', 'inherit', 'inherit'] })
  for (let f = startFrame; f < total; f++) {
    const png = await shot()
    if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r))
    await step()
    if (f % (fps * 5) === 0) process.stdout.write(`${Math.round(f / fps)}s `)
  }
  ff.stdin.end()
  await new Promise((r) => ff.on('close', r))
  console.log(`\nwrote ${out}`)
}
await browser.close()
