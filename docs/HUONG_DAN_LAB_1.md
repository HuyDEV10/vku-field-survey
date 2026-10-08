# Lab 1 - Hướng dẫn thực hiện từ đầu đến cuối

## 1. Hiểu đúng bài làm

Hai ảnh đề thuộc cùng mini-project **VKU Field Survey**: ảnh thứ nhất mô tả chức năng, ảnh thứ hai quy định đầu ra nộp. Ta thực hiện theo hai phần: **PWA offline-first** và **Android APK dùng lại PWA qua Capacitor**.

Week 1 cung cấp kiến trúc ba lớp và cách chọn PWA/Hybrid. Week 2 hướng dẫn môi trường Vite/Capacitor và một phong cách thiết kế thống nhất. Week 3 là cơ sở của Manifest, Cache API, IndexedDB và Background Sync. Spring Boot/PostgreSQL là phần máy chủ bổ sung để chứng minh phiếu được đồng bộ thật.

### Mục tiêu bạn cần trình diễn

1. Cài PWA từ URL HTTPS trên Vercel.
2. Tắt mạng, vẫn mở ứng dụng và nhập phiếu.
3. Tải lại: nội dung và ảnh chưa gửi vẫn còn.
4. Gửi khi offline: phiếu có UUID, timestamp, `PENDING_SYNC`.
5. Có mạng và backend hoạt động: phiếu được lưu vào PostgreSQL; trạng thái thành `SYNCED`.
6. Cài APK, dùng Camera/Network native và lặp lại thử nghiệm.

## 2. Chuẩn bị môi trường Windows

| Công cụ        | Yêu cầu của dự án                           | Kiểm tra                             |
| -------------- | ------------------------------------------- | ------------------------------------ |
| Node.js        | >=22.12; Node 24 của bạn phù hợp            | `node --version`                     |
| npm            | Đi kèm Node                                 | `npm --version`                      |
| Git            | Đã cấu hình tài khoản                       | `git --version`                      |
| Java           | JDK 21 cho backend                          | `java -version`                      |
| Maven          | Có Maven Wrapper trong dự án                | `.\mvnw.cmd --version` trong backend |
| PostgreSQL     | 16+; khuyến nghị dùng bản bạn đã cài        | pgAdmin kết nối thành công           |
| Android Studio | >=2025.2.1, SDK Platform 36, Build Tools 36 | SDK Manager                          |

Nếu máy có Java 17 và 21, kiểm tra `java -version` trước khi chạy. Có thể chọn Java 21 cho terminal hiện tại:

```powershell
# Thay bằng đường dẫn JDK 21 thực tế trên máy bạn
$env:JAVA_HOME = "C:\Program Files\Java\jdk-21"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
java -version
```

Giải nén dự án vào đường dẫn ngắn, ví dụ `D:\Projects\vku-field-survey`. Mở thư mục đó bằng VS Code. Khi đã có repository, dùng `git clone <URL-repository>` thay cho giải nén.

## 3. Tạo PostgreSQL database

Trong pgAdmin, đăng nhập tài khoản quản trị, chọn database `postgres` và mở Query Tool. Thay mật khẩu dưới đây bằng mật khẩu local bạn tự chọn. Chạy từng câu riêng; `CREATE DATABASE` không chạy trong transaction.

```sql
CREATE ROLE vku_survey WITH LOGIN PASSWORD 'YourLocalPassword';
```

```sql
CREATE DATABASE vku_field_survey OWNER vku_survey;
```

Không cần tự tạo bảng. Spring Boot dùng Flyway chạy `V1__create_surveys.sql` khi khởi động. Nếu role/database đã tồn tại, dùng chúng hoặc chọn tên mới; không xóa database hiện có để chạy lab.

## 4. Chạy Spring Boot

Mở PowerShell thứ nhất:

```powershell
cd D:\Projects\vku-field-survey\backend
$env:DB_URL = "jdbc:postgresql://localhost:5432/vku_field_survey"
$env:DB_USERNAME = "vku_survey"
$env:DB_PASSWORD = "YourLocalPassword"
.\mvnw.cmd spring-boot:run
```

Lần đầu Maven tải thư viện nên cần Internet. Giữ terminal mở trong lúc dùng ứng dụng.

Mở `http://localhost:8080/api/health`. Kết quả đúng:

```json
{ "status": "UP", "database": "PostgreSQL" }
```

