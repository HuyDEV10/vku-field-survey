import { surveys, setting, acquire, updateOwned, release } from '../data/db.js';
export async function syncQueue({ fetcher = fetch, force = false, notify = () => {} } = {}) {
  const owner = crypto.randomUUID();
  if (!(await acquire(owner))) return { busy: true, sent: 0 };
  let sent = 0;
  try {
    const api = await setting('apiUrl');
    if (!api) return { sent, error: 'Chưa cấu hình địa chỉ API.' };
    for (const row of await surveys()) {
      if (row.status !== 'PENDING_SYNC' || (!force && row.nextAttemptAt > Date.now())) continue;
      if (!(await acquire(owner))) break;
      const payload = {
        id: row.id,
        createdAt: row.createdAt,
        building: row.building.trim(),
        floor: Number(row.floor),
        room: row.room.trim(),
        category: row.category,
        rating: Number(row.rating),
        notes: row.notes.trim(),
      };
      const body = new FormData();
      body.append('metadata', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
      if (row.photo)
        body.append(
          'photo',
          row.photo,
          'inspection.' + (row.photo.type === 'image/png' ? 'png' : 'jpg'),
        );
      try {
        const response = await fetcher(api + '/api/surveys', {
          method: 'POST',
          body,
          signal: AbortSignal.timeout(20000),
        });
        if (!response.ok) {
          const detail = await response
            .json()
            .catch(() => ({ message: 'HTTP ' + response.status }));
          const error = new Error(detail.message || 'HTTP ' + response.status);
          error.permanent =
            response.status >= 400 &&
            response.status < 500 &&
            ![408, 429].includes(response.status);
          throw error;
        }
        const receipt = await response.json();
        if (receipt.id !== row.id) throw new Error('Máy chủ trả mã phiếu không hợp lệ.');
        row.status = 'SYNCED';
        row.syncedAt = receipt.receivedAt;
        row.lastError = '';
        row.nextAttemptAt = 0;
        sent++;
      } catch (error) {
        row.attempts++;
        row.lastError = error.message;
        row.status = error.permanent ? 'FAILED' : 'PENDING_SYNC';
        row.nextAttemptAt = Date.now() + Math.min(300000, 5000 * 2 ** Math.min(row.attempts, 6));
        if (!(await updateOwned(owner, row))) break;
        notify(row);
        if (!error.permanent) break;
        continue;
      }
      if (!(await updateOwned(owner, row))) break;
      notify(row);
    }
    return { sent };
  } finally {
    await release(owner);
  }
}
