import { describe, expect, it } from 'vitest';
import { fromBase64, toBase64 } from '../src/transform';
import { subtle } from '../src/webhooks/verify';

// Exercises the code paths used on edge runtimes / browsers (no Buffer) and Node 18 (no global WebCrypto).
describe('runtime fallbacks', () => {
  it('base64 helpers work without Buffer', () => {
    const bytes = new Uint8Array(70_000).map((_, i) => i % 256);
    const encoded = toBase64(bytes, null);
    expect(encoded).toBe(toBase64(bytes));
    expect(fromBase64(encoded, null)).toEqual(bytes);
    expect(toBase64(new TextEncoder().encode('hello'), null)).toBe('aGVsbG8=');
  });

  it('falls back to node:crypto webcrypto when there is no global crypto', async () => {
    const s = await subtle(null);
    const key = await s.importKey('raw', new Uint8Array([1, 2, 3]), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const mac = new Uint8Array(await s.sign('HMAC', key, new TextEncoder().encode('x')));
    expect(mac).toHaveLength(32);
    // Node 19+ exposes WebCrypto globally; Node 18 does not and uses the fallback.
    const global = (globalThis as { crypto?: { subtle?: unknown } }).crypto?.subtle;
    if (global) expect(await subtle()).toBe(global);
    else expect(await subtle()).toBeDefined();
  });
});
