import './style.css';
import { saveDraft, loadDraft, enqueue, surveys, setting, retryFailed } from './data/db.js';
import { validate, categories } from './business/validation.js';
import { syncQueue } from './business/sync.js';
import { native, capturePhoto, compressPhoto, listenNetwork } from './platform/device.js';
const empty = () => ({
  id: 'current',
  building: '',
  floor: '',
  room: '',
  category: '',
  rating: 0,
  notes: '',
  photo: null,
  step: 1,
});
let draft = (await loadDraft()) || empty(),
  screen = 'form',
  connected = navigator.onLine,
  syncing = false,
  installedEvent,
  swReady = false;
let saveChain = Promise.resolve(),
  previewUrl;
const app = document.querySelector('#app');
const esc = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const stamp = (value) => (value ? new Date(value).toLocaleString('vi-VN') : '');
function toast(message) {
  const box = document.querySelector('#toast');
  box.textContent = message;
  box.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (box.hidden = true), 5500);
}
function persist() {
  const snapshot = { ...draft, updatedAt: new Date().toISOString() };
  saveChain = saveChain.catch(() => {}).then(() => saveDraft(snapshot));
  saveChain
    .then(() => {
      const el = document.querySelector('#saved');
      if (el) el.textContent = 'Đã lưu trên thiết bị · ' + new Date().toLocaleTimeString('vi-VN');
    })
    .catch(() =>
      toast('Không lưu được trên thiết bị. Kiểm tra dung lượng trước khi đóng ứng dụng.'),
    );
  return saveChain;
}
function imageUrl(blob) {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = blob ? URL.createObjectURL(blob) : null;
  return previewUrl;
}
function updateConnection() {
  const el = document.querySelector('#connection');
  if (el) {
    el.textContent = connected ? 'Có kết nối mạng' : 'Đang offline';
    el.className = 'badge ' + (connected ? 'online' : 'offline');
  }
}
async function render() {
  const rows = await surveys(),
    pending = rows.filter((r) => r.status === 'PENDING_SYNC').length;
  app.innerHTML = `<header><div class="brand"><img src="/icons/icon-192.png" alt="" width="38" height="38"><div><strong>VKU Field Survey</strong><span>Kiểm tra cơ sở vật chất</span></div></div><span id="connection" class="badge"></span></header>
 <main><div class="page-heading"><div><p class="eyebrow">KHẢO SÁT TẠI HIỆN TRƯỜNG</p><h1>${screen === 'form' ? 'Phiếu kiểm tra' : screen === 'list' ? 'Phiếu trên thiết bị' : 'Kết nối & cài đặt'}</h1><p>${screen === 'form' ? 'Nhập tại chỗ. Dữ liệu được lưu ngay trên thiết bị.' : screen === 'list' ? 'Theo dõi nháp và kết quả đồng bộ của bạn.' : 'Thiết lập máy chủ nhận phiếu và cài ứng dụng.'}</p></div></div>
 <section id="content"></section><p class="footnote">${native ? 'Ứng dụng Android' : 'PWA'} · ${pending} phiếu chờ đồng bộ · Dữ liệu cục bộ thuộc thiết bị này.</p></main>
 <nav aria-label="Điều hướng chính">${[
   ['form', '+', 'Khảo sát'],
   ['list', '▤', 'Phiếu đã lưu'],
   ['settings', '⚙', 'Cài đặt'],
 ]
   .map(
     ([id, icon, label]) =>
       `<button data-screen="${id}" class="${screen === id ? 'active' : ''}"><span aria-hidden="true">${icon}</span>${label}</button>`,
   )
   .join('')}</nav>
 <div id="toast" role="status" hidden></div><dialog id="detail"></dialog>`;
  updateConnection();
  document.querySelectorAll('[data-screen]').forEach(
    (b) =>
      (b.onclick = async () => {
        try {
          await saveChain;
          screen = b.dataset.screen;
          await render();
        } catch {
          toast('Chưa lưu được dữ liệu.');
        }
      }),
  );
  if (screen === 'form') renderForm();
  else if (screen === 'list') renderList(rows);
  else await renderSettings();
}
function renderForm() {
  const step = draft.step || 1,
    content = document.querySelector('#content');
  content.innerHTML = `<div class="steps" aria-label="Bước ${step} trên 3">${['Vị trí', 'Tình trạng', 'Ảnh & xác nhận'].map((label, i) => `<div class="${i + 1 <= step ? 'current' : ''}"><span>${i + 1}</span>${label}</div>`).join('')}</div>
 <form id="survey-form" class="card"><div class="card-title"><h2>${['Xác định vị trí', 'Đánh giá thiết bị', 'Kiểm tra trước khi gửi'][step - 1]}</h2><span>Bước ${step}/3</span></div><p id="saved" class="saved">${draft.updatedAt ? 'Đã lưu nháp · ' + stamp(draft.updatedAt) : 'Tự lưu khi bạn nhập'}</p>
 ${step === 1 ? `<label>Tòa nhà <span>*</span><input name="building" maxlength="100" placeholder="Ví dụ: Tòa A" value="${esc(draft.building)}" required></label><div class="columns"><label>Tầng <span>*</span><input name="floor" type="number" min="-5" max="100" step="1" placeholder="Ví dụ: 2" value="${esc(draft.floor)}" required><small>Tầng hầm nhập số âm.</small></label><label>Phòng <span>*</span><input name="room" maxlength="30" placeholder="Ví dụ: A201" value="${esc(draft.room)}" required></label></div>` : ''}
 ${
   step === 2
     ? `<label>Loại thiết bị <span>*</span><select name="category" required><option value="">Chọn loại thiết bị</option>${Object.entries(
         categories,
       )
         .map(
           ([key, label]) =>
             `<option value="${key}" ${draft.category === key ? 'selected' : ''}>${label}</option>`,
         )
         .join(
           '',
         )}</select></label><fieldset><legend>Tình trạng <span>*</span></legend><div class="ratings">${[1, 2, 3, 4, 5].map((n) => `<button type="button" aria-label="${n} sao" aria-pressed="${draft.rating === n}" data-rating="${n}" class="${draft.rating >= n ? 'chosen' : ''}">★</button>`).join('')}</div><p id="rating-label" class="muted">${['Chưa đánh giá', 'Hỏng / không sử dụng được', 'Kém / cần sửa chữa', 'Trung bình', 'Tốt', 'Rất tốt'][draft.rating]}</p></fieldset><label>Ghi chú lỗi<textarea name="notes" maxlength="2000" rows="4" placeholder="Mô tả lỗi hoặc tình trạng quan sát được…">${esc(draft.notes)}</textarea><small>Bắt buộc khi đánh giá 1–2 sao. Tối đa 2.000 ký tự.</small></label>`
     : ''
 }
 ${step === 3 ? `<div class="review"><div><span>Vị trí</span><strong>${esc(draft.building)} · Tầng ${esc(draft.floor)} · ${esc(draft.room)}</strong></div><div><span>Thiết bị</span><strong>${esc(categories[draft.category])}</strong></div><div><span>Đánh giá</span><strong>${'★'.repeat(Number(draft.rating))} (${draft.rating}/5)</strong></div><div><span>Ghi chú</span><p>${esc(draft.notes || 'Không có ghi chú')}</p></div></div><div class="photo-area">${draft.photo ? `<img id="photo-preview" src="${imageUrl(draft.photo)}" alt="Ảnh hiện trường"><button id="remove-photo" type="button" class="text-button">Xóa ảnh</button>` : '<p>Thêm ảnh hiện trường để minh họa tình trạng.</p>'}<div class="photo-actions">${native ? '<button id="camera" type="button" class="secondary">Chụp ảnh</button>' : ''}<label class="file-button">${draft.photo ? 'Thay ảnh' : 'Chụp / chọn ảnh'}<input id="photo" type="file" accept="image/jpeg,image/png,image/webp" capture="environment"></label></div><small>Ảnh được nén và lưu trên thiết bị cùng phiếu.</small></div><div class="notice">${connected ? 'Phiếu được lưu trước, sau đó gửi nếu máy chủ sẵn sàng.' : 'Bạn đang offline. Phiếu sẽ chờ đồng bộ khi kết nối lại.'}</div>` : ''}
 <p id="form-error" class="error" role="alert"></p><div class="form-actions">${step > 1 ? '<button type="button" id="back" class="secondary">Quay lại</button>' : '<button type="button" id="reset" class="text-button">Xóa nháp</button>'}<button type="submit" class="primary">${step === 3 ? 'Lưu & gửi phiếu' : 'Tiếp tục →'}</button></div></form>`;
  const form = document.querySelector('#survey-form');
  form.addEventListener('input', (event) => {
    if (event.target.name) {
      draft[event.target.name] = event.target.value;
      persist();
    }
  });
  document.querySelectorAll('[data-rating]').forEach(
    (b) =>
      (b.onclick = () => {
        draft.rating = Number(b.dataset.rating);
        persist();
        renderForm();
      }),
  );
  document.querySelector('#back')?.addEventListener('click', () => {
    draft.step--;
    persist();
    renderForm();
  });
  document.querySelector('#reset')?.addEventListener('click', async () => {
    if (confirm('Xóa nội dung phiếu nháp đang nhập?')) {
      draft = empty();
      await persist();
      renderForm();
    }
  });
  form.onsubmit = async (event) => {
    event.preventDefault();
    const error = validate(draft, step);
    document.querySelector('#form-error').textContent = error;
    if (error) return;
    const submit = form.querySelector('[type=submit]');
    submit.disabled = true;
    try {
      await persist();
      if (step < 3) {
        draft.step++;
        await persist();
        renderForm();
        return;
      }
      await enqueue(draft);
      draft = empty();
      screen = 'list';
      await render();
      toast('Đã lưu phiếu trên thiết bị.');
      await requestSync();
    } catch (error) {
      submit.disabled = false;
      document.querySelector('#form-error').textContent = 'Không lưu được phiếu: ' + error.message;
    }
  };
  document.querySelector('#photo')?.addEventListener('change', async (event) => {
    if (event.target.files[0]) await attach(event.target.files[0]);
  });
  document.querySelector('#camera')?.addEventListener('click', async () => {
    try {
      await persist();
      await attach(await capturePhoto());
    } catch {
      toast('Chưa chụp được ảnh hoặc bạn đã hủy.');
    }
  });
  document.querySelector('#remove-photo')?.addEventListener('click', async () => {
    draft.photo = null;
    await persist();
    renderForm();
  });
}
async function attach(blob) {
  try {
    draft.photo = await compressPhoto(blob);
    await persist();
    renderForm();
    toast('Đã lưu ảnh trên thiết bị.');
  } catch (error) {
    toast(error.message);
  }
}
function renderList(rows) {
  const pending = rows.filter((r) => r.status === 'PENDING_SYNC').length,
    synced = rows.filter((r) => r.status === 'SYNCED').length,
    failed = rows.filter((r) => r.status === 'FAILED').length;
  document.querySelector('#content').innerHTML =
    `<div class="stats"><div><strong>${pending}</strong><span>Chờ đồng bộ</span></div><div><strong>${synced}</strong><span>Đã gửi</span></div><div><strong>${failed}</strong><span>Cần kiểm tra</span></div></div><div class="list-actions"><button id="sync-now" class="primary" ${syncing ? 'disabled' : ''}>${syncing ? 'Đang đồng bộ…' : 'Đồng bộ ngay'}</button><button id="export" class="secondary">Xuất bản sao JSON</button></div>
 ${
   rows.length
     ? `<div class="survey-list">${rows
         .toReversed()
         .map(
           (r) =>
             `<button class="survey-row" data-id="${r.id}"><div class="row-top"><strong>${esc(r.building)} · ${esc(r.room)}</strong><span class="badge ${r.status === 'SYNCED' ? 'online' : r.status === 'FAILED' ? 'failed' : 'offline'}">${r.status === 'SYNCED' ? 'Đã gửi' : r.status === 'FAILED' ? 'Cần kiểm tra' : 'Chờ gửi'}</span></div><p>${esc(categories[r.category])} · ${r.rating}/5 sao ${r.photo ? '· Có ảnh' : ''}</p><small>${stamp(r.createdAt)}</small>${r.lastError ? '<p class="error">' + esc(r.lastError) + '</p>' : ''}</button>`,
         )
         .join('')}</div>`
     : '<div class="card empty"><h2>Chưa có phiếu đã gửi</h2><p>Phiếu nháp đang nhập nằm ở mục Khảo sát.</p><button id="start" class="primary">Tạo phiếu kiểm tra</button></div>'
 }`;
  document.querySelector('#sync-now').onclick = async () => {
    if (syncing) return;
    await retryFailed();
    await requestSync(true);
  };
  document.querySelector('#start')?.addEventListener('click', () => {
    screen = 'form';
    render();
  });
  document.querySelectorAll('[data-id]').forEach(
    (b) =>
      (b.onclick = () => {
        const r = rows.find((row) => row.id === b.dataset.id),
          dialog = document.querySelector('#detail');
        dialog.innerHTML = `<h2>${esc(r.building)} · ${esc(r.room)}</h2><p>Tầng ${r.floor} · ${esc(categories[r.category])} · ${r.rating}/5 sao</p><p class="prewrap">${esc(r.notes || 'Không có ghi chú')}</p>${r.photo ? `<img src="${imageUrl(r.photo)}" alt="Ảnh khảo sát">` : ''}<p><small>Mã phiếu: ${r.id}<br>Tạo: ${stamp(r.createdAt)}<br>Máy chủ nhận: ${stamp(r.syncedAt) || 'Chưa nhận'}<br>Số lần gửi lỗi: ${r.attempts}</small></p><button id="close-dialog" class="primary">Đóng</button>`;
        document.querySelector('#close-dialog').onclick = () => dialog.close();
        dialog.showModal();
      }),
  );
  document.querySelector('#export').onclick = async () => {
    const data = [];
    for (const row of rows) {
      let photo = null;
      if (row.photo)
        photo = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(row.photo);
        });
      data.push({ ...row, photo });
    }
    const url = URL.createObjectURL(
      new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), surveys: data }, null, 2)], {
        type: 'application/json',
      }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vku-surveys-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
}
async function renderSettings() {
  const api = (await setting('apiUrl')) || '';
  document.querySelector('#content').innerHTML =
    `<div class="card"><h2>Máy chủ nhận phiếu</h2><p>Dùng URL HTTPS của đường hầm đến Spring Boot khi chạy trên Vercel hoặc Android.</p><form id="settings-form"><label>Địa chỉ API<input id="api-url" type="url" placeholder="https://your-tunnel.example" value="${esc(api)}" required></label><small>Nhập URL gốc, không thêm /api/surveys. Local web: http://localhost:8080.</small><div class="form-actions"><button class="primary">Lưu địa chỉ</button><button id="check-api" type="button" class="secondary">Kiểm tra kết nối</button></div><p id="api-result" role="status"></p></form></div><div class="card"><h2>Cài đặt ứng dụng</h2><p>${native ? 'Bạn đang dùng phiên bản Android.' : 'Chrome/Edge: chọn Cài đặt ứng dụng. Trên iOS: Chia sẻ → Thêm vào màn hình chính.'}</p><button id="install" class="secondary" ${!installedEvent ? 'disabled' : ''}>Cài PWA</button><p id="offline-status" class="muted">${native ? 'Giao diện đã đóng gói trong APK.' : swReady ? 'Bộ nhớ offline đã sẵn sàng.' : 'Chưa có Service Worker điều khiển trang. Hãy chạy bản build và tải lại khi có mạng.'}</p><button id="update" class="text-button">Kiểm tra bản cập nhật</button></div><div class="notice">Không xóa dữ liệu trang web hoặc gỡ ứng dụng trước khi phiếu đã đồng bộ / xuất bản sao. Trình duyệt có thể thu hồi dữ liệu khi thiết bị hết dung lượng.</div>`;
  document.querySelector('#settings-form').onsubmit = async (event) => {
    event.preventDefault();
    try {
      const url = new URL(document.querySelector('#api-url').value.trim());
      if (url.username || url.password || url.search || url.hash || url.pathname !== '/')
        throw new Error('Nhập URL gốc không chứa tài khoản, đường dẫn hoặc tham số.');
      if (
        url.protocol !== 'https:' &&
        !(
          url.protocol === 'http:' &&
          ['localhost', '127.0.0.1'].includes(url.hostname) &&
          location.protocol === 'http:' &&
          !native
        )
      )
        throw new Error('Vercel và Android cần API HTTPS. HTTP chỉ dùng khi chạy web ở localhost.');
      await setting('apiUrl', url.origin);
      document.querySelector('#api-result').textContent = 'Đã lưu địa chỉ API.';
      await requestSync();
    } catch (error) {
      document.querySelector('#api-result').textContent = error.message;
    }
  };
  document.querySelector('#check-api').onclick = async () => {
    const result = document.querySelector('#api-result');
    result.textContent = 'Đang kiểm tra…';
    try {
      const res = await fetch((await setting('apiUrl')) + '/api/health', {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (data.status !== 'UP') throw new Error('API chưa sẵn sàng.');
      result.textContent = 'Kết nối Spring Boot và PostgreSQL thành công.';
    } catch {
      result.textContent =
        'Chưa kết nối được. Kiểm tra Spring Boot, PostgreSQL, đường hầm và CORS.';
    }
  };
  document.querySelector('#install').onclick = async () => {
    if (installedEvent) {
      await installedEvent.prompt();
      installedEvent = null;
      renderSettings();
    }
  };
  document.querySelector('#update').onclick = async () => {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (!reg) {
      toast('Không có Service Worker trong phiên này.');
      return;
    }
    await reg.update();
    if (reg.waiting) {
      if (confirm('Có phiên bản mới. Đã lưu nháp; tải lại để cập nhật?')) {
        await saveChain;
        reg.waiting.postMessage('SKIP_WAITING');
      }
    } else toast('Đã kiểm tra cập nhật. Bản mới có thể đang tải.');
  };
}
async function registerBackground() {
  if (
    native ||
    !('serviceWorker' in navigator) ||
    !(await surveys()).some((r) => r.status === 'PENDING_SYNC')
  )
    return;
  const reg = await navigator.serviceWorker.getRegistration();
  if (reg?.active && 'sync' in reg)
    try {
      await reg.sync.register('vku-surveys');
    } catch {
      /* Foreground retries remain available. */
    }
}
async function requestSync(force = false) {
  if (syncing) return;
  await registerBackground();
  if (!connected) {
    if (force) toast('Bạn đang offline. Phiếu vẫn được lưu.');
    return;
  }
  syncing = true;
  if (screen === 'list') await render();
  try {
    const result = await syncQueue({ force });
    if (result.sent) toast('Đã đồng bộ ' + result.sent + ' phiếu.');
    else if (force)
      toast(
        result.busy
          ? 'Đồng bộ đang chạy ở phiên khác.'
          : result.error || 'Đã kiểm tra hàng đợi. Xem trạng thái từng phiếu.',
      );
  } catch (error) {
    toast('Đồng bộ chưa hoàn tất: ' + error.message);
  } finally {
    syncing = false;
    if (screen === 'list') await render();
  }
}
if (!(await setting('apiUrl'))) {
  const configured =
    import.meta.env.VITE_API_URL ||
    (['localhost', '127.0.0.1'].includes(location.hostname) && !native
      ? 'http://localhost:8080'
      : '');
  if (configured) await setting('apiUrl', configured.replace(/\/$/, ''));
}
await render();
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installedEvent = event;
  if (screen === 'settings') renderSettings();
});
window.addEventListener('restored-photo', (event) => attach(event.detail));
await listenNetwork((online) => {
  connected = online;
  updateConnection();
  if (online) requestSync();
});
if (!native && import.meta.env.PROD && 'serviceWorker' in navigator) {
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data === 'QUEUE_UPDATED' && screen === 'list') render();
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (swReady) location.reload();
      else {
        swReady = true;
        if (screen === 'settings') renderSettings();
      }
    });
    await navigator.serviceWorker.ready;
    swReady = !!navigator.serviceWorker.controller;
    reg.addEventListener('updatefound', () =>
      toast('Đang tải phiên bản mới. Bạn có thể cập nhật ở Cài đặt.'),
    );
  } catch {
    toast('Chưa chuẩn bị được bộ nhớ offline. Giữ kết nối và thử tải lại.');
  }
}
if (navigator.storage?.persist) await navigator.storage.persist().catch(() => false);
setInterval(() => {
  if (connected) requestSync();
}, 30000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') requestSync();
});
