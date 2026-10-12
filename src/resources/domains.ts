import type { HttpClient } from '../http';
import { seg } from '../http';
import { toApi } from '../transform';
import type {
  CreateDomainOptions,
  Deleted,
  Domain,
  ListDomainsOptions,
  ObjectId,
  PaginatedData,
  RequestOptions,
  Response,
  UpdateDomainOptions,
} from '../types';
import { pageQuery, req } from './shared';

const DOMAIN_KEYS = { customReturnPath: 'custom_return_path', openTracking: 'open_tracking', clickTracking: 'click_tracking' };

export class Domains {
  constructor(private readonly http: HttpClient) {}

  /** `POST /domains`: returns the DNS `records` to publish. */
  create(payload: CreateDomainOptions, options?: RequestOptions): Promise<Response<Domain>> {
    return this.http.post('/domains', req(options, { body: toApi(payload, DOMAIN_KEYS) }));
  }

  /** `GET /domains` */
  list(options?: ListDomainsOptions, requestOptions?: RequestOptions): Promise<Response<PaginatedData<Domain>>> {
    return this.http.get('/domains', req(requestOptions, { query: pageQuery(options) }));
  }

  /** `GET /domains/{id}`: includes the DNS `records` and their status. */
  get(id: string, options?: RequestOptions): Promise<Response<Domain>> {
    return this.http.get(`/domains/${seg(id)}`, req(options));
  }

  /** `PATCH /domains/{id}` */
  update(payload: UpdateDomainOptions, options?: RequestOptions): Promise<Response<ObjectId>> {
    const { id, ...rest } = payload;
    return this.http.patch(`/domains/${seg(id)}`, req(options, { body: toApi(rest, DOMAIN_KEYS) }));
  }

  /** `DELETE /domains/{id}` */
  remove(id: string, options?: RequestOptions): Promise<Response<Deleted>> {
    return this.http.delete(`/domains/${seg(id)}`, req(options));
  }

  /** `POST /domains/{id}/verify`: checks the DNS records now. */
  verify(id: string, options?: RequestOptions): Promise<Response<ObjectId>> {
    return this.http.post(`/domains/${seg(id)}/verify`, req(options));
  }
}
