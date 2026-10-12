import type { ReactNodeLike } from './types';

type RenderFn = (node: ReactNodeLike, options?: Record<string, unknown>) => string | Promise<string>;

let renderer: Promise<RenderFn> | undefined;

/** Overrides the renderer (tests, or environments that bundle their own). */
export function setReactRenderer(fn: RenderFn | undefined): void {
  renderer = fn ? Promise.resolve(fn) : undefined;
}

async function loadRenderer(): Promise<RenderFn> {
  try {
    // Optional peer dependency, resolved at runtime only when `react` is used.
    const specifier = '@react-email/render';
    const mod = (await import(/* webpackIgnore: true */ /* @vite-ignore */ specifier)) as { render?: RenderFn; default?: { render?: RenderFn } };
    const render = mod.render ?? mod.default?.render;
    if (!render) throw new Error('missing export');
    return render;
  } catch {
    renderer = undefined;
    throw new Error(
      'Failed to render React component. Make sure to install `@react-email/render` (npm install @react-email/render).',
    );
  }
}

/** Renders a React element to an HTML string with `@react-email/render`. */
export async function renderReact(node: ReactNodeLike): Promise<string> {
  renderer ??= loadRenderer();
  const render = await renderer;
  return await render(node);
}
