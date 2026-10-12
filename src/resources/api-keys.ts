import type { HttpClient } from '../http';
import { seg } from '../http';
import type {
  ApiKey,
  CreateApiKeyOptions,
  CreatedApiKey,
  Deleted,
  ListApiKeysOptions,
  ObjectId,
  PaginatedData,
  RequestOptions,
  Response,
  UpdateApiKeyOptions,
} from '../types';
import { pageQuery, req } from './shared';

export class ApiKeys {
  constructor(private readonly http: HttpClient) {}

  /** `POST /api-keys`: the `token` is only returned once. */
  create(payload: CreateApiKeyOptions, options?: RequestOptions): Promise<Response<CreatedApiKey>> {
    const { domainId, domain_id, ...rest } = payload;
    const body: Record<string, unknown> = { ...rest };
    if (domainId ?? domain_id) body.domain_id = domainId ?? domain_id;
    return this.http.post('/api-keys', req(options, { body }));
  }

  /** `GET /api-keys` */
  list(options?: ListApiKeysOptions, requestOptions?: RequestOptions): Promise<Response<PaginatedData<ApiKey>>> {
    return this.http.get('/api-keys', req(requestOptions, { query: pageQuery(options) }));
  }

  /** `PATCH /api-keys/{id}`: rename a key. */
  update(id: string, payload: UpdateApiKeyOptions, options?: RequestOptions): Promise<Response<ObjectId>> {
    return this.http.patch(`/api-keys/${seg(id)}`, req(options, { body: { name: payload.name } }));
  }

  /** `DELETE /api-keys/{id}`: revoke a key. */
  remove(id: string, options?: RequestOptions): Promise<Response<Deleted>> {
    return this.http.delete(`/api-keys/${seg(id)}`, req(options));
  }
}
