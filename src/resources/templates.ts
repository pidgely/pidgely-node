import type { HttpClient } from '../http';
import { seg } from '../http';
import { toApi, withRenderedReact } from '../transform';
import type {
  CreateTemplateOptions,
  Deleted,
  ListTemplatesOptions,
  ObjectId,
  PaginatedData,
  RequestOptions,
  Response,
  Template,
  UpdateTemplateOptions,
} from '../types';
import { pageQuery, req, withBody } from './shared';

const TEMPLATE_KEYS = { replyTo: 'reply_to' };

function templateBody(payload: UpdateTemplateOptions) {
  return async () => {
    const body = toApi(await withRenderedReact(payload), TEMPLATE_KEYS);
    if (payload.variables) {
      body.variables = payload.variables.map((v) => toApi(v, { fallbackValue: 'fallback_value' }));
    }
    return body;
  };
}

/**
 * Awaitable result that can also be chained with `.publish()`, as in the Resend SDK:
 * `await pidgely.templates.create({...}).publish()`.
 */
export class ChainableTemplateResult implements PromiseLike<Response<ObjectId>> {
  constructor(
    private readonly promise: Promise<Response<ObjectId>>,
    private readonly publishFn: (id: string, options?: RequestOptions) => Promise<Response<ObjectId>>,
  ) {}

  then<R1 = Response<ObjectId>, R2 = never>(
    onfulfilled?: ((value: Response<ObjectId>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.promise.then(onfulfilled, onrejected);
  }

  /** Publishes the template once it has been created/duplicated. */
  async publish(options?: RequestOptions): Promise<Response<ObjectId>> {
    const result = await this.promise;
    if (result.error) return result;
    return this.publishFn(result.data.id, options);
  }
}

export class Templates {
  constructor(private readonly http: HttpClient) {}

  /** `POST /templates`: creates a draft. Chain `.publish()` to publish it. */
  create(payload: CreateTemplateOptions, options?: RequestOptions): ChainableTemplateResult {
    const promise = withBody(templateBody(payload), (body) => this.http.post<ObjectId>('/templates', req(options, { body })));
    return new ChainableTemplateResult(promise, (id, o) => this.publish(id, o));
  }

  /** `GET /templates` */
  list(options?: ListTemplatesOptions, requestOptions?: RequestOptions): Promise<Response<PaginatedData<Template>>> {
    return this.http.get('/templates', req(requestOptions, { query: pageQuery(options) }));
  }

  /** `GET /templates/{id_or_alias}`: the current draft. */
  get(idOrAlias: string, options?: RequestOptions): Promise<Response<Template>> {
    return this.http.get(`/templates/${seg(idOrAlias)}`, req(options));
  }

  /** `PATCH /templates/{id_or_alias}`: updates the draft. */
  update(idOrAlias: string, payload: UpdateTemplateOptions, options?: RequestOptions): Promise<Response<ObjectId>> {
    return withBody(templateBody(payload), (body) => this.http.patch<ObjectId>(`/templates/${seg(idOrAlias)}`, req(options, { body })));
  }

  /** `DELETE /templates/{id_or_alias}` */
  remove(idOrAlias: string, options?: RequestOptions): Promise<Response<Deleted>> {
    return this.http.delete(`/templates/${seg(idOrAlias)}`, req(options));
  }

  /** `POST /templates/{id_or_alias}/publish`: the published version is what `template: { id }` sends. */
  publish(idOrAlias: string, options?: RequestOptions): Promise<Response<ObjectId>> {
    return this.http.post(`/templates/${seg(idOrAlias)}/publish`, req(options));
  }

  /** `POST /templates/{id_or_alias}/duplicate`. Chain `.publish()` to publish the copy. */
  duplicate(idOrAlias: string, options?: RequestOptions): ChainableTemplateResult {
    const promise = this.http.post<ObjectId>(`/templates/${seg(idOrAlias)}/duplicate`, req(options));
    return new ChainableTemplateResult(promise, (id, o) => this.publish(id, o));
  }
}
