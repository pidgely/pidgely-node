import type { FetchLike } from './http';
import { HttpClient } from './http';
import { ApiKeys } from './resources/api-keys';
import { Batch } from './resources/batch';
import { Brand } from './resources/brand';
import { Broadcasts } from './resources/broadcasts';
import { Contacts } from './resources/contacts';
import { Domains } from './resources/domains';
import { Emails } from './resources/emails';
import { Segments } from './resources/segments';
import { Suppressions } from './resources/suppressions';
import { TemplateBuilder } from './resources/template-builder';
import { Templates } from './resources/templates';
import { Usage } from './resources/usage';
import { Webhooks } from './resources/webhooks';

export const DEFAULT_BASE_URL = 'https://api.pidgely.com';

export interface PidgelyOptions {
  /** API base URL. Defaults to `PIDGELY_BASE_URL` or `https://api.pidgely.com`. */
  baseUrl?: string;
  /** Per-attempt timeout in milliseconds (default 30 000; `0` disables). */
  timeout?: number;
  /**
   * Automatic retries on 408/429/5xx and network errors (default 2). 429 is always retried
   * (except quota errors); 5xx and network errors are retried for GET/PATCH/DELETE and for
   * POST requests that carry an `idempotencyKey`. `Retry-After` is honoured.
   */
  maxRetries?: number;
  /** Custom fetch implementation (defaults to the global `fetch`). */
  fetch?: FetchLike;
  /** Appended to the `pidgely-node/<version>` user agent. */
  userAgent?: string;
  /** Headers sent with every request. */
  headers?: Record<string, string>;
}

function env(name: string): string | undefined {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return proc?.env?.[name] || undefined;
}

export class Pidgely {
  /** The API key in use (non-enumerable, so it does not show up when the client is logged or serialized). */
  declare readonly key: string;
  readonly baseUrl: string;

  readonly emails: Emails;
  readonly batch: Batch;
  readonly domains: Domains;
  readonly apiKeys: ApiKeys;
  readonly contacts: Contacts;
  readonly segments: Segments;
  /** @deprecated Audiences are now segments; same API, kept for Resend compatibility. */
  readonly audiences: Segments;
  readonly broadcasts: Broadcasts;
  readonly templates: Templates;
  /** Visual builder and AI assist (Pidgely extension, Scale plan). */
  readonly templateBuilder: TemplateBuilder;
  /** Brand import from a website (Pidgely extension, Scale plan). */
  readonly brand: Brand;
  readonly webhooks: Webhooks;
  readonly suppressions: Suppressions;
  /** Today's usage and quota. */
  readonly usage: Usage;

  /**
   * @param key API key (`pdg_…`). Defaults to the `PIDGELY_API_KEY` environment variable.
   * @throws when no API key is available.
   */
  constructor(key?: string, options: PidgelyOptions = {}) {
    const apiKey = key || env('PIDGELY_API_KEY');
    if (!apiKey) {
      throw new Error('Missing API key. Pass it to the constructor `new Pidgely("pdg_123")` or set PIDGELY_API_KEY.');
    }
    Object.defineProperty(this, 'key', { value: apiKey, enumerable: false, writable: false });
    this.baseUrl = (options.baseUrl || env('PIDGELY_BASE_URL') || DEFAULT_BASE_URL).replace(/\/+$/, '');

    const http = new HttpClient({
      apiKey,
      baseUrl: this.baseUrl,
      timeout: options.timeout ?? 30_000,
      maxRetries: options.maxRetries ?? 2,
      fetch: options.fetch,
      userAgent: options.userAgent,
      headers: options.headers,
    });

    this.emails = new Emails(http);
    this.batch = new Batch(http);
    this.domains = new Domains(http);
    this.apiKeys = new ApiKeys(http);
    this.contacts = new Contacts(http);
    this.segments = new Segments(http);
    this.audiences = this.segments;
    this.broadcasts = new Broadcasts(http);
    this.templates = new Templates(http);
    this.templateBuilder = new TemplateBuilder(http);
    this.brand = new Brand(http);
    this.webhooks = new Webhooks(http);
    this.suppressions = new Suppressions(http);
    this.usage = new Usage(http);
  }
}
