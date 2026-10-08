import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
const base = process.env.E2E_BASE_URL || 'http://localhost:4173';
const api = process.env.E2E_API_URL || 'http://localhost:8080';
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_PATH
    ? {
        executablePath: process.env.CHROMIUM_PATH,
        args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      }
    : {}),
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  timezoneId: 'Asia/Ho_Chi_Minh',
});
const page = await context.newPage(),
  errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const out = process.env.E2E_SCREENSHOTS || 'test-results';
await mkdir(out, { recursive: true });
try {
  await page.goto(base);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.getByRole('button', { name: 'Cài đặt', exact: true }).click();
  await page.locator('#api-url').fill(api);
  await page.getByRole('button', { name: 'Lưu địa chỉ' }).click();
  await page.getByRole('button', { name: 'Kiểm tra kết nối' }).click();
  await page.getByText('Kết nối Spring Boot và PostgreSQL thành công.').waitFor();
  await page.getByRole('button', { name: 'Khảo sát', exact: true }).click();
  await page.getByLabel('Tòa nhà').fill('Tòa A');
  await page.getByLabel('Tầng', { exact: false }).fill('2');
  await page.getByLabel('Phòng').fill('A201');
  await page.waitForFunction(async () => {
    const r = indexedDB.open('vku-field-survey');
    const d = await new Promise((resolve) => (r.onsuccess = () => resolve(r.result)));
    const t = d.transaction('drafts').objectStore('drafts').get('current');
    return await new Promise((resolve) => (t.onsuccess = () => resolve(t.result?.room === 'A201')));
  });
  await context.setOffline(true);
  await page.reload();
  assert.equal(await page.getByLabel('Phòng').inputValue(), 'A201');
  console.log('Offline form ready after navigation (ms):', Math.round(await page.evaluate(() => performance.now())));
  await page.getByRole('button', { name: 'Tiếp tục' }).click();
  await page.getByLabel('Loại thiết bị').selectOption('PROJECTOR');
  await page.getByRole('button', { name: '2 sao', exact: true }).click();
  await page.getByRole('button', { name: 'Tiếp tục' }).click();
  assert.match(await page.locator('#form-error').textContent(), /mô tả lỗi/);
  await page.getByLabel('Ghi chú lỗi').fill('Máy chiếu không lên hình.');
  await page.getByRole('button', { name: 'Tiếp tục' }).click();
  await page
    .locator('#photo')
    .setInputFiles({
      name: 'photo.png',
      mimeType: 'image/png',
      buffer: await readFile('public/icons/icon-192.png'),
    });
  await page.locator('#photo-preview').waitFor();
  await page.reload();
  await page.locator('#photo-preview').waitFor();
  await page.screenshot({ path: out + '/inspection-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Lưu & gửi phiếu' }).click();
  await page.getByText('Chờ gửi', { exact: true }).waitFor();
  await page.reload();
  await page.getByRole('button', { name: 'Phiếu đã lưu', exact: true }).click();
  await page.getByText('Chờ gửi', { exact: true }).waitFor();
  await page.screenshot({ path: out + '/queue-offline.png', fullPage: true });
  await context.setOffline(false);
  await page.getByRole('button', { name: 'Đồng bộ ngay' }).click();
  await page.getByText('Đã gửi', { exact: true }).last().waitFor({ timeout: 20000 });
  const row = await page.evaluate(async () => {
    const r = indexedDB.open('vku-field-survey');
    const d = await new Promise((resolve) => (r.onsuccess = () => resolve(r.result)));
    const q = d.transaction('surveys').objectStore('surveys').getAll();
    return await new Promise((resolve) => (q.onsuccess = () => resolve(q.result[0])));
  });
  assert.equal(row.status, 'SYNCED');
  const image = await context.request.get(api + '/api/surveys/' + row.id + '/photo');
  assert.equal(image.status(), 200);
  const form = {
    id: row.id,
    createdAt: row.createdAt,
    building: row.building,
    floor: Number(row.floor),
    room: row.room,
    category: row.category,
    rating: Number(row.rating),
    notes: row.notes,
  };
  // A changed payload with an existing UUID must be rejected.
  const conflict = await context.request.post(api + '/api/surveys', {
    multipart: {
      metadata: {
        name: 'metadata.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify({ ...form, notes: 'Changed payload' })),
      },
    },
  });
  assert.equal(conflict.status(), 409);
  await page.screenshot({ path: out + '/queue-synced.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole('button', { name: 'Khảo sát', exact: true }).click();
  await page.screenshot({ path: out + '/inspection-desktop.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log(
    'Browser E2E passed: offline reload, draft/photo recovery, validation, queue, PostgreSQL sync, photo and UUID conflict.',
  );
  console.log('Synced survey UUID:', row.id);
} finally {
  await browser.close();
}
