<p align="center">
  <a href="https://pidgely.com"><img src=".github/assets/banner.png" alt="Pidgely — Email API for developers" width="100%"></a>
</p>

<p align="center">
  <a href="https://github.com/pidgely/pidgely-node/actions/workflows/ci.yml"><img src="https://github.com/pidgely/pidgely-node/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/pidgely"><img src="https://img.shields.io/npm/v/pidgely?color=E2793F" alt="npm"></a>
  <img src="https://img.shields.io/badge/node-%E2%89%A518-339933?logo=node.js&logoColor=white" alt="Node ≥ 18">
  <img src="https://img.shields.io/badge/dependencies-0-success" alt="Zero dependencies">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT"></a>
</p>

# pidgely

The official Node.js / TypeScript SDK for [Pidgely](https://pidgely.com), the Resend-compatible email API.

- **Drop-in for Resend.** Same methods and the same `{ data, error }` results. Migrating means changing an import and a key.
- **Zero dependencies.** Uses the global `fetch`. Runs on Node.js 18+, Bun, Deno, Cloudflare Workers, Vercel Edge and other edge runtimes.
- **Typed from the OpenAPI spec.** ESM and CommonJS builds ship with declarations.
- **Built for production.** Idempotency keys, automatic retries with backoff that honour `Retry-After`, per-request timeouts and abort signals.
- **Webhook verification.** Standard Webhooks (Svix) signatures, checked in constant time with timestamp tolerance.

Full documentation lives at **[docs.pidgely.com](https://docs.pidgely.com)**.

## Install

```sh
npm install pidgely
# pnpm add pidgely · yarn add pidgely · bun add pidgely
```

## Quickstart

Create an API key in the [dashboard](https://app.pidgely.com), verify a sending domain, then:

```ts
import { Pidgely } from 'pidgely';

const pidgely = new Pidgely('pdg_...'); // or set PIDGELY_API_KEY and call new Pidgely()

const { data, error } = await pidgely.emails.send({
  from: 'Acme <hello@acme.com>',
  to: ['delivered@example.com'],
  subject: 'Hello from Pidgely',
  html: '<p>It works!</p>',
});

if (error) {
  console.error(error); // { statusCode, name, message }
} else {
  console.log(data.id);
}
```

CommonJS works too: `const { Pidgely } = require('pidgely')`.

### Configuration

```ts
const pidgely = new Pidgely(process.env.PIDGELY_API_KEY, {
  baseUrl: 'https://api.pidgely.com', // or PIDGELY_BASE_URL
  timeout: 30_000, // per attempt, in ms (0 disables)
  maxRetries: 2, // automatic retries, see below
  userAgent: 'my-app/1.2.3', // appended to pidgely-node/<version>
  headers: { 'X-Team': 'growth' }, // sent with every request
  fetch: customFetch, // defaults to globalThis.fetch
});
```

| Environment variable | Used for |
|---|---|
| `PIDGELY_API_KEY` | API key when none is passed to the constructor |
| `PIDGELY_BASE_URL` | Base URL when `baseUrl` is not set (default `https://api.pidgely.com`) |

### Results and errors

Methods never throw on API or network errors. They resolve to a `Response<T>`:

```ts
type Response<T> =
  | { data: T; error: null; headers: Record<string, string> | null }
  | { data: null; error: { statusCode: number | null; name: string; message: string }; headers: Record<string, string> | null };
```

`error.name` is machine-readable: `validation_error`, `not_found`, `invalid_api_key`, `restricted_api_key`, `rate_limit_exceeded`, `daily_quota_exceeded`, `invalid_idempotent_request` and so on. Network failures and timeouts come back as `application_error` with `statusCode: null`. The only thing that rejects is an `AbortSignal` you abort yourself, the same as `fetch`.

Every method also accepts a final `options` argument with `headers`, `signal`, `timeout` and `maxRetries`. Send methods add `idempotencyKey`.

### Idempotency

```ts
await pidgely.emails.send(
  { from: 'Acme <billing@acme.com>', to: 'ana@example.com', subject: 'Receipt #1042', html },
  { idempotencyKey: 'receipt-1042' },
);
```

The key is sent as `Idempotency-Key`. For 24 hours the API replays the stored response for the same key (the reply carries the header `idempotent-replayed: true`) and answers `409` when the body differs.

### Retries

Failed requests are retried up to `maxRetries` times (default 2) with exponential backoff and jitter (0.5 s, 1 s, 2 s and so on, capped at 8 s), or after the delay given in `Retry-After`:

| Failure | Retried when |
|---|---|
| `429 rate_limit_exceeded` | always (quota errors such as `daily_quota_exceeded` are not retried) |
| `408`, `500`, `502`, `503`, `504`, network error, timeout | `GET`, `PATCH`, `DELETE`, or a `POST` that has an `idempotencyKey` |

A `POST` without an idempotency key is never retried after a 5xx or a network error, because the email might already have been accepted. Pass an `idempotencyKey` to make sends safe to retry. A `Retry-After` longer than 60 seconds returns the error instead of waiting. Set `maxRetries: 0` to turn retries off.

## Resources

All examples assume `const pidgely = new Pidgely()`. Inputs use camelCase, as in the Resend SDK. Responses are returned exactly as the API sends them, in snake_case.

### Emails

```ts
// Send, with attachments, tags, custom headers and scheduling
const { data } = await pidgely.emails.send({
  from: 'Acme <hello@acme.com>',
  to: ['ana@example.com'],
  cc: 'team@acme.com',
  replyTo: 'support@acme.com',
  subject: 'Your invoice',
  html: '<p>Invoice attached.</p>', // `text` is generated when omitted
  attachments: [
    { filename: 'invoice.pdf', content: pdfBuffer }, // Buffer/Uint8Array or base64 string
    { filename: 'logo.png', path: 'https://acme.com/logo.png', contentId: 'logo' }, // inline: <img src="cid:logo">
  ],
  tags: [{ name: 'category', value: 'billing' }],
  headers: { 'X-Entity-Ref-ID': 'inv_1042' },
  scheduledAt: 'tomorrow at 9am', // ISO 8601 or natural language, up to 30 days ahead
});

// Send a published template
await pidgely.emails.send({
  from: 'Acme <hello@acme.com>',
  to: 'ana@example.com',
  template: { id: 'welcome', variables: { NAME: 'Ana', TRIAL_DAYS: 14 } },
});

await pidgely.emails.get('4ef9a417-02e9-4d39-ad75-9611e0fcc33c'); // includes last_event
await pidgely.emails.list({ limit: 20 }); // cursor pagination: { after } / { before }
await pidgely.emails.update({ id, scheduledAt: 'in 2 hours' }); // reschedule
await pidgely.emails.cancel(id); // cancel a scheduled email
await pidgely.emails.attachments.list({ emailId: id });
await pidgely.emails.attachments.get({ emailId: id, id: attachmentId }); // signed download_url, valid for 1 hour
```

#### React Email

Pass `react` instead of `html`. It is rendered with [`@react-email/render`](https://react.email), an optional peer dependency loaded only when you use it:

```sh
npm install @react-email/render @react-email/components react react-dom
```

```tsx
import { WelcomeEmail } from './emails/welcome';

await pidgely.emails.send({
  from: 'Acme <hello@acme.com>',
  to: 'ana@example.com',
  subject: 'Welcome!',
  react: <WelcomeEmail name="Ana" />,
});
```

`react` also works in `batch.send`, `broadcasts.create/update` and `templates.create/update`. On runtimes that cannot resolve the dynamic import, register a renderer yourself with `setReactRenderer(render)`.

### Batch

```ts
const { data } = await pidgely.batch.send(
  [
    { from: 'Acme <hello@acme.com>', to: 'ana@example.com', subject: 'Hi Ana', html: '<p>Hi</p>' },
    { from: 'Acme <hello@acme.com>', to: 'bob@example.com', subject: 'Hi Bob', html: '<p>Hi</p>' },
  ],
  { idempotencyKey: 'digest-2026-10-12', batchValidation: 'permissive' },
);
// data.data → [{ id }, ...]; with 'permissive', data.errors → [{ index, message }]
```

Up to 100 emails per request. `strict` (the default) sends all of them or none. `permissive` sends the valid ones and reports the invalid ones.

### Domains

```ts
const { data: domain } = await pidgely.domains.create({ name: 'acme.com', customReturnPath: 'bounces', tls: 'opportunistic' });
console.table(domain?.records); // DKIM TXT, return-path MX + SPF TXT, DMARC: publish these at your DNS provider

await pidgely.domains.verify(domain!.id); // check DNS now
await pidgely.domains.get(domain!.id); // status: not_started | pending | verified | failed, plus per-record status
await pidgely.domains.list();
await pidgely.domains.update({ id: domain!.id, tls: 'enforced' });
await pidgely.domains.remove(domain!.id);
```

Automatic DNS setup: detect the provider, then let Pidgely create the records on Cloudflare (the token is used for that request only and never stored), or open the signed Domain Connect link:

```ts
const { data: dns } = await pidgely.domains.dnsProvider(domain!.id);
if (dns?.cloudflare) {
  const { data: setup } = await pidgely.domains.setupCloudflare(domain!.id, { apiToken: process.env.CLOUDFLARE_TOKEN! });
  console.table(setup?.records); // created | updated | unchanged | kept, per record
} else if (dns?.domain_connect) {
  console.log('Approve the records at your provider:', dns.domain_connect.url);
}
```

### API keys

```ts
const { data } = await pidgely.apiKeys.create({ name: 'Production', permission: 'sending_access', domainId });
console.log(data?.token); // pdg_…, shown only once
await pidgely.apiKeys.list();
await pidgely.apiKeys.update(keyId, { name: 'Production (web)' });
await pidgely.apiKeys.remove(keyId);
```

### Contacts

```ts
await pidgely.contacts.create({
  email: 'ana@example.com',
  firstName: 'Ana',
  lastName: 'Lima',
  properties: { plan: 'pro', seats: 5 },
  segments: [{ id: segmentId }],
});
await pidgely.contacts.list({ segmentId, limit: 100 });
await pidgely.contacts.get({ email: 'ana@example.com' }); // or get(id) / get({ id })
await pidgely.contacts.update({ email: 'ana@example.com', unsubscribed: true }); // kept in sync with the suppression list
await pidgely.contacts.remove({ email: 'ana@example.com' });

// Upsert up to 1,000 contacts; invalid rows are reported with their index instead of failing the request
const { data: result } = await pidgely.contacts.batch({
  contacts: [
    { email: 'ana@example.com', firstName: 'Ana' },
    { email: 'bruno@example.com', properties: { plan: 'team' } },
  ],
  segmentId, // optional: added to every row
});
// result.data → [{ index, id }], result.errors → [{ index, message }]

await pidgely.contacts.segments.list({ email: 'ana@example.com' });
await pidgely.contacts.segments.add({ email: 'ana@example.com', segmentId });
await pidgely.contacts.segments.remove({ contactId, segmentId });
```

### Segments (and legacy audiences)

```ts
const { data: segment } = await pidgely.segments.create({ name: 'Pro customers' });
await pidgely.segments.list();
await pidgely.segments.get(segment!.id);
await pidgely.segments.update(segment!.id, { name: 'Pro & Team customers' });
await pidgely.segments.listContacts(segment!.id, { limit: 50 });
await pidgely.segments.remove(segment!.id);
```

`pidgely.audiences` is a deprecated alias of `pidgely.segments`, kept for Resend compatibility. `contacts.create/get/update/remove` also take a legacy `audienceId`.

### Broadcasts

```ts
const { data } = await pidgely.broadcasts.create({
  segmentId,
  from: 'Acme News <news@acme.com>',
  subject: 'What’s new in October',
  previewText: 'Three features you asked for',
  html: '<p>Hi {{{FIRST_NAME|there}}},</p>…<a href="{{{PIDGELY_UNSUBSCRIBE_URL}}}">Unsubscribe</a>',
  name: 'October newsletter',
});

await pidgely.broadcasts.send(data!.id, { scheduledAt: 'tomorrow at 10am' }); // omit to send now
await pidgely.broadcasts.cancel(data!.id);
await pidgely.broadcasts.duplicate(data!.id);
await pidgely.broadcasts.update(data!.id, { subject: 'New subject' }); // drafts only
await pidgely.broadcasts.get(data!.id); // includes per-status stats
await pidgely.broadcasts.list();
await pidgely.broadcasts.remove(data!.id);
```

Pass `send: true` (with an optional `scheduledAt`) to `create` to send without a separate call. Every broadcast message includes RFC 8058 one-click unsubscribe. Personalisation supports `{{{FIRST_NAME|fallback}}}`, `{{{LAST_NAME}}}`, `{{{EMAIL}}}`, `{{{contact.<property>}}}` and `{{{RESEND_UNSUBSCRIBE_URL}}}` / `{{{PIDGELY_UNSUBSCRIBE_URL}}}`.

### Templates

```ts
// Create and publish in one chain
await pidgely.templates
  .create({
    name: 'Welcome',
    alias: 'welcome',
    from: 'Acme <hello@acme.com>',
    subject: 'Welcome, {{{NAME}}}!',
    html: '<p>Hi {{{NAME}}}, your trial lasts {{{TRIAL_DAYS}}} days.</p>',
    variables: [
      { key: 'NAME', type: 'string', fallbackValue: 'there' },
      { key: 'TRIAL_DAYS', type: 'number', fallbackValue: 14 },
    ],
  })
  .publish();

await pidgely.templates.get('welcome'); // by id or alias (draft)
await pidgely.templates.update('welcome', { subject: 'Welcome aboard, {{{NAME}}}!' });
await pidgely.templates.publish('welcome');
// Render the draft without sending; missing_variables lists variables with no value and no fallback
const { data: preview } = await pidgely.templates.preview('welcome', { variables: { NAME: 'Ana', TRIAL_DAYS: 30 } });
await pidgely.templates.duplicate('welcome'); // also chainable with .publish()
await pidgely.templates.list();
await pidgely.templates.remove('welcome');
```

### Template builder, AI assist and brand (Scale plan)

Pidgely extensions. Builder documents (typed blocks plus a theme) are sent and returned as JSON, in the API's snake_case:

```ts
const { data: caps } = await pidgely.templateBuilder.capabilities(); // builder, ai_available, AI quota, theme, brand

// Read your website once: logo, colors, fonts, social links and address become the organization theme
await pidgely.brand.import({ url: 'https://acme.com', apply: true });

// Write an e-mail with AI (uses your theme and brand), check it, save it as a template
const { data: email } = await pidgely.templateBuilder.ai.generate({ prompt: 'Welcome e-mail for new users of our invoicing app', language: 'en' });
const { data: rendered } = await pidgely.templateBuilder.render({ document: email!.document, subject: email!.subject });
console.log(rendered?.issues); // deliverability lint: spam words, missing unsubscribe, placeholder links…
await pidgely.templates.create({ name: 'Welcome', alias: 'welcome', subject: email!.subject, builder: email!.document }).publish();

await pidgely.templateBuilder.ai.rewrite({ block: email!.document.blocks[1]!, action: 'tone', tone: 'friendly' });
await pidgely.templateBuilder.ai.translate({ document: email!.document, subject: email!.subject, language: 'pt-br' });
await pidgely.templateBuilder.ai.subjects({ document: email!.document }); // five subject + preview text ideas
await pidgely.templateBuilder.convert({ html: '<h1>Hello</h1><p>Welcome!</p>' }); // HTML to a document, when lossless
await pidgely.templateBuilder.getTheme();
await pidgely.templateBuilder.updateTheme({ theme: { brand_color: '#2563eb', font: 'inter' } });
```

Below Scale these return `403 plan_required`; AI calls count against the monthly AI quota (`429 ai_quota_exceeded`).

### Usage

```ts
const { data: usage } = await pidgely.usage.get(); // { today: { accepted, delivered, bounced, complained }, daily_quota, status }
```

### Webhooks

```ts
const { data } = await pidgely.webhooks.create({
  endpoint: 'https://acme.com/webhooks/pidgely',
  events: ['email.delivered', 'email.bounced', 'email.complained'],
});
console.log(data?.signing_secret); // whsec_…, store it to verify deliveries

await pidgely.webhooks.list();
await pidgely.webhooks.get(webhookId);
await pidgely.webhooks.update(webhookId, { status: 'disabled' });
await pidgely.webhooks.rotateSigningSecret(webhookId);
await pidgely.webhooks.remove(webhookId);
```

Events: `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`, `email.failed`, `email.suppressed`, `domain.updated`, `contact.created`, `contact.updated`, `contact.deleted`.

### Suppressions

```ts
await pidgely.suppressions.add({ email: 'noreply@example.com' });
await pidgely.suppressions.list({ origin: 'bounce' }); // bounce | complaint | manual | unsubscribe
await pidgely.suppressions.get('noreply@example.com'); // by id or email
await pidgely.suppressions.remove('noreply@example.com');
await pidgely.suppressions.batch.add({ emails: ['a@example.com', 'b@example.com'] }); // up to 100
await pidgely.suppressions.batch.remove({ emails: ['a@example.com'] });
```

## Verifying webhooks

Pidgely signs every delivery with the [Standard Webhooks](https://www.standardwebhooks.com) scheme. The same values are sent under both the `webhook-*` and `svix-*` header names. `verify` checks the HMAC-SHA256 signature in constant time, rejects timestamps more than 5 minutes from now, and returns the parsed event. Pass the **raw** request body, not re-serialized JSON.

```ts
import { verifyWebhook, WebhookVerificationError } from 'pidgely';

// Next.js / Remix / Hono / Workers (Fetch API)
export async function POST(req: Request) {
  const payload = await req.text();
  try {
    const event = await verifyWebhook({ payload, headers: req.headers, webhookSecret: process.env.PIDGELY_WEBHOOK_SECRET! });
    if (event.type === 'email.bounced') {
      // event.data.email_id, event.data.to, …
    }
    return new Response('ok');
  } catch (err) {
    if (err instanceof WebhookVerificationError) return new Response('invalid signature', { status: 400 });
    throw err;
  }
}
```

```ts
// Express: keep the raw body
app.post('/webhooks/pidgely', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const event = await pidgely.webhooks.verify(req.body.toString('utf8'), req.headers, process.env.PIDGELY_WEBHOOK_SECRET!);
    res.sendStatus(200);
  } catch {
    res.sendStatus(400);
  }
});
```

`pidgely.webhooks.verify` also accepts Resend's object form, `verify({ payload, headers, webhookSecret })`. Set a different window with `tolerance` (in seconds). The standalone `verifyWebhook` does not need an API key. Unlike the Resend SDK, verification is **async** because it uses WebCrypto, so remember the `await`.

## Migrating from Resend

Pidgely serves the Resend REST API at the same paths, and this SDK mirrors the Resend SDK:

```diff
- import { Resend } from 'resend';
- const resend = new Resend(process.env.RESEND_API_KEY);
+ import { Pidgely } from 'pidgely';
+ const resend = new Pidgely(process.env.PIDGELY_API_KEY);

  const { data, error } = await resend.emails.send({ from, to, subject, react: <Welcome /> });
```

1. `npm uninstall resend && npm install pidgely`.
2. Rename the import and swap `re_…` for your `pdg_…` key.
3. Verify your domain in Pidgely and publish the DNS records it returns.
4. If you verify webhooks, `await` the `verify` call and pass the `whsec_…` secret from your Pidgely webhook.

The method names, argument shapes, `{ data, error, headers }` results and error names all match. Pidgely additions include `emails.attachments`, `apiKeys.update`, `segments.update/listContacts`, `contacts.batch`, `templates.preview`, `broadcasts.cancel/duplicate`, `suppressions.*`, the `stream` field on emails, and built-in retries. Some Resend features are not supported yet: open/click tracking, topics, inbound email, automations, events and logs. See the migration guide at [docs.pidgely.com](https://docs.pidgely.com) for the full list.

You can also keep the official `resend` package and point it at Pidgely with `RESEND_BASE_URL=https://api.pidgely.com`.

## TypeScript

Every option and response type is exported (`CreateEmailOptions`, `Email`, `Domain`, `Contact`, `Broadcast`, `WebhookEvent`, `ErrorResponse` and more). The raw OpenAPI types are also exported as `paths` and `components`. The types are generated from [`openapi/pidgely.yaml`](openapi/pidgely.yaml) with `npm run generate`.

## Development

```sh
npm install
npm run typecheck && npm run lint
npm test               # vitest, mocked fetch (no network)
npm run test:coverage  # coverage report in coverage/
npm run build          # ESM + CJS + .d.ts in dist/
```

### Publishing

Releases are published from GitHub Actions ([`release.yml`](.github/workflows/release.yml)) with [npm provenance](https://docs.npmjs.com/generating-provenance-statements) whenever a `v*` tag is pushed:

1. One-time setup: create an npm **granular access token** with read and write access to the `pidgely` package (or an automation token), and save it as the repository secret `NPM_TOKEN` (*Settings → Secrets and variables → Actions*).
2. Update `CHANGELOG.md`, then run `npm version <patch|minor|major>`. This also syncs `src/version.ts`. Push with `git push --follow-tags`.

The workflow checks that the tag matches `package.json`, runs the full test suite, publishes, and creates the GitHub release.

## Links

- Documentation: https://docs.pidgely.com
- API reference (OpenAPI 3.1): [`openapi/pidgely.yaml`](openapi/pidgely.yaml)
- MCP server for AI agents: [`@pidgely/mcp`](https://github.com/pidgely/mcp)
- Security: see [SECURITY.md](https://github.com/pidgely/.github/blob/main/SECURITY.md)

## License

[MIT](LICENSE) © Caotec Serviços em Tecnologia Ltda
