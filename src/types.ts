import type { components } from './generated/openapi';

type Schemas = components['schemas'];

/** Marks the keys `K` of `T` as always present (the API always serializes them). */
type WithRequired<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: T[P] };

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

/** Machine-readable error names returned by the API (plus SDK-side `application_error`). */
export type PidgelyErrorName =
  | 'validation_error'
  | 'missing_required_field'
  | 'not_found'
  | 'missing_api_key'
  | 'invalid_api_key'
  | 'restricted_api_key'
  | 'rate_limit_exceeded'
  | 'daily_quota_exceeded'
  | 'monthly_quota_exceeded'
  | 'invalid_idempotency_key'
  | 'invalid_idempotent_request'
  | 'concurrent_idempotent_requests'
  | 'method_not_allowed'
  | 'internal_server_error'
  | 'application_error'
  // Forward compatible: the API may add names.
  | (string & {});

/** Error body returned by the API: `{ statusCode, name, message }`. */
export interface ErrorResponse {
  message: string;
  /** HTTP status, or `null` when the request never got a response (network error, timeout). */
  statusCode: number | null;
  name: PidgelyErrorName;
}

/**
 * Every method resolves to `{ data, error, headers }` and never throws for API or
 * network errors (same contract as the Resend SDK).
 */
export type Response<T> = (
  | { data: T; error: null }
  | { data: null; error: ErrorResponse }
) & {
  /** Response headers (lower-cased), or `null` when there was no response. */
  headers: Record<string, string> | null;
};

export interface PaginatedData<T> {
  object: 'list';
  has_more: boolean;
  data: T[];
}

/** Cursor pagination: `after`/`before` take an item id. */
export type PaginationOptions = { limit?: number } & (
  | { after?: string; before?: never }
  | { before?: string; after?: never }
);

export type Tag = Schemas['Tag'];
export type Email = WithRequired<
  Schemas['Email'],
  'id' | 'message_id' | 'to' | 'from' | 'created_at' | 'subject' | 'bcc' | 'cc' | 'reply_to' | 'last_event' | 'scheduled_at'
>;
export type EmailAttachment = WithRequired<
  Schemas['EmailAttachment'],
  'id' | 'filename' | 'size' | 'content_type' | 'content_disposition' | 'content_id' | 'download_url' | 'expires_at'
>;
export type DomainRecord = WithRequired<Schemas['DomainRecord'], 'record' | 'name' | 'type' | 'ttl' | 'status' | 'value'>;
export type Domain = WithRequired<
  Omit<Schemas['Domain'], 'records' | 'capabilities'>,
  'id' | 'name' | 'status' | 'created_at' | 'region' | 'open_tracking' | 'click_tracking' | 'tls'
> & {
  capabilities: { sending: string; receiving: string };
  /** DNS records to publish. Present on create/get, omitted in lists. */
  records?: DomainRecord[];
};
export type ApiKey = WithRequired<Schemas['ApiKey'], 'id' | 'name' | 'permission' | 'created_at' | 'last_used_at'>;
export type CreatedApiKey = WithRequired<Schemas['CreatedApiKey'], 'id' | 'token'>;
export type Webhook = WithRequired<Schemas['Webhook'], 'id' | 'created_at' | 'status' | 'endpoint' | 'events'>;
export type Suppression = WithRequired<Schemas['Suppression'], 'id' | 'email' | 'origin' | 'source_id' | 'created_at'>;
export type SuppressionOrigin = Suppression['origin'];
export type Contact = WithRequired<
  Schemas['Contact'],
  'id' | 'email' | 'first_name' | 'last_name' | 'created_at' | 'unsubscribed'
>;
export type Segment = WithRequired<Schemas['Segment'], 'id' | 'name' | 'created_at'>;
export type Broadcast = WithRequired<
  Schemas['Broadcast'],
  'id' | 'name' | 'audience_id' | 'segment_id' | 'status' | 'created_at' | 'scheduled_at' | 'sent_at' | 'topic_id'
>;
export type TemplateVariable = Schemas['TemplateVariable'];
export type Template = WithRequired<
  Schemas['Template'],
  'id' | 'alias' | 'name' | 'created_at' | 'updated_at' | 'status' | 'published_at'
>;

/** `{ object, id }` returned by most mutations. */
export interface ObjectId {
  object: string;
  id: string;
}
/** `{ object, id, deleted }` returned by deletions. */
export interface Deleted {
  object: string;
  id: string;
  deleted: boolean;
}

// ---------------------------------------------------------------------------
// Request options
// ---------------------------------------------------------------------------

export interface RequestOptions {
  /** Extra headers for this request. */
  headers?: Record<string, string>;
  /** Abort the request (and its retries). */
  signal?: AbortSignal;
  /** Per-attempt timeout in milliseconds (overrides the client option). */
  timeout?: number;
  /** Maximum retries for this request (overrides the client option). */
  maxRetries?: number;
}

