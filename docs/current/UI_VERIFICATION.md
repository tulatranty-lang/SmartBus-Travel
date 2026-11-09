# Nghiệm thu SmartBus 3 — Windows, 09/11/2026

Mã nguồn nối tiếp nhánh `codex/complete-smartbus`, nền giao diện tại commit `1ddeaf7`. Môi trường thực thi: Windows, Node.js 24.16.0, npm 11.6.0, Microsoft Edge qua Playwright 1.62.1, SQL Server 17.0.1145.4 Enterprise Developer Edition. SQL mới và kiểm thử dùng các database riêng; không thay đổi `SmartBusDB` đã có trên máy.

## Kết quả

| Nhóm | Kết quả thực thi |
|---|---|
| Build React/TypeScript | `npm run build` thành công; 20 tệp production đồng bộ sang GitHub Pages |
| Kiểm tra mã và đồng bộ | TypeScript, kiểm tra backend, JS parse và Pages đồng bộ đều qua |
| Kiểm thử React/API client/import | **51/51**, ba nhóm Vitest; API giả lập riêng trong unit test |
| Unit/API và phục vụ giao diện | **72/72**, 13 nhóm Jest; gồm bốn kiểm thử giao diện production, MIME, worker/CSP, runtime config và cô lập tệp bí mật |
| Nghiệp vụ SQL thật | **28/28** nhóm, [báo cáo](ui-sql-test-results.json) |
| Nâng cấp SQL thật | **5/5**, [báo cáo](ui-upgrade-test-results.json) |
| Trình duyệt + SQL thật | **12/12** nhóm, không có exception JavaScript hoặc vi phạm CSP; [báo cáo](ui-browser-results.json) |

Các con số SQL là nhóm kịch bản; không cộng chung như số lượng test case nguyên tử. Số `ms` trong báo cáo không phải kết quả đo tải hoặc cam kết tốc độ. Các báo cáo cũ vẫn giữ để phân biệt kết quả giữa các lần bàn giao.

## Luồng đã thao tác trong Edge

1. Trang chủ đọc địa điểm/thống kê thật, ảnh nội bộ tải được, bản đồ thu nhỏ mở khi cuộn đến.
2. Ctrl+K tìm địa điểm, mở đúng chi tiết SQL, Escape đóng hộp thoại.
3. Chi tiết tuyến mở đúng tuyến và hình học trên bản đồ WebGL, worker cùng origin tải được.
4. Nhập tọa độ của bến và nhận đúng bến gần nhất từ SQL; không giả tọa độ thiết bị.
5. Đăng ký tài khoản mới, phiên không ghi nhớ nằm trong sessionStorage.
6. Lưu địa điểm, tải lại trang vẫn còn trong yêu thích, sau đó bỏ lưu.
7. Tạo lịch trình, xác nhận đã lưu vào SQL, thu gọn/mở lại, xem các điểm trên bản đồ và mở lại trong lịch sử.
8. Gửi trải nghiệm; bài ở trạng thái pending chưa hiện trong danh sách công khai.
9. Chat Hội An trả lời từ dữ liệu thật, không tự bật xin vị trí.
10. Người dùng thường bị chặn quản trị. Cấp quyền cho đúng tài khoản thử qua CLI, đăng nhập lại, duyệt bài và xác nhận bài xuất hiện công khai.
11. Các trang chính ở 390 px, menu mobile, hộp thoại ở 320 px không tràn ngang. Đây là viewport thật trong Edge, chưa phải thiết bị cảm ứng vật lý.
12. Tắt WebGL trong ngữ cảnh trình duyệt thử; Leaflet 2D vẫn vẽ tuyến/điểm từ SQL thật.

Ảnh: [trang chủ desktop](images/ui-v3-home-desktop.png), [mobile](images/ui-v3-home-mobile.png), [bản đồ](images/ui-v3-map.png), [lịch trình](images/ui-v3-planner.png), [quản trị](images/ui-v3-admin.png), [bản đồ dự phòng](images/ui-v3-map-fallback.png).

## Các vấn đề đã phát hiện và sửa khi chạy

- CSS của MapLibre ghi đè `position` của vùng bản đồ, tạo vùng vẽ không có chiều cao. Quy tắc kích thước giờ có độ ưu tiên đủ cho cả MapLibre và Leaflet.
- Liên kết từ lịch trình mở nhầm lớp tuyến xe. Nay chuyển sang lớp điểm đến và bao khung các điểm; đổi khu vực bỏ bộ lọc tuyến cũ.
- CSP chưa cho kết nối OpenFreeMap. Nay chỉ thêm đúng máy chủ bản đồ và worker cùng origin, không bật `unsafe-eval`.
- Seed SQL lớn vượt timeout API 15 giây trên Windows. Migration có timeout riêng mặc định 120 giây và giữ transaction/checksum; chạy lại đã hoàn tất 13 file. Không sửa SQL lịch sử hoặc xóa database để né lỗi.
- Một dòng chữ ở banner có màu quá nhạt trên nền sáng; đã đổi màu dễ đọc hơn.

## Chạy lại

`npm run setup` cài dependencies và dựng giao diện. `npm run build`, `npm run check`, `npm test` kiểm tra mã/build/unit. Trên môi trường hạn chế tệp tạm Windows, Jest có thể cần thư mục cache ghi được (`npm --prefix backend-api test -- --cacheDirectory ../.artifacts/jest`).

Các kiểm thử SQL và browser cần `DB_NAME` của database thử, `SMARTBUS_TEST_DATABASE` bằng đúng tên đó, `SQL_TEST_DISPOSABLE=1`. Làm theo README để nạp dữ liệu và chạy `npm run test:sql`, `npm run test:browser`. Công cụ browser tự mở cổng HTTP ngẫu nhiên và chỉ dùng tài khoản do nó tạo; không dùng tài khoản thật của người sử dụng. CI chạy build, unit/API, SQL, upgrade và browser riêng; trạng thái chạy từ xa phải xem trực tiếp trên PR.

## Giới hạn còn lại

- Đã chạy mã khởi động Node trên Windows; chưa chạy trọn bộ `setup.cmd`/`start.cmd` tương tác hoặc Docker image. Dockerfile đã bổ sung bước build React nhưng chưa nghiệm thu container cục bộ.
- Chưa kiểm mọi biểu mẫu GUI quản trị/hồ sơ, mọi tổ hợp bộ lọc hoặc trình đọc màn hình. CRUD/import/quyền sở hữu của API có kiểm thử SQL; điều đó không chứng minh mọi biểu mẫu đã được thao tác trong browser.
- Chưa nghiệm thu GPS ngoài thực địa, iOS/Android thật, mạng di động chậm, tải đồng thời hoặc độ chính xác lịch chạy/giá vé hiện hành. Dữ liệu tuyến vẫn là dữ liệu tham khảo, không có feed ETA/telemetry trực tiếp.
- Chưa đưa lên production hoặc gộp vào main. GitHub Pages chỉ có frontend và cần API HTTPS + SQL riêng; không coi việc dựng được `docs` là backend đã online.
- MapLibre còn bundle lớn, nhưng chỉ tải khi cần bản đồ; build vẫn có cảnh báo kích thước chunk. Cảnh báo runtime-config không được bundle là dự kiến vì Express cung cấp tệp này lúc chạy.
- Chưa thay cơ chế token browser storage bằng cookie HttpOnly. Các giới hạn bảo mật/phụ thuộc ở báo cáo API cũ vẫn cần được cân nhắc khi triển khai production.
