import { afterEach, expect, it, vi } from 'vitest';
import { onStorageKey } from '@/lib/storage-events';
import { installSyncedStorage } from './synced-storage';

const KEYS = ['elevenvoice.theme.v2', 'elevenvoice.clone.settings.v1', 'elevenvoice.locale'];
const RAW = ['elevenvoice.locale'];
let uninstall: (() => void) | undefined;
afterEach(() => {
  uninstall?.();
  uninstall = undefined;
  localStorage.clear();
});

function install() {
  const post = vi.fn(async (_key: string, _value: unknown) => {});
  const synced = installSyncedStorage({ storage: localStorage, keys: KEYS, rawKeys: RAW, post });
  uninstall = synced.uninstall;
  return { post, synced };
}

it('posts each change to a synced key once, in the format the allowlist declares', () => {
  const { post } = install();
  localStorage.setItem('elevenvoice.clone.settings.v1', JSON.stringify({ steps: 16 }));
  localStorage.setItem('elevenvoice.locale', 'true'); // a raw key stays a string even if it parses
  localStorage.removeItem('elevenvoice.theme.v2');
  expect(post.mock.calls).toEqual([
    ['elevenvoice.clone.settings.v1', { steps: 16 }],
    ['elevenvoice.locale', 'true'],
    ['elevenvoice.theme.v2', null],
  ]);
});

it('never posts a JSON key whose stored text cannot be parsed', () => {
  const { post } = install();
  localStorage.setItem('elevenvoice.theme.v2', 'not json');
  expect(post).not.toHaveBeenCalled();
});

it('ignores keys that never sync and still stores them', () => {
  const { post } = install();
  localStorage.setItem('elevenvoice.workspace-layout', 'x');
  expect(post).not.toHaveBeenCalled();
  expect(localStorage.getItem('elevenvoice.workspace-layout')).toBe('x');
});

it('applies a pulled value without echoing it and tells the app it changed', () => {
  const { post, synced } = install();
  const seen: (string | null)[] = [];
  const stops = KEYS.map((key) => onStorageKey(key, () => seen.push(key)));
  synced.apply('elevenvoice.locale', 'de');
  synced.apply('elevenvoice.clone.settings.v1', { steps: 24 });
  synced.apply('elevenvoice.theme.v2', null);
  stops.forEach((stop) => stop());
  expect(post).not.toHaveBeenCalled();
  expect(localStorage.getItem('elevenvoice.locale')).toBe('de');
  expect(localStorage.getItem('elevenvoice.clone.settings.v1')).toBe('{"steps":24}');
  expect(localStorage.getItem('elevenvoice.theme.v2')).toBeNull();
  expect(seen).toEqual([
    'elevenvoice.locale',
    'elevenvoice.clone.settings.v1',
    'elevenvoice.theme.v2',
  ]);
});

it('reads the current values of every synced key for the first mirror', () => {
  localStorage.setItem('elevenvoice.locale', 'de');
  localStorage.setItem('elevenvoice.theme.v2', '{"mode":"dark"}');
  const { synced } = install();
  expect(synced.snapshot()).toEqual([
    ['elevenvoice.theme.v2', { mode: 'dark' }],
    ['elevenvoice.locale', 'de'],
  ]);
});

it('uninstall restores the original storage methods', () => {
  const original = Storage.prototype.setItem;
  const { post } = install();
  uninstall!();
  uninstall = undefined;
  expect(Storage.prototype.setItem).toBe(original);
  localStorage.setItem('elevenvoice.locale', 'de');
  expect(post).not.toHaveBeenCalled();
});

it('a failing post never breaks the write', () => {
  const post = vi.fn(async () => {
    throw new Error('backend down');
  });
  const synced = installSyncedStorage({ storage: localStorage, keys: KEYS, rawKeys: RAW, post });
  uninstall = synced.uninstall;
  expect(() => localStorage.setItem('elevenvoice.locale', 'de')).not.toThrow();
  expect(localStorage.getItem('elevenvoice.locale')).toBe('de');
});

it('a pulled value for a partly-synced key merges in and keeps device-local fields (the draft)', () => {
  const post = vi.fn(async () => {});
  const synced = installSyncedStorage({
    storage: localStorage,
    keys: KEYS,
    rawKeys: RAW,
    partialKeys: ['elevenvoice.clone.settings.v1'],
    post,
  });
  uninstall = synced.uninstall;
  localStorage.setItem(
    'elevenvoice.clone.settings.v1',
    JSON.stringify({ steps: 16, text: 'my draft', refText: 'ref', selectedProfileId: 'ab12cd34' }),
  );
  synced.apply('elevenvoice.clone.settings.v1', { steps: 24, speed: 1.1 });
  expect(JSON.parse(localStorage.getItem('elevenvoice.clone.settings.v1')!)).toEqual({
    steps: 24,
    speed: 1.1,
    text: 'my draft',
    refText: 'ref',
    selectedProfileId: 'ab12cd34',
  });
});
