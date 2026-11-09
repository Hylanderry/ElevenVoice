// Background mode: closing the window keeps ElevenVoice (and its voice engine)
// running in the tray, the app can start with the system, and the first launch
// records the user's agreement to the terms and to every model licence.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const BACKGROUND_ARG = '--background';
export const TERMS_URL = 'https://elevenvoice.sbs/terms';

export interface BackgroundPrefs {
  /** Closing the window hides it to the tray; the engine keeps running. */
  runInBackground: boolean;
  /** Start with the system, hidden in the tray. */
  openAtLogin: boolean;
}

const DEFAULTS: BackgroundPrefs = { runInBackground: true, openAtLogin: false };

function readJson<T>(path: string): Partial<T> | null {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Partial<T>;
  } catch {
    return null;
  }
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2));
}

export function prefsPath(userData: string): string {
  return join(userData, 'background.json');
}

export function readBackgroundPrefs(userData: string): BackgroundPrefs {
  const saved = readJson<BackgroundPrefs>(prefsPath(userData)) ?? {};
  return {
    runInBackground:
      typeof saved.runInBackground === 'boolean' ? saved.runInBackground : DEFAULTS.runInBackground,
    openAtLogin: typeof saved.openAtLogin === 'boolean' ? saved.openAtLogin : DEFAULTS.openAtLogin,
  };
}

export function writeBackgroundPrefs(userData: string, prefs: BackgroundPrefs): void {
  writeJson(prefsPath(userData), prefs);
}

export function launchedInBackground(argv: readonly string[]): boolean {
  return argv.includes(BACKGROUND_ARG);
}

/** Login-item settings for the current platform (Windows/macOS). */
export function loginItemSettings(openAtLogin: boolean, execPath: string) {
  return { openAtLogin, openAsHidden: true, path: execPath, args: [BACKGROUND_ARG] };
}

export function consentPath(userData: string): string {
  return join(userData, 'consent.json');
}

export function hasConsent(userData: string): boolean {
  return existsSync(consentPath(userData));
}

export function recordConsent(userData: string, version: string, now = new Date()): void {
  writeJson(consentPath(userData), {
    terms: TERMS_URL,
    modelLicences: 'all',
    version,
    acceptedAt: now.toISOString(),
  });
}
