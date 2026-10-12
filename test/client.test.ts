import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_BASE_URL, Pidgely, VERSION } from '../src';
import pkg from '../package.json';
import { client, lastCall, mockFetch } from './helpers';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Pidgely client', () => {
  it('throws without an API key', () => {
    vi.stubEnv('PIDGELY_API_KEY', '');
    expect(() => new Pidgely()).toThrow(/Missing API key/);
  });

  it('reads PIDGELY_API_KEY and PIDGELY_BASE_URL', async () => {
    vi.stubEnv('PIDGELY_API_KEY', 'pdg_env_key');
    vi.stubEnv('PIDGELY_BASE_URL', 'https://eu.example.com/');
    const { fetch, calls } = mockFetch({ body: { id: '1' } });
    const p = new Pidgely(undefined, { fetch });
    expect(p.baseUrl).toBe('https://eu.example.com');
    await p.emails.get('1');
    expect(lastCall(calls).url).toBe('https://eu.example.com/emails/1');
    expect(lastCall(calls).headers.Authorization).toBe('Bearer pdg_env_key');
  });

  it('prefers explicit arguments over the environment', () => {
    vi.stubEnv('PIDGELY_API_KEY', 'pdg_env');
    vi.stubEnv('PIDGELY_BASE_URL', 'https://env.example.com');
    const p = new Pidgely('pdg_arg', { baseUrl: 'http://localhost:8080///' });
    expect(p.key).toBe('pdg_arg');
    expect(p.baseUrl).toBe('http://localhost:8080');
  });

  it('defaults to the production base URL', () => {
    vi.stubEnv('PIDGELY_BASE_URL', '');
    expect(new Pidgely('k').baseUrl).toBe(DEFAULT_BASE_URL);
  });

  it('does not expose the key when serialized', () => {
    const p = new Pidgely('pdg_secret_value');
    expect(Object.keys(p)).not.toContain('key');
    expect(JSON.stringify(p)).not.toContain('pdg_secret_value');
  });

  it('keeps audiences as an alias of segments', () => {
    const p = new Pidgely('k');
    expect(p.audiences).toBe(p.segments);
  });

  it('sends auth, accept, user agent and custom headers', async () => {
    const { pidgely, calls } = client([{ body: {} }], { userAgent: 'my-app/1.0', headers: { 'X-Team': 'growth' } });
    await pidgely.domains.list();
    const h = lastCall(calls).headers;
    expect(h.Authorization).toBe('Bearer pdg_test_key');
    expect(h.Accept).toBe('application/json');
    expect(h['User-Agent']).toBe(`pidgely-node/${VERSION} my-app/1.0`);
    expect(h['X-Team']).toBe('growth');
    expect(h['Content-Type']).toBeUndefined();
  });

  it('uses pidgely-node/<version> as user agent and keeps VERSION in sync with package.json', async () => {
    expect(VERSION).toBe(pkg.version);
    const { pidgely, calls } = client([{ body: {} }]);
    await pidgely.domains.list();
    expect(lastCall(calls).headers['User-Agent']).toBe(`pidgely-node/${pkg.version}`);
  });

  it('falls back to the global fetch', async () => {
    const { fetch } = mockFetch({ body: { object: 'list', has_more: false, data: [] } });
    vi.stubGlobal('fetch', fetch);
    try {
      const { data } = await new Pidgely('k').domains.list();
      expect(data?.data).toEqual([]);
      expect(fetch).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
