import { renderReact } from './render';
import type { Attachment, CreateEmailOptions } from './types';

/**
 * Converts the SDK's camelCase options into the API's snake_case body. Keys listed in
 * `map` are renamed; any other key is passed through untouched, so snake_case input
 * (as accepted by the REST API) also works.
 */
export function toApi(input: object, map: Record<string, string>, omit: readonly string[] = []): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || omit.includes(key)) continue;
    out[map[key] ?? key] = value;
  }
  return out;
}

const EMAIL_KEYS = { replyTo: 'reply_to', scheduledAt: 'scheduled_at', topicId: 'topic_id' };
const ATTACHMENT_KEYS = { contentType: 'content_type', contentId: 'content_id' };

/** Fills `html` from `react` when given (requires `@react-email/render`). */
export async function withRenderedReact<T extends { react?: unknown; html?: unknown }>(payload: T): Promise<Omit<T, 'react'>> {
  const { react, ...rest } = payload;
  if (react === undefined || react === null) return rest;
  return { ...rest, html: await renderReact(react) };
}

export async function emailToApi(payload: CreateEmailOptions): Promise<Record<string, unknown>> {
  const rendered = await withRenderedReact(payload as CreateEmailOptions & { react?: unknown });
  const body = toApi(rendered, EMAIL_KEYS);
  if (Array.isArray(body.attachments)) {
    body.attachments = (body.attachments as Attachment[]).map((a) => {
      const att = toApi(a, ATTACHMENT_KEYS);
      if (a.content instanceof Uint8Array) att.content = toBase64(a.content);
      return att;
    });
  }
  return body;
}

type BufferLike = {
  from(b: Uint8Array): { toString(enc: string): string };
  from(s: string, enc: string): Uint8Array;
};

function nodeBuffer(): BufferLike | null {
  return (globalThis as { Buffer?: BufferLike }).Buffer ?? null;
}

/** Base64-encodes bytes, with `Buffer` when available (Node, Bun) and `btoa` elsewhere (edge, Deno, browsers). */
export function toBase64(bytes: Uint8Array, B: BufferLike | null = nodeBuffer()): string {
  if (B) return B.from(bytes).toString('base64');
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Decodes base64, with `Buffer` when available and `atob` elsewhere (which throws on invalid input). */
export function fromBase64(value: string, B: BufferLike | null = nodeBuffer()): Uint8Array {
  if (B) return new Uint8Array(B.from(value, 'base64'));
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}
