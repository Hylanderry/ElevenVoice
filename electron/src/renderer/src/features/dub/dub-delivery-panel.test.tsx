import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ api: vi.fn(), save: vi.fn() }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params && 'count' in params ? `${key}:${String(params.count)}` : key,
  }),
}));
vi.mock('@/lib/api/client', () => ({
  apiJson: mock.api,
  apiPath: (path: string) => `http://api${path}`,
  describeError: (error: unknown) => String(error),
  errorFromResponse: vi.fn(),
}));
vi.mock('@/components/bridge', () => ({ getBridge: () => ({}) }));
vi.mock('@/lib/export-history', () => ({ saveExport: mock.save }));
import { DubDeliveryPanel, deliveryItemKey, deliveryPackageName } from './dub-delivery-panel';
import type { DubSession } from './dub-session';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function mount(session: Partial<DubSession>) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <DubDeliveryPanel
        session={{ jobId: 'job1', filename: 'intro.mp4', tracks: ['es'], ...session } as DubSession}
        disabled={false}
      />
    </QueryClientProvider>,
  );
}

it('names each item by its outcome and the package by the source file', () => {
  expect(deliveryItemKey({ id: 'clipping', status: 'pass', lang: 'es' })).toBe(
    'dubDelivery.clipping_ok',
  );
  expect(deliveryItemKey({ id: 'clipping', status: 'warn', lang: 'es' })).toBe(
    'dubDelivery.clipping_issue',
  );
  expect(deliveryPackageName('my talk.final.mp4')).toBe('my talk.final_delivery.zip');
  expect(deliveryPackageName('')).toBe('project_delivery.zip');
});

it('checks the project only when asked and lists every item', async () => {
  mock.api.mockResolvedValue({
    job_id: 'job1',
    filename: 'intro.mp4',
    status: 'warn',
    languages: ['es'],
    items: [
      { id: 'transcript', status: 'pass', lang: null, count: 12 },
      { id: 'untranslated', status: 'warn', lang: 'es', count: 2, total: 12 },
    ],
  });
  mount({});
  expect(mock.api).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: /dubDelivery.check/ }));
  expect(await screen.findByText('dubDelivery.overall_warn')).toBeInTheDocument();
  expect(mock.api).toHaveBeenCalledWith('/dub/delivery/check/job1', expect.anything());
  expect(screen.getByText('dubDelivery.transcript_ok:12')).toBeInTheDocument();
  expect(screen.getByText('dubDelivery.untranslated_issue:2')).toBeInTheDocument();
  expect(screen.getByText('ES')).toBeInTheDocument();
});

it('saves the package through the native save dialog', async () => {
  mount({});
  fireEvent.click(screen.getByRole('button', { name: /dubDelivery.package/ }));
  await vi.waitFor(() =>
    expect(mock.save).toHaveBeenCalledWith(
      'http://api/dub/delivery/package/job1',
      'intro_delivery.zip',
    ),
  );
});

it('explains why there is no package before any language is dubbed', () => {
  mount({ tracks: [] });
  expect(screen.getByRole('button', { name: /dubDelivery.package/ })).toBeDisabled();
  expect(screen.getByText('dubDelivery.package_unavailable')).toBeInTheDocument();
});
