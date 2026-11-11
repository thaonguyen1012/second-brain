import { describe, expect, it } from 'vitest';
import { DJANGO, isLocalHost } from './dev-host.mjs';

describe('isLocalHost', () => {
  it('accepts the proxy itself on its port', () => {
    for (const host of ['localhost:8080', '127.0.0.1:8080', '[::1]:8080', 'LOCALHOST:8080']) {
      expect(isLocalHost(host, 8080), host).toBe(true);
    }
    expect(isLocalHost('localhost', 80)).toBe(true);
  });

  it('refuses another name, another port or no Host (DNS rebinding, S-21)', () => {
    for (const host of ['attacker.example:8080', 'localhost:3000', 'localhost', '127.0.0.1.attacker.example:8080', '', undefined]) {
      expect(isLocalHost(host, 8080), String(host)).toBe(false);
    }
  });
});

describe('DJANGO routes (security audit P-11)', () => {
  it('sends attachments, the API and the admin to Django and pages to Next', () => {
    for (const p of ['/files/a/b.pdf', '/api/items/1', '/api/me', '/admin/', '/healthz']) expect(DJANGO.test(p), p).toBe(true);
    for (const p of ['/', '/inbox/', '/docs/it/x/', '/api/search?q=a', '/trees/x.json', '/filesx/a']) expect(DJANGO.test(p), p).toBe(false);
  });
});
