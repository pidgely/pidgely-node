import { describe, expect, it } from 'vitest';
import { Pidgely, signWebhook, verifyWebhook, WebhookVerificationError } from '../src';
import { timingSafeEqual } from '../src/webhooks/verify';

// Official Standard Webhooks / Svix test vector.
const SECRET = 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw';
const MSG_ID = 'msg_p5jXN8AQM9LWM0D4loKWxJek';
const TS = 1614265330;
const PAYLOAD = '{"test": 2432232314}';
const SIGNATURE = 'v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=';
const NOW = new Date(TS * 1000);

const svixHeaders = { 'svix-id': MSG_ID, 'svix-timestamp': String(TS), 'svix-signature': SIGNATURE };

describe('webhook signatures', () => {
  it('matches the Standard Webhooks test vector', async () => {
    expect(await signWebhook(SECRET, MSG_ID, TS, PAYLOAD)).toBe(SIGNATURE);
    expect(await signWebhook(SECRET.slice(6), MSG_ID, TS, new TextEncoder().encode(PAYLOAD))).toBe(SIGNATURE);
  });

  it('verifies with svix-* headers and returns the parsed payload', async () => {
    const event = await verifyWebhook({ payload: PAYLOAD, headers: svixHeaders, webhookSecret: SECRET, now: NOW });
    expect(event).toEqual({ test: 2432232314 });
  });

  it('verifies with webhook-* headers in a Fetch Headers object', async () => {
    const headers = new Headers({ 'webhook-id': MSG_ID, 'webhook-timestamp': String(TS), 'webhook-signature': SIGNATURE });
    await expect(verifyWebhook({ payload: PAYLOAD, headers, webhookSecret: SECRET, now: NOW })).resolves.toEqual({ test: 2432232314 });
  });

  it('verifies with svix-* names in a Fetch Headers object', async () => {
    await expect(verifyWebhook({ payload: PAYLOAD, headers: new Headers(svixHeaders), webhookSecret: SECRET, now: NOW })).resolves.toBeTruthy();
  });

  it('accepts Resend-style { id, timestamp, signature } and mixed-case Node headers', async () => {
    await expect(
      verifyWebhook({ payload: PAYLOAD, headers: { id: MSG_ID, timestamp: String(TS), signature: SIGNATURE }, webhookSecret: SECRET, now: NOW }),
    ).resolves.toBeTruthy();
    await expect(
      verifyWebhook({
        payload: PAYLOAD,
        headers: { 'Svix-Id': MSG_ID, 'Svix-Timestamp': String(TS), 'Svix-Signature': [SIGNATURE] },
        webhookSecret: SECRET,
        now: NOW,
      }),
    ).resolves.toBeTruthy();
  });

  it('accepts any matching signature among several (secret rotation)', async () => {
    const headers = { ...svixHeaders, 'svix-signature': `v1,bm90IHRoaXMgb25l ${SIGNATURE} v2,other` };
    await expect(verifyWebhook({ payload: PAYLOAD, headers, webhookSecret: SECRET, now: NOW })).resolves.toBeTruthy();
  });

  it('accepts a Uint8Array payload', async () => {
    const payload = new TextEncoder().encode(PAYLOAD);
    await expect(verifyWebhook({ payload, headers: svixHeaders, webhookSecret: SECRET, now: NOW })).resolves.toEqual({ test: 2432232314 });
  });

  it('accepts timestamps within the tolerance', async () => {
    const now = new Date((TS + 299) * 1000);
    await expect(verifyWebhook({ payload: PAYLOAD, headers: svixHeaders, webhookSecret: SECRET, now })).resolves.toBeTruthy();
  });

  const reject = async (opts: Partial<Parameters<typeof verifyWebhook>[0]>, message: RegExp) => {
    const err = await verifyWebhook({ payload: PAYLOAD, headers: svixHeaders, webhookSecret: SECRET, now: NOW, ...opts }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(WebhookVerificationError);
    expect((err as Error).name).toBe('WebhookVerificationError');
    expect((err as Error).message).toMatch(message);
  };

  it('rejects a tampered payload', () => reject({ payload: '{"test": 2432232315}' }, /No matching signature/));
  it('rejects a wrong secret', () => reject({ webhookSecret: 'whsec_' + btoa('another secret value!!') }, /No matching signature/));
  it('rejects a wrong message id', () => reject({ headers: { ...svixHeaders, 'svix-id': 'msg_other' } }, /No matching signature/));
  it('rejects an old timestamp', () => reject({ now: new Date((TS + 301) * 1000) }, /too old/));
  it('rejects a future timestamp', () => reject({ now: new Date((TS - 301) * 1000) }, /too new/));
  it('honours a custom tolerance', () => reject({ now: new Date((TS + 11) * 1000), tolerance: 10 }, /too old/));
  it('rejects a non-numeric timestamp', () => reject({ headers: { ...svixHeaders, 'svix-timestamp': '12abc' } }, /Invalid signature headers/));
  it('rejects missing headers', () => reject({ headers: { 'svix-id': MSG_ID } }, /Missing required headers/));
  it('rejects a missing secret', () => reject({ webhookSecret: '' }, /Missing webhook secret/));
  it('rejects an empty secret key', () => reject({ webhookSecret: 'whsec_' }, /Invalid webhook secret/));
  it('rejects a secret that is not base64', () => reject({ webhookSecret: 'whsec_%%%not-base64' }, /Invalid webhook secret/));
  it('rejects a v1 signature with the wrong length', () =>
    reject({ headers: { ...svixHeaders, 'svix-signature': 'v1,short' } }, /No matching signature/));

  it('rejects a signed but non-JSON payload', async () => {
    const sig = await signWebhook(SECRET, MSG_ID, TS, 'not json');
    await reject({ payload: 'not json', headers: { ...svixHeaders, 'svix-signature': sig } }, /not valid JSON/);
  });

  it('round-trips a signed Pidgely event', async () => {
    const body = JSON.stringify({ type: 'email.delivered', created_at: '2026-10-12T10:00:00Z', data: { email_id: 'em_1', to: ['a@x.com'] } });
    const ts = Math.floor(Date.now() / 1000);
    const sig = await signWebhook(SECRET, 'msg_1', ts, body);
    const event = await verifyWebhook({
      payload: body,
      headers: { 'webhook-id': 'msg_1', 'webhook-timestamp': String(ts), 'webhook-signature': sig },
      webhookSecret: SECRET,
    });
    expect(event.type).toBe('email.delivered');
    expect(event.data.email_id).toBe('em_1');
  });

  it('pidgely.webhooks.verify accepts positional and object arguments', async () => {
    const pidgely = new Pidgely('pdg_test');
    await expect(pidgely.webhooks.verify(PAYLOAD, svixHeaders, SECRET, { now: NOW })).resolves.toEqual({ test: 2432232314 });
    await expect(pidgely.webhooks.verify({ payload: PAYLOAD, headers: svixHeaders, webhookSecret: SECRET, now: NOW })).resolves.toBeTruthy();
    await expect(pidgely.webhooks.verify(PAYLOAD, undefined as never, undefined as never)).rejects.toThrow(/Missing webhook secret/);
  });

  it('timingSafeEqual', () => {
    expect(timingSafeEqual('abc', 'abc')).toBe(true);
    expect(timingSafeEqual('abc', 'abd')).toBe(false);
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
  });
});
