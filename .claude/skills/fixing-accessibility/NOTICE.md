# Notice

`SKILL.md` is an unchanged copy of `skills/fixing-accessibility/SKILL.md` from
https://github.com/ibelick/ui-skills, commit `df4eb34c5dee830e8e36490d6fde3451c187339b` (19/02/2026), under the MIT
License in `LICENSE`. Installed on 13/11/2026 at the owner's request, to audit this app's UI.

Use it with `/fixing-accessibility` (rules for the UI work in the conversation) or `/fixing-accessibility <file>` (a
review of one file). This app's own rules come first: `web/DESIGN.md` (components, contrast, focus) and the Base UI
primitives in `web/components/ui/`, which already trap focus, close on Escape and return focus.

To update it, copy the file again from the repository (keep `LICENSE` and this notice), or run
`npx skills add ibelick/ui-skills -a claude-code --skill fixing-accessibility`, which installs it under `.agents/skills/`
with a link in `.claude/skills/`.
