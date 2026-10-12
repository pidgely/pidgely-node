import type { HttpClient } from '../http';
import { seg } from '../http';
import type {
  Contact,
  CreateSegmentOptions,
  CreateSegmentResponseSuccess,
  Deleted,
  ListSegmentsOptions,
  ObjectId,
  PaginatedData,
  PaginationOptions,
  RequestOptions,
  Response,
  Segment,
  UpdateSegmentOptions,
} from '../types';
import { pageQuery, req } from './shared';

export class Segments {
  constructor(private readonly http: HttpClient) {}

  /** `POST /segments` */
  create(payload: CreateSegmentOptions, options?: RequestOptions): Promise<Response<CreateSegmentResponseSuccess>> {
    return this.http.post('/segments', req(options, { body: { name: payload.name } }));
  }

  /** `GET /segments` */
  list(options?: ListSegmentsOptions, requestOptions?: RequestOptions): Promise<Response<PaginatedData<Segment>>> {
    return this.http.get('/segments', req(requestOptions, { query: pageQuery(options) }));
  }

  /** `GET /segments/{id}` */
  get(id: string, options?: RequestOptions): Promise<Response<Segment>> {
    return this.http.get(`/segments/${seg(id)}`, req(options));
  }

  /** `PATCH /segments/{id}`: rename a segment. */
  update(id: string, payload: UpdateSegmentOptions, options?: RequestOptions): Promise<Response<ObjectId>> {
    return this.http.patch(`/segments/${seg(id)}`, req(options, { body: { name: payload.name } }));
  }

  /** `DELETE /segments/{id}` */
  remove(id: string, options?: RequestOptions): Promise<Response<Deleted>> {
    return this.http.delete(`/segments/${seg(id)}`, req(options));
  }

  /** `GET /segments/{id}/contacts` */
  listContacts(id: string, options?: PaginationOptions, requestOptions?: RequestOptions): Promise<Response<PaginatedData<Contact>>> {
    return this.http.get(`/segments/${seg(id)}/contacts`, req(requestOptions, { query: pageQuery(options) }));
  }
}
