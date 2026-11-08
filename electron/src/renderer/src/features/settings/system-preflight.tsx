import { useQuery } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import {
  CheckCircleIcon,
  TriangleAlertIcon,
  CircleXIcon,
  ScanSearchIcon,
  PackageCheckIcon,
  CircleDashedIcon,
} from 'lucide-react';
import type { PreflightReport } from '@shared/api/setup-types';
import { apiJson } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { SettingsRow, SettingsSection } from './settings-layout';

type Check = PreflightReport['checks'][number];

/** Checks whose title comes from the catalog; the backend's English label is the fallback. */
const LABEL_KEYS: Record<string, string> = {
  os: 'setup.check_os',
  python: 'setup.check_python',
  ram: 'setup.check_ram',
  disk: 'setup.check_disk',
  hf_cache_writable: 'setup.check_hf_cache',
  gpu: 'setup.check_gpu',
  gpu_routing: 'setup.check_gpu_routing',
  network: 'setup.check_network',
  installed_ffmpeg: 'setup.check_installed_ffmpeg',
  installed_models: 'setup.check_installed_models',
};

export function localizePreflightCheck(check: Check, t: TFunction) {
  if (check.id === 'arch')
    return {
      label: t('setup.check_arch_label'),
      detail: t('setup.check_arch_detail'),
      fix: t('setup.check_arch_fix'),
    };
  const label = LABEL_KEYS[check.id] ? t(LABEL_KEYS[check.id]) : check.label;
  if (check.id === 'installed_ffmpeg') {
    const detail = check.found
      ? t('setup.installed_ffmpeg_found', {
          origin: t(`setup.installed_origin_${check.origin ?? 'system'}`),
          // Builds append vendor tags ("7.1-essentials_build-www.gyan.dev"); keep the number.
          version: check.version?.match(/^\d+(?:\.\d+)*/)?.[0] ?? '',
        }).trim()
      : t('setup.installed_ffmpeg_missing');
    return { label, detail, fix: null };
  }
  if (check.id === 'installed_models') {
    const items = check.items ?? [];
    const detail = items.length
      ? t('setup.installed_models_found', {
          total: items.length,
          names: items.map((item) => item.label).join(', '),
        })
      : t('setup.installed_models_none');
    return { label, detail, fix: null };
  }
  return { label, detail: check.detail, fix: check.fix };
}

function CheckRow({ check, t }: { check: Check; t: TFunction }) {
  const installed = check.id.startsWith('installed_');
  const Icon = installed
    ? check.found
      ? PackageCheckIcon
      : CircleDashedIcon
    : check.status === 'pass'
      ? CheckCircleIcon
      : check.status === 'warn'
        ? TriangleAlertIcon
        : CircleXIcon;
  const tone = installed
    ? check.found
      ? 'text-success'
      : 'text-muted-foreground'
    : check.status === 'pass'
      ? 'text-success'
      : check.status === 'warn'
        ? 'text-warning'
        : 'text-destructive';
  const text = localizePreflightCheck(check, t);
  return (
    <li className="flex items-start gap-3 py-3">
      <Icon aria-hidden="true" className={`mt-0.5 size-4 shrink-0 ${tone}`} />
      <div className="min-w-0 space-y-1">
        <h3 className="text-sm font-medium">{text.label}</h3>
        <p className="break-words text-xs leading-5 text-muted-foreground">{text.detail}</p>
        {text.fix && <p className="break-words text-xs leading-5">{text.fix}</p>}
      </div>
    </li>
  );
}

export function SystemPreflight() {
  const { t } = useTranslation();
  const query = useQuery({
    queryKey: ['setup-preflight'],
    queryFn: ({ signal }) => apiJson<PreflightReport>('/setup/preflight', { signal }),
    enabled: false,
    retry: false,
  });
  const checks = Array.isArray(query.data?.checks) ? query.data.checks : [];
  const installed = checks.filter((check) => check.id.startsWith('installed_'));
  const requirements = checks.filter((check) => !check.id.startsWith('installed_'));
  return (
    <SettingsSection title={t('setup.system_preflight')} icon={ScanSearchIcon}>
      <SettingsRow
        id="system-preflight-check"
        title={t('setup.system_check')}
        description={t('setup.system_check_desc')}
      >
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          {t(
            query.isFetching
              ? 'setup.probing'
              : query.data
                ? 'setup.recheck'
                : 'setup.system_check',
          )}
        </Button>
      </SettingsRow>
      {query.isError && (
        <p role="alert" className="px-4 py-3 text-sm text-destructive">
          {t('backend.retry')}
        </p>
      )}
      {installed.length > 0 && (
        <section aria-labelledby="preflight-installed" className="px-4 pt-2">
          <h3 id="preflight-installed" className="text-xs font-medium text-muted-foreground">
            {t('setup.installed_heading')}
          </h3>
          <ul className="divide-y divide-border/50">
            {installed.map((check) => (
              <CheckRow key={check.id} check={check} t={t} />
            ))}
          </ul>
        </section>
      )}
      {requirements.length > 0 && (
        <section
          aria-labelledby={installed.length > 0 ? 'preflight-requirements' : undefined}
          className="px-4 pt-2"
        >
          {installed.length > 0 && (
            <h3 id="preflight-requirements" className="text-xs font-medium text-muted-foreground">
              {t('setup.requirements_heading')}
            </h3>
          )}
          <ul className="divide-y divide-border/50">
            {requirements.map((check) => (
              <CheckRow key={check.id} check={check} t={t} />
            ))}
          </ul>
        </section>
      )}
    </SettingsSection>
  );
}
