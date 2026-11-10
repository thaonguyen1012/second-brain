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