Nếu lỗi kết nối database: kiểm tra PostgreSQL đang chạy, cổng, tên database và tài khoản. Nếu cổng của bạn là 5433, sửa `DB_URL` tương ứng. Nếu 8080 đang bận, đặt `$env:SERVER_PORT="8081"` và sửa địa chỉ API phía frontend/đường hầm.

### Cách chạy lại bằng file cấu hình local

Sao chép `backend/.env.example` thành `backend/.env`, điền thông tin thực tế. File `.env` không được commit. Spring Boot không tự đọc `.env`; tiện ích sau sẽ đọc và nạp vào terminal của tiến trình:

```powershell
cd D:\Projects\vku-field-survey
powershell -ExecutionPolicy Bypass -File .\scripts\run-backend.ps1
```

Lệnh này chỉ áp dụng ExecutionPolicy cho tiến trình hiện tại, không thay đổi chính sách toàn máy.

## 5. Chạy và kiểm tra PWA local

Mở PowerShell thứ hai:

```powershell
cd D:\Projects\vku-field-survey\frontend
npm ci
npm run build
npm run preview
```

Mở `http://localhost:4173` bằng Chrome/Edge. Ở mục **Cài đặt**, lưu API `http://localhost:8080`, rồi bấm **Kiểm tra kết nối**. Dữ liệu nháp và phiếu nằm ở IndexedDB của origin này.

`npm run dev` chạy Vite ở 5173 và dùng khi sửa code. Service Worker chỉ đăng ký trong bản production để tránh cache cũ gây nhiễu lúc phát triển. `localhost:5173` và `localhost:4173` là hai nơi lưu dữ liệu khác nhau.

### Phiếu ba bước

- **Vị trí:** nhập tòa nhà, tầng (-5 đến 100), phòng.
- **Tình trạng:** chọn loại thiết bị, đánh giá 1-5 sao, ghi chú. Đánh giá 1-2 sao phải có ghi chú.
- **Ảnh & xác nhận:** chụp/chọn ảnh; kiểm tra nội dung; bấm **Lưu & gửi phiếu**.

Ảnh được nén thành JPEG, cạnh lớn nhất 1.400 px, tối đa 4 MB. Có thể gửi phiếu không có ảnh; đề yêu cầu tính năng Camera Photo nhưng không nói mọi phiếu bắt buộc có ảnh. Khi trình diễn nên gửi ít nhất một phiếu có ảnh.

### Kiểm tra offline bằng DevTools

1. Mở online lần đầu. Trong Application → Service Workers, xác nhận worker đang hoạt động và điều khiển trang. Trong Cache Storage có `vku-shell-...`.
2. Nhập một phần phiếu. Đợi dòng **Đã lưu trên thiết bị**.
3. Trong Network, chọn **Offline**. Tải lại trang.
4. Dữ liệu phải còn. Hoàn thành phiếu, thêm ảnh, tải lại lần nữa để kiểm tra ảnh vẫn còn.
5. Bấm gửi. Ở **Phiếu đã lưu**, thấy **Chờ gửi**.
6. Chuyển Network về **No throttling**, giữ backend hoạt động; phiếu tự gửi. Có thể bấm **Đồng bộ ngay**.
7. Khi tắt backend nhưng Wi-Fi vẫn có: phiếu phải tiếp tục chờ, không được hiển thị đã gửi.

Offline chỉ hoạt động sau khi đã mở ứng dụng online một lần và precache thành công. Không bật tùy chọn **Bypass for network** khi kiểm thử Service Worker.

## 6. Xem phiếu đã nhận trong PostgreSQL

Chọn database `vku_field_survey` trong pgAdmin, chạy:

```sql
SELECT id, building, floor, room, category, rating, notes,
       created_at, received_at, photo_path
FROM surveys
ORDER BY received_at DESC;
```

UUID ở UI phải trùng UUID trong bảng. Ảnh nằm trong `backend/uploads/` mặc định. Xem ảnh qua `http://localhost:8080/api/surveys/<UUID>/photo`. Phiếu không có ảnh trả 404 ở API ảnh.

Dữ liệu local của trình duyệt và database backend độc lập. Xóa IndexedDB không xóa PostgreSQL; đổi domain Vercel hoặc đổi trình duyệt sẽ có vùng lưu offline khác.

## 7. Đưa API local ra HTTPS

