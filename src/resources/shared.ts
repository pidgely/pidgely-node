import type { HttpRequest, Query } from '../http';
import type { PaginationOptions, RequestOptions, Response } from '../types';

/** Splits pagination fields into a query object. */
export function pageQuery(options: (PaginationOptions & Record<string, unknown>) | undefined, extra: Query = {}): Query {
  return { limit: options?.limit, after: options?.after, before: options?.before, ...extra };
}

/** Request-level options forwarded to the HTTP layer. */
export function req(options: RequestOptions | undefined, more: HttpRequest = {}): HttpRequest {
  return {
    headers: options?.headers,
    signal: options?.signal,
    timeout: options?.timeout,
    maxRetries: options?.maxRetries,
    ...more,
  };
}

/**
 * Builds a request body locally (e.g. React rendering) and sends it. A local failure is
 * returned as an `application_error` instead of being thrown.
 */
export async function withBody<B, T>(build: () => Promise<B>, send: (body: B) => Promise<Response<T>>): Promise<Response<T>> {
  let body: B;
  try {
    body = await build();
  } catch (err) {
    return {
      data: null,
      error: { name: 'application_error', statusCode: null, message: err instanceof Error ? err.message : String(err) },
      headers: null,
    };
  }
  return send(body);
}
