# VKU Field Survey

Ứng dụng kiểm tra cơ sở vật chất tại VKU. Người dùng nhập phiếu và chụp ảnh khi mất mạng; phiếu được lưu trên thiết bị và đồng bộ đến Spring Boot/PostgreSQL khi máy chủ truy cập được.

## Công nghệ

- PWA: Vite, JavaScript, CSS, Web App Manifest, Service Worker.
- Dữ liệu offline: IndexedDB qua `idb`, ảnh dạng Blob.
- API: Spring Boot 3.5.7, Java 21, Maven Wrapper, PostgreSQL, Flyway.
- Android: Capacitor 8, Camera, Network, App.
- Hosting frontend: Vercel. Backend và PostgreSQL chạy local; API được truy cập qua đường hầm HTTPS khi demo từ Vercel/Android.

## Chạy nhanh trên Windows

Chuẩn bị Java 21, Node.js >=22.12, PostgreSQL 16 trở lên. Cài Android Studio 2025.2.1 trở lên nếu build APK.

1. Trong pgAdmin, kết nối database `postgres`, chạy riêng từng câu lệnh:

```sql
CREATE ROLE vku_survey WITH LOGIN PASSWORD 'YourLocalPassword';
CREATE DATABASE vku_field_survey OWNER vku_survey;
```

2. Mở PowerShell ở thư mục `backend`:

```powershell
$env:DB_USERNAME = "vku_survey"
$env:DB_PASSWORD = "YourLocalPassword"
$env:DB_URL = "jdbc:postgresql://localhost:5432/vku_field_survey"
.\mvnw.cmd spring-boot:run
```

3. Mở terminal thứ hai ở `frontend`:

```powershell
npm ci
npm run build
npm run preview
```

4. Mở `http://localhost:4173`. Vào **Cài đặt**, kiểm tra API `http://localhost:8080`. Tạo phiếu, tắt mạng, tải lại và thử gửi.

Dùng `npm run dev` để sửa giao diện. Kiểm thử Service Worker và offline bằng `build` + `preview`, không dùng dev server.

## Hướng dẫn đầy đủ

- [Cách chạy, triển khai Vercel, build APK và thực hiện lab](docs/HUONG_DAN_LAB_1.md)
- [Kiến trúc, API và trạng thái phiếu](docs/ARCHITECTURE.md)
- [Kịch bản kiểm thử và đối chiếu yêu cầu](docs/TEST_PLAN.md)
- [Báo cáo kỹ thuật](docs/Lab-1-Technical-Report.pdf)

## Cấu trúc

| Thư mục            | Nội dung                                                        |
| ------------------ | --------------------------------------------------------------- |
| `frontend/src`     | Giao diện, nghiệp vụ, IndexedDB, Service Worker, bridge Android |
| `frontend/android` | Dự án Android native, Gradle Wrapper                            |
| `backend/src/main` | API, validation, lưu ảnh, migration PostgreSQL                  |
| `backend/src/test` | Kiểm thử tích hợp với database riêng                            |
| `docs`             | Hướng dẫn, báo cáo, kịch bản test, ảnh kiểm thử                 |
| `scripts`          | Tiện ích chạy backend trên Windows                              |

## Kiểm thử

```powershell
# frontend
npm test
# Chạy backend + bản preview trước khi chạy E2E
npx playwright install chromium
npm run test:e2e
```

Backend test dùng database riêng có tên kết thúc bằng `_test`. Xem hướng dẫn tạo database test trước khi chạy `mvnw.cmd test`.

## Trạng thái triển khai

Mã nguồn chứa cấu hình Vercel và Android. URL Vercel, URL đường hầm và địa chỉ repository được cập nhật sau khi tạo deployment/repository trong tài khoản của người thực hiện. Không coi bản local là URL HTTPS công khai đã nộp.

Không đưa `.env`, mật khẩu, thư mục ảnh đã nhận, `node_modules`, build output hoặc khóa ký Android lên Git.
