import type { HttpClient } from '../http';
import { seg } from '../http';
import { toApi, withRenderedReact } from '../transform';
import type {
  Broadcast,
  CreateBroadcastOptions,
  Deleted,
  ListBroadcastsOptions,
  ObjectId,
  PaginatedData,
  RequestOptions,
  Response,
  SendBroadcastOptions,
  UpdateBroadcastOptions,
} from '../types';
import { pageQuery, req, withBody } from './shared';

const BROADCAST_KEYS = {
  segmentId: 'segment_id',
  audienceId: 'audience_id',
  replyTo: 'reply_to',
  previewText: 'preview_text',
  scheduledAt: 'scheduled_at',
  topicId: 'topic_id',
};

export class Broadcasts {
  constructor(private readonly http: HttpClient) {}

  /** `POST /broadcasts`: creates a draft, or sends it with `send: true`. */
  create(payload: CreateBroadcastOptions, options?: RequestOptions): Promise<Response<ObjectId>> {
    return withBody(
      async () => toApi(await withRenderedReact(payload), BROADCAST_KEYS),
      (body) => this.http.post('/broadcasts', req(options, { body })),
    );
  }

  /** `GET /broadcasts` */
  list(options?: ListBroadcastsOptions, requestOptions?: RequestOptions): Promise<Response<PaginatedData<Broadcast>>> {
    return this.http.get('/broadcasts', req(requestOptions, { query: pageQuery(options) }));
  }

  /** `GET /broadcasts/{id}` */
  get(id: string, options?: RequestOptions): Promise<Response<Broadcast>> {
    return this.http.get(`/broadcasts/${seg(id)}`, req(options));
  }

  /** `PATCH /broadcasts/{id}`: drafts only. */
  update(id: string, payload: UpdateBroadcastOptions, options?: RequestOptions): Promise<Response<ObjectId>> {
    return withBody(
      async () => toApi(await withRenderedReact(payload), BROADCAST_KEYS),
      (body) => this.http.patch(`/broadcasts/${seg(id)}`, req(options, { body })),
    );
  }

  /** `DELETE /broadcasts/{id}` */
  remove(id: string, options?: RequestOptions): Promise<Response<Deleted>> {
    return this.http.delete(`/broadcasts/${seg(id)}`, req(options));
  }

  /** `POST /broadcasts/{id}/send`: now, or at `scheduledAt`. */
  send(id: string, payload?: SendBroadcastOptions, options?: RequestOptions): Promise<Response<{ id: string }>> {
    const body = payload?.scheduledAt ? { scheduled_at: payload.scheduledAt } : {};
    return this.http.post(`/broadcasts/${seg(id)}/send`, req(options, { body }));
  }

  /** `POST /broadcasts/{id}/cancel`: cancel a scheduled or queued broadcast. */
  cancel(id: string, options?: RequestOptions): Promise<Response<ObjectId>> {
    return this.http.post(`/broadcasts/${seg(id)}/cancel`, req(options));
  }

  /** `POST /broadcasts/{id}/duplicate`: copy as a new draft. */
  duplicate(id: string, options?: RequestOptions): Promise<Response<ObjectId>> {
    return this.http.post(`/broadcasts/${seg(id)}/duplicate`, req(options));
  }
}
