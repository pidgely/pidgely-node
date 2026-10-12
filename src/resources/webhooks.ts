import type { HttpClient } from '../http';
import { seg } from '../http';
import type {
  CreateWebhookOptions,
  CreateWebhookResponseSuccess,
  Deleted,
  ListWebhooksOptions,
  ObjectId,
  PaginatedData,
  RequestOptions,
  Response,
  UpdateWebhookOptions,
  Webhook,
  WebhookEvent,
} from '../types';
import type { VerifyWebhookOptions, WebhookHeadersInput } from '../webhooks/verify';
import { verifyWebhook } from '../webhooks/verify';
import { pageQuery, req } from './shared';

export class Webhooks {
  constructor(private readonly http: HttpClient) {}

  /** `POST /webhooks`: returns the `signing_secret` (`whsec_…`). */
  create(payload: CreateWebhookOptions, options?: RequestOptions): Promise<Response<CreateWebhookResponseSuccess>> {
    return this.http.post('/webhooks', req(options, { body: { endpoint: payload.endpoint, events: payload.events } }));
  }

  /** `GET /webhooks` */
  list(options?: ListWebhooksOptions, requestOptions?: RequestOptions): Promise<Response<PaginatedData<Webhook>>> {
    return this.http.get('/webhooks', req(requestOptions, { query: pageQuery(options) }));
  }

  /** `GET /webhooks/{id}` */
  get(id: string, options?: RequestOptions): Promise<Response<Webhook>> {
    return this.http.get(`/webhooks/${seg(id)}`, req(options));
  }

  /** `PATCH /webhooks/{id}` */
  update(id: string, payload: UpdateWebhookOptions, options?: RequestOptions): Promise<Response<ObjectId>> {
    return this.http.patch(`/webhooks/${seg(id)}`, req(options, { body: { ...payload } }));
  }

  /** `DELETE /webhooks/{id}` */
  remove(id: string, options?: RequestOptions): Promise<Response<Deleted>> {
    return this.http.delete(`/webhooks/${seg(id)}`, req(options));
  }

  /** `POST /webhooks/{id}/signing-secret/rotate` */
  rotateSigningSecret(id: string, options?: RequestOptions): Promise<Response<CreateWebhookResponseSuccess>> {
    return this.http.post(`/webhooks/${seg(id)}/signing-secret/rotate`, req(options));
  }

  /**
   * Verifies a delivery's signature and returns the parsed event. Accepts either
   * `(payload, headers, secret)` or Resend's `{ payload, headers, webhookSecret }`.
   *
   * @throws {WebhookVerificationError}
   */
  verify<T = Record<string, unknown>>(options: VerifyWebhookOptions): Promise<WebhookEvent<T>>;
  verify<T = Record<string, unknown>>(
    payload: string | Uint8Array,
    headers: WebhookHeadersInput,
    secret: string,
    options?: Pick<VerifyWebhookOptions, 'tolerance' | 'now'>,
  ): Promise<WebhookEvent<T>>;
  verify<T = Record<string, unknown>>(
    payloadOrOptions: VerifyWebhookOptions | string | Uint8Array,
    headers?: WebhookHeadersInput,
    secret?: string,
    options?: Pick<VerifyWebhookOptions, 'tolerance' | 'now'>,
  ): Promise<WebhookEvent<T>> {
    if (typeof payloadOrOptions === 'string' || payloadOrOptions instanceof Uint8Array) {
      return verifyWebhook<T>({ payload: payloadOrOptions, headers: headers ?? {}, webhookSecret: secret ?? '', ...options });
    }
    return verifyWebhook<T>(payloadOrOptions);
  }
}
