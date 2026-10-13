import type { HttpClient } from '../http';
import { toApi } from '../transform';
import type {
  BuilderAIBlock,
  BuilderAIEmail,
  BuilderConversion,
  BuilderRender,
  BuilderThemeView,
  ConvertHtmlOptions,
  GenerateTemplateOptions,
  PaginatedData,
  RenderDocumentOptions,
  RequestOptions,
  Response,
  RewriteBlockOptions,
  SubjectSuggestion,
  SuggestSubjectsOptions,
  TemplateBuilderCapabilities,
  TranslateTemplateOptions,
  UpdateThemeOptions,
} from '../types';
import { req } from './shared';

/** Builder documents, themes and blocks are API JSON: only the SDK's own option names are renamed. */
const AI_KEYS = { templateId: 'template_id' };

/**
 * AI assist (Scale plan): every call counts against the organization's monthly AI quota
 * (`429 ai_quota_exceeded`) and per-minute limit (`429 ai_rate_limited`).
 */
export class TemplateBuilderAI {
  constructor(private readonly http: HttpClient) {}

  /** `POST /template-builder/ai/generate`: a complete document, subject and preview text from a prompt, with your theme and brand. */
  generate(payload: GenerateTemplateOptions, options?: RequestOptions): Promise<Response<BuilderAIEmail>> {
    return this.http.post('/template-builder/ai/generate', req(options, { body: toApi(payload, AI_KEYS) }));
  }

  /** `POST /template-builder/ai/rewrite`: improve, shorten, lengthen, fix or change the tone of one block (links and style are kept). */
  rewrite(payload: RewriteBlockOptions, options?: RequestOptions): Promise<Response<BuilderAIBlock>> {
    return this.http.post('/template-builder/ai/rewrite', req(options, { body: toApi(payload, AI_KEYS) }));
  }

  /** `POST /template-builder/ai/translate`: the subject, preview text and every text of a document; structure and links stay. */
  translate(payload: TranslateTemplateOptions, options?: RequestOptions): Promise<Response<BuilderAIEmail>> {
    return this.http.post('/template-builder/ai/translate', req(options, { body: toApi(payload, AI_KEYS) }));
  }

  /** `POST /template-builder/ai/subjects`: five subject line and preview text ideas. */
  subjects(payload: SuggestSubjectsOptions, options?: RequestOptions): Promise<Response<Omit<PaginatedData<SubjectSuggestion>, 'has_more'>>> {
    return this.http.post('/template-builder/ai/subjects', req(options, { body: toApi(payload, AI_KEYS) }));
  }
}

/**
 * Visual template builder (Pidgely extension). Rendering, converting and saving themes need the
 * Scale plan (`403 plan_required`); `capabilities` and `getTheme` work on every plan. Save a
 * document as a template with `templates.create({ name, builder: document })`.
 */
export class TemplateBuilder {
  readonly ai: TemplateBuilderAI;

  constructor(private readonly http: HttpClient) {
    this.ai = new TemplateBuilderAI(http);
  }

  /** `GET /template-builder`: plan, AI quota, saved theme and brand, brand import availability. */
  capabilities(options?: RequestOptions): Promise<Response<TemplateBuilderCapabilities>> {
    return this.http.get('/template-builder', req(options));
  }

  /** `GET /template-builder/theme`: the organization theme (or the default one) and brand profile. */
  getTheme(options?: RequestOptions): Promise<Response<BuilderThemeView>> {
    return this.http.get('/template-builder/theme', req(options));
  }

  /** `PATCH /template-builder/theme`: save the default theme and, optionally, the brand profile. */
  updateTheme(payload: UpdateThemeOptions, options?: RequestOptions): Promise<Response<BuilderThemeView>> {
    return this.http.patch('/template-builder/theme', req(options, { body: toApi(payload, {}) }));
  }

  /** `POST /template-builder/render`: the HTML and text a send would use (tags kept) plus deliverability issues. Saves nothing. */
  render(payload: RenderDocumentOptions, options?: RequestOptions): Promise<Response<BuilderRender>> {
    return this.http.post('/template-builder/render', req(options, { body: toApi(payload, {}) }));
  }

  /** `POST /template-builder/convert`: simple HTML to a document, only when nothing would be lost. */
  convert(payload: ConvertHtmlOptions, options?: RequestOptions): Promise<Response<BuilderConversion>> {
    return this.http.post('/template-builder/convert', req(options, { body: { html: payload.html } }));
  }
}
