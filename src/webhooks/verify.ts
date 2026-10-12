import { fromBase64, toBase64 } from '../transform';
import type { WebhookEvent } from '../types';

/** Thrown by {@link verifyWebhook} when a delivery cannot be trusted. */
export class WebhookVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebhookVerificationError';
  }
}

/** The three Standard Webhooks values, already extracted. */
export interface WebhookHeaders {
  id: string;
  timestamp: string;
  signature: string;
}

/**
 * Request headers: a Fetch `Headers`, a Node `IncomingHttpHeaders`-like record, or
 * `{ id, timestamp, signature }`. Both `svix-*` and `webhook-*` names are accepted.
 */
export type WebhookHeadersInput = Headers | WebhookHeaders | Record<string, string | string[] | undefined>;

export interface VerifyWebhookOptions {
  /** The raw request body, exactly as received (do not re-serialize parsed JSON). */
  payload: string | Uint8Array;
  headers: WebhookHeadersInput;
  /** The endpoint's signing secret (`whsec_…`). */
  webhookSecret: string;
  /** Maximum clock difference in seconds (default 300). */
  tolerance?: number;
  /** Override the current time (tests). */
  now?: Date;
}

const DEFAULT_TOLERANCE_SECONDS = 5 * 60;
const encoder = new TextEncoder();

function header(headers: WebhookHeadersInput, name: 'id' | 'timestamp' | 'signature'): string | undefined {
  if (typeof Headers !== 'undefined' && headers instanceof Headers) {
    return headers.get(`webhook-${name}`) ?? headers.get(`svix-${name}`) ?? undefined;
  }
  const record = headers as Record<string, string | string[] | undefined>;
  const lower: Record<string, string | string[] | undefined> = {};
  for (const [k, v] of Object.entries(record)) lower[k.toLowerCase()] = v;
  const value = lower[`webhook-${name}`] ?? lower[`svix-${name}`] ?? lower[name];
  return Array.isArray(value) ? value.join(' ') : value;
}

type Subtle = Pick<SubtleCrypto, 'importKey' | 'sign'>;

/** WebCrypto's `subtle`, from the global (Node 19+, Bun, Deno, edge) or `node:crypto` (Node 18). */
export async function subtle(
  web: { subtle?: Subtle } | null = (globalThis as { crypto?: { subtle?: Subtle } }).crypto ?? null,
): Promise<Subtle> {
  if (web?.subtle) return web.subtle;
  // Node 18 without the global: fall back to node:crypto's WebCrypto.
  const specifier = 'node:crypto';
  const mod = (await import(/* webpackIgnore: true */ /* @vite-ignore */ specifier)) as { webcrypto: { subtle: Subtle } };
  return mod.webcrypto.subtle;
}

/** Constant-time comparison of two strings (length is not secret). */
export function timingSafeEqual(a: string, b: string): boolean {
  const x = encoder.encode(a);
  const y = encoder.encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= (x[i] as number) ^ (y[i] as number);
  return diff === 0;
}

/** Computes the `v1,<base64>` signature of a delivery (Standard Webhooks). */
export async function signWebhook(secret: string, id: string, timestamp: number | string, payload: string | Uint8Array): Promise<string> {
  const encoded = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new WebhookVerificationError('Invalid webhook secret');
  const key = fromBase64(encoded);
  const body = typeof payload === 'string' ? encoder.encode(payload) : payload;
  const prefix = encoder.encode(`${id}.${timestamp}.`);
  const message = new Uint8Array(prefix.length + body.length);
  message.set(prefix, 0);
  message.set(body, prefix.length);
  const s = await subtle();
  const cryptoKey = await s.importKey('raw', key as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await s.sign('HMAC', cryptoKey, message as BufferSource));
  return `v1,${toBase64(mac)}`;
}

/**
 * Verifies a webhook delivery (Standard Webhooks / Svix scheme) and returns the parsed event.
 * Checks the timestamp against `tolerance` and compares signatures in constant time.
 *
 * @throws {WebhookVerificationError} when headers are missing, the timestamp is outside the
 * tolerance, or no signature matches.
 */
export async function verifyWebhook<T = Record<string, unknown>>(options: VerifyWebhookOptions): Promise<WebhookEvent<T>> {
  const { payload, headers, webhookSecret } = options;
  if (!webhookSecret) throw new WebhookVerificationError('Missing webhook secret');
  const id = header(headers, 'id');
  const timestamp = header(headers, 'timestamp');
  const signature = header(headers, 'signature');
  if (!id || !timestamp || !signature) throw new WebhookVerificationError('Missing required headers');

  if (!/^\d+$/.test(timestamp)) throw new WebhookVerificationError('Invalid signature headers');
  const ts = Number(timestamp);
  const now = Math.floor((options.now ?? new Date()).getTime() / 1000);
  const tolerance = options.tolerance ?? DEFAULT_TOLERANCE_SECONDS;
  if (now - ts > tolerance) throw new WebhookVerificationError('Message timestamp too old');
  if (ts - now > tolerance) throw new WebhookVerificationError('Message timestamp too new');

  const expected = await signWebhook(webhookSecret, id, timestamp, payload);
  let ok = false;
  for (const candidate of signature.split(' ')) {
    // Evaluate every candidate so timing does not reveal which one matched.
    if (timingSafeEqual(candidate, expected)) ok = true;
  }
  if (!ok) throw new WebhookVerificationError('No matching signature found');

  const text = typeof payload === 'string' ? payload : new TextDecoder().decode(payload);
  try {
    return JSON.parse(text) as WebhookEvent<T>;
  } catch {
    throw new WebhookVerificationError('Payload is not valid JSON');
  }
}
