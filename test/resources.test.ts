import { describe, expect, it } from 'vitest';
import type { Pidgely } from '../src';
import { client, lastCall } from './helpers';

const BASE = 'https://api.pidgely.com';

interface Case {
  name: string;
  call: (p: Pidgely) => Promise<unknown> | PromiseLike<unknown>;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
}

const cases: Case[] = [
  // Emails
  {
    name: 'emails.send maps camelCase to the API body',
    call: (p) =>
      p.emails.send({
        from: 'Acme <hi@acme.com>',
        to: ['a@x.com'],
        cc: 'c@x.com',
        bcc: ['b@x.com'],
        replyTo: 'r@x.com',
        subject: 'Hello',
        html: '<p>Hi</p>',
        text: 'Hi',
        headers: { 'X-Entity-Ref-ID': '1' },
        tags: [{ name: 'category', value: 'welcome' }],
        scheduledAt: 'in 1 hour',
        stream: 'transactional',
        attachments: [
          { filename: 'a.txt', content: new TextEncoder().encode('hello'), contentType: 'text/plain' },
          { filename: 'logo.png', path: 'https://acme.com/logo.png', contentId: 'logo' },
          { filename: 'b.txt', content: 'aGk=' },
        ],
      }),
    method: 'POST',
    path: '/emails',
    body: {
      from: 'Acme <hi@acme.com>',
      to: ['a@x.com'],
      cc: 'c@x.com',
      bcc: ['b@x.com'],
      reply_to: 'r@x.com',
      subject: 'Hello',
      html: '<p>Hi</p>',
      text: 'Hi',
      headers: { 'X-Entity-Ref-ID': '1' },
      tags: [{ name: 'category', value: 'welcome' }],
      scheduled_at: 'in 1 hour',
      stream: 'transactional',
      attachments: [
        { filename: 'a.txt', content: 'aGVsbG8=', content_type: 'text/plain' },
        { filename: 'logo.png', path: 'https://acme.com/logo.png', content_id: 'logo' },
        { filename: 'b.txt', content: 'aGk=' },
      ],
    },
  },
  {
    name: 'emails.send with a template',
    call: (p) => p.emails.send({ to: 'a@x.com', template: { id: 'welcome', variables: { NAME: 'Ana', COUNT: 2 } } }),
    method: 'POST',
    path: '/emails',
    body: { to: 'a@x.com', template: { id: 'welcome', variables: { NAME: 'Ana', COUNT: 2 } } },
  },
  {
    name: 'emails.send passes snake_case through',
    call: (p) => p.emails.send({ from: 'a@acme.com', to: 'b@x.com', subject: 's', text: 't', reply_to: 'r@x.com' } as never),
    method: 'POST',
    path: '/emails',
    body: { from: 'a@acme.com', to: 'b@x.com', subject: 's', text: 't', reply_to: 'r@x.com' },
  },
  {
    name: 'emails.create is an alias of send',
    call: (p) => p.emails.create({ from: 'a@acme.com', to: 'b@x.com', subject: 's', text: 't' }),
    method: 'POST',
    path: '/emails',
    body: { from: 'a@acme.com', to: 'b@x.com', subject: 's', text: 't' },
  },
  { name: 'emails.get', call: (p) => p.emails.get('em_1'), method: 'GET', path: '/emails/em_1' },
  { name: 'emails.list', call: (p) => p.emails.list(), method: 'GET', path: '/emails' },
  {
    name: 'emails.list with pagination',
    call: (p) => p.emails.list({ limit: 10, after: 'em_9' }),
    method: 'GET',
    path: '/emails?limit=10&after=em_9',
  },
  {
    name: 'emails.update',
    call: (p) => p.emails.update({ id: 'em_1', scheduledAt: '2026-11-01T10:00:00Z' }),
    method: 'PATCH',
    path: '/emails/em_1',
    body: { scheduled_at: '2026-11-01T10:00:00Z' },
  },
  { name: 'emails.cancel', call: (p) => p.emails.cancel('em_1'), method: 'POST', path: '/emails/em_1/cancel' },
  {
    name: 'emails.attachments.list',
    call: (p) => p.emails.attachments.list({ emailId: 'em_1', limit: 5 }),
    method: 'GET',
    path: '/emails/em_1/attachments?limit=5',
  },
  {
    name: 'emails.attachments.get',
    call: (p) => p.emails.attachments.get({ emailId: 'em_1', id: 'att_1' }),
    method: 'GET',
    path: '/emails/em_1/attachments/att_1',
  },
  // Batch
  {
    name: 'batch.send',
    call: (p) =>
      p.batch.send(
        [
          { from: 'a@acme.com', to: 'b@x.com', subject: 's1', text: 't', replyTo: 'r@x.com' },
          { from: 'a@acme.com', to: 'c@x.com', subject: 's2', html: '<b>h</b>' },
        ],
        { batchValidation: 'permissive', idempotencyKey: 'batch-1' },
      ),
    method: 'POST',
    path: '/emails/batch',
    body: [
      { from: 'a@acme.com', to: 'b@x.com', subject: 's1', text: 't', reply_to: 'r@x.com' },
      { from: 'a@acme.com', to: 'c@x.com', subject: 's2', html: '<b>h</b>' },
    ],
    headers: { 'x-batch-validation': 'permissive', 'Idempotency-Key': 'batch-1' },
  },
  {
    name: 'batch.create is an alias of send',
    call: (p) => p.batch.create([{ from: 'a@acme.com', to: 'b@x.com', subject: 's', text: 't' }]),
    method: 'POST',
    path: '/emails/batch',
    body: [{ from: 'a@acme.com', to: 'b@x.com', subject: 's', text: 't' }],
  },
  // Domains
  {
    name: 'domains.create',
    call: (p) =>
      p.domains.create({ name: 'acme.com', region: 'sa-east-1', customReturnPath: 'send', tls: 'enforced', openTracking: false }),
    method: 'POST',
    path: '/domains',
    body: { name: 'acme.com', region: 'sa-east-1', custom_return_path: 'send', tls: 'enforced', open_tracking: false },
  },
  { name: 'domains.list', call: (p) => p.domains.list({ limit: 2 }), method: 'GET', path: '/domains?limit=2' },
  { name: 'domains.get', call: (p) => p.domains.get('dom_1'), method: 'GET', path: '/domains/dom_1' },
  {
    name: 'domains.update',
    call: (p) => p.domains.update({ id: 'dom_1', tls: 'opportunistic', clickTracking: false }),
    method: 'PATCH',
    path: '/domains/dom_1',
    body: { tls: 'opportunistic', click_tracking: false },
  },
  { name: 'domains.remove', call: (p) => p.domains.remove('dom_1'), method: 'DELETE', path: '/domains/dom_1' },
  { name: 'domains.verify', call: (p) => p.domains.verify('dom_1'), method: 'POST', path: '/domains/dom_1/verify' },
  // API keys
  {
    name: 'apiKeys.create',
    call: (p) => p.apiKeys.create({ name: 'Prod', permission: 'sending_access', domainId: 'dom_1' }),
    method: 'POST',
    path: '/api-keys',
    body: { name: 'Prod', permission: 'sending_access', domain_id: 'dom_1' },
  },
  {
    name: 'apiKeys.create with Resend domain_id',
    call: (p) => p.apiKeys.create({ name: 'Prod', domain_id: 'dom_2' }),
    method: 'POST',
    path: '/api-keys',
    body: { name: 'Prod', domain_id: 'dom_2' },
  },
  { name: 'apiKeys.list', call: (p) => p.apiKeys.list(), method: 'GET', path: '/api-keys' },
  {
    name: 'apiKeys.update',
    call: (p) => p.apiKeys.update('key_1', { name: 'Renamed' }),
    method: 'PATCH',
    path: '/api-keys/key_1',
    body: { name: 'Renamed' },
  },
  { name: 'apiKeys.remove', call: (p) => p.apiKeys.remove('key_1'), method: 'DELETE', path: '/api-keys/key_1' },
  // Contacts
  {
    name: 'contacts.create',
    call: (p) =>
      p.contacts.create({
        email: 'ana@x.com',
        firstName: 'Ana',
        lastName: 'Lima',
        unsubscribed: false,
        properties: { plan: 'pro', seats: 3 },
        segments: [{ id: 'seg_1' }],
      }),
    method: 'POST',
    path: '/contacts',
    body: {
      email: 'ana@x.com',
      first_name: 'Ana',
      last_name: 'Lima',
      unsubscribed: false,
      properties: { plan: 'pro', seats: 3 },
      segments: [{ id: 'seg_1' }],
    },
  },
  {
    name: 'contacts.create in a legacy audience',
    call: (p) => p.contacts.create({ email: 'ana@x.com', audienceId: 'aud_1' }),
    method: 'POST',
    path: '/audiences/aud_1/contacts',
    body: { email: 'ana@x.com' },
  },
  {
    name: 'contacts.batch maps every row and segmentId',
    call: (p) =>
      p.contacts.batch({
        contacts: [
          { email: 'ana@x.com', firstName: 'Ana', lastName: 'Lima', unsubscribed: false, properties: { plan: 'pro' }, segments: [{ id: 'seg_2' }] },
          { email: 'bo@x.com' },
        ],
        segmentId: 'seg_1',
      }),
    method: 'POST',
    path: '/contacts/batch',
    body: {
      contacts: [
        { email: 'ana@x.com', first_name: 'Ana', last_name: 'Lima', unsubscribed: false, properties: { plan: 'pro' }, segments: [{ id: 'seg_2' }] },
        { email: 'bo@x.com' },
      ],
      segment_id: 'seg_1',
    },
  },
  {
    name: 'contacts.batch without a segment',
    call: (p) => p.contacts.batch({ contacts: [{ email: 'ana@x.com' }] }),
    method: 'POST',
    path: '/contacts/batch',
    body: { contacts: [{ email: 'ana@x.com' }] },
  },
  {
    name: 'contacts.list by segment',
    call: (p) => p.contacts.list({ segmentId: 'seg_1', limit: 50 }),
    method: 'GET',
    path: '/contacts?limit=50&segment_id=seg_1',
  },
  { name: 'contacts.list', call: (p) => p.contacts.list(), method: 'GET', path: '/contacts' },
  { name: 'contacts.get by id string', call: (p) => p.contacts.get('ct_1'), method: 'GET', path: '/contacts/ct_1' },
  {
    name: 'contacts.get by email',
    call: (p) => p.contacts.get({ email: 'ana+x@x.com' }),
    method: 'GET',
    path: '/contacts/ana%2Bx%40x.com',
  },
  {
    name: 'contacts.get in a legacy audience',
    call: (p) => p.contacts.get({ id: 'ct_1', audienceId: 'aud_1' }),
    method: 'GET',
    path: '/audiences/aud_1/contacts/ct_1',
  },
  {
    name: 'contacts.update',
    call: (p) => p.contacts.update({ email: 'ana@x.com', firstName: null, unsubscribed: true, properties: { plan: null } }),
    method: 'PATCH',
    path: '/contacts/ana%40x.com',
    body: { first_name: null, unsubscribed: true, properties: { plan: null } },
  },
  {
    name: 'contacts.remove by id string',
    call: (p) => p.contacts.remove('ct_1'),
    method: 'DELETE',
    path: '/contacts/ct_1',
  },
  {
    name: 'contacts.remove by email',
    call: (p) => p.contacts.remove({ email: 'ana@x.com' }),
    method: 'DELETE',
    path: '/contacts/ana%40x.com',
  },
  {
    name: 'contacts.segments.list',
    call: (p) => p.contacts.segments.list({ contactId: 'ct_1', limit: 3 }),
    method: 'GET',
    path: '/contacts/ct_1/segments?limit=3',
  },
  {
    name: 'contacts.segments.add',
    call: (p) => p.contacts.segments.add({ email: 'ana@x.com', segmentId: 'seg_1' }),
    method: 'POST',
    path: '/contacts/ana%40x.com/segments/seg_1',
  },
  {
    name: 'contacts.segments.remove',
    call: (p) => p.contacts.segments.remove({ contactId: 'ct_1', segmentId: 'seg_1' }),
    method: 'DELETE',
    path: '/contacts/ct_1/segments/seg_1',
  },
  // Segments / audiences
  { name: 'segments.create', call: (p) => p.segments.create({ name: 'VIP' }), method: 'POST', path: '/segments', body: { name: 'VIP' } },
  { name: 'segments.list', call: (p) => p.segments.list(), method: 'GET', path: '/segments' },
  { name: 'segments.get', call: (p) => p.segments.get('seg_1'), method: 'GET', path: '/segments/seg_1' },
  {
    name: 'segments.update',
    call: (p) => p.segments.update('seg_1', { name: 'VIPs' }),
    method: 'PATCH',
    path: '/segments/seg_1',
    body: { name: 'VIPs' },
  },
  { name: 'segments.remove', call: (p) => p.segments.remove('seg_1'), method: 'DELETE', path: '/segments/seg_1' },
  {
    name: 'segments.listContacts',
    call: (p) => p.segments.listContacts('seg_1', { before: 'ct_9' }),
    method: 'GET',
    path: '/segments/seg_1/contacts?before=ct_9',
  },
  { name: 'audiences.list (alias)', call: (p) => p.audiences.list(), method: 'GET', path: '/segments' },
  // Broadcasts
  {
    name: 'broadcasts.create',
    call: (p) =>
      p.broadcasts.create({
        segmentId: 'seg_1',
        from: 'News <news@acme.com>',
        subject: 'October',
        replyTo: ['r@acme.com'],
        html: '<p>Hi {{{FIRST_NAME|there}}}</p><a href="{{{PIDGELY_UNSUBSCRIBE_URL}}}">Unsubscribe</a>',
        name: 'Oct newsletter',
        previewText: 'News',
        scheduledAt: 'tomorrow at 9am',
        send: true,
      }),
    method: 'POST',
    path: '/broadcasts',
    body: {
      segment_id: 'seg_1',
      from: 'News <news@acme.com>',
      subject: 'October',
      reply_to: ['r@acme.com'],
      html: '<p>Hi {{{FIRST_NAME|there}}}</p><a href="{{{PIDGELY_UNSUBSCRIBE_URL}}}">Unsubscribe</a>',
      name: 'Oct newsletter',
      preview_text: 'News',
      scheduled_at: 'tomorrow at 9am',
      send: true,
    },
  },
  { name: 'broadcasts.list', call: (p) => p.broadcasts.list(), method: 'GET', path: '/broadcasts' },
  { name: 'broadcasts.get', call: (p) => p.broadcasts.get('bc_1'), method: 'GET', path: '/broadcasts/bc_1' },
  {
    name: 'broadcasts.update',
    call: (p) => p.broadcasts.update('bc_1', { subject: 'New subject', audienceId: 'aud_1' }),
    method: 'PATCH',
    path: '/broadcasts/bc_1',
    body: { subject: 'New subject', audience_id: 'aud_1' },
  },
  { name: 'broadcasts.remove', call: (p) => p.broadcasts.remove('bc_1'), method: 'DELETE', path: '/broadcasts/bc_1' },
  { name: 'broadcasts.send now', call: (p) => p.broadcasts.send('bc_1'), method: 'POST', path: '/broadcasts/bc_1/send', body: {} },
  {
    name: 'broadcasts.send scheduled',
    call: (p) => p.broadcasts.send('bc_1', { scheduledAt: 'in 2 hours' }),
    method: 'POST',
    path: '/broadcasts/bc_1/send',
    body: { scheduled_at: 'in 2 hours' },
  },
  { name: 'broadcasts.cancel', call: (p) => p.broadcasts.cancel('bc_1'), method: 'POST', path: '/broadcasts/bc_1/cancel' },
  { name: 'broadcasts.duplicate', call: (p) => p.broadcasts.duplicate('bc_1'), method: 'POST', path: '/broadcasts/bc_1/duplicate' },
  // Templates
  {
    name: 'templates.create',
    call: (p) =>
      p.templates.create({
        name: 'Welcome',
        alias: 'welcome',
        from: 'Acme <hi@acme.com>',
        subject: 'Welcome, {{{NAME}}}',
        replyTo: 'r@acme.com',
        html: '<p>Hi {{{NAME}}}</p>',
        variables: [
          { key: 'NAME', type: 'string', fallbackValue: 'there' },
          { key: 'COUNT', type: 'number' },
        ],
      }),
    method: 'POST',
    path: '/templates',
    body: {
      name: 'Welcome',
      alias: 'welcome',
      from: 'Acme <hi@acme.com>',
      subject: 'Welcome, {{{NAME}}}',
      reply_to: 'r@acme.com',
      html: '<p>Hi {{{NAME}}}</p>',
      variables: [
        { key: 'NAME', type: 'string', fallback_value: 'there' },
        { key: 'COUNT', type: 'number' },
      ],
    },
  },
  { name: 'templates.list', call: (p) => p.templates.list({ limit: 1 }), method: 'GET', path: '/templates?limit=1' },
  { name: 'templates.get by alias', call: (p) => p.templates.get('welcome'), method: 'GET', path: '/templates/welcome' },
  {
    name: 'templates.update',
    call: (p) => p.templates.update('welcome', { subject: 'Hey' }),
    method: 'PATCH',
    path: '/templates/welcome',
    body: { subject: 'Hey' },
  },
  { name: 'templates.remove', call: (p) => p.templates.remove('tpl_1'), method: 'DELETE', path: '/templates/tpl_1' },
  { name: 'templates.publish', call: (p) => p.templates.publish('tpl_1'), method: 'POST', path: '/templates/tpl_1/publish' },
  { name: 'templates.duplicate', call: (p) => p.templates.duplicate('tpl_1'), method: 'POST', path: '/templates/tpl_1/duplicate' },
  {
    name: 'templates.preview',
    call: (p) => p.templates.preview('welcome', { variables: { NAME: 'Ana', TRIAL_DAYS: 14 } }),
    method: 'POST',
    path: '/templates/welcome/preview',
    body: { variables: { NAME: 'Ana', TRIAL_DAYS: 14 } },
  },
  { name: 'templates.preview without variables', call: (p) => p.templates.preview('tpl 1'), method: 'POST', path: '/templates/tpl%201/preview', body: {} },
  // Webhooks
  {
    name: 'webhooks.create',
    call: (p) => p.webhooks.create({ endpoint: 'https://acme.com/hooks', events: ['email.delivered', 'email.bounced'] }),
    method: 'POST',
    path: '/webhooks',
    body: { endpoint: 'https://acme.com/hooks', events: ['email.delivered', 'email.bounced'] },
  },
  { name: 'webhooks.list', call: (p) => p.webhooks.list(), method: 'GET', path: '/webhooks' },
  { name: 'webhooks.get', call: (p) => p.webhooks.get('wh_1'), method: 'GET', path: '/webhooks/wh_1' },
  {
    name: 'webhooks.update',
    call: (p) => p.webhooks.update('wh_1', { status: 'disabled' }),
    method: 'PATCH',
    path: '/webhooks/wh_1',
    body: { status: 'disabled' },
  },
  { name: 'webhooks.remove', call: (p) => p.webhooks.remove('wh_1'), method: 'DELETE', path: '/webhooks/wh_1' },
  {
    name: 'webhooks.rotateSigningSecret',
    call: (p) => p.webhooks.rotateSigningSecret('wh_1'),
    method: 'POST',
    path: '/webhooks/wh_1/signing-secret/rotate',
  },
  // Suppressions
  {
    name: 'suppressions.add',
    call: (p) => p.suppressions.add({ email: 'x@y.com' }),
    method: 'POST',
    path: '/suppressions',
    body: { email: 'x@y.com' },
  },
  {
    name: 'suppressions.create (alias)',
    call: (p) => p.suppressions.create({ email: 'x@y.com' }),
    method: 'POST',
    path: '/suppressions',
    body: { email: 'x@y.com' },
  },
  {
    name: 'suppressions.list by origin',
    call: (p) => p.suppressions.list({ origin: 'bounce', limit: 20 }),
    method: 'GET',
    path: '/suppressions?limit=20&origin=bounce',
  },
  { name: 'suppressions.get', call: (p) => p.suppressions.get('x@y.com'), method: 'GET', path: '/suppressions/x%40y.com' },
  { name: 'suppressions.remove', call: (p) => p.suppressions.remove('sup_1'), method: 'DELETE', path: '/suppressions/sup_1' },
  {
    name: 'suppressions.batch.add',
    call: (p) => p.suppressions.batch.add({ emails: ['a@x.com', 'b@x.com'] }),
    method: 'POST',
    path: '/suppressions/batch/add',
    body: { emails: ['a@x.com', 'b@x.com'] },
  },
  {
    name: 'suppressions.batch.remove',
    call: (p) => p.suppressions.batch.remove({ ids: ['sup_1'] }),
    method: 'POST',
    path: '/suppressions/batch/remove',
    body: { ids: ['sup_1'] },
  },
  // Template builder documents through /templates (passed as is, snake_case kept)
  {
    name: 'templates.create with a builder document',
    call: (p) =>
      p.templates.create({
        name: 'Welcome (builder)',
        subject: 'Welcome',
        builder: { preview_text: 'Hi', theme: { brand_color: '#2563eb' }, blocks: [{ type: 'button', label: 'Go', href: 'https://acme.com', full_width: true }] },
      }),
    method: 'POST',
    path: '/templates',
    body: {
      name: 'Welcome (builder)',
      subject: 'Welcome',
      builder: { preview_text: 'Hi', theme: { brand_color: '#2563eb' }, blocks: [{ type: 'button', label: 'Go', href: 'https://acme.com', full_width: true }] },
    },
  },
  { name: 'templates.update detaches the builder document', call: (p) => p.templates.update('welcome', { builder: null }), method: 'PATCH', path: '/templates/welcome', body: { builder: null } },
  // Template builder and AI assist
  { name: 'templateBuilder.capabilities', call: (p) => p.templateBuilder.capabilities(), method: 'GET', path: '/template-builder' },
  { name: 'templateBuilder.getTheme', call: (p) => p.templateBuilder.getTheme(), method: 'GET', path: '/template-builder/theme' },
  {
    name: 'templateBuilder.updateTheme',
    call: (p) => p.templateBuilder.updateTheme({ theme: { brand_color: '#2563eb', logo_url: 'https://acme.com/l.png' }, brand: { name: 'Acme', website: 'https://acme.com/' } }),
    method: 'PATCH',
    path: '/template-builder/theme',
    body: { theme: { brand_color: '#2563eb', logo_url: 'https://acme.com/l.png' }, brand: { name: 'Acme', website: 'https://acme.com/' } },
  },
  {
    name: 'templateBuilder.render',
    call: (p) => p.templateBuilder.render({ document: { blocks: [{ type: 'heading', text: 'Hi' }] }, subject: 'Hello' }),
    method: 'POST',
    path: '/template-builder/render',
    body: { document: { blocks: [{ type: 'heading', text: 'Hi' }] }, subject: 'Hello' },
  },
  {
    name: 'templateBuilder.convert',
    call: (p) => p.templateBuilder.convert({ html: '<h1>Hi</h1>' }),
    method: 'POST',
    path: '/template-builder/convert',
    body: { html: '<h1>Hi</h1>' },
  },
  {
    name: 'templateBuilder.ai.generate',
    call: (p) => p.templateBuilder.ai.generate({ prompt: 'Welcome e-mail', language: 'pt-br', variables: ['PLAN'], templateId: 'tpl_1', theme: { font: 'inter' } }),
    method: 'POST',
    path: '/template-builder/ai/generate',
    body: { prompt: 'Welcome e-mail', language: 'pt-br', variables: ['PLAN'], template_id: 'tpl_1', theme: { font: 'inter' } },
  },
  {
    name: 'templateBuilder.ai.rewrite',
    call: (p) => p.templateBuilder.ai.rewrite({ block: { type: 'text', runs: [{ text: 'Hi' }] }, action: 'tone', tone: 'friendly' }),
    method: 'POST',
    path: '/template-builder/ai/rewrite',
    body: { block: { type: 'text', runs: [{ text: 'Hi' }] }, action: 'tone', tone: 'friendly' },
  },
  {
    name: 'templateBuilder.ai.translate',
    call: (p) => p.templateBuilder.ai.translate({ document: { blocks: [] }, subject: 'Hello', language: 'es' }),
    method: 'POST',
    path: '/template-builder/ai/translate',
    body: { document: { blocks: [] }, subject: 'Hello', language: 'es' },
  },
  {
    name: 'templateBuilder.ai.subjects',
    call: (p) => p.templateBuilder.ai.subjects({ document: { blocks: [] } }),
    method: 'POST',
    path: '/template-builder/ai/subjects',
    body: { document: { blocks: [] } },
  },
  // Brand, DNS setup, usage
  {
    name: 'brand.import',
    call: (p) => p.brand.import({ url: 'acme.com', apply: true, ai: false, language: 'en' }),
    method: 'POST',
    path: '/brand/import',
    body: { url: 'acme.com', apply: true, ai: false, language: 'en' },
  },
  { name: 'brand.import without a url', call: (p) => p.brand.import(), method: 'POST', path: '/brand/import', body: {} },
  { name: 'domains.dnsProvider', call: (p) => p.domains.dnsProvider('dom_1'), method: 'GET', path: '/domains/dom_1/dns-provider' },
  {
    name: 'domains.setupCloudflare',
    call: (p) => p.domains.setupCloudflare('dom_1', { apiToken: 'cf-token' }),
    method: 'POST',
    path: '/domains/dom_1/dns-provider/cloudflare',
    body: { api_token: 'cf-token' },
  },
  { name: 'usage.get', call: (p) => p.usage.get(), method: 'GET', path: '/v1/usage' },
];

