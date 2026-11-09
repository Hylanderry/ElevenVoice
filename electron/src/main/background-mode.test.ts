import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BACKGROUND_ARG,
  hasConsent,
  launchedInBackground,
  loginItemSettings,
  readBackgroundPrefs,
  recordConsent,
  writeBackgroundPrefs,
} from './background-mode';

const dir = () => mkdtempSync(join(tmpdir(), 'ev-bg-'));

describe('background mode', () => {
  it('runs in the background by default and does not start with the system', () => {
    expect(readBackgroundPrefs(dir())).toEqual({ runInBackground: true, openAtLogin: false });
  });

  it('remembers the user choices', () => {
    const d = dir();
    writeBackgroundPrefs(d, { runInBackground: false, openAtLogin: true });
    expect(readBackgroundPrefs(d)).toEqual({ runInBackground: false, openAtLogin: true });
  });

  it('starts hidden when launched with the system', () => {
    expect(launchedInBackground(['app.exe', BACKGROUND_ARG])).toBe(true);
    expect(launchedInBackground(['app.exe'])).toBe(false);
    expect(loginItemSettings(true, 'C:/app.exe')).toMatchObject({ openAtLogin: true, args: [BACKGROUND_ARG] });
  });

  it('records the first-launch agreement once', () => {
    const d = dir();
    expect(hasConsent(d)).toBe(false);
    recordConsent(d, '1.0.0');
    expect(hasConsent(d)).toBe(true);
  });
});
