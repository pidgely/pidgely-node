import type { HttpClient } from '../http';
import { seg } from '../http';
import type {
  AddSuppressionOptions,
  BatchAddSuppressionsOptions,
  BatchRemoveSuppressionsOptions,
  Deleted,
  ListSuppressionsOptions,
  ObjectId,
  PaginatedData,
  RequestOptions,
  Response,
  Suppression,
} from '../types';
import { pageQuery, req } from './shared';

export class SuppressionsBatch {
  constructor(private readonly http: HttpClient) {}

  /** `POST /suppressions/batch/add`: up to 100 addresses. */
  add(payload: BatchAddSuppressionsOptions, options?: RequestOptions): Promise<Response<PaginatedData<ObjectId>>> {
    return this.http.post('/suppressions/batch/add', req(options, { body: { emails: payload.emails } }));
  }

  /** `POST /suppressions/batch/remove`: by `emails` and/or `ids`, up to 100. */
  remove(payload: BatchRemoveSuppressionsOptions, options?: RequestOptions): Promise<Response<PaginatedData<Deleted>>> {
    return this.http.post('/suppressions/batch/remove', req(options, { body: { emails: payload.emails, ids: payload.ids } }));
  }
}

export class Suppressions {
  readonly batch: SuppressionsBatch;

  constructor(private readonly http: HttpClient) {
    this.batch = new SuppressionsBatch(http);
  }

  /** `POST /suppressions`: stop sending to an address. */
  add(payload: AddSuppressionOptions, options?: RequestOptions): Promise<Response<ObjectId>> {
    return this.http.post('/suppressions', req(options, { body: { email: payload.email } }));
  }

  /** Alias of {@link Suppressions.add}. */
  create(payload: AddSuppressionOptions, options?: RequestOptions): Promise<Response<ObjectId>> {
    return this.add(payload, options);
  }

  /** `GET /suppressions`, optionally filtered by `origin`. */
  list(options?: ListSuppressionsOptions, requestOptions?: RequestOptions): Promise<Response<PaginatedData<Suppression>>> {
    return this.http.get('/suppressions', req(requestOptions, { query: pageQuery(options, { origin: options?.origin }) }));
  }

  /** `GET /suppressions/{id_or_email}` */
  get(idOrEmail: string, options?: RequestOptions): Promise<Response<Suppression>> {
    return this.http.get(`/suppressions/${seg(idOrEmail)}`, req(options));
  }

  /** `DELETE /suppressions/{id_or_email}`: allow sending to the address again. */
  remove(idOrEmail: string, options?: RequestOptions): Promise<Response<Deleted>> {
    return this.http.delete(`/suppressions/${seg(idOrEmail)}`, req(options));
  }
}
