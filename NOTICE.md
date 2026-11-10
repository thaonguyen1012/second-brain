# Notices: third-party code and assets in this repository

Alex's Brain is MIT licensed (`LICENSE`). The parts below were not written for this project; each keeps its own
licence. Packages installed by `npm ci` and `uv sync` are not in the repository; their licences are those of the
packages pinned in `web/package-lock.json` and `backend/uv.lock`.

| Component | Where | Licence | Licence text |
| --- | --- | --- | --- |
| Stageshow kit (Benji Taylor) | `web/components/stageshow/kit/` (a copy, adapted; brand marks left out) | MIT | `web/components/stageshow/kit/LICENSE`, `NOTICE.md` beside it |
| Stageshow skill (Benji Taylor): kit, examples, playground, references | `.claude/skills/stageshow/` | MIT for its source | `.claude/skills/stageshow/LICENSE`, `NOTICE.md` |
| App icons used as examples by the Stageshow skill | `.claude/skills/stageshow/assets/app-icons.ts` (base64 PNGs taken from macOS app bundles) | **not MIT**: the artwork of the respective apps, used as illustrative references (Stageshow `NOTICE.md`) | none |
| Brand marks of the Stageshow skill | `.claude/skills/stageshow/kit/brands/` | SVGL (MIT), payment-icons (Apache 2.0), Cryptocurrency Icons (CC0 1.0), and official Linear, American Express and Circle assets under their owners' brand terms | `kit/brands/LICENSE-*.txt`, `kit/brands/SOURCES.md` |
| Two photographs of the Stageshow Wikipedia example | `.claude/skills/stageshow/examples/wikipedia/*.jpg` | CC0 1.0 | `examples/wikipedia/PHOTOS.md` |
| Inter and Geist fonts (latin subsets) of the launch-film example | `.claude/skills/stageshow/examples/brain-launch/fonts/*.woff2` | SIL Open Font License 1.1 (both families) | **not in the repository** |
| Space UI components (Community edition), built on shadcn/ui and Base UI | `web/components/ui/`, `web/components/spaceui/` (added with the shadcn CLI from the `@spaceui` registry) | MIT (Space UI Community, shadcn/ui, Base UI) | **not in the repository** (the registry adds the source files only) |
| Fonts of the app: Inter, Geist, JetBrains Mono | downloaded by `next/font` at build time, not committed | SIL Open Font License 1.1 | in the font packages |
| Mermaid | copied from `node_modules` to `web/public/vendor/` at build time, gitignored | MIT | `node_modules/mermaid/LICENSE` |

Everything else, including the cover drawings (`web/public/covers/`), the brand mark and the icons
(`web/public/icons/`, `web/components/brand-mark.tsx`), the group marks and the sample handbook
(`web/examples/sample-handbook/`), was made for this project and is under the MIT licence of the repository.

Product names (Coursera, F8, GitBook, Cloudflare, Gemini, Claude...) are used to describe what the app works with;
they remain the marks of their owners.
