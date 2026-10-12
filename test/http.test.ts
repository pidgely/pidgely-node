import { describe, expect, it } from 'vitest';
import { backoff, parseRetryAfter, queryString } from '../src/http';
import { client, lastCall } from './helpers';

const rateLimited = { status: 429, body: { statusCode: 429, name: 'rate_limit_exceeded', message: 'slow down' } };
const serverError = { status: 503, body: { statusCode: 503, name: 'internal_server_error', message: 'busy' } };

describe('responses', () => {
  it('returns { data, error: null, headers } on success', async () => {
    const { pidgely } = client([{ body: { id: 'e1' }, headers: { 'X-Request-Id': 'req_1' } }]);
    const res = await pidgely.emails.get('e1');
    expect(res.error).toBeNull();
    expect(res.data).toEqual({ id: 'e1' });
    expect(res.headers?.['x-request-id']).toBe('req_1');
  });

  it('returns the API error body without throwing', async () => {
    const { pidgely } = client([
      { status: 422, body: { statusCode: 422, name: 'validation_error', message: 'The `to` field is missing.' } },
    ]);
    const res = await pidgely.emails.send({ from: 'a@b.com', to: [], subject: 's', html: 'h' });
    expect(res.data).toBeNull();
    expect(res.error).toEqual({ statusCode: 422, name: 'validation_error', message: 'The `to` field is missing.' });
  });

  it('fills a missing statusCode from the HTTP status', async () => {
    const { pidgely } = client([{ status: 404, body: { name: 'not_found', message: 'nope' } }]);
    const { error } = await pidgely.domains.get('d');
    expect(error).toEqual({ statusCode: 404, name: 'not_found', message: 'nope' });
  });

  it('maps the native { error: { code, message } } shape', async () => {
    const { pidgely } = client([{ status: 403, body: { error: { code: 'forbidden', message: 'no' } } }]);
    const { error } = await pidgely.domains.get('d');
    expect(error).toEqual({ statusCode: 403, name: 'forbidden', message: 'no' });
    const { pidgely: p2 } = client([{ status: 403, body: { error: { code: 'forbidden' } } }]);
    expect((await p2.domains.get('d')).error?.message).toBe('forbidden');
  });

  it('handles non-JSON error bodies', async () => {
    const { pidgely } = client([{ status: 502, body: '<html>Bad gateway</html>' }], { maxRetries: 0 });
    const { error } = await pidgely.domains.get('d');
    expect(error).toEqual({ statusCode: 502, name: 'internal_server_error', message: '<html>Bad gateway</html>' });
    const { pidgely: p2 } = client([{ status: 400, body: '' }]);
    expect((await p2.domains.get('d')).error).toEqual({ statusCode: 400, name: 'application_error', message: 'HTTP 400' });
    const { pidgely: p3 } = client([{ status: 400, body: '[1]' }]);
    expect((await p3.domains.get('d')).error?.name).toBe('application_error');
  });

  it('returns null data for an empty success body', async () => {
    const { pidgely } = client([{ status: 200 }]);
    expect((await pidgely.domains.remove('d')).data).toBeNull();
  });

  it('reports network errors as application_error', async () => {
    const { pidgely } = client([new TypeError('fetch failed')], { maxRetries: 0 });
    const res = await pidgely.emails.get('x');
    expect(res.error).toEqual({ name: 'application_error', statusCode: null, message: 'Unable to reach the Pidgely API: fetch failed' });
    expect(res.headers).toBeNull();
    const { pidgely: p2, fetch } = client([], { maxRetries: 0 });
    fetch.mockRejectedValueOnce('boom');
    expect((await p2.emails.get('x')).error?.message).toBe('Unable to reach the Pidgely API: boom');
  });

  it('reports invalid success JSON', async () => {
    const { pidgely } = client([{ status: 200, body: '{not json' }], { maxRetries: 0 });
    expect((await pidgely.emails.get('x')).error?.message).toBe('Unable to parse the API response');
  });
});

