import type { HttpClient } from '../http';
import { emailToApi } from '../transform';
import type { CreateBatchOptions, CreateBatchRequestOptions, CreateBatchResponseSuccess, Response } from '../types';
import { req, withBody } from './shared';

export class Batch {
  constructor(private readonly http: HttpClient) {}

  /** `POST /emails/batch`: send up to 100 emails in one request. */
  send(payload: CreateBatchOptions, options?: CreateBatchRequestOptions): Promise<Response<CreateBatchResponseSuccess>> {
    const headers = { ...options?.headers };
    if (options?.batchValidation) headers['x-batch-validation'] = options.batchValidation;
    return withBody(
      () => Promise.all(payload.map((email) => emailToApi(email))),
      (body) => this.http.post('/emails/batch', req({ ...options, headers }, { body, idempotencyKey: options?.idempotencyKey })),
    );
  }

  /** Alias of {@link Batch.send}. */
  create(payload: CreateBatchOptions, options?: CreateBatchRequestOptions): Promise<Response<CreateBatchResponseSuccess>> {
    return this.send(payload, options);
  }
}
