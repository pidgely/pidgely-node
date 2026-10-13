# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- `templates.preview(idOrAlias, { variables })` renders a template draft with variables (`POST /templates/{id_or_alias}/preview`) and returns a `TemplatePreview`.
- `contacts.batch({ contacts, segmentId })` creates or updates up to 1,000 contacts in one request (`POST /contacts/batch`) and returns a `ContactBatchResult`; invalid rows are reported in `errors` with their index.
- Types `PreviewTemplateOptions`, `TemplatePreview`, `BatchContactsOptions`, `ContactInput` and `ContactBatchResult`.
- `templateBuilder` (Scale plan): `capabilities()`, `getTheme()`, `updateTheme({ theme, brand })`, `render({ document, subject })` and `convert({ html })`, plus AI assist in `templateBuilder.ai`: `generate`, `rewrite`, `translate` and `subjects`.
- `templates.create/update` accept a visual builder document as `builder` (`null` detaches it).
- `brand.import({ url, apply, ai, language })` reads a website and proposes a theme and brand profile (`POST /brand/import`).
- `domains.dnsProvider(id)` and `domains.setupCloudflare(id, { apiToken })` for automatic DNS setup; the token is used for one request and never stored.
- `usage.get()` returns today's usage, the daily quota and the account status (`GET /v1/usage`).
- Types `BuilderDocument`, `BuilderBlock`, `BuilderTheme`, `BrandProfile`, `BuilderRender`, `BuilderAIEmail`, `TemplateBuilderCapabilities`, `BrandImport`, `DnsProvider`, `CloudflareSetup`, `Usage` and their option types.

## [0.1.0] - 2026-10-12

### Added

- First release of the official Pidgely SDK for Node.js and TypeScript.
- `Pidgely` client that reads `PIDGELY_API_KEY` / `PIDGELY_BASE_URL`, with zero runtime dependencies. Runs on Node.js 18+, Bun, Deno and edge runtimes. Ships ESM and CJS builds with types.
- Resources with the Resend SDK's method names and `{ data, error, headers }` results: `emails` (with `attachments`), `batch`, `domains`, `apiKeys`, `contacts` (with `segments`), `segments` (with the `audiences` alias), `broadcasts`, `templates` (chainable `.publish()`), `webhooks` and `suppressions` (with `batch`).
- `react` option rendered with the optional peer dependency `@react-email/render`.
- `idempotencyKey` request option (`Idempotency-Key` header).
- Automatic retries with exponential backoff and jitter on 429/5xx/network errors, honouring `Retry-After`. Retries are safe by default: a POST is only retried when it carries an idempotency key.
- Per-attempt timeouts, `AbortSignal` support, and the `pidgely-node/<version>` user agent.
- `verifyWebhook` / `pidgely.webhooks.verify` for Standard Webhooks (Svix) signatures, with constant-time comparison and timestamp tolerance.
- Types generated from the public OpenAPI 3.1 spec (`openapi/pidgely.yaml`).

[Unreleased]: https://github.com/pidgely/pidgely-node/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/pidgely/pidgely-node/releases/tag/v0.1.0
