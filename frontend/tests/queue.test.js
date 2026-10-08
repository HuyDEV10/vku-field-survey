import 'fake-indexeddb/auto';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  db,
  saveDraft,
  loadDraft,
  enqueue,
  surveys,
  setting,
  acquire,
  release,
  retryFailed,
} from '../src/data/db.js';
import { syncQueue } from '../src/business/sync.js';
import { validate } from '../src/business/validation.js';
const valid = () => ({
  id: 'current',
  building: 'Tòa A',
  floor: '2',
  room: 'A201',
  category: 'PROJECTOR',
  rating: 4,
  notes: 'Tốt',
  photo: new Blob(['photo'], { type: 'image/jpeg' }),
  step: 3,
});
beforeEach(async () => {
  const d = await db();
  for (const store of ['drafts', 'surveys', 'settings', 'locks']) await d.clear(store);
  await setting('apiUrl', 'https://api.example');
});
test('draft preserves photo and step', async () => {
  await saveDraft(valid());
  const d = await loadDraft();
  assert.equal(d.step, 3);
  assert.equal(await d.photo.text(), 'photo');
});
test('submit atomically queues snapshot and removes draft', async () => {
  await saveDraft(valid());
  const row = await enqueue(valid());
  assert.equal(await loadDraft(), undefined);
  assert.equal(row.status, 'PENDING_SYNC');
  assert.match(row.id, /^[a-f0-9-]{36}$/);
  assert.equal((await surveys()).length, 1);
});
test('offline request retains pending data and photo', async () => {
  await enqueue(valid());
  await syncQueue({
    fetcher: async () => {
      throw new TypeError('offline');
    },
  });
  const [r] = await surveys();
  assert.equal(r.status, 'PENDING_SYNC');
  assert.equal(r.attempts, 1);
  assert.equal(await r.photo.text(), 'photo');
  assert.ok(r.nextAttemptAt > Date.now());
});
test('success marks synced only after matching server receipt', async () => {
  const row = await enqueue(valid());
  await syncQueue({
    fetcher: async (url, options) => {
      assert.equal(url, 'https://api.example/api/surveys');
      assert.equal(options.method, 'POST');
      assert.equal(await options.body.get('photo').text(), 'photo');
      return Response.json({ id: row.id, receivedAt: new Date().toISOString() });
    },
  });
  assert.equal((await surveys())[0].status, 'SYNCED');
});
test('malformed receipt is not accepted', async () => {
  await enqueue(valid());
  await syncQueue({ fetcher: async () => Response.json({ id: 'wrong' }) });
  assert.equal((await surveys())[0].status, 'PENDING_SYNC');
});
test('two callers do not dispatch concurrently', async () => {
  await enqueue(valid());
  let calls = 0;
  const fetcher = async (_, o) => {
    calls++;
    const r = JSON.parse(await o.body.get('metadata').text());
    await new Promise((resolve) => setTimeout(resolve, 30));
    return Response.json({ id: r.id, receivedAt: new Date().toISOString() });
  };
  await Promise.all([syncQueue({ fetcher }), syncQueue({ fetcher })]);
  assert.equal(calls, 1);
});
test('records are sent sequentially', async () => {
  for (let i = 0; i < 3; i++) await enqueue(valid());
  let active = 0,
    max = 0;
  await syncQueue({
    fetcher: async (_, o) => {
      active++;
      max = Math.max(max, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return Response.json({ id: JSON.parse(await o.body.get('metadata').text()).id });
    },
  });
  assert.equal(max, 1);
  assert.equal((await surveys()).filter((r) => r.status === 'SYNCED').length, 3);
});
test('permanent validation error is visible and retry is explicit', async () => {
  await enqueue(valid());
  await syncQueue({
    fetcher: async () => Response.json({ message: 'Invalid rating' }, { status: 400 }),
  });
  assert.equal((await surveys())[0].status, 'FAILED');
  await retryFailed();
  assert.equal((await surveys())[0].status, 'PENDING_SYNC');
});
test('expired lock can recover after closed tab', async () => {
  await acquire('old', Date.now() - 61000);
  assert.equal(await acquire('new'), true);
  await release('old');
  assert.equal(await acquire('third'), false);
  await release('new');
  assert.equal(await acquire('third'), true);
});
test('validation checks location, rating and defect note', () => {
  assert.equal(validate(valid()), '');
  assert.notEqual(validate({ ...valid(), rating: 1, notes: '' }), '');
  assert.notEqual(validate({ ...valid(), floor: '' }), '');
  assert.notEqual(validate({ ...valid(), rating: 6 }), '');
  assert.equal(validate({ ...valid(), rating: 0 }, 1), '');
});
