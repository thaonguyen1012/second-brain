// The dev proxy answers only requests addressed to itself (security audit S-21): a page on another site that
// rebinds its own name to 127.0.0.1 sends `Host: <its name>`, so checking the Host header stops it from reading the
// local stack (Next has no auth of its own, and `make dev` logs every request in as the owner).

/** Whether `host` (the request's Host header) names this proxy: localhost, 127.0.0.1 or [::1] on `port`. */
export function isLocalHost(host, port) {
  if (typeof host !== 'string') return false;
  const m = /^(localhost|127\.0\.0\.1|\[::1\])(?::(\d+))?$/i.exec(host.trim());
  if (!m) return false;
  const given = m[2] === undefined ? 80 : Number(m[2]);
  return given === Number(port);
}
