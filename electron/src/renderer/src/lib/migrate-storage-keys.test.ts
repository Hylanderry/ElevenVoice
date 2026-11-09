import { describe, expect, it } from 'vitest';
import { migrateStorageKeys } from './migrate-storage-keys';

describe('migrateStorageKeys', () => {
  it('moves legacy keys to the elevenvoice prefix without overwriting newer values', () => {
    localStorage.clear();
    localStorage.setItem('voicestudio.batch.rules.v1', '[1]');
    localStorage.setItem('voicestudio.theme', 'old');
    localStorage.setItem('elevenvoice.theme', 'new');
    expect(migrateStorageKeys(localStorage)).toBe(2);
    expect(localStorage.getItem('elevenvoice.batch.rules.v1')).toBe('[1]');
    expect(localStorage.getItem('elevenvoice.theme')).toBe('new');
    expect(localStorage.getItem('voicestudio.theme')).toBeNull();
  });
});
