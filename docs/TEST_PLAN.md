# Đối chiếu yêu cầu và kiểm thử

## Ma trận yêu cầu

| Yêu cầu đề                            | Nơi thực hiện                          | Cách kiểm tra                         |
| ------------------------------------- | -------------------------------------- | ------------------------------------- |
| Standalone, màu #0284c7, icon 192/512 | `public/manifest.json`, icons          | Application → Manifest; cài PWA       |
| Cache-First App Shell                 | `vite.config.js`, `src/sw.js`          | Tắt mạng và reload bản build          |
| Form đủ trường                        | `main.js`, `validation.js`             | Nhập ba bước; validation FE/BE        |
| Lưu nháp realtime IndexedDB           | `data/db.js`                           | Nhập và refresh; Blob ảnh còn         |
| UUID, timestamp, PENDING_SYNC         | `enqueue()`                            | Xem store surveys và danh sách        |
| Gửi tuần tự, online, Background Sync  | `business/sync.js`, `sw.js`            | Offline → online; kiểm tra PostgreSQL |
| Camera/Network native                 | `platform/device.js`, Android manifest | Test APK trên điện thoại              |
| APK cài được                          | Android Gradle project                 | Assemble, cài và chạy trên thiết bị   |
| Live HTTPS Vercel                     | `frontend/vercel.json`, hướng dẫn      | Deploy production và kiểm tra URL     |
| Public GitHub/README                  | Root README, gitignore                 | Kiểm tra repository public            |
| Báo cáo 2-4 trang                     | `Lab-1-Technical-Report.pdf`           | Kiểm tra số trang, điền link thực tế  |

## Kết quả đã kiểm tra

- 10 frontend tests: lưu nháp/Blob, snapshot enqueue, lỗi mạng, receipt, khóa, tuần tự, 4xx, lease, validation.
- 8 backend integration tests với PostgreSQL 16: lưu phiếu, gửi lại cùng UUID, UUID nội dung khác, ghi chú lỗi, ảnh không hợp lệ, lưu/đọc ảnh, bốn request đồng thời, CORS, health. Một test bao gồm nhiều phép kiểm tra; tổng phương thức là 8.
- Production web build và Android `assembleDebug` thành công; APK đã kiểm tra chữ ký v2 và package `vn.edu.vku.fieldsurvey`. Capacitor sync nhận đủ Camera/Network/App.
- Browser E2E: reload offline, phục hồi nháp và ảnh thử nghiệm, validation, lưu phiếu pending, online gửi PostgreSQL, ảnh API, 409 với UUID nội dung khác.
- Ảnh minh chứng ở `screenshots/`; dùng fixture ảnh icon dự án trong E2E.

## Các kiểm tra cần thực hiện trên tài khoản/thiết bị của người nộp

| Mục                         | Trạng thái cần ghi sau khi thực hiện         |
| --------------------------- | -------------------------------------------- |
| URL Vercel production       | URL, ngày test HTTPS/install/offline         |
| GitHub public               | URL repository và commit                     |
| APK cài trên điện thoại     | Model/Android version, ảnh app đã cài        |
| Camera native               | Ảnh chụp thực tế; lưu lại sau khi đóng/mở    |
| Network native              | Chế độ máy bay → có mạng → PostgreSQL nhận   |
| Offline boot dưới 1 giây    | Đo trên thiết bị đích; không suy từ máy test |
| Template báo cáo giảng viên | Đối chiếu khi có mẫu                         |

## Test thủ công

1. Nhập vị trí, reload trước khi gửi: giữ nội dung.
2. Nhập 1 sao mà không ghi chú: bị chặn.
3. Đánh giá hợp lệ, chọn ảnh, reload offline: ảnh còn.
4. Gửi ba phiếu khi offline: cả ba pending, có UUID khác nhau.
5. Bật mạng nhưng tắt backend: không có phiếu giả đã gửi.
6. Bật backend: lần lượt nhận đủ phiếu và ảnh.
7. Gửi lại cùng UUID/nội dung: database có một hàng.
8. Mở hai phiên cùng origin, kích hoạt sync: backend vẫn không lưu trùng.
9. Đóng phiên đang sync, mở lại sau lease hết hạn: hàng đợi tiếp tục.
10. Chạy trên Vercel và APK với API HTTPS, xác nhận CORS và Camera/Network.

Không đo tốc độ offline trong lần truy cập đầu tiên chưa cache. Không xóa IndexedDB khi còn phiếu chưa gửi nếu chưa xuất bản sao.