PWA HTTPS trên Vercel không gọi trực tiếp `http://localhost:8080` của laptop. Dùng đường hầm HTTPS đến Spring Boot. Một cách là Cloudflare Quick Tunnel:

```powershell
# Cài cloudflared nếu máy chưa có
winget install --id Cloudflare.cloudflared
# Mở terminal mới sau khi cài
cloudflared tunnel --url http://localhost:8080
```

Terminal in URL dạng `https://...trycloudflare.com`. Giữ cả Spring Boot, PostgreSQL và cloudflared hoạt động. Thử `<URL>/api/health` từ điện thoại trước.

Quick Tunnel có thể đổi URL sau khi khởi động lại. Ứng dụng có mục **Cài đặt** để thay API mà không cần rebuild. Chỉ dùng URL của máy chủ bạn quản lý vì ứng dụng gửi nội dung và ảnh khảo sát đến URL đã lưu.

## 8. Triển khai frontend trên Vercel

1. Đưa repository public lên GitHub.
2. Trong Vercel, chọn **Add New → Project**, import repository này.
3. Đặt **Root Directory** là `frontend`.
4. Framework Preset: **Vite**.
5. Build Command: `npm run build`; Output Directory: `dist`; Install Command: `npm ci`.
6. Thêm biến `VITE_API_URL` bằng URL gốc HTTPS của đường hầm. Không đặt mật khẩu PostgreSQL trong Vercel hoặc biến `VITE_*`.
7. Deploy và lấy URL `https://<project>.vercel.app`.
8. Trong terminal backend, cấu hình CORS gồm đúng domain đó, rồi khởi động lại:

```powershell
$env:CORS_ORIGINS = "http://localhost:5173,http://localhost:4173,https://localhost,https://YOUR-PROJECT.vercel.app"
.\mvnw.cmd spring-boot:run
```

`https://localhost` là origin của Capacitor Android. Nếu dùng preview deployment Vercel có domain khác, thêm đúng domain đó; không dùng wildcard cho toàn bộ Internet.

9. Mở URL Vercel, vào **Cài đặt**, xác nhận API là URL đường hầm, kiểm tra kết nối.
10. Cài PWA bằng Chrome/Edge hoặc Share → Add to Home Screen trên iOS. Lặp lại test offline trên URL này.

Biến Vite được gắn vào bundle lúc build. Sửa `VITE_API_URL` trong Vercel cần redeploy. Nếu origin đã có API cũ trong IndexedDB, sửa trong **Cài đặt**, vì ứng dụng ưu tiên địa chỉ đã lưu của thiết bị.

Frontend vẫn mở offline khi laptop tắt; đồng bộ phải đợi API local hoạt động trở lại. Không đưa PostgreSQL port 5432 ra Internet.

## 9. Build và cài Android APK

Cài Android Studio, mở SDK Manager và chuẩn bị SDK Platform 36, Build Tools 36, Platform Tools. Dùng JDK đi kèm Android Studio khi Gradle yêu cầu. Dự án dùng compile/target SDK 36, min SDK 24.

Trong `frontend`:

```powershell
npm ci
npm run android:sync
npm run android:open
```

Dự án `android/` đã có sẵn; không chạy lại `npx cap add android`. `android:sync` build web rồi chép vào APK và đồng bộ plugin. Mỗi lần thay frontend phải sync lại.

Trong Android Studio, đợi Gradle Sync hoàn tất. Chọn emulator hoặc điện thoại USB debugging, bấm Run. Vào **Cài đặt** của app và nhập API HTTPS đường hầm.

Để tạo APK bằng terminal:

```powershell
cd android
.\gradlew.bat assembleDebug
```

APK ở `frontend/android/app/build/outputs/apk/debug/app-debug.apk`. Đây là debug APK để cài thử và nộp lab, không phải bản phát hành Google Play.

Cài qua USB:

```powershell
adb install -r .\app\build\outputs\apk\debug\app-debug.apk
```

Hoặc chuyển APK sang điện thoại, cho phép cài từ nguồn tương ứng rồi mở file. Trong app, chụp ảnh bằng nút **Chụp ảnh**. Plugin Network kích hoạt đồng bộ khi mạng trở lại; App kích hoạt khi app quay lại foreground. Không bảo đảm đồng bộ khi Android đã đóng hẳn/force-stop ứng dụng.