describe('timeouts and abort', () => {
  it('times out with an application_error', async () => {
    const { pidgely, fetch } = client([], { timeout: 20, maxRetries: 0 });
    fetch.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
    );
    const res = await pidgely.emails.get('x');
    expect(res.error).toEqual({ name: 'application_error', statusCode: null, message: 'Request timed out after 20ms' });
  });

  it('per-request timeout overrides the client timeout', async () => {
    const { pidgely, fetch } = client([], { timeout: 60_000, maxRetries: 0 });
    fetch.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
    );
    expect((await pidgely.emails.get('x', { timeout: 10 })).error?.message).toBe('Request timed out after 10ms');
  });

  it('propagates a caller abort', async () => {
    const { pidgely, fetch } = client();
    fetch.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        }),
    );
    const controller = new AbortController();
    const pending = pidgely.emails.get('x', { signal: controller.signal });
    controller.abort(new Error('user cancelled'));
    await expect(pending).rejects.toThrow('user cancelled');
  });

  it('rejects immediately when already aborted', async () => {
    const { pidgely, fetch } = client();
    const controller = new AbortController();
    controller.abort(new Error('stop'));
    await expect(pidgely.emails.get('x', { signal: controller.signal })).rejects.toThrow('stop');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not retry after a caller abort between attempts', async () => {
    const controller = new AbortController();
    const { pidgely, calls } = client([serverError, { body: {} }]);
    const http = (pidgely.emails as unknown as { http: { sleep: (ms: number) => Promise<void> } }).http;
    http.sleep = async () => {
      controller.abort(new Error('gave up'));
    };
    await expect(pidgely.emails.get('x', { signal: controller.signal })).rejects.toThrow('gave up');
    expect(calls).toHaveLength(1);
  });
});

