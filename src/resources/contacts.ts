import type { HttpClient } from '../http';
import { seg } from '../http';
import { toApi } from '../transform';
import type {
  Contact,
  ContactSegmentOptions,
  ContactSegmentsSelector,
  CreateContactOptions,
  GetContactOptions,
  ListContactSegmentsOptions,
  ListContactsOptions,
  ObjectId,
  PaginatedData,
  RemoveContactOptions,
  RemoveContactResponseSuccess,
  RemoveContactSegmentResponseSuccess,
  RequestOptions,
  Response,
  Segment,
  UpdateContactOptions,
} from '../types';
import { pageQuery, req } from './shared';

const CONTACT_KEYS = { firstName: 'first_name', lastName: 'last_name' };

/** Resolves the `{id_or_email}` path key and the optional legacy audience prefix. */
function contactPath(options: GetContactOptions | RemoveContactOptions | UpdateContactOptions): string {
  if (typeof options === 'string') return `/contacts/${seg(options)}`;
  const key = options.id ?? options.email;
  if (!key) throw new Error('Missing `id` or `email` field.');
  const base = options.audienceId ? `/audiences/${seg(options.audienceId)}/contacts` : '/contacts';
  return `${base}/${seg(key)}`;
}

function contactKey(options: ContactSegmentsSelector): string {
  const key = options.contactId ?? options.email;
  if (!key) throw new Error('Missing `contactId` or `email` field.');
  return seg(key);
}

function missing<T>(message: string): Promise<Response<T>> {
  return Promise.resolve({ data: null, error: { name: 'missing_required_field', statusCode: null, message }, headers: null });
}

export class ContactSegments {
  constructor(private readonly http: HttpClient) {}

  /** `GET /contacts/{id_or_email}/segments` */
  list(options: ListContactSegmentsOptions, requestOptions?: RequestOptions): Promise<Response<PaginatedData<Segment>>> {
    if (!options.contactId && !options.email) return missing('Missing `contactId` or `email` field.');
    return this.http.get(`/contacts/${contactKey(options)}/segments`, req(requestOptions, { query: pageQuery(options) }));
  }

  /** `POST /contacts/{id_or_email}/segments/{segment_id}` */
  add(options: ContactSegmentOptions, requestOptions?: RequestOptions): Promise<Response<{ id: string }>> {
    if (!options.contactId && !options.email) return missing('Missing `contactId` or `email` field.');
    return this.http.post(`/contacts/${contactKey(options)}/segments/${seg(options.segmentId)}`, req(requestOptions));
  }

  /** `DELETE /contacts/{id_or_email}/segments/{segment_id}` */
  remove(options: ContactSegmentOptions, requestOptions?: RequestOptions): Promise<Response<RemoveContactSegmentResponseSuccess>> {
    if (!options.contactId && !options.email) return missing('Missing `contactId` or `email` field.');
    return this.http.delete(`/contacts/${contactKey(options)}/segments/${seg(options.segmentId)}`, req(requestOptions));
  }
}

export class Contacts {
  readonly segments: ContactSegments;

  constructor(private readonly http: HttpClient) {
    this.segments = new ContactSegments(http);
  }

  /** `POST /contacts` (creates or updates by email). With `audienceId`, uses the legacy audience route. */
  create(payload: CreateContactOptions, options?: RequestOptions): Promise<Response<ObjectId>> {
    const { audienceId, ...rest } = payload;
    const path = audienceId ? `/audiences/${seg(audienceId)}/contacts` : '/contacts';
    return this.http.post(path, req(options, { body: toApi(rest, CONTACT_KEYS) }));
  }

  /** `GET /contacts`, optionally filtered by `segmentId`. */
  list(options?: ListContactsOptions, requestOptions?: RequestOptions): Promise<Response<PaginatedData<Contact>>> {
    return this.http.get(
      '/contacts',
      req(requestOptions, { query: pageQuery(options, { segment_id: options?.segmentId, audience_id: options?.audienceId }) }),
    );
  }

  /** `GET /contacts/{id_or_email}`: pass an id, an email, `{ id }` or `{ email }`. */
  get(options: GetContactOptions, requestOptions?: RequestOptions): Promise<Response<Contact>> {
    if (typeof options !== 'string' && !options.id && !options.email) return missing('Missing `id` or `email` field.');
    return this.http.get(contactPath(options), req(requestOptions));
  }

  /** `PATCH /contacts/{id_or_email}`: `unsubscribed` stays in sync with the suppression list. */
  update(options: UpdateContactOptions, requestOptions?: RequestOptions): Promise<Response<ObjectId>> {
    if (!options.id && !options.email) return missing('Missing `id` or `email` field.');
    const body = toApi(options, CONTACT_KEYS, ['id', 'email', 'audienceId']);
    return this.http.patch(contactPath(options), req(requestOptions, { body }));
  }

  /** `DELETE /contacts/{id_or_email}` */
  remove(options: RemoveContactOptions, requestOptions?: RequestOptions): Promise<Response<RemoveContactResponseSuccess>> {
    if (typeof options !== 'string' && !options.id && !options.email) return missing('Missing `id` or `email` field.');
    return this.http.delete(contactPath(options), req(requestOptions));
  }
}
