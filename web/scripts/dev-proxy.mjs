#!/usr/bin/env node
// Development stand-in for deploy/nginx.conf: one origin that routes like production.
// Pages such as /inbox/them/ (capture), /manifest.webmanifest and /icons/ go to Next like any non-Django path.
// /api/me, /api/progress*, /api/{inbox,items,notes,weeks,projects,time-entries,opportunities,skills,market,news,brief,achievements,predictions,status}*, /api/schema/, /admin*, /admin-static/*, /healthz -> Django; everything else -> Next.
// WebSocket upgrades are piped too, so `next dev` behind the proxy keeps hot reload.
// The web upstream decides which progress store the pages use (NEXT_PUBLIC_PROGRESS_STORE is inlined at build
// time): `make dev` builds the :3100 server with =api, `make dev-hot` starts `next dev` with =api behind the
// proxy on :3000 (the origin that holds the old localStorage progress); see ARCHITECTURE.md.
// Usage: node scripts/dev-proxy.mjs [--port 8080] [--web http://127.0.0.1:3000] [--api http://127.0.0.1:8000]
import http from 'node:http';
import net from 'node:net';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    port: { type: 'string', default: '8080' },
    web: { type: 'string', default: 'http://127.0.0.1:3000' },
    api: { type: 'string', default: 'http://127.0.0.1:8000' },
  },
});

const DJANGO = /^\/(api\/(me|progress|schema|inbox|items|notes|weeks|projects|time-entries|opportunities|skills|market|news|brief|achievements|predictions|status)(\/|$|\?)|admin(\/|$)|admin-static\/|healthz$)/;

const upstreamFor = (url) => new URL(DJANGO.test(url ?? '') ? values.api : values.web);

const server = http.createServer((req, res) => {
  const target = upstreamFor(req.url);
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
});

// WebSocket (Next's HMR): replay the upgrade request on a raw socket to the upstream, then pipe both ways.
server.on('upgrade', (req, socket, head) => {
  const target = upstreamFor(req.url);
  const upstream = net.connect(Number(target.port || 80), target.hostname, () => {
    const lines = [`${req.method} ${req.url} HTTP/${req.httpVersion}`];
    for (let i = 0; i < req.rawHeaders.length; i += 2) lines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
    upstream.write(lines.join('\r\n') + '\r\n\r\n');
    if (head?.length) upstream.write(head);
    upstream.pipe(socket).pipe(upstream);
  });
  const close = () => {
    upstream.destroy();
    socket.destroy();
  };
  upstream.on('error', close);
  socket.on('error', close);
});

server.listen(Number(values.port), '127.0.0.1', () => {
  console.log(`dev proxy on http://localhost:${values.port} (web ${values.web}, api ${values.api})`);
});