describe('retries', () => {
  it('retries 429 honoring Retry-After seconds', async () => {
    const { pidgely, calls, sleeps } = client([{ ...rateLimited, headers: { 'Retry-After': '2' } }, { body: { id: 'e' } }]);
    const res = await pidgely.emails.send({ from: 'a@b.com', to: 'c@d.com', subject: 's', text: 't' });
    expect(res.data).toEqual({ id: 'e' });
    expect(calls).toHaveLength(2);
    expect(sleeps).toEqual([2000]);
  });

  it('retries 429 honoring an HTTP-date Retry-After', async () => {
    const date = new Date(Date.now() + 3_000).toUTCString();
    const { pidgely, sleeps } = client([{ ...rateLimited, headers: { 'Retry-After': date } }, { body: {} }]);
    await pidgely.domains.list();
    expect(sleeps).toHaveLength(1);
    expect(sleeps[0]).toBeGreaterThan(1_000);
    expect(sleeps[0]).toBeLessThanOrEqual(3_000);
  });

  it('gives up when Retry-After is longer than a minute', async () => {
    const { pidgely, calls } = client([{ ...rateLimited, headers: { 'Retry-After': '3600' } }, { body: {} }]);
    const res = await pidgely.domains.list();
    expect(res.error?.name).toBe('rate_limit_exceeded');
    expect(calls).toHaveLength(1);
  });

  it('does not retry quota errors', async () => {
    const quota = { status: 429, body: { statusCode: 429, name: 'daily_quota_exceeded', message: 'quota' } };
    const { pidgely, calls } = client([quota, { body: {} }]);
    expect((await pidgely.domains.list()).error?.name).toBe('daily_quota_exceeded');
    expect(calls).toHaveLength(1);
  });

  it('retries 5xx on GET with exponential backoff, up to maxRetries', async () => {
    const { pidgely, calls, sleeps } = client([serverError, serverError, serverError]);
    const res = await pidgely.emails.list();
    expect(res.error?.statusCode).toBe(503);
    expect(calls).toHaveLength(3); // 1 + 2 retries (default)
    expect(sleeps).toHaveLength(2);
    expect(sleeps[0]).toBeGreaterThanOrEqual(250);
    expect(sleeps[0]).toBeLessThanOrEqual(500);
    expect(sleeps[1]).toBeGreaterThanOrEqual(500);
    expect(sleeps[1]).toBeLessThanOrEqual(1000);
  });

  it('does not retry a POST without an idempotency key on 5xx or network errors', async () => {
    const { pidgely, calls } = client([serverError, { body: { id: 'e' } }]);
    const res = await pidgely.emails.send({ from: 'a@b.com', to: 'c@d.com', subject: 's', text: 't' });
    expect(res.error?.statusCode).toBe(503);
    expect(calls).toHaveLength(1);
    const { pidgely: p2, calls: c2 } = client([new TypeError('reset'), { body: { id: 'e' } }]);
    await p2.emails.send({ from: 'a@b.com', to: 'c@d.com', subject: 's', text: 't' });
    expect(c2).toHaveLength(1);
  });

  it('retries a POST carrying an idempotency key, with the same key', async () => {
    const { pidgely, calls } = client([serverError, new TypeError('reset'), { body: { id: 'e' } }]);
    const res = await pidgely.emails.send(
      { from: 'a@b.com', to: 'c@d.com', subject: 's', text: 't' },
      { idempotencyKey: 'welcome/123' },
    );
    expect(res.data).toEqual({ id: 'e' });
    expect(calls).toHaveLength(3);
    expect(calls.map((c) => c.headers['Idempotency-Key'])).toEqual(['welcome/123', 'welcome/123', 'welcome/123']);
  });

  it('retries network errors on idempotent methods', async () => {
    const { pidgely, calls } = client([new TypeError('reset'), { body: { object: 'domain', id: 'd' } }]);
    expect((await pidgely.domains.remove('d')).data).toEqual({ object: 'domain', id: 'd' });
    expect(calls).toHaveLength(2);
  });

  it('does not retry 4xx errors other than 408/429', async () => {
    const { pidgely, calls } = client([{ status: 404, body: { statusCode: 404, name: 'not_found', message: 'x' } }]);
    await pidgely.emails.get('x');
    expect(calls).toHaveLength(1);
  });

  it('honours maxRetries per client and per request', async () => {
    const { pidgely, calls } = client([serverError], { maxRetries: 0 });
    await pidgely.emails.list();
    expect(calls).toHaveLength(1);
    const { pidgely: p2, calls: c2 } = client([serverError]);
    await p2.emails.list(undefined, { maxRetries: 4 });
    expect(c2).toHaveLength(5);
  });
});

describe('helpers', () => {
  it('parseRetryAfter', () => {
    expect(parseRetryAfter(undefined)).toBeNull();
    expect(parseRetryAfter('')).toBeNull();
    expect(parseRetryAfter('1.5')).toBe(1500);
    expect(parseRetryAfter('garbage')).toBeNull();
    expect(parseRetryAfter(new Date(10_000).toUTCString(), 4_000)).toBe(6_000);
    expect(parseRetryAfter(new Date(1_000).toUTCString(), 4_000)).toBe(0);
  });

  it('backoff grows exponentially with jitter and caps at 8s', () => {
    expect(backoff(0, () => 0)).toBe(250);
    expect(backoff(0, () => 1)).toBe(500);
    expect(backoff(3, () => 1)).toBe(4000);
    expect(backoff(10, () => 1)).toBe(8000);
    expect(backoff(10, () => 0)).toBe(4000);
  });

  it('queryString skips empty values', () => {
    expect(queryString(undefined)).toBe('');
    expect(queryString({ a: undefined, b: null })).toBe('');
    expect(queryString({ limit: 10, after: 'x y', ok: true })).toBe('?limit=10&after=x+y&ok=true');
  });

  it('sends JSON bodies with Content-Type', async () => {
    const { pidgely, calls } = client([{ body: { id: 'x' } }]);
    await pidgely.segments.create({ name: 'VIP' });
    expect(lastCall(calls).headers['Content-Type']).toBe('application/json');
    expect(lastCall(calls).body).toEqual({ name: 'VIP' });
  });
});
