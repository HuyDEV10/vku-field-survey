import { openDB } from 'idb';
let database;
export function db() {
  database ??= openDB('vku-field-survey', 1, {
    upgrade(d) {
      d.createObjectStore('drafts', { keyPath: 'id' });
      const q = d.createObjectStore('surveys', { keyPath: 'id' });
      q.createIndex('createdAt', 'createdAt');
      d.createObjectStore('settings');
      d.createObjectStore('locks');
    },
  });
  return database;
}
export async function saveDraft(draft) {
  return (await db()).put('drafts', draft);
}
export async function loadDraft() {
  return (await db()).get('drafts', 'current');
}
export async function surveys() {
  return (await db()).getAllFromIndex('surveys', 'createdAt');
}
export async function setting(key, value) {
  const d = await db();
  return value === undefined ? d.get('settings', key) : d.put('settings', value, key);
}
export async function enqueue(draft) {
  const d = await db();
  const tx = d.transaction(['surveys', 'drafts'], 'readwrite');
  const record = {
    ...draft,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: 'PENDING_SYNC',
    attempts: 0,
    nextAttemptAt: 0,
    lastError: '',
  };
  await tx.objectStore('surveys').add(record);
  await tx.objectStore('drafts').delete('current');
  await tx.done;
  return record;
}
export async function acquire(owner, now = Date.now()) {
  const d = await db(),
    tx = d.transaction('locks', 'readwrite'),
    s = tx.objectStore('locks');
  const lock = await s.get('sync');
  if (lock && lock.expiresAt > now && lock.owner !== owner) {
    await tx.done;
    return false;
  }
  await s.put({ owner, expiresAt: now + 60000 }, 'sync');
  await tx.done;
  return true;
}
export async function updateOwned(owner, record) {
  const d = await db(),
    tx = d.transaction(['locks', 'surveys'], 'readwrite');
  const lock = await tx.objectStore('locks').get('sync');
  if (lock?.owner !== owner || lock.expiresAt < Date.now()) {
    await tx.done;
    return false;
  }
  await tx.objectStore('surveys').put(record);
  await tx.done;
  return true;
}
export async function release(owner) {
  const d = await db(),
    tx = d.transaction('locks', 'readwrite'),
    s = tx.objectStore('locks');
  if ((await s.get('sync'))?.owner === owner) await s.delete('sync');
  await tx.done;
}
export async function retryFailed() {
  const d = await db(),
    tx = d.transaction('surveys', 'readwrite');
  for (const row of await tx.store.getAll())
    if (row.status !== 'SYNCED') {
      row.status = 'PENDING_SYNC';
      row.nextAttemptAt = 0;
      await tx.store.put(row);
    }
  await tx.done;
}
