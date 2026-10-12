import type { ErrorResponse, IdempotentRequestOptions, Response } from './types';
import { VERSION } from './version';

export type FetchLike = (input: string, init: RequestInit) => Promise<globalThis.Response>;

export interface HttpClientConfig {
  apiKey: string;
  baseUrl: string;
  timeout: number;
  maxRetries: number;
  fetch?: FetchLike;
  userAgent?: string;
  headers?: Record<string, string>;
}

export type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';
export type Query = Record<string, string | number | boolean | undefined | null>;

export interface HttpRequest extends IdempotentRequestOptions {
  query?: Query;
  body?: unknown;
}

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const IDEMPOTENT_METHODS = new Set<Method>(['GET', 'DELETE', 'PATCH']);
/** Base and cap of the exponential backoff, in ms. */
const BACKOFF_BASE_MS = 500;
const BACKOFF_CAP_MS = 8_000;
/** A server asking us to wait longer than this is not retried. */
const MAX_RETRY_AFTER_MS = 60_000;

/** Minimal HTTP layer: auth, JSON, timeouts, retries. Never throws for API or network errors. */
export class HttpClient {
  // ES private field: never enumerable, serialized or shown by util.inspect, so the API key does not leak in logs.
  readonly #config: HttpClientConfig;

  constructor(config: HttpClientConfig) {
    this.#config = config;
  }

  /** Exposed for tests (and so `sleep` can be stubbed). */
  sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

  get<T>(path: string, req: HttpRequest = {}): Promise<Response<T>> {
    return this.request<T>('GET', path, req);
  }
  post<T>(path: string, req: HttpRequest = {}): Promise<Response<T>> {
    return this.request<T>('POST', path, req);
  }
  patch<T>(path: string, req: HttpRequest = {}): Promise<Response<T>> {
    return this.request<T>('PATCH', path, req);
  }
  delete<T>(path: string, req: HttpRequest = {}): Promise<Response<T>> {
    return this.request<T>('DELETE', path, req);
  }

  async request<T>(method: Method, path: string, req: HttpRequest = {}): Promise<Response<T>> {
    const url = this.#config.baseUrl + path + queryString(req.query);
    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: `Bearer ${this.#config.apiKey}`,
      'User-Agent': this.#config.userAgent
        ? `pidgely-node/${VERSION} ${this.#config.userAgent}`
        : `pidgely-node/${VERSION}`,
      ...this.#config.headers,
      ...req.headers,
    };
    let body: string | undefined;
    if (req.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(req.body);
    }
    if (req.idempotencyKey) headers['Idempotency-Key'] = req.idempotencyKey;

    const maxRetries = Math.max(0, req.maxRetries ?? this.#config.maxRetries);
    const timeout = req.timeout ?? this.#config.timeout;
    const canRetryUnsafe = IDEMPOTENT_METHODS.has(method) || Boolean(req.idempotencyKey);
    const doFetch: FetchLike = this.#config.fetch ?? ((input, init) => globalThis.fetch(input, init));

    for (let attempt = 0; ; attempt++) {
      const result = await this.attempt<T>(doFetch, url, { method, headers, body }, timeout, req.signal);
      if (attempt >= maxRetries) return result.response;

      let delay: number | null = null;
      if (result.kind === 'network') {
        if (canRetryUnsafe) delay = backoff(attempt);
      } else if (result.kind === 'http' && RETRYABLE_STATUS.has(result.status)) {
        const quota = /quota_exceeded$/.test(result.response.error?.name ?? '');
        const safe = result.status === 429 ? !quota : canRetryUnsafe;
        if (safe) {
          const retryAfter = parseRetryAfter(result.response.headers?.['retry-after']);
          if (retryAfter === null) delay = backoff(attempt);
          else if (retryAfter <= MAX_RETRY_AFTER_MS) delay = retryAfter;
        }
      }
      if (delay === null) return result.response;
      if (req.signal?.aborted) throw req.signal.reason;
      await this.sleep(delay);
    }
  }

  private async attempt<T>(
    doFetch: FetchLike,
    url: string,
    init: { method: Method; headers: Record<string, string>; body: string | undefined },
    timeout: number,
    signal: AbortSignal | undefined,
  ): Promise<
    | { kind: 'ok'; response: Response<T> }
    | { kind: 'http'; status: number; response: Response<T> }
    | { kind: 'network'; response: Response<T> }
  > {
    if (signal?.aborted) throw signal.reason;
    const controller = new AbortController();
    const onAbort = () => controller.abort(signal?.reason);
    signal?.addEventListener('abort', onAbort, { once: true });
    let timedOut = false;
    const timer =
      timeout > 0
        ? setTimeout(() => {
            timedOut = true;
            controller.abort();
          }, timeout)
        : undefined;

    try {
      const res = await doFetch(url, { ...init, signal: controller.signal });
      const headers = headersToRecord(res.headers);
      const text = await res.text();
      if (res.ok) {
        return { kind: 'ok', response: { data: (text ? JSON.parse(text) : null) as T, error: null, headers } };
      }
      return { kind: 'http', status: res.status, response: { data: null, error: parseError(res, text), headers } };
    } catch (err) {
      // A caller-initiated abort propagates, like fetch itself.
      if (signal?.aborted) throw signal.reason;
      const message = timedOut
        ? `Request timed out after ${timeout}ms`
        : err instanceof SyntaxError
          ? 'Unable to parse the API response'
          : `Unable to reach the Pidgely API: ${err instanceof Error ? err.message : String(err)}`;
      return {
        kind: 'network',
        response: { data: null, error: { name: 'application_error', statusCode: null, message }, headers: null },
      };
    } finally {
      if (timer) clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }
}

function parseError(res: globalThis.Response, text: string): ErrorResponse {
  try {
    const body: unknown = JSON.parse(text);
    if (body && typeof body === 'object') {
      const b = body as Record<string, unknown>;
      if (typeof b.name === 'string' && typeof b.message === 'string') {
        return { name: b.name, message: b.message, statusCode: typeof b.statusCode === 'number' ? b.statusCode : res.status };
      }
      // Native `/v1` error shape: { error: { code, message } }
      const e = b.error as Record<string, unknown> | undefined;
      if (e && typeof e.code === 'string') {
        return { name: e.code, message: typeof e.message === 'string' ? e.message : e.code, statusCode: res.status };
      }
    }
  } catch {
    // fall through
  }
  return {
    name: res.status >= 500 ? 'internal_server_error' : 'application_error',
    message: text.trim() || res.statusText || `HTTP ${res.status}`,
    statusCode: res.status,
  };
}

function headersToRecord(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key.toLowerCase()] = value;
  });
  return out;
}

/** `Retry-After` in seconds or as an HTTP date, converted to ms. `null` when absent or invalid. */
export function parseRetryAfter(value: string | undefined, now = Date.now()): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d+(\.\d+)?$/.test(trimmed)) return Math.round(Number(trimmed) * 1000);
  const date = Date.parse(trimmed);
  if (Number.isNaN(date)) return null;
  return Math.max(0, date - now);
}

/** Exponential backoff with jitter: 50-100% of min(cap, base * 2^attempt). */
export function backoff(attempt: number, random = Math.random): number {
  const exp = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** attempt);
  return Math.round(exp / 2 + random() * (exp / 2));
}

export function queryString(query: Query | undefined): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) params.append(key, String(value));
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

/** Encodes a path segment (ids, emails, template aliases). */
export function seg(value: string): string {
  return encodeURIComponent(value);
}
