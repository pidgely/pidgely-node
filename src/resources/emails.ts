import type { HttpClient } from '../http';
import { seg } from '../http';
import { emailToApi } from '../transform';
import type {
  CreateEmailOptions,
  CreateEmailRequestOptions,
  CreateEmailResponseSuccess,
  Email,
  EmailAttachment,
  GetAttachmentOptions,
  ListAttachmentsOptions,
  ListEmailsOptions,
  ObjectId,
  PaginatedData,
  RequestOptions,
  Response,
  UpdateEmailOptions,
} from '../types';
import { pageQuery, req, withBody } from './shared';

export class EmailAttachments {
  constructor(private readonly http: HttpClient) {}

  /** `GET /emails/{email_id}/attachments` */
  list(options: ListAttachmentsOptions, requestOptions?: RequestOptions): Promise<Response<PaginatedData<EmailAttachment>>> {
    return this.http.get(`/emails/${seg(options.emailId)}/attachments`, req(requestOptions, { query: pageQuery(options) }));
  }

  /** `GET /emails/{email_id}/attachments/{id}`: includes a signed `download_url` valid for 1 hour. */
  get(options: GetAttachmentOptions, requestOptions?: RequestOptions): Promise<Response<EmailAttachment>> {
    return this.http.get(`/emails/${seg(options.emailId)}/attachments/${seg(options.id)}`, req(requestOptions));
  }
}

export class Emails {
  readonly attachments: EmailAttachments;

  constructor(private readonly http: HttpClient) {
    this.attachments = new EmailAttachments(http);
  }

  /** `POST /emails`: send an email. Renders `react` to HTML when given. */
  send(payload: CreateEmailOptions, options?: CreateEmailRequestOptions): Promise<Response<CreateEmailResponseSuccess>> {
    return withBody(
      () => emailToApi(payload),
      (body) => this.http.post('/emails', req(options, { body, idempotencyKey: options?.idempotencyKey })),
    );
  }

  /** Alias of {@link Emails.send}. */
  create(payload: CreateEmailOptions, options?: CreateEmailRequestOptions): Promise<Response<CreateEmailResponseSuccess>> {
    return this.send(payload, options);
  }

  /** `GET /emails/{id}` */
  get(id: string, options?: RequestOptions): Promise<Response<Email>> {
    return this.http.get(`/emails/${seg(id)}`, req(options));
  }

  /** `GET /emails` */
  list(options?: ListEmailsOptions, requestOptions?: RequestOptions): Promise<Response<PaginatedData<Email>>> {
    return this.http.get('/emails', req(requestOptions, { query: pageQuery(options) }));
  }

  /** `PATCH /emails/{id}`: reschedule a scheduled email. */
  update(payload: UpdateEmailOptions, options?: RequestOptions): Promise<Response<ObjectId>> {
    return this.http.patch(`/emails/${seg(payload.id)}`, req(options, { body: { scheduled_at: payload.scheduledAt } }));
  }

  /** `POST /emails/{id}/cancel`: cancel a scheduled email. */
  cancel(id: string, options?: RequestOptions): Promise<Response<ObjectId>> {
    return this.http.post(`/emails/${seg(id)}/cancel`, req(options));
  }
}
