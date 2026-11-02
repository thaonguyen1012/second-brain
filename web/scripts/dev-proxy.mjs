#!/usr/bin/env node
// Development stand-in for deploy/nginx.conf: one origin that routes like production.
// /api/me, /api/progress*, /api/{inbox,items,notes,weeks}*, /api/schema/, /admin*, /admin-static/*, /healthz -> Django; everything else -> Next.
// Usage: node scripts/dev-proxy.mjs [--port 8080] [--web http://127.0.0.1:3000] [--api http://127.0.0.1:8000]
import http from 'node:http';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    port: { type: 'string', default: '8080' },
    web: { type: 'string', default: 'http://127.0.0.1:3000' },
    api: { type: 'string', default: 'http://127.0.0.1:8000' },
  },
});

const DJANGO = /^\/(api\/(me|progress|schema|inbox|items|notes|weeks)(\/|$|\?)|admin(\/|$)|admin-static\/|healthz$)/;

http
  .createServer((req, res) => {
    const target = new URL(DJANGO.test(req.url ?? '') ? values.api : values.web);
    const upstream = http.request(
      {
        host: target.hostname,
        port: target.port,
        method: req.method,
        path: req.url, // raw, so %2F inside a page path reaches Django unchanged
        headers: { ...req.headers, 'x-forwarded-host': req.headers.host, 'x-forwarded-proto': 'http' },
      },
      (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers);
        up.pipe(res);
      },
    );
    upstream.on('error', (err) => {
      res.writeHead(502, { 'content-type': 'text/plain' });
      res.end(`upstream error: ${err.message}`);
    });
    req.pipe(upstream);
  })
  .listen(Number(values.port), '127.0.0.1', () => {
    console.log(`dev proxy on http://localhost:${values.port} (web ${values.web}, api ${values.api})`);
  });
