import type { HttpClient } from '../http';
import { toApi } from '../transform';
import type { BrandImport, ImportBrandOptions, RequestOptions, Response } from '../types';
import { req } from './shared';

/** Brand import (Pidgely extension, Scale plan). */
export class Brand {
  constructor(private readonly http: HttpClient) {}

  /**
   * `POST /brand/import`: reads a website and proposes a builder theme and brand profile (logo, colors with
   * WCAG-checked buttons, fonts, social links, address). Nothing is saved unless `apply` is true.
   */
  import(payload: ImportBrandOptions = {}, options?: RequestOptions): Promise<Response<BrandImport>> {
    return this.http.post('/brand/import', req(options, { body: toApi(payload, {}) }));
  }
}
