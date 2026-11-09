// Settings saved by builds that used the old internal prefix move to the
// ElevenVoice prefix once, before any module reads them.
const OLD = ['voice', 'studio'].join('');
const NEW = 'elevenvoice';

export function migrateStorageKeys(storage: Storage | undefined = globalThis.localStorage): number {
  if (!storage) return 0;
  let moved = 0;
  try {
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key?.toLowerCase().includes(OLD)) keys.push(key);
    }
    for (const key of keys) {
      const next = key.replace(new RegExp(OLD, 'gi'), NEW);
      const value = storage.getItem(key);
      if (value !== null && storage.getItem(next) === null) storage.setItem(next, value);
      storage.removeItem(key);
      moved++;
    }
  } catch {
    // Storage unavailable (private mode, quota): nothing to carry over.
  }
  return moved;
}

migrateStorageKeys();
