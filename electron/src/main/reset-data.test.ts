// @vitest-environment node
import { mkdtemp, mkdir, symlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, parse } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import {
  isValidElevenVoiceRoot,
  directorySize,
  modelsAreShared,
  purgeResetScopes,
  scanResetScopes,
  within,
  type ResetRoots,
} from './reset-data';

const created: string[] = [];
afterEach(async () => {
  const { rm } = await import('node:fs/promises');
  await Promise.allSettled(
    created.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

async function fixture(): Promise<ResetRoots & { root: string }> {
  const root = await mkdtemp(join(tmpdir(), 'ElevenVoice-reset-test-'));
  created.push(root);
  const data = join(root, 'Application Support', 'OmniVoice', 'data');
  const models = join(root, '.cache', 'huggingface');
  const logs = join(root, 'Application Support', 'OmniVoice', 'logs');
  const temp = join(root, 'temp');
  await Promise.all([data, models, logs, temp].map((path) => mkdir(path, { recursive: true })));
  await mkdir(join(data, 'voices'), { recursive: true });
  await mkdir(join(data, 'gallery_cache'), { recursive: true });
  await mkdir(join(models, 'models--fixture'), { recursive: true });
  await mkdir(join(temp, 'omnivoice-job'), { recursive: true });
  await writeFile(join(data, 'prefs.json'), 'prefs');
  await writeFile(join(data, 'voices', 'voice.wav'), 'voice');
  await writeFile(join(data, 'gallery_cache', 'cache.bin'), 'cache');
  await writeFile(join(data, 'keep.txt'), 'keep');
  await writeFile(join(models, 'models--fixture', 'weights.bin'), 'weights');
  await writeFile(join(logs, 'backend.log'), 'log');
  await writeFile(join(temp, 'omnivoice-job', 'part.bin'), 'temp');
  await writeFile(join(temp, 'unrelated.txt'), 'keep');
  return { root, data, models, logs, temp };
}

it('reports real reset scopes and marks a cache outside app data as shared', async () => {
  const roots = await fixture();
  const scopes = await scanResetScopes(roots);
  expect(scopes.slice(0, 2).map((scope) => scope.key)).toEqual(['ui_prefs', 'history']);
  expect(scopes.find((scope) => scope.key === 'content')).toMatchObject({
    exists: true,
    shared: false,
  });
  expect(scopes.find((scope) => scope.key === 'models')).toMatchObject({
    exists: true,
    shared: true,
  });
  expect(scopes.find((scope) => scope.key === 'models')!.size_bytes).toBeGreaterThan(0);
});

it('removes only selected ElevenVoice targets and preserves unrelated siblings', async () => {
  const roots = await fixture();
  const report = await purgeResetScopes(
    roots,
    ['settings', 'content', 'models', 'caches', 'logs', 'unknown'],
    join(roots.root, 'home'),
  );
  expect(report.failed).toEqual([]);
  expect(report.refused).toEqual([]);
  expect(report.freed_bytes).toBeGreaterThan(0);
  expect(existsSync(join(roots.data, 'prefs.json'))).toBe(false);
  expect(existsSync(join(roots.data, 'voices'))).toBe(false);
  expect(existsSync(roots.models)).toBe(false);
  expect(existsSync(roots.logs!)).toBe(false);
  expect(existsSync(join(roots.temp, 'omnivoice-job'))).toBe(false);
  expect(existsSync(join(roots.data, 'keep.txt'))).toBe(true);
  expect(existsSync(join(roots.temp, 'unrelated.txt'))).toBe(true);
});

it('refuses filesystem roots, home directories and unsigned custom roots', async () => {
  const root = await mkdtemp(join(tmpdir(), 'unsigned-reset-test-'));
  created.push(root);
  expect(await isValidElevenVoiceRoot(parse(root).root, null)).toBe(false);
  expect(await isValidElevenVoiceRoot(root, root)).toBe(false);
  expect(await isValidElevenVoiceRoot(root, null)).toBe(false);
});

it('does not infer ownership from a lookalike ancestor or a model-cache signature', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ElevenVoice-lookalike-'));
  created.push(root);
  const personal = join(root, 'Application Support', 'ElevenVoice', 'personal', 'documents');
  const cache = join(root, 'external-cache');
  await mkdir(join(cache, 'models--someone--model'), { recursive: true });
  await mkdir(personal, { recursive: true });
  expect(await isValidElevenVoiceRoot(personal, null)).toBe(false);
  expect(await isValidElevenVoiceRoot(cache, null)).toBe(false);
  expect(await isValidElevenVoiceRoot(cache, null, true)).toBe(true);
});

it('resolves aliases before deciding whether models are shared', async () => {
  const roots = await fixture();
  const externalAlias = join(roots.root, 'external-models-link');
  await symlink(roots.models, externalAlias, process.platform === 'win32' ? 'junction' : 'dir');
  expect(await modelsAreShared(externalAlias, roots.data)).toBe(true);

  const nestedModels = join(roots.data, 'models');
  const nestedAlias = join(roots.root, 'nested-models-link');
  await mkdir(nestedModels);
  await symlink(nestedModels, nestedAlias, process.platform === 'win32' ? 'junction' : 'dir');
  expect(await modelsAreShared(nestedAlias, roots.data)).toBe(false);
});

it('authorizes reset roots per scope and rejects a logs alias to a shared cache', async () => {
  const roots = await fixture();
  const cacheLogs = join(roots.root, 'cache-logs');
  await symlink(roots.models, cacheLogs, process.platform === 'win32' ? 'junction' : 'dir');
  const report = await purgeResetScopes({ ...roots, logs: cacheLogs }, ['logs'], null);
  expect(report.refused).toContain(cacheLogs);
  expect(existsSync(join(roots.models, 'models--fixture', 'weights.bin'))).toBe(true);
});

it('measures a linked root but never follows links found inside it', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ElevenVoice-size-'));
  created.push(root);
  const data = join(root, 'Application Support', 'OmniVoice', 'data');
  const external = join(root, 'external');
  const alias = join(root, 'data-link');
  await mkdir(data, { recursive: true });
  await mkdir(external);
  await writeFile(join(data, 'owned.bin'), '1234');
  await writeFile(join(external, 'external.bin'), '12345678');
  await symlink(
    external,
    join(data, 'external-link'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  await symlink(data, alias, process.platform === 'win32' ? 'junction' : 'dir');
  expect(await directorySize(alias)).toBe(4);
});

it('treats dot-prefixed names as children rather than parent traversal', () => {
  const root = join(parse(process.cwd()).root, 'tmp', 'ElevenVoice');
  expect(within(join(root, '..cache'), root)).toBe(true);
  expect(within(join(root, '..', 'cache'), root)).toBe(false);
});

it('treats a bare app-named folder as owned only under an app-data parent or with a signature', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ElevenVoice-parent-test-'));
  created.push(root);
  const personal = join(root, 'Documents', 'ElevenVoice');
  const installed = join(root, '.config', 'ElevenVoice');
  const strayShare = join(root, 'share', 'OmniVoice');
  const localShare = join(root, '.local', 'share', 'OmniVoice');
  for (const path of [personal, installed, strayShare, localShare])
    await mkdir(path, { recursive: true });
  const home = join(root, 'home');
  expect(await isValidElevenVoiceRoot(personal, home)).toBe(false);
  expect(await isValidElevenVoiceRoot(strayShare, home)).toBe(false);
  expect(await isValidElevenVoiceRoot(installed, home)).toBe(true);
  expect(await isValidElevenVoiceRoot(localShare, home)).toBe(true);
  // Directly under the home folder, as ~/.elevenvoice is.
  expect(await isValidElevenVoiceRoot(personal, join(root, 'Documents'))).toBe(true);
  await writeFile(join(personal, 'elevenvoice.db'), 'db');
  expect(await isValidElevenVoiceRoot(personal, home)).toBe(true);
});
