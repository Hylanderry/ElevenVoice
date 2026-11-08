import type { BatchJob } from '@shared/api/batch-types';

export interface BatchReportSummary {
  total: number;
  done: number;
  failed: number;
  pending: number;
  /** Seconds of processing across finished jobs. */
  processingSeconds: number;
}

export function summarizeBatch(jobs: BatchJob[]): BatchReportSummary {
  let done = 0;
  let failed = 0;
  let pending = 0;
  let processingSeconds = 0;
  for (const job of jobs) {
    if (job.status === 'done') done += 1;
    else if (job.status === 'failed' || job.status === 'cancelled') failed += 1;
    else pending += 1;
    if (job.started_at && job.finished_at && job.finished_at >= job.started_at)
      processingSeconds += job.finished_at - job.started_at;
  }
  return { total: jobs.length, done, failed, pending, processingSeconds };
}

const COLUMNS = [
  'file',
  'status',
  'languages',
  'queued_at',
  'started_at',
  'finished_at',
  'processing_seconds',
  'attempts',
  'error',
] as const;

function iso(seconds?: number) {
  return seconds ? new Date(seconds * 1000).toISOString() : '';
}

/** RFC 4180 cell: quoted when it holds a comma, quote or line break. Formula-leading cells are defused for spreadsheets. */
export function csvCell(value: string | number): string {
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** One row per job, oldest first, so the file reads in the order the work was queued. */
export function batchReportCsv(jobs: BatchJob[]): string {
  const rows = [...jobs]
    .sort((a, b) => a.created_at - b.created_at)
    .map((job) => {
      const seconds =
        job.started_at && job.finished_at ? Math.round(job.finished_at - job.started_at) : '';
      return [
        job.filename,
        job.status,
        job.langs.join(' '),
        iso(job.created_at),
        iso(job.started_at),
        iso(job.finished_at),
        seconds,
        job.attempts ?? 1,
        job.error ?? '',
      ]
        .map(csvCell)
        .join(',');
    });
  return [COLUMNS.join(','), ...rows].join('\r\n') + '\r\n';
}

export function batchReportName(now = new Date()): string {
  const stamp = now.toISOString().slice(0, 16).replace(/[:T]/g, '-');
  return `elevenvoice-batch-report-${stamp}.csv`;
}
