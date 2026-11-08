import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  CircleXIcon,
  ClipboardCheckIcon,
  LoaderCircleIcon,
  PackageCheckIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getBridge } from '@/components/bridge';
import { PipelineFailure } from '@/components/pipeline-failure';
import { apiJson, apiPath, describeError, errorFromResponse } from '@/lib/api/client';
import { saveExport } from '@/lib/export-history';
import { cn } from '@/lib/utils';
import type { DubSession } from './dub-session';

type CheckStatus = 'pass' | 'warn' | 'fail';

export interface DeliveryItem {
  id: string;
  status: CheckStatus;
  lang: string | null;
  [param: string]: unknown;
}

export interface DeliveryCheck {
  job_id: string;
  filename: string;
  status: CheckStatus;
  languages: string[];
  items: DeliveryItem[];
}

const ICONS = { pass: CheckCircle2Icon, warn: TriangleAlertIcon, fail: CircleXIcon };
const TONES = { pass: 'text-success', warn: 'text-warning', fail: 'text-destructive' };

/** Translation key for an item: `<id>_ok` when it passed, `<id>_issue` otherwise. */
export function deliveryItemKey(item: DeliveryItem): string {
  return `dubDelivery.${item.id}_${item.status === 'pass' ? 'ok' : 'issue'}`;
}

export function deliveryPackageName(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, '') || 'project';
  return `${base}_delivery.zip`;
}

/** Check a dubbing project before it goes to a client, then save it as one package. */
export function DubDeliveryPanel({
  session,
  disabled,
}: {
  session: DubSession;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const jobId = session.jobId;
  const check = useQuery({
    queryKey: ['dub-delivery-check', jobId],
    queryFn: ({ signal }) =>
      apiJson<DeliveryCheck>(`/dub/delivery/check/${encodeURIComponent(jobId!)}`, { signal }),
    enabled: false,
    retry: false,
  });
  const result = check.data?.job_id === jobId ? check.data : undefined;
  const canPackage = !!jobId && session.tracks.length > 0;
  const download = async () => {
    if (!canPackage || saving) return;
    setSaving(true);
    setError(null);
    try {
      const url = apiPath(`/dub/delivery/package/${encodeURIComponent(jobId!)}`);
      const name = deliveryPackageName(result?.filename || session.filename || 'project');
      if (getBridge()) await saveExport(url, name);
      else {
        const response = await fetch(url);
        if (!response.ok) throw await errorFromResponse(response);
        const objectUrl = URL.createObjectURL(await response.blob());
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = name;
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
      }
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setSaving(false);
    }
  };
  return (
    <details className="group rounded-xl border border-border/40 bg-muted/15 p-3">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium">
        <PackageCheckIcon className="size-4 text-muted-foreground" />
        {t('dubDelivery.title')}
        <ChevronDownIcon className="ml-auto size-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-xs leading-5 text-muted-foreground">{t('dubDelivery.description')}</p>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          disabled={!jobId || disabled || check.isFetching}
          onClick={() => void check.refetch()}
        >
          {check.isFetching ? (
            <LoaderCircleIcon className="animate-spin" />
          ) : (
            <ClipboardCheckIcon />
          )}
          {t(check.isFetching ? 'dubDelivery.checking' : 'dubDelivery.check')}
        </Button>
        {check.isError && (
          <PipelineFailure fallback={describeError(check.error)} className="text-xs" />
        )}
        {result && (
          <div className="space-y-2" aria-live="polite">
            <p className={cn('text-sm font-medium', TONES[result.status])}>
              {t(`dubDelivery.overall_${result.status}`)}
            </p>
            <ul className="space-y-1.5">
              {result.items.map((item) => {
                const Icon = ICONS[item.status];
                return (
                  <li
                    key={`${item.id}-${item.lang ?? ''}`}
                    className="flex items-start gap-2 text-xs leading-5"
                  >
                    <Icon
                      aria-hidden="true"
                      className={cn('mt-0.5 size-3.5 shrink-0', TONES[item.status])}
                    />
                    <span className="min-w-0">
                      {item.lang ? (
                        <span className="mr-1.5 font-medium">{item.lang.toUpperCase()}</span>
                      ) : null}
                      {t(deliveryItemKey(item), item)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        <Button
          className="w-full"
          disabled={!canPackage || disabled || saving}
          onClick={() => void download()}
        >
          {saving ? <LoaderCircleIcon className="animate-spin" /> : <PackageCheckIcon />}
          {t(saving ? 'common.loading' : 'dubDelivery.package')}
        </Button>
        {!canPackage && (
          <p className="text-xs text-muted-foreground">{t('dubDelivery.package_unavailable')}</p>
        )}
        {error && (
          <PipelineFailure fallback={error} onDismiss={() => setError(null)} className="text-xs" />
        )}
      </div>
    </details>
  );
}
