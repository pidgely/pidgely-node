import { afterEach, describe, expect, it, vi } from 'vitest';
import { setReactRenderer } from '../src';
import { client, lastCall } from './helpers';

afterEach(() => setReactRenderer(undefined));

describe('react rendering', () => {
  it('renders `react` to html for emails, batch, broadcasts and templates', async () => {
    const render = vi.fn(async (node: unknown) => `<p>${String((node as { text: string }).text)}</p>`);
    setReactRenderer(render);
    const { pidgely, calls } = client([{ body: { id: 'x' } }]);

    await pidgely.emails.send({ from: 'a@acme.com', to: 'b@x.com', subject: 's', react: { text: 'one' } });
    expect(lastCall(calls).body).toEqual({ from: 'a@acme.com', to: 'b@x.com', subject: 's', html: '<p>one</p>' });

    await pidgely.batch.send([{ from: 'a@acme.com', to: 'b@x.com', subject: 's', react: { text: 'two' } }]);
    expect((lastCall(calls).body as { html: string }[])[0]?.html).toBe('<p>two</p>');

    await pidgely.broadcasts.create({ segmentId: 's', from: 'a@acme.com', subject: 's', react: { text: 'three' } });
    expect((lastCall(calls).body as { html: string }).html).toBe('<p>three</p>');

    await pidgely.broadcasts.update('bc', { react: { text: 'four' } });
    expect(lastCall(calls).body).toEqual({ html: '<p>four</p>' });

    await pidgely.templates.create({ name: 't', react: { text: 'five' } });
    expect(lastCall(calls).body).toEqual({ name: 't', html: '<p>five</p>' });

    await pidgely.templates.update('t', { react: { text: 'six' } });
    expect(lastCall(calls).body).toEqual({ html: '<p>six</p>' });
    expect(render).toHaveBeenCalledTimes(6);
  });

  it('supports a synchronous renderer', async () => {
    setReactRenderer(() => '<i>sync</i>');
    const { pidgely, calls } = client([{ body: { id: 'x' } }]);
    await pidgely.emails.send({ from: 'a@acme.com', to: 'b@x.com', subject: 's', react: {} });
    expect((lastCall(calls).body as { html: string }).html).toBe('<i>sync</i>');
  });

  it('returns an application_error when @react-email/render is not installed', async () => {
    const { pidgely, fetch } = client();
    const res = await pidgely.emails.send({ from: 'a@acme.com', to: 'b@x.com', subject: 's', react: {} });
    expect(res.data).toBeNull();
    expect(res.error?.name).toBe('application_error');
    expect(res.error?.message).toMatch(/@react-email\/render/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reports a module without a render export', async () => {
    vi.doMock('@react-email/render', () => ({ render: undefined, default: undefined }));
    try {
      const { pidgely } = client();
      const res = await pidgely.emails.send({ from: 'a@acme.com', to: 'b@x.com', subject: 's', react: {} });
      expect(res.error?.message).toMatch(/@react-email\/render/);
    } finally {
      vi.doUnmock('@react-email/render');
    }
  });

  it('loads @react-email/render dynamically when installed', async () => {
    vi.doMock('@react-email/render', () => ({ render: async () => '<p>from module</p>' }));
    try {
      const { pidgely, calls } = client([{ body: { id: 'x' } }]);
      await pidgely.emails.send({ from: 'a@acme.com', to: 'b@x.com', subject: 's', react: {} });
      expect((lastCall(calls).body as { html: string }).html).toBe('<p>from module</p>');
    } finally {
      vi.doUnmock('@react-email/render');
    }
  });

  it('accepts a default-exported render', async () => {
    // (vitest throws on access to undeclared exports of a mock, hence `render: undefined`)
    vi.doMock('@react-email/render', () => ({ render: undefined, default: { render: () => '<p>default</p>' } }));
    try {
      const { pidgely, calls } = client([{ body: { id: 'x' } }]);
      await pidgely.emails.send({ from: 'a@acme.com', to: 'b@x.com', subject: 's', react: {} });
      expect((lastCall(calls).body as { html: string }).html).toBe('<p>default</p>');
    } finally {
      vi.doUnmock('@react-email/render');
    }
  });
});
