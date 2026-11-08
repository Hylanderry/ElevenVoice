type CheckStatus = 'pass' | 'warn' | 'fail';

interface PreflightCheck {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  fix: string | null;
  /** `installed_*` checks: whether the item is already on this computer. */
  found?: boolean;
  /** `installed_ffmpeg`: where the binary comes from. */
  origin?: 'system' | 'bundled' | 'custom' | 'sidecar' | null;
  version?: string | null;
  path?: string | null;
  /** `installed_models`: models already in the download cache. */
  items?: Array<{ repo_id: string; label: string }>;
}

interface PreflightDevice {
  os: string;
  arch: string;
  gpu_vendor: 'nvidia' | 'amd' | 'apple' | 'intel' | 'unknown' | 'none';
  gpu_backend: 'cuda' | 'rocm' | 'mps' | 'cpu';
  gpu_available: boolean;
  gpu_driver: string | null;
  gpu_device_name: string | null;
  ram_gb: number;
  disk_free_gb: number;
}

export interface PreflightReport {
  ok: boolean;
  has_warnings: boolean;
  checks: PreflightCheck[];
  device: PreflightDevice;
}