export interface IdempotentRequestOptions extends RequestOptions {
  /**
   * Sent as the `Idempotency-Key` header: the API replays the stored response for 24 hours
   * and rejects a different body with the same key (409). Also makes POST requests safe to
   * retry automatically on 5xx and network errors.
   */
  idempotencyKey?: string;
}

// ---------------------------------------------------------------------------
// Emails
// ---------------------------------------------------------------------------

/**
 * A React element (for example a React Email component). Typed loosely so the SDK does not
 * depend on `@types/react`; rendering requires the optional peer `@react-email/render`.
 */
export type ReactNodeLike = unknown;

export interface Attachment {
  /** File content: base64 string, `Uint8Array` or `Buffer`. Use either `content` or `path`. */
  content?: string | Uint8Array;
  filename?: string;
  /** http(s) URL fetched at send time. */
  path?: string;
  contentType?: string;
  /** Makes the attachment inline; reference it as `cid:<contentId>` in the HTML. */
  contentId?: string;
}

interface EmailBaseOptions {
  /** `"Name <sender@your-verified-domain.com>"`. May come from the template. */
  from?: string;
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string | string[];
  subject?: string;
  html?: string;
  /** Generated from `html` when omitted. */
  text?: string;
  /** Rendered to `html` with `@react-email/render` (optional peer dependency). */
  react?: ReactNodeLike;
  headers?: Record<string, string>;
  attachments?: Attachment[];
  tags?: Tag[];
  /** ISO 8601 or natural language (`"in 1 hour"`, `"tomorrow at 9am"`), within 30 days. */
  scheduledAt?: string;
  /** Not supported yet: a non-empty value is rejected by the API. */
  topicId?: string | null;
  /** Pidgely extension: `transactional` (default) or `broadcast` (adds RFC 8058 unsubscribe). */
  stream?: 'transactional' | 'broadcast';
}

export interface EmailTemplate {
  /** Template id or alias (its published version is used). */
  id: string;
  variables?: Record<string, string | number>;
}

export type CreateEmailOptions =
  | (EmailBaseOptions & { template?: never })
  | (Omit<EmailBaseOptions, 'html' | 'text' | 'react'> & {
      template: EmailTemplate;
      html?: never;
      text?: never;
      react?: never;
    });

export type CreateEmailRequestOptions = IdempotentRequestOptions;
export interface CreateEmailResponseSuccess {
  id: string;
}

export type ListEmailsOptions = PaginationOptions;
export interface UpdateEmailOptions {
  id: string;
  scheduledAt: string;
}
export type ListAttachmentsOptions = PaginationOptions & { emailId: string };
export interface GetAttachmentOptions {
  emailId: string;
  id: string;
}

export type CreateBatchOptions = CreateEmailOptions[];
export interface CreateBatchRequestOptions extends IdempotentRequestOptions {
  /** `strict` (default): all or nothing. `permissive`: valid emails are sent, invalid ones reported in `errors`. */
  batchValidation?: 'strict' | 'permissive';
}
export interface CreateBatchResponseSuccess {
  data: { id: string }[];
  /** Present with `batchValidation: 'permissive'`. */
  errors?: { index: number; message: string }[];
}

// ---------------------------------------------------------------------------
// Domains
// ---------------------------------------------------------------------------

export interface CreateDomainOptions {
  name: string;
  region?: string;
  /** Bounce subdomain label (default `bounces`). */
  customReturnPath?: string;
  tls?: 'opportunistic' | 'enforced';
  /** Accepted, not supported yet. */
  openTracking?: boolean;
  /** Accepted, not supported yet. */
  clickTracking?: boolean;
  capabilities?: { sending?: string; receiving?: string };
}
export type ListDomainsOptions = PaginationOptions;
export interface UpdateDomainOptions {
  id: string;
  tls?: 'opportunistic' | 'enforced';
  openTracking?: boolean;
  clickTracking?: boolean;
}

// ---------------------------------------------------------------------------
// API keys
// ---------------------------------------------------------------------------

export interface CreateApiKeyOptions {
  name: string;
  permission?: 'full_access' | 'sending_access';
  /** Restrict a `sending_access` key to one domain. */
  domainId?: string;
  /** Resend spelling of `domainId`. */
  domain_id?: string;
}
export type ListApiKeysOptions = PaginationOptions;
export interface UpdateApiKeyOptions {
  name: string;
}

// ---------------------------------------------------------------------------
// Contacts, segments
// ---------------------------------------------------------------------------

export type ContactPropertyValue = string | number | boolean | null;

/** Select a contact by `id` or by `email`. */
export type ContactSelector = { id: string; email?: never } | { email: string; id?: never };

