import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { BatchJob } from '@shared/api/batch-types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
import {
  BATCH_RULES_KEY,
  BatchRules,
  readBatchRules,
  upsertBatchRule,
  type BatchRule,
} from './batch-rules';
import { batchReportCsv, batchReportName, csvCell, summarizeBatch } from './batch-report';

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function job(id: string, extra: Partial<BatchJob> = {}): BatchJob {
  return {
    id,
    status: 'done',
    filename: `${id}.mp4`,
    langs: ['es'],
    preserve_bg: true,
    created_at: 1000,
    started_at: 1000,
    finished_at: 1060,
    ...extra,
  };
}

// ── rules ────────────────────────────────────────────────────────────────────

it('replaces a rule saved again under the same name instead of duplicating it', () => {
  const first = upsertBatchRule([], {
    name: 'Clients',
    langs: ['Spanish'],
    voice: '',
    preserve: true,
  });
  const second = upsertBatchRule(first, {
    name: ' clients ',
    langs: ['French'],
    voice: 'v1',
    preserve: false,
  });
  expect(second).toHaveLength(1);
  expect(second[0]).toMatchObject({ id: first[0].id, langs: ['French'], voice: 'v1' });
});

it('ignores unreadable or malformed saved rules', () => {
  localStorage.setItem(BATCH_RULES_KEY, '{not json');
  expect(readBatchRules()).toEqual([]);
  const good: BatchRule = { id: 'a', name: 'A', langs: ['Spanish'], voice: '', preserve: true };
  localStorage.setItem(BATCH_RULES_KEY, JSON.stringify([good, { id: 'b', name: 3 }]));
  expect(readBatchRules()).toEqual([good]);
});

it('saves the current setup as a rule and applies a saved one', () => {
  const onApply = vi.fn();
  render(
    <BatchRules langs={['Spanish', 'German']} voice="v1" preserve={false} onApply={onApply} />,
  );
  expect(screen.getByText('batch.rules_empty')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /batch.rules_save_current/ }));
  fireEvent.change(screen.getByLabelText('batch.rules_name'), { target: { value: 'Weekly' } });
  fireEvent.click(screen.getByRole('button', { name: 'batch.rules_save' }));

  const stored = readBatchRules();
  expect(stored).toEqual([
    expect.objectContaining({
      name: 'Weekly',
      langs: ['Spanish', 'German'],
      voice: 'v1',
      preserve: false,
    }),
  ]);
  expect(screen.queryByText('batch.rules_empty')).toBeNull();
});

it('cannot save a rule without target languages', () => {
  render(<BatchRules langs={[]} voice="" preserve onApply={vi.fn()} />);
  expect(screen.getByRole('button', { name: /batch.rules_save_current/ })).toBeDisabled();
});

// ── report ───────────────────────────────────────────────────────────────────

it('summarizes finished, failed and waiting jobs with processing time', () => {
  expect(
    summarizeBatch([
      job('a'),
      job('b', { status: 'failed', started_at: 2000, finished_at: 2030 }),
      job('c', { status: 'cancelled', started_at: undefined, finished_at: undefined }),
      job('d', { status: 'queued', started_at: undefined, finished_at: undefined }),
      job('e', { status: 'running', finished_at: undefined }),
    ]),
  ).toEqual({ total: 5, done: 1, failed: 2, pending: 2, processingSeconds: 90 });
});

it('writes one CSV row per job, oldest first, quoting and defusing cells', () => {
  const csv = batchReportCsv([
    job('newer', { created_at: 2000 }),
    job('older', {
      created_at: 1000,
      status: 'failed',
      langs: ['es', 'fr'],
      error: 'Bad "input", retry',
      filename: '=cmd.mp4',
    }),
  ]);
  const lines = csv.trimEnd().split('\r\n');
  expect(lines[0]).toBe(
    'file,status,languages,queued_at,started_at,finished_at,processing_seconds,attempts,error',
  );
  expect(lines[1].startsWith("'=cmd.mp4,failed,es fr,")).toBe(true);
  expect(lines[1].endsWith(',60,1,"Bad ""input"", retry"')).toBe(true);
  expect(lines[2].startsWith('newer.mp4,done,es,')).toBe(true);
});

it('quotes only when needed and names the file by date', () => {
  expect(csvCell('plain')).toBe('plain');
  expect(csvCell('a,b')).toBe('"a,b"');
  expect(csvCell('-1')).toBe("'-1");
  expect(batchReportName(new Date('2026-11-06T15:30:00Z'))).toBe(
    'elevenvoice-batch-report-2026-11-06-15-30.csv',
  );
});
