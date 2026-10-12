import { vi } from 'vitest';
import { Pidgely } from '../src';
import type { PidgelyOptions } from '../src';

export interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

export type Reply = { status?: number; body?: unknown; headers?: Record<string, string> } | Error;

/** A fetch mock that records calls and answers from a queue (last reply repeats). */
export function mockFetch(...replies: Reply[]) {
  const calls: Call[] = [];
  const queue = replies.length ? [...replies] : [{ status: 200, body: { id: 'x' } }];
  const fetch = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({
      url,
      method: init.method ?? 'GET',
      headers: init.headers as Record<string, string>,
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
    });
    const reply = queue.length > 1 ? queue.shift()! : queue[0]!;
    if (reply instanceof Error) throw reply;
    const body = reply.body === undefined ? '' : typeof reply.body === 'string' ? reply.body : JSON.stringify(reply.body);
    return new Response(body, { status: reply.status ?? 200, headers: reply.headers });
  });
  return { fetch, calls };
}

/** A client wired to a mock fetch, with retries' sleep stubbed out. */
export function client(replies: Reply[] = [], options: PidgelyOptions = {}) {
  const { fetch, calls } = mockFetch(...replies);
  const pidgely = new Pidgely('pdg_test_key', { fetch, ...options });
  const sleeps: number[] = [];
  // Reach the shared HttpClient through any resource to stub its sleep.
  const http = (pidgely.emails as unknown as { http: { sleep: (ms: number) => Promise<void> } }).http;
  http.sleep = async (ms: number) => {
    sleeps.push(ms);
  };
  return { pidgely, fetch, calls, sleeps };
}

export function lastCall(calls: Call[]): Call {
  const call = calls.at(-1);
  if (!call) throw new Error('no fetch call recorded');
  return call;
}
