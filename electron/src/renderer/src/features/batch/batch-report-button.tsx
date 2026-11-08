import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { FileSpreadsheetIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiJson, describeError } from '@/lib/api/client';
import { saveNativeData } from '@/lib/native-save';
import type { BatchJob } from '@shared/api/batch-types';
import { batchReportCsv, batchReportName, summarizeBatch } from './batch-report';

const REPORT_LIMIT = 500;

/** Browser fallback when there is no native save dialog (web mode). */
function downloadInBrowser(data: string, name: string) {
  const url = URL.createObjectURL(new Blob([data], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Summary of every batch job in this session, and a CSV report of them. */
export function BatchReport() {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const jobs = useQuery({
    queryKey: ['batch-jobs', 'report'],
    queryFn: ({ signal }) => apiJson<BatchJob[]>(`/batch/jobs?limit=${REPORT_LIMIT}`, { signal }),
    refetchInterval: 5000,
  });
  const all = jobs.data ?? [];
  if (!all.length) return null;
  const summary = summarizeBatch(all);
  const minutes = Math.round(summary.processingSeconds / 60);
  const exportReport = async () => {
    setSaving(true);
    try {
      const csv = batchReportCsv(all);
      const name = batchReportName();
      // BOM so spreadsheet apps read accented file names correctly.
      const saved = await saveNativeData({
        data: new TextEncoder().encode('﻿' + csv),
        suggestedName: name,
      });
      if (saved === null) downloadInBrowser('﻿' + csv, name);
    } catch (error) {
      toast.error(t('batch.report_failed', { message: describeError(error) }));
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <span>
        {t('batch.report_summary', {
          done: summary.done,
          failed: summary.failed,
          pending: summary.pending,
          minutes,
        })}
      </span>
      <Button variant="ghost" size="sm" disabled={saving} onClick={() => void exportReport()}>
        <FileSpreadsheetIcon />
        {t('batch.report_export')}
      </Button>
    </div>
  );
}
