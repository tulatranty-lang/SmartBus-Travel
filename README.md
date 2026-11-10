# SmartBus Travel Connect

Ứng dụng web tra cứu xe buýt và du lịch miền Trung: tuyến/điểm dừng trên bản đồ, bến gần vị trí, địa điểm du lịch, gợi ý lịch trình, trợ lý tiếng Việt, lưu yêu thích và quản trị nội dung.

**SmartBus 3:** React 19 + TypeScript + Vite, TanStack Query, Radix UI, Motion, MapLibre/OpenFreeMap và Leaflet dự phòng; API Node.js/Express + Microsoft SQL Server. Các thư viện giao diện là mã nguồn mở, không yêu cầu API key bản đồ. Giao diện mới và API chạy chung một server; người dùng đăng ký/đăng nhập để lưu chuyến đi.

Giao diện mới nằm trong `web/src`, được dựng vào `frontend/app` và mở ngay tại `/`. Bản HTML cũ vẫn có tại `/legacy/`. Xem [các thay đổi giao diện](docs/current/UI_UPGRADE.md) và [nghiệm thu SmartBus 3 trên Windows](docs/current/UI_VERIFICATION.md).

Dữ liệu tuyến và tọa độ được nhập từ bộ tài liệu sẵn có trong repository. Đây là dữ liệu tham khảo, chưa phải feed vị trí xe/giờ đến trực tiếp từ đơn vị vận hành. Tên khu vực có Quảng Nam cũ và tuyến liên vùng; không dùng số khu vực như số đơn vị hành chính hiện hành. Bài review mẫu cũ được đánh dấu `is_seed`/“Bài mẫu”.

**Mô phỏng đường phố:** mở `/#/simulation` để xem đoạn Cầu Rồng → Võ Văn Kiệt → Võ Nguyên Giáp trên nền hình học OSM, với xe điện Kim Long 40 người tham chiếu tuyến 06. Có ba tình huống, bám xe IDM, giới hạn tăng tốc/độ êm, phanh theo độ cong, theo dõi hai trục khi cua, chờ đèn và mở cửa theo số khách. Bảng “Nguồn & độ chính xác” ghi từng nguồn Danabus, Báo Đà Nẵng, hãng xe và mạng xã hội chính thức; thông số ước tính được đánh dấu. Đây là mô phỏng, chưa có GPS xe trực tiếp và chưa nghiệm thu mép đường. Xem [cấu hình và kết quả kiểm tra](docs/current/SIMULATION_RELEASE.md).

## Chạy trên Windows

Cần Node.js 24 LTS (tối thiểu 22.12), SQL Server Developer/Express 2022 trở lên và TCP/IP của SQL Server được bật. SSMS chỉ là công cụ quản trị; cài SSMS không đồng nghĩa đã cài SQL Server. Không cần Apache hoặc XAMPP.

1. Clone và tạo cấu hình riêng:

   ```powershell
   git clone https://github.com/tulatranty-lang/SmartBus-Travel.git
   cd SmartBus-Travel
   node scripts/configure.js
   notepad backend-api\.env
   ```

2. Điền thông tin SQL Server của bạn trong `backend-api/.env`:

   ```dotenv
   DB_SERVER=localhost
   DB_PORT=1433
   DB_NAME=SmartBusDB
   DB_USER=sa
   DB_PASSWORD=mat_khau_sql_cua_ban
   DB_ENCRYPT=false
   DB_TRUST_SERVER_CERTIFICATE=true
   PORT=5000
   ```

   Script cấu hình tự sinh hai JWT secret ngẫu nhiên và giữ nguyên secret riêng đã có. SQL login cần quyền tạo database ở lần cài mới hoặc quản trị viên tạo database trước. Với named instance, dùng `DB_SERVER=localhost\SQLEXPRESS` và cấu hình SQL Browser/TCP thích hợp; cổng TCP cố định dễ kiểm tra hơn.

3. Chạy từ thư mục dự án:

   ```powershell
   .\setup.cmd
   .\start.cmd
   ```

