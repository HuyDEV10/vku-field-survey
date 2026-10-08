# Kiến trúc và API

## Ba lớp

| Lớp              | File chính                                   | Trách nhiệm                                           |
| ---------------- | -------------------------------------------- | ----------------------------------------------------- |
| Presentation     | `frontend/src/main.js`, `style.css`          | Form, danh sách phiếu, cài đặt, phản hồi trạng thái   |
| Business         | `business/validation.js`, `business/sync.js` | Validation, gửi tuần tự, phân loại lỗi                |
| Data             | `data/db.js`                                 | IndexedDB, giao dịch enqueue, khóa đồng bộ            |
| Platform adapter | `platform/device.js`                         | Camera, Network, App, nén ảnh                         |
| Web offline      | `sw.js`, `vite.config.js`                    | Precache App Shell, lifecycle worker, Background Sync |

Frontend và Service Worker dùng chung hàng đợi và hàm sync. Không cache POST hoặc dữ liệu API bằng Cache-First. Cache-First chỉ áp dụng tài nguyên App Shell; ảnh phiếu nằm trong IndexedDB.

## Trạng thái

- Nháp: store `drafts`, một phiếu hiện tại `id=current`, có bước form và Blob ảnh.
- Gửi phiếu: transaction thêm snapshot vào `surveys`, tạo UUID/timestamp và xóa nháp.
- `PENDING_SYNC`: giữ nguyên nội dung trong lúc gửi; chỉ đổi trạng thái sau receipt đúng UUID.
- `SYNCED`: máy chủ đã xác nhận; có `syncedAt`.
- `FAILED`: lỗi 4xx cần người dùng kiểm tra; không tự lặp mãi. 408/429 vẫn là lỗi có thể thử lại.

Lỗi mạng/5xx: tăng số lần lỗi, lưu thông báo và thời điểm thử lại, backoff tối đa 5 phút. Foreground kiểm tra mỗi 30 giây; online/app foreground kích hoạt thêm. Người dùng có nút thử lại ngay.

Khóa sync dùng transaction trên IndexedDB, UUID owner và lease 60 giây. Fetch có timeout 20 giây. Gia hạn trước mỗi phiếu, kiểm tra owner trước cập nhật và trước nhả khóa. Sau crash, khóa hết hạn và tiến trình mới tiếp tục. Đây là cơ chế giảm gửi lặp; backend UUID vẫn là lớp đảm bảo cuối cùng.

## Service Worker

Vite build tạo `sw.js` riêng, bundle hàm sync và `idb`, nhúng danh sách tài nguyên thật theo tên file có hash. Install precache HTML/CSS/JS/icon; activate dọn cache phiên bản cũ và claim clients. Worker mới chờ; người dùng chủ động cập nhật để tránh mất phiên đang nhập. Fonts dùng system font nên không phụ thuộc CDN.

`sync` event gửi hàng đợi và thông báo cho các client. Nếu còn phiếu pending, event thất bại để trình duyệt có thể thử lại. Background Sync không có trên mọi trình duyệt và không bảo đảm thời điểm chạy. Bản Android dùng Network/App và foreground, không dùng Service Worker.

## REST API

### GET /api/health

Thực hiện `SELECT 1` để kiểm tra database. Trả `status=UP`, `database=PostgreSQL` khi thành công.

### POST /api/surveys

`multipart/form-data` gồm:

- `metadata`: phần JSON có Content-Type `application/json`.
- `photo`: JPEG/PNG tùy chọn, tối đa 4 MB.

```json
{
  "id": "c4a6c7e2-61fd-4f5f-8db5-32bbf9d4100e",
  "createdAt": "2026-10-08T05:00:00Z",
  "building": "Tòa A",
  "floor": 2,
  "room": "A201",
  "category": "PROJECTOR",
  "rating": 2,
  "notes": "Máy chiếu không lên hình."
}
```

201 khi tạo mới; 200 khi cùng UUID và cùng nội dung đã tồn tại. Receipt gồm `id`, `receivedAt`, `duplicate`. 409 khi UUID trùng nhưng nội dung/ảnh khác. 400 cho metadata/ảnh không hợp lệ, 413 khi quá giới hạn.

Máy chủ normalize chuỗi, hash metadata và bytes ảnh. PostgreSQL primary key UUID cùng `INSERT ... ON CONFLICT DO NOTHING` xử lý race. Một UUID không tạo hai hàng kể cả khi bốn request chạy đồng thời.

### GET /api/surveys/{id}/photo

Đọc đường dẫn từ database; trả bytes ảnh hoặc 404 nếu không có. API không nhận đường dẫn file từ người dùng. Tên ảnh do máy chủ tạo bằng UUID + hash, không dùng filename upload.

## Lưu trữ và phạm vi

Flyway quản lý bảng và ràng buộc. PostgreSQL lưu metadata, thời gian nhận, đường dẫn ảnh và hash. Thư mục uploads dùng file tạm rồi rename để tránh đọc file chưa ghi xong. Filesystem và transaction PostgreSQL không có transaction chung; crash có thể để lại file ảnh không được tham chiếu. Khi sao lưu phải sao lưu cả database và uploads.

Bản lab chưa có tài khoản/phân quyền hoặc dashboard quản trị. API đường hầm phục vụ demo; CORS không thay thế xác thực. IndexedDB không thay thế backup và có thể bị xóa khi gỡ ứng dụng/xóa dữ liệu trang hoặc do giới hạn thiết bị. Bản sao JSON gồm cả ảnh được xuất từ màn hình danh sách phiếu.
