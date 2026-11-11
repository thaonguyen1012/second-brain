# Security

Alex's Brain is a single-owner app meant to run behind Cloudflare Access (or another authenticating proxy). Its
security model is described in `README.md` ("Security notes"), `DECISIONS.md` (10.5) and `deploy/README.md`.

## Reporting a vulnerability

Please do not open a public issue for a security problem. Use GitHub's private vulnerability reporting on this
repository ("Security" tab, "Report a vulnerability"), with the steps to reproduce, the affected version (commit)
and the impact you see. You should get an answer within a week. Fixes land on the default branch; there are no
maintained release branches.

In scope: the Django API (auth middleware, the Access JWT check, CSRF, object ownership), the SSRF guard of link
fetching, HTML sanitising of fetched pages and of handbook content, the nginx examples in `deploy/`. Out of scope:
`AUTH_MODE=dev` (local development only; Django refuses it without `DEBUG=true`) and setups that expose the app
without an authenticating proxy.

## Threat model

Alex's Brain is a single-owner application: a study site built from the owner's handbooks plus a "second brain"
(notes, inbox, weeks, projects, opportunities, skills, a morning brief). There is one user, and the application is
meant to run behind Cloudflare Access on a host that opens no public port (Cloudflare Tunnel). What the app trusts
and does not:

* **Trusted:** the owner, after Cloudflare Access has authenticated them; the owner's own machine; the operator who
  deploys (the same person). Django verifies the Access JWT on every request itself and maps it to the one user, so
  a request that reaches Django without a valid token for the owner's email is anonymous, session or not.
* **Not trusted:** every page the owner captures into the inbox and every og:image host; every RSS feed; pasted job
  ads; the handbook exports the content is imported from; the LLM provider and everything it answers; pages of other
  origins open in the owner's browser; any other process on a shared host.
* **Out of the app's hands:** the Cloudflare Access policy and session, the tunnel, TLS, the host's firewall and
  users. The repository documents them (`deploy/README.md`) but cannot enforce them.

## Rules the code follows (DECISIONS.md 10.5, for an outside reader)

1. **One door.** Only the tunnel reaches nginx; nginx reaches Django and Next on loopback or a private network.
   Django checks the Access JWT (RS256, audience, issuer, expiry; keys from the team's JWKS) and accepts only the
   owner's email. The health check is the only unauthenticated route.
2. **Browser hygiene.** Session cookie Secure, HttpOnly, SameSite=Lax; CSRF token required on every write (the
   web client sends `X-CSRFToken`); `X-Frame-Options: DENY`, nosniff, same-origin referrer; a Content-Security-Policy
   at nginx, report-only until the console is clean, then enforcing.
3. **No request from the browser to another origin.** Fonts, Mermaid and all code are served from the app's origin.
4. **Outbound requests only in background jobs, and only through the SSRF guard**: every address a host resolves to
   must be public, the connection is pinned to the checked address, at most three redirects, ten seconds, two
   megabytes, no compressed bodies; only the content types the job expects. (The Access key set is the one exception:
   the web process fetches it to verify tokens.)
5. **Untrusted text is data.** OG fields and feed entries are reduced to plain text with `nh3` before they are stored;
   raw HTML in handbook content is allowlisted by `rehype-safe-html`; notes render through react-markdown with no raw
   HTML; links and images in notes follow an allowlist of same-origin paths and http(s).
6. **Uploads** are size-limited, decoded by Pillow regardless of the claimed type, re-encoded as small WebP files
   whose names are content hashes, stored outside any web root and served through nginx internal locations after
   Django has checked the owner.
7. **The LLM gets titles and short excerpts, never notes, never URLs.** Its output must match a strict schema
   (pydantic, no extra fields) and is stored as tags and text; it is never executed, and the model has no tools. A
   monthly cost cap is checked before every call.
8. **Secrets stay in `backend/.env` (development) or root-only env files that systemd or Docker hands to the
   services**, outside git; dependencies are pinned by lockfiles and
   audited (`npm audit`, `pip-audit`); every owned row can be exported and deleted by the owner; backups are owner-only
   files (encryption of off-host copies is still to do).


## Known limits

* The capture bookmarklet runs inside the page it captures and opens the capture window with `window.open`; that
  page's scripts get the window handle and could navigate it. Use the bookmarklet on pages you trust, or the share
  target of the installed app on a phone.
* The page Content-Security-Policy in `deploy/nginx/site.conf` starts as report-only.
* Off-host copies of the backups are not encrypted by the app.

A full audit (10/11/2026) found no critical or high issue; its medium and low findings (lesson HTML inside
admonitions, time limits on background fetches, the release script of the systemd example, writes on GET, a
missing `Cross-Origin-Resource-Policy`, the development proxy's Host check) are fixed.