4. Mở **http://localhost:5000**. Giữ cửa sổ server đang chạy; Ctrl+C để dừng. Dùng nút Đăng ký để tạo tài khoản riêng. Không có tài khoản admin/mật khẩu mặc định.

Các lệnh tương đương, dùng được trên Linux/macOS:

```bash
npm run setup
npm run db:setup
npm start
```

`setup` cài dependencies của API và giao diện theo lock, rồi dựng SmartBus 3; `db:setup` tạo schema và nạp dữ liệu tham khảo; `db:migrate` áp dụng schema mới mà không chạy lại bộ import đã có journal. Migration chạy trong transaction, có khóa chống chạy đồng thời và checksum. Chạy lại thành công phải báo `0 file(s) applied`. Tệp seed lớn có thời gian chờ riêng `DB_MIGRATION_TIMEOUT_MS` (mặc định 120 giây), không kéo dài timeout API. Không sửa các SQL đã được ghi journal và không xóa database để né lỗi.

**Database cũ:** sao lưu trước nâng cấp; giữ nguyên `DB_NAME`, tài khoản và mật khẩu. Chạy `npm run setup`, rồi `npm run db:migrate`. Khi database chưa có `smartbus_migrations`, CLI chạy các SQL lịch sử có điều kiện để bổ sung schema. Bộ import tham khảo có cập nhật lại một số liên kết tuyến–bến, vì vậy chỉ dùng `--seed` khi chủ động cài/import dữ liệu. Kiểm thử nâng cấp có giữ hash mật khẩu và lịch sử hoạt động; không thể coi đó là kiểm chứng mọi database cũ tùy biến.

## Vào quản trị

Đăng ký tài khoản trên web trước, sau đó người quản trị máy chủ chạy:

```powershell
node backend-api/scripts/admin.js grant email-cua-ban@example.com
```

Đăng nhập lại, mở **Quản trị** trong menu. Admin có thể duyệt/từ chối review và bài cộng đồng, tìm/tạo/sửa/ẩn địa điểm, xem hoạt động. Quyền được đọc từ database mỗi request; đổi quyền/khóa tài khoản có hiệu lực với phiên đang dùng. Lệnh grant không đặt lại mật khẩu.

Thu hồi quyền: `node backend-api/scripts/admin.js revoke EMAIL`. CLI ngăn thu hồi admin hoạt động cuối cùng. Tạo admin trực tiếp chỉ khi đặt rõ `ADMIN_EMAIL` và `ADMIN_PASSWORD` riêng (12–72 byte) rồi chạy `node backend-api/scripts/admin.js create`; không đưa các giá trị này lên Git.

## Các chức năng và đường đi của dữ liệu

| Chức năng | Luồng chính | Nơi mở rộng |
|---|---|---|
| Đăng ký/đăng nhập/đăng xuất | React AuthDialog → `/auth/*` → auth service/repository → users, refresh_tokens | `web/src/api.ts`, `web/src/state.tsx`, `backend-api/modules/auth` |
| Tuyến, điểm dừng, bản đồ | ExplorePages → `/routes`, `/stops`, `/map/*` → SQL → JSON/GeoJSON → MapLibre hoặc Leaflet | `web/src/components/TransitMap.tsx`, `modules/route`, `stop`, `map` |
| Du lịch | PlacesPage → `/tourism/places` → bộ lọc SQL, count cùng điều kiện, batch liên kết bến/tuyến → thẻ địa điểm | `web/src/pages/ExplorePages.tsx`, `modules/tourism` |
| Yêu thích | Token Bearer → `/favorite-*` hoặc alias tourism → kiểm tra tồn tại → ghi transaction → đọc theo user ID | `modules/favorites` |
| Lịch trình | POST `/trip-plans/generate` → lọc tỉnh, chấm điểm và chọn tuần tự → lưu plan + items nguyên khối | `modules/trip` |
| Trợ lý | `/chatbot/ask` → nhận diện intent/entity → dữ liệu SQL theo mục đích → câu trả lời và lịch sử | `modules/chat` |
| Review/quản trị | Review mới → pending → admin kiểm duyệt → chỉ approved công khai | `modules/review`, `community`, `admin` |
| Nhập dữ liệu quản trị | JSON tối đa 200 dòng → validate toàn bộ → transaction upsert → import_history | `modules/import` |

