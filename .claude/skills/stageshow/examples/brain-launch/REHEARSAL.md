# Rehearsal: brain-launch

A 43 s square launch video of Alex's Brain for LinkedIn, X and Threads (English UI only). Rendered with
`record.mjs` (the kit's virtual clock, one screenshot per frame at 2x, ffmpeg H.264 1080 x 1080, 30 fps).

```
npx vite playground --config playground/vite.config.ts --port 5199   # in .claude/skills/stageshow
node examples/brain-launch/record.mjs --seconds 43 --out alex-brain-launch.mp4
node examples/brain-launch/record.mjs --stills shots --every 1500     # a still per 1.5 s to check beats
```

- **Gold copied:** hero-demo (named targets, a cursor that only travels to act), payout-flow (holds), fade-crop
  (a window inset top and sides, off the bottom). Shell and pages ported from `web/components/stageshow/intro/`
  with the English strings of `web/lib/i18n/en/`.
- **Changed for video:** one 640 design scaled 1.6875x; a caption over the window per scene (feeds autoplay
  muted); the lockup opens and closes the film, so the last frame is the first.
- **Checked:** contact sheets every 1.5 s over the whole film, a 1080 crop of the skills grid (type and
  descenders), the poster (the lockup).
- **Not checked:** `film.mjs --gate` (the stage is a 43 s film, not a loop); dark theme; a compact design
  (the video is a fixed square).