describe('resource methods', () => {
  it.each(cases)('$name', async ({ call, method, path, body, headers }) => {
    const { pidgely, calls } = client([{ body: { object: 'x', id: 'id_1' } }]);
    const res = (await call(pidgely)) as { data: unknown; error: unknown };
    expect(res.error).toBeNull();
    expect(res.data).toEqual({ object: 'x', id: 'id_1' });
    expect(calls).toHaveLength(1);
    const c = lastCall(calls);
    expect(c.method).toBe(method);
    expect(c.url).toBe(BASE + path);
    expect(c.body).toEqual(body);
    for (const [k, v] of Object.entries(headers ?? {})) expect(c.headers[k]).toBe(v);
    if (!headers?.['Idempotency-Key']) expect(c.headers['Idempotency-Key']).toBeUndefined();
  });
});

describe('idempotency', () => {
  it('sends Idempotency-Key on emails.send', async () => {
    const { pidgely, calls } = client([{ body: { id: 'e' } }]);
    await pidgely.emails.send({ from: 'a@acme.com', to: 'b@x.com', subject: 's', text: 't' }, { idempotencyKey: 'order-42' });
    expect(lastCall(calls).headers['Idempotency-Key']).toBe('order-42');
  });

  it('exposes the Idempotent-Replayed header', async () => {
    const { pidgely } = client([{ body: { id: 'e' }, headers: { 'Idempotent-Replayed': 'true' } }]);
    const res = await pidgely.emails.send({ from: 'a@acme.com', to: 'b@x.com', subject: 's', text: 't' }, { idempotencyKey: 'k' });
    expect(res.headers?.['idempotent-replayed']).toBe('true');
  });
});