Đăng xuất thu hồi toàn bộ phiên của tài khoản. Token refresh xoay vòng, chỉ một request đồng thời được dùng token cũ. Mật khẩu bcrypt; password đăng ký tối đa 72 byte UTF-8. Token refresh lưu dạng SHA-256 trong database. Client hiện lưu token theo lựa chọn ghi nhớ trong browser storage; đây vẫn là bề mặt rủi ro nếu có XSS và chưa thay bằng mô hình cookie HttpOnly/BFF.

## Cấu trúc

```text
web/src/                   Mã nguồn React/TypeScript của SmartBus 3
web/public/                Ảnh có ghi nguồn, favicon, cấu hình API cho static host
frontend/app/              Giao diện production do npm run ui:build tạo (không commit)
frontend/                  HTML/JS cũ, phục vụ tại /legacy/
backend-api/server.js      HTTP entry point, hỗ trợ PORT/--port
backend-api/app.js         Middleware, route mounting, runtime-config, static frontend
backend-api/config/        Môi trường, SQL connection pool
backend-api/common/        Auth/RBAC, validate, error, cache, GIS, pagination
backend-api/modules/       Controller → service → repository theo nghiệp vụ
backend-api/services/      Data service kế thừa, truy cập SQL
backend-api/scripts/       Migration, admin, công cụ import CLI
backend-api/tests/         Unit/API mock và SQL integration tách biệt
scripts/                   Cấu hình, khởi động Windows, đồng bộ GitHub Pages
database/                  SQL lịch sử bất biến + migration mới
docs/current/              Tài liệu và bằng chứng kiểm thử bản này
docs/                      Bản build SmartBus 3 cho GitHub Pages và tài liệu lịch sử
rasa-smartbus-bot/          Tích hợp Rasa tùy chọn; không cần cho bộ luật chat hiện tại
```

`backend-api/src/`, các báo cáo `README_*`/patch cũ là phần kế thừa, không phải entry point mới. Xem [kiến trúc/ERD/API](docs/current/ARCHITECTURE.md), [thuật toán](docs/current/ALGORITHMS.md), [kiểm thử và giới hạn](docs/current/VERIFICATION.md).

Sau khi sửa `web/src`, chạy `npm run build` để dựng lại giao diện và cập nhật GitHub Pages. Không sửa các tệp sinh tự động trong `frontend/app` hoặc `docs/assets`. Khi phát triển, chạy API bằng `npm run dev` và Vite bằng `npm run dev:web` ở cửa sổ khác; Vite chuyển tiếp API đến cổng 5000.

## Kiểm tra

```bash
npm run build
npm run check
npm test
```

SQL integration **chỉ dành cho database thử riêng**, có cấu hình DB_* trỏ vào đó. Ví dụ PowerShell:

```powershell
$env:DB_NAME="SmartBusQaTest"
$env:SQL_TEST_DISPOSABLE="1"
$env:SMARTBUS_TEST_DATABASE="SmartBusQaTest"
node backend-api/scripts/migrate.js --seed
npm run test:sql
```

Không trỏ test vào database đang sử dụng: test tạo tài khoản, nâng quyền, nhập dữ liệu và tạo nội dung. Chạy migration upgrade test bằng database khác có tên chứa `Upgrade` và `Test`: `node backend-api/tests/sql/upgrade.js`; lần đầu phải là database mới. Các test mock không chứng minh SQL đang hoạt động. Báo cáo hiện tại ghi riêng kết quả thật.

Kiểm tra trình duyệt với cùng cấu hình database thử ở trên: `npm run test:browser`. Công cụ tự mở HTTP ở cổng ngẫu nhiên và Edge trên Windows; trên Linux cần chạy `npx --prefix web playwright install --with-deps chromium` trước. Nó dùng SQL thật để đăng ký, lưu địa điểm, tạo lịch trình và kiểm duyệt bài của tài khoản thử; ảnh và báo cáo nằm trong `.artifacts/browser`.

