# Báo cáo kiểm thử và bàn giao

Bản làm việc: nhánh `codex/complete-smartbus`, bắt đầu từ `4d0db32`. Các số liệu dưới đây là kết quả thực thi, không suy ra từ việc chỉ đọc code. Môi trường: Linux, Node.js 24.22.1, npm 11.9, SQL Server 2022 16.0.4212.1; trình duyệt Chrome. Database thử riêng, không kết nối database sản xuất của chủ dự án.

## Đã sửa

- Cài dependencies từ public registry, giữ lock; loại multer không sử dụng và parser xlsx cũ; CLI XLSX chuyển sang ExcelJS (dev tool). Cập nhật dependencies tương thích và override qs 6.17.1. Không hạ Jest/ép major version để che audit.
- Frontend chuẩn `frontend/` đồng bộ sang `docs/` bằng script; API cùng origin và cấu hình runtime; phục vụ static chỉ trong frontend, không lộ thư mục SQL/cấu hình.
- Migration tự động: 13 file cài mới, transaction/khóa/checksum, sửa view06 bằng migration12; không sửa SQL lịch sử. Loại `.env` khỏi bản mã được theo dõi.
- Xác thực đọc lại role/trạng thái/session version từ SQL; refresh độc nhất trong cùng giây, xoay atomic; thu hồi phiên; quản trị viên được cấp từ CLI, không có mật khẩu mặc định.
- Yêu thích ghi idempotent và đồng bộ hai bảng kế thừa trong transaction; kiểm tra đối tượng tồn tại; không đọc bản lưu người khác.
- Bài pending không còn lộ qua detail public; duyệt/ẩn có hiệu lực; CRUD địa điểm admin và import JSON được nối SQL thay stub.
- Tourism dùng cùng predicate cho count/rows và lọc trước phân trang. Lịch trình không đổi sang dữ liệu tĩnh khi SQL lỗi; plan/items lưu nguyên khối.
- Trang chủ nạp tuyến/du lịch thật từ API trước đăng nhập; sửa thống kê giả/double-count khu vực, ký tự thừa, nút quên mật khẩu chưa hoạt động, nhãn form, Esc/focus trap và khoảng cách mobile.
- Không tự xin GPS khi gửi chat thông thường; chỉ dùng vị trí đã cấp. Bỏ ETA 12 phút và số hành khách ngẫu nhiên; simulation mặc định tắt, dữ liệu xe ghi rõ tham khảo.
- Sửa chat chọn sai điểm vì mô tả nhắc địa danh, nhầm giá vé thành thống kê, “khi” thành chào, lịch trình bị nhánh điểm đến chặn, “null phút” trên thẻ.

## Kết quả thực thi

| Nhóm | Kết quả | Bằng chứng |
|---|---|---|
| Cài dependencies từ lock | `npm ci`: 668 packages, thành công sau cập nhật | package-lock public, không cần registry nội bộ |
| Syntax/static | 182 file JS parse thành công; 37 asset frontend/docs giống nhau | `npm run check` |
| Unit/API dùng mock | **68/68**, 12 suites | [unit-api-test-results.json](unit-api-test-results.json) |
| Nghiệp vụ SQL thật | **28/28** nhóm kịch bản | [sql-test-results.json](sql-test-results.json) |
| Nâng cấp SQL | **5/5** | [upgrade-test-results.json](upgrade-test-results.json) |
| Audit dependencies production | **0** cảnh báo được npm ghi nhận lúc chạy | [dependency-audit.json](dependency-audit.json) |
| Audit gồm công cụ phát triển | 13 cảnh báo: 6 low, 7 moderate, 0 high/critical | [dependency-audit-all.json](dependency-audit-all.json) |
| Trình duyệt desktop | Trang chủ, dữ liệu tuyến/du lịch, lọc/clear, auth modal trống/Esc, chat Hội An | Kiểm tra trực tiếp Chrome |
| Responsive 390px | Trang chủ, auth modal, chat mở/đóng; content 386px trong viewport 390px, không tràn ngang | [ảnh mobile](images/smartbus-mobile.png), [form mobile](images/smartbus-mobile-login.png) |

Ảnh responsive được chụp ứng dụng thật trong iframe cùng origin rộng 390px, không phải giả lập thiết bị GPS/cảm ứng vật lý. Desktop đo content 1359px trong viewport 1363px. Đã quan sát trạng thái database chưa sẵn sàng: thống kê “—”, báo lỗi và nút thử lại; sau nối SQL đã tải tuyến và địa điểm đúng. Browser log lỗi extension nội bộ được tách khỏi lỗi ứng dụng.

## Các trường hợp đã bao phủ

### Unit/API mock

- Password bcrypt dài theo byte UTF-8; email/password sai; hash không trả về client; JWT sai chữ ký, hết hạn, loại refresh dùng như access, ID không hợp lệ, session version cũ, tài khoản khóa.
- Role giả trong claim không nâng quyền so với database; admin endpoints từ chối user, personal endpoints yêu cầu login.
- Haversine 0 m và đối cực; anchor tỉnh đúng; tỉnh ràng buộc cứng; lịch trình không lặp; ứng viên rỗng; nguồn database lỗi trả 503 thay vì điểm đến dự phòng.
- Import JSON rỗng/quá 200 dòng/đường dẫn máy chủ, mã trùng, GPS null/rỗng/boolean/ngoài vùng; XLSX header tiếng Việt, ô trống; CSV dấu phẩy/newline trong quote; báo lỗi `.xls` nhị phân không hỗ trợ.
- Migration chia batch GO không tách literal, DB_NAME không được chèn SQL.
- Chat tách giá vé/lịch chạy/thống kê/lịch trình/bến gần/ETA, phân biệt Mỹ Khê theo tỉnh, không chọn điểm chỉ có mô tả nhắc đích.
- JSON lỗi cú pháp trả 400; CORS chỉ trả allow-origin cho origin đã cấu hình; rate limit trả 429 JSON/Retry-After, X-Forwarded-For giả không đổi giới hạn IP. Test XFF tạo diagnostic `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` dự kiến vì trust proxy mặc định tắt; không phải test thất bại.