describe('typed responses', () => {
  it('templates.preview returns the rendered draft', async () => {
    const preview = { object: 'template_preview', from: 'a@acme.com', subject: 'Hi Ana', reply_to: [], html: '<p>Hi Ana</p>', text: 'Hi Ana', missing_variables: ['TRIAL_DAYS'] };
    const { pidgely } = client([{ body: preview }]);
    const res = await pidgely.templates.preview('welcome', { variables: { NAME: 'Ana' } });
    expect(res.data?.subject).toBe('Hi Ana');
    expect(res.data?.missing_variables).toEqual(['TRIAL_DAYS']);
  });

  it('contacts.batch returns saved rows and per-row errors', async () => {
    const result = { object: 'list', data: [{ index: 0, id: 'ct_1' }], errors: [{ index: 1, message: 'email: is invalid' }] };
    const { pidgely } = client([{ body: result }]);
    const res = await pidgely.contacts.batch({ contacts: [{ email: 'ana@x.com' }, { email: 'bad' }] });
    expect(res.data?.data[0]).toEqual({ index: 0, id: 'ct_1' });
    expect(res.data?.errors[0]?.index).toBe(1);
  });
});

describe('contacts selectors', () => {
  it('returns missing_required_field without calling the API', async () => {
    const { pidgely, fetch } = client();
    const results = await Promise.all([
      pidgely.contacts.get({} as never),
      pidgely.contacts.update({} as never),
      pidgely.contacts.remove({} as never),
      pidgely.contacts.segments.list({} as never),
      pidgely.contacts.segments.add({ segmentId: 's' } as never),
      pidgely.contacts.segments.remove({ segmentId: 's' } as never),
    ]);
    for (const r of results) expect(r.error?.name).toBe('missing_required_field');
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('templates chaining', () => {
  it('create(...).publish() publishes the created template', async () => {
    const { pidgely, calls } = client([{ body: { object: 'template', id: 'tpl_9' } }, { body: { object: 'template', id: 'tpl_9' } }]);
    const res = await pidgely.templates.create({ name: 'Welcome', html: '<p>Hi</p>' }).publish();
    expect(res.data).toEqual({ object: 'template', id: 'tpl_9' });
    expect(calls.map((c) => `${c.method} ${c.url.replace(BASE, '')}`)).toEqual(['POST /templates', 'POST /templates/tpl_9/publish']);
  });

  it('duplicate(...).publish() publishes the copy', async () => {
    const { pidgely, calls } = client([{ body: { object: 'template', id: 'tpl_copy' } }, { body: { object: 'template', id: 'tpl_copy' } }]);
    await pidgely.templates.duplicate('welcome').publish({ headers: { 'X-Trace': '1' } });
    expect(lastCall(calls).url).toBe(`${BASE}/templates/tpl_copy/publish`);
    expect(lastCall(calls).headers['X-Trace']).toBe('1');
  });

  it('publish() is skipped when create fails', async () => {
    const { pidgely, calls } = client([{ status: 422, body: { statusCode: 422, name: 'validation_error', message: 'bad' } }]);
    const res = await pidgely.templates.create({ name: '' }).publish();
    expect(res.error?.name).toBe('validation_error');
    expect(calls).toHaveLength(1);
  });

  it('is awaitable and supports then(onfulfilled, onrejected)', async () => {
    const { pidgely } = client([{ body: { object: 'template', id: 't' } }]);
    const value = await pidgely.templates.create({ name: 'x' }).then((r) => r.data?.id);
    expect(value).toBe('t');
  });
});

describe('pidgely extensions', () => {
  it('templateBuilder.ai.subjects returns suggestions', async () => {
    const body = { object: 'list', data: [{ subject: 'Welcome', preview_text: 'Hi', angle: 'direct' }] };
    const { pidgely } = client([{ body }]);
    const res = await pidgely.templateBuilder.ai.subjects({ document: { blocks: [] } });
    expect(res.data?.data[0]?.angle).toBe('direct');
  });

  it('surfaces plan_required from the builder routes', async () => {
    const { pidgely } = client([{ status: 403, body: { statusCode: 403, name: 'plan_required', message: 'The Scale plan is required.' } }]);
    const res = await pidgely.templateBuilder.render({ document: { blocks: [] } });
    expect(res.error).toEqual({ statusCode: 403, name: 'plan_required', message: 'The Scale plan is required.' });
  });

  it('reads native /v1 errors from usage.get', async () => {
    const { pidgely } = client([{ status: 403, body: { error: { code: 'insufficient_scope', message: 'this API key can only send emails' } } }]);
    const res = await pidgely.usage.get();
    expect(res.error?.name).toBe('insufficient_scope');
  });
});