export interface CreateContactOptions {
  email: string;
  firstName?: string;
  lastName?: string;
  unsubscribed?: boolean;
  properties?: Record<string, ContactPropertyValue>;
  /** Segments to add the contact to. */
  segments?: { id: string }[];
  /** @deprecated Legacy audiences: creates the contact through `/audiences/{id}/contacts`. */
  audienceId?: string;
}
export type ListContactsOptions = PaginationOptions & {
  segmentId?: string;
  /** @deprecated Use `segmentId`. */
  audienceId?: string;
};
export type GetContactOptions = string | (ContactSelector & { audienceId?: string });
export type UpdateContactOptions = ContactSelector & {
  firstName?: string | null;
  lastName?: string | null;
  unsubscribed?: boolean;
  properties?: Record<string, ContactPropertyValue>;
  /** @deprecated Legacy audiences. */
  audienceId?: string;
};
export type RemoveContactOptions = string | (ContactSelector & { audienceId?: string });
export interface RemoveContactResponseSuccess {
  object: string;
  contact: string;
  deleted: boolean;
}

export type ContactSegmentsSelector = { contactId: string; email?: never } | { email: string; contactId?: never };
export type ListContactSegmentsOptions = PaginationOptions & ContactSegmentsSelector;
export type ContactSegmentOptions = ContactSegmentsSelector & { segmentId: string };
export interface RemoveContactSegmentResponseSuccess {
  object: string;
  id: string;
  segment_id: string;
  deleted: boolean;
}

export interface CreateSegmentOptions {
  name: string;
}
export interface CreateSegmentResponseSuccess {
  object: string;
  id: string;
  name: string;
}
export type ListSegmentsOptions = PaginationOptions;
export interface UpdateSegmentOptions {
  name: string;
}

// ---------------------------------------------------------------------------
// Broadcasts
// ---------------------------------------------------------------------------

export interface CreateBroadcastOptions {
  segmentId?: string;
  /** @deprecated Legacy alias of `segmentId`. */
  audienceId?: string;
  from: string;
  subject: string;
  replyTo?: string | string[];
  /**
   * Supports `{{{FIRST_NAME|there}}}`, `{{{LAST_NAME}}}`, `{{{EMAIL}}}`, `{{{contact.<property>}}}`,
   * `{{{RESEND_UNSUBSCRIBE_URL}}}` and `{{{PIDGELY_UNSUBSCRIBE_URL}}}`.
   */
  html?: string;
  text?: string;
  react?: ReactNodeLike;
  name?: string;
  previewText?: string;
  /** Send right away (or at `scheduledAt`) instead of creating a draft. */
  send?: boolean;
  scheduledAt?: string;
  /** Not supported yet. */
  topicId?: string | null;
}
export type UpdateBroadcastOptions = Partial<CreateBroadcastOptions>;
export interface SendBroadcastOptions {
  /** ISO 8601 or natural language. Omit to send now. */
  scheduledAt?: string;
}
export type ListBroadcastsOptions = PaginationOptions;

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export type TemplateVariableOptions =
  | { key: string; type: 'string'; fallbackValue?: string | null }
  | { key: string; type: 'number'; fallbackValue?: number | null };

export interface CreateTemplateOptions {
  name: string;
  alias?: string;
  from?: string;
  subject?: string;
  replyTo?: string | string[];
  html?: string;
  text?: string;
  react?: ReactNodeLike;
  variables?: TemplateVariableOptions[];
}
export type UpdateTemplateOptions = Partial<CreateTemplateOptions>;
export type ListTemplatesOptions = PaginationOptions;

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

export type WebhookEventType =
  | 'email.sent'
  | 'email.delivered'
  | 'email.delivery_delayed'
  | 'email.bounced'
  | 'email.complained'
  | 'email.failed'
  | 'email.suppressed'
  | 'email.opened'
  | 'email.clicked'
  | 'domain.created'
  | 'domain.updated'
  | 'domain.deleted'
  | 'contact.created'
  | 'contact.updated'
  | 'contact.deleted'
  | (string & {});

export interface CreateWebhookOptions {
  endpoint: string;
  events: WebhookEventType[];
}
export interface CreateWebhookResponseSuccess {
  object: string;
  id: string;
  /** `whsec_…`: store it to verify deliveries. */
  signing_secret: string;
}
export interface UpdateWebhookOptions {
  endpoint?: string;
  events?: WebhookEventType[];
  status?: 'enabled' | 'disabled';
}
export type ListWebhooksOptions = PaginationOptions;

/** Payload delivered to webhook endpoints (Resend format). */
export interface WebhookEvent<T = Record<string, unknown>> {
  type: WebhookEventType;
  created_at: string;
  data: T & {
    email_id?: string;
    from?: string;
    to?: string[];
    subject?: string;
    created_at?: string;
    tags?: Record<string, string> | Tag[];
  };
}

// ---------------------------------------------------------------------------
// Suppressions
// ---------------------------------------------------------------------------

export interface AddSuppressionOptions {
  email: string;
}
export type ListSuppressionsOptions = PaginationOptions & { origin?: SuppressionOrigin };
export interface BatchAddSuppressionsOptions {
  /** Up to 100 addresses. */
  emails: string[];
}
export interface BatchRemoveSuppressionsOptions {
  emails?: string[];
  ids?: string[];
}