### SQL thật, không mock repository

- Tạo database mới `SmartBusCleanTest`, chạy đủ schema/import; journal 13 file. Rerun áp dụng 0 file.
- Đăng ký ghi bcrypt thật, email trùng 409, login sai/injection bị chặn; profile hiện tại; hai refresh đồng thời chỉ một thành công, replay thất bại.
- User không vào admin; grant admin giữ mật khẩu và vô hiệu token cũ; tài khoản khóa bị từ chối ngay.
- Query tuyến/du lịch/nearest/GeoJSON, trang rỗng/limit âm/detail không tồn tại, tọa độ sai.
- Favorite lặp, ba thao tác đồng thời không nhân đôi; hai nhóm endpoint cho cùng bản lưu; tài khoản khác không nhìn thấy; đối tượng thiếu bị 404.
- Bài cộng đồng mới pending, strip HTML, tác giả thấy nhưng public 404; duyệt public 200, ẩn lại 404.
- Admin tạo/sửa/ẩn địa điểm; query public không bật được includeInactive.
- Import lỗi toàn batch không ghi nửa chừng; import JSON hợp lệ lưu SQL và import_history.
- Lịch trình chỉ trong tỉnh chọn, số item khi lưu và đọc khớp; khác chủ sở hữu nhận 404; xóa của mình; item FK lỗi rollback cả parent.
- Chat phản hồi/lịch sử cá nhân, Hội An đúng đích, giá vé và lịch trình đúng intent; không tạo ETA trực tiếp.
- Logout thu hồi access/refresh; static root trả app/CSP, `.env` và SQL qua HTTP 404; runtime-config chỉ có API prefix/simulation.

### Nâng cấp dữ liệu cũ

`tests/sql/upgrade.js` tạo database thử từ schema trước migration12, thêm tài khoản và lịch sử sentinel, rồi thêm đúng một migration12. Hash mật khẩu và lịch sử còn nguyên, session version được thêm; chạy lại 0 file; cố ý đổi checksum trong **journal database thử** bị từ chối. Không sửa file SQL đã áp dụng để làm test xanh, không drop dữ liệu để né lỗi. Checksum journal dạng CRLF từ Windows cũng được kiểm tra và chấp nhận khi nội dung SQL không đổi.

## Chưa xác minh / giới hạn

- Chưa chạy `.cmd/.ps1` trên Windows thật, Docker image hoặc production deployment. Hướng dẫn phù hợp stack hiện có nhưng không được coi là bằng chứng các môi trường này đã chạy.
- Chưa hoàn tất luồng GUI sau đăng nhập/admin trong trình duyệt; các endpoint tương ứng đã chạy với SQL thật. Không dùng phiên đăng nhập hoặc tài khoản thật của chủ dự án để thử.
- Chưa kiểm thử thiết bị iOS/Android vật lý, GPS thực địa, màn hình đọc, mọi mức zoom hoặc tất cả breakpoint.
- Chưa load test nhiều người dùng, tối ưu DB plan toàn bộ, pentest độc lập, kiểm toán bảo mật đầy đủ. Thời gian `ms` trong JSON là thời gian từng **nhóm kịch bản** ở DB thử nóng, không phải SLA hoặc latency benchmark production.
- Dữ liệu tham khảo lịch sử chưa xác nhận với nhà vận hành về lịch chạy/giá vé hiện hành; review seed được giữ/đánh dấu; không có feed GPS/ETA trực tiếp.
- Chat là bộ luật hữu hạn, Rasa chưa chạy. Chưa có reset mật khẩu bằng email, 2FA, cookie HttpOnly/BFF, Redis, audit bền vững hoặc tối ưu lịch trình tổng chi phí/giờ mở cửa.
- Audit còn cảnh báo ở dependencies **dev** (Jest/deepmerge, nodemon/minimatch, c8/glob, ExcelJS/uuid); không nằm trong install `--omit=dev` của server. Không coi audit production 0 là chứng minh không còn lỗ hổng.
- GitHub Pages vẫn cần backend/SQL riêng và CORS đúng. Endpoint Render cũ chưa được xác minh; bản này chưa được public online.
- Cấu trúc kế thừa vẫn có scaffolding/tài liệu cũ và route review đặt tên lẫn hai loại nội dung. Xem ARCHITECTURE trước khi thêm tính năng.

## Hướng phát triển tiếp theo

Ưu tiên chạy nghiệm thu Windows/thiết bị thật và toàn bộ GUI đã đăng nhập, tách API community/place reviews, thay token browser storage bằng thiết kế session HttpOnly/BFF có CSRF, bổ sung nguồn GTFS/telemetry chính thức, kiểm tra lịch mở cửa và tổng chi phí. CI đã bổ sung job SQL cài mới/nâng cấp trên container dùng mật khẩu ngẫu nhiên; kết quả remote phải xem ở PR, không suy ra từ cấu hình workflow.
