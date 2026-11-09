/** The preload contract, reached through the global augmentation in src/preload/index.d.ts. */
export type ElevenVoiceBridge = Window['elevenvoice'];

/** The preload bridge, or null outside Electron (vitest, a plain browser tab). */
export function getBridge(): ElevenVoiceBridge | null {
  if (typeof window === 'undefined') return null;
  return 'elevenvoice' in window && window.elevenvoice ? window.elevenvoice : null;
}

export function appVersion(): string {
  return getBridge()?.app.version ?? __APP_VERSION__;
}

export function isMac(): boolean {
  return getBridge()?.app.platform === 'darwin';
}

export type PlatformFamily = 'mac' | 'windows' | 'linux';

/** Which OS design language native-feeling UI should follow; browser tabs fall back to the user agent. */
export function platformFamily(): PlatformFamily {
  const platform =
    getBridge()?.app.platform ?? (typeof navigator === 'undefined' ? '' : navigator.platform || navigator.userAgent);
  if (platform === 'darwin' || /mac|iphone|ipad/i.test(platform)) return 'mac';
  if (platform === 'win32' || /win/i.test(platform)) return 'windows';
  return 'linux';
}
