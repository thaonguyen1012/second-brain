import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, request } from './client';

// request() runs in the browser: stand in for the cookie (CSRF token), the write event and fetch.
const calls: { url: string; init: RequestInit }[] = [];
let answer: Response;

beforeEach(() => {
  calls.length = 0;
  vi.stubGlobal('document', { cookie: 'csrftoken=tok123' });
  vi.stubGlobal('window', { dispatchEvent: () => true });
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return answer;
  });
});
afterEach(() => vi.unstubAllGlobals());

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('request', () => {
  it('sends JSON bodies as JSON with the CSRF header', async () => {
    answer = json(200, { id: 1 });
    await expect(request('PATCH', '/api/items/1', { status: 'done' })).resolves.toEqual({ id: 1 });
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['X-CSRFToken']).toBe('tok123');
    expect(calls[0].init.body).toBe('{"status":"done"}');
  });

  it('sends a FormData body as it is, without a Content-Type (the browser adds the boundary)', async () => {
    answer = json(200, { id: 1 });
    const form = new FormData();
    form.append('file', new Blob(['x'], { type: 'image/png' }), 'a.png');
    await request('POST', '/api/items/1/image', form);
    const headers = calls[0].init.headers as Record<string, string>;
    expect(calls[0].init.body).toBe(form);
    expect(headers['Content-Type']).toBeUndefined();
    expect(headers['X-CSRFToken']).toBe('tok123');
  });

  it("treats nginx's HTML 413 as an answer about the request, a 502 as unreachable", async () => {
    answer = new Response('<html>413</html>', { status: 413, headers: { 'content-type': 'text/html' } });
    const tooBig = await request('POST', '/api/items/1/image', new FormData()).catch((e: unknown) => e);
    expect(tooBig).toBeInstanceOf(ApiError);
    expect(tooBig).toMatchObject({ status: 413, reachable: true });

    answer = new Response('<html>bad gateway</html>', { status: 502, headers: { 'content-type': 'text/html' } });
    await expect(request('GET', '/api/items')).rejects.toMatchObject({ status: 502, reachable: false });
  });

  it('keeps the parsed body of a DRF 400', async () => {
    answer = json(400, { file: ['Ảnh lớn hơn 10 MB.'] });
    await expect(request('POST', '/api/items/1/image', new FormData())).rejects.toMatchObject({
      status: 400,
      reachable: true,
      body: { file: ['Ảnh lớn hơn 10 MB.'] },
    });
  });
});