APK dùng tài nguyên web đóng gói để mở offline; không đăng ký Service Worker trong WebView. Hàng đợi IndexedDB và nghiệp vụ đồng bộ được dùng lại. PWA web dùng Background Sync nếu trình duyệt hỗ trợ.

### Test Android bắt buộc trên máy bạn

1. Cài và mở app; lưu API, kiểm tra kết nối.
2. Bật chế độ máy bay, tạo phiếu và chụp ảnh.
3. Đóng và mở lại app; kiểm tra nháp/phiếu và ảnh còn.
4. Gửi offline; thấy phiếu chờ.
5. Tắt chế độ máy bay, mở lại app nếu cần; kiểm tra PostgreSQL nhận đúng một phiếu.
6. Chụp minh chứng APK được cài và sử dụng camera thật.

## 10. Chạy kiểm thử tự động

### Frontend

```powershell
cd frontend
npm test
```

Bao gồm lưu Blob/nháp, enqueue nguyên tử, giữ phiếu khi mất mạng, xác nhận receipt, khóa đồng bộ, gửi tuần tự, lỗi 4xx, phục hồi khóa hết hạn và validation.

### Backend với database riêng

Tạo database test trong pgAdmin khi đang kết nối `postgres`:

```sql
CREATE DATABASE vku_field_survey_test OWNER vku_survey;
```

Trong terminal backend:

```powershell
$env:TEST_DB_URL = "jdbc:postgresql://localhost:5432/vku_field_survey_test"
$env:DB_USERNAME = "vku_survey"
$env:DB_PASSWORD = "YourLocalPassword"
.\mvnw.cmd test
```

Test xóa dữ liệu trong bảng `surveys` của database test trước mỗi trường hợp. Profile test dùng `TEST_DB_URL`; kiểm tra tên database kết thúc `_test` trước khi xóa. Không dùng database dữ liệu thật cho bộ test.

### E2E trình duyệt

Giữ backend và bản preview đang chạy. Trong terminal frontend khác:

```powershell
npx playwright install chromium
npm run test:e2e
```

E2E tạo một phiếu dữ liệu thử ở backend đang kết nối. Chạy backend với database test nếu muốn tách dữ liệu thử. Ảnh E2E là icon dự án dùng làm fixture; không thay thế minh chứng Camera native trên điện thoại.

## 11. Chuẩn bị bài nộp

| Đầu ra        | Cách lấy                                                                                            |
| ------------- | --------------------------------------------------------------------------------------------------- |
| URL HTTPS     | URL production Vercel đã test                                                                       |
| GitHub public | Repository chứa frontend, backend, Android source và tài liệu                                       |
| README        | Hướng dẫn chạy và các liên kết trong repository                                                     |
| PDF 2-4 trang | `docs/Lab-1-Technical-Report.pdf`; điền URL thực tế, bổ sung kết quả điện thoại theo mẫu giảng viên |
| APK           | APK đã build và cài thử; đính kèm bài nộp hoặc GitHub Release                                       |

Ảnh đề chưa kèm mẫu báo cáo chuẩn. Báo cáo hiện có cấu trúc kỹ thuật 4 trang; cần đối chiếu mẫu của giảng viên nếu được cung cấp.

## 12. Các lỗi thường gặp

| Hiện tượng                            | Cách xử lý                                                               |
| ------------------------------------- | ------------------------------------------------------------------------ |
| PWA không mở offline                  | Chạy build/preview; mở online lần đầu; kiểm tra worker và precache       |
| Vercel không gọi được API             | Kiểm tra HTTPS tunnel đang chạy; URL API; domain CORS                    |
| Có mạng nhưng phiếu chờ               | Kiểm tra backend/database; online không bảo đảm API truy cập được        |
| Backend không chạy                    | Kiểm tra Java 21, DB_PASSWORD, PostgreSQL và cổng                        |
| Sửa code nhưng vẫn giao diện cũ       | Build lại; ở Cài đặt kiểm tra cập nhật; giữ nháp đã lưu trước khi reload |
| Camera plugin không hoạt động         | Chạy `npm run android:sync`, Gradle Sync, mở app native                  |
| Dữ liệu local không thấy ở domain mới | Mỗi origin có IndexedDB riêng; dùng lại đúng URL/thiết bị                |
| HTTP 409                              | UUID đã nhận có nội dung khác; không đánh dấu phiếu là đã gửi            |
