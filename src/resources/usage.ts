import type { HttpClient } from '../http';
import type { RequestOptions, Response, Usage as UsageView } from '../types';
import { req } from './shared';

export class Usage {
  constructor(private readonly http: HttpClient) {}

  /** `GET /v1/usage`: today's counters, the daily quota and the account status. */
  get(options?: RequestOptions): Promise<Response<UsageView>> {
    return this.http.get('/v1/usage', req(options));
  }
}