## GitHub Pages và chạy online

Khuyến nghị chạy **cùng origin**: `npm start` phục vụ frontend và API; `/runtime-config.js` tự nhận API prefix. Không cần sửa JavaScript khi đổi domain chung.

GitHub Pages phục vụ bản công khai tại [SmartBus Travel](https://tulatranty-lang.github.io/SmartBus-Travel/#/simulation), không chạy Node.js/SQL Server. Bản này xem được mô phỏng, 39 tuyến, 243 điểm nguồn riêng biệt và 60 điểm du lịch từ dữ liệu đã có trong Git, không xuất tài khoản hoặc nội dung SQL cá nhân. 298 vị trí theo thứ tự các tuyến được giữ nguyên. Chạy `npm run data:public` khi chủ động cập nhật bộ dữ liệu công khai; CI kiểm tra tính nhất quán. Các đường nối điểm nguồn ở trang Khám phá được vẽ nét đứt, không được nhận là đường hoặc làn đã xác thực.

Sau sửa giao diện, chạy `npm run build`; CI kiểm tra bản dựng và tài nguyên trong `docs` giống nhau. Đường dẫn tương đối và HashRouter hỗ trợ `/SmartBus-Travel/`. Tài khoản, lưu hành trình và gửi nội dung cần backend. Để dùng backend HTTPS trên Pages, đặt URL API vào `web/public/runtime-config.js` rồi dựng lại; backend cần `CORS_ORIGIN=https://tulatranty-lang.github.io`. Có thể đặt `window.SMARTBUS_PUBLIC_SNAPSHOT=false` để tắt chế độ dữ liệu công khai khi dùng cấu hình riêng. Bản Express cùng origin dùng SQL như trước, không tự chuyển sang dữ liệu công khai khi máy chủ gặp lỗi.

Dockerfile tại **thư mục gốc** đóng gói cả API, frontend và migration; kết nối tới SQL Server riêng. Trước khi public đặt `NODE_ENV=production`, hai JWT secret khác nhau đủ dài, DB account riêng, TLS và CORS origin đúng. Không đóng gói `.env`, token hoặc dữ liệu phiên. Docker image chưa được chạy trong môi trường kiểm thử hiện tại. Không có cam kết dịch vụ miễn phí lâu dài trong bản này.

## Xử lý lỗi thường gặp

| Triệu chứng | Cách kiểm tra |
|---|---|
| `node`/`npm` không nhận diện | Cài Node.js LTS, mở terminal mới |
| SQL không kết nối | Bật SQL service/TCP, kiểm tra cổng bằng `Test-NetConnection localhost -Port 1433`, SQL Authentication và DB_* |
| `Migration checksum changed` | Khôi phục đúng SQL đã áp dụng từ Git/backup; thêm migration mới, không sửa journal để bỏ qua |
| Login thành công nhưng bị 401 sau nâng quyền | Đăng nhập lại; phiên cũ đã bị thu hồi đúng thiết kế |
| Trang chủ không có dữ liệu | Kiểm tra `/api/v1/health/db`, chạy `db:setup` cho cài mới, nút Thử lại trên web |
| GPS không hoạt động | GPS cần HTTPS hoặc localhost, quyền vị trí trình duyệt và thiết bị có tín hiệu; không có tọa độ sẽ không tự đoán vị trí |
| Bản đồ nền/tuyến đường không tải | Leaflet/OSM/OSRM cần mạng; tọa độ và tuyến tham khảo vẫn khác dữ liệu vận hành trực tiếp |
| Cổng 5000 bị dùng | Đổi PORT trong `.env`, cập nhật origin cho host riêng rồi khởi động lại |

Công cụ import XLSX/CSV/JSON tại `backend-api/scripts/import-smartbus-data.js` cần bộ dependencies phát triển (cài mặc định bằng `npm ci`); `.xls` nhị phân cũ cần chuyển sang `.xlsx`. HTTP import chỉ nhận JSON đã validate, không đọc đường dẫn tệp trên máy chủ. Các cảnh báo audit dev còn lại được ghi rõ trong báo cáo kiểm thử.
