# Thuật toán SmartBus đang thực thi

Bản này dùng các bộ luật và hàm điểm xác định, chưa dùng mô hình học máy hoặc chứng minh tối ưu toàn cục. Metadata/tọa độ nguồn có độ tin cậy khác nhau; kết quả là tham khảo.

## Tìm bến

`modules/stop/stop.repository.js` lấy điểm dừng có tọa độ hợp lệ từ SQL và lọc tuyến nếu được chọn. Khoảng cách Haversine theo bán kính Trái Đất 6.371 km; sai số số thực ở hai điểm đối cực được clamp về [0,1]. Cùng tọa độ phải là 0 m. Dữ liệu null/chuỗi rỗng/boolean không được biến thành vị trí thực. Khoảng cách đường chim bay khác quãng đường đi bộ; chỉ dẫn OSM/OSRM là dịch vụ mạng bên ngoài, không tự động trở thành tuyến vận hành chính thức.

## Chọn điểm cho lịch trình

`modules/trip/trip.service.js`:

1. Xác định khu vực: lựa chọn rõ ràng → từ khóa địa danh → anchor gần tọa độ hiện tại. Nếu thiếu, bộ chọn mặc định DN. Khu vực rõ ràng là ràng buộc cứng; không đủ điểm thì trả ít điểm hoặc rỗng, không chuyển tỉnh âm thầm.
2. Lấy tối đa 60 ứng viên SQL theo khu vực, batch enrich bến/tuyến. Cache 3 phút theo khu vực, sở thích, vị trí, thời lượng, ngân sách; không dùng cache của vị trí khác.
3. Chia slot: nửa ngày 2 điểm; 1 ngày 4; 2 ngày 6; 3 ngày 8. Chọn greedy từng điểm tiếp theo từ vị trí trước, không lặp ID hoặc tên chuẩn hóa.
4. Minimize điểm:

   `18 × thứ_tự_ưu_tiên_loại + min(45, 1.4 × km_từ_điểm_trước) + 30 × số_lần_lặp_loại_vượt_1 − (3 × rating + min(12, reviewCount/8)) − 8 × có_liên_kết_bus + điều_chỉnh_bữa_ăn`

   Điểm thấp hơn được chọn trước. Slot ăn uống có điều chỉnh −12 khi có metadata món ăn/loại phù hợp. Đây là hệ số kinh nghiệm, không phải độ tin cậy đã được học/đánh giá độc lập.
5. Lưu trip_plans và tất cả trip_plan_items cùng transaction khi người dùng đăng nhập. Tính giờ lưu trú/di chuyển ước lượng theo metadata và khoảng cách; không kiểm tra giờ mở cửa, vé còn chỗ hoặc chuyến cuối thực tế. Ngân sách hiện mới là tín hiệu sở thích/cache; chưa phải ràng buộc tổng chi phí đã tối ưu.

Bộ dữ liệu có rating/review tham khảo kế thừa; không coi chúng là đánh giá người dùng đã được xác minh. Không sinh rating mặc định 4.5/4.6 khi chưa có dữ liệu.

## Chat tiếng Việt

`modules/chat/chat-intent.service.js` chuẩn hóa chữ thường, dấu tiếng Việt rồi nhận diện intent (chào, giá vé, lịch chạy, thống kê, review, lịch trình, GPS, món ăn, du lịch, bến gần, ETA, tuyến). Giá vé được xử lý trước câu “bao nhiêu” để không nhầm sang thống kê; từ “hi” có biên từ để không nhầm “khi nào” thành chào.

Entity gồm mã tuyến, địa danh/khu vực và thời lượng. Tên tỉnh nêu rõ ưu tiên hơn landmark trùng tên. Với câu hỏi đi tới địa danh đã nhận diện, query có scope khu vực và tên điểm đến phải khớp tên ứng viên, không chỉ được nhắc tình cờ trong tips của một điểm khác. Câu hỏi lịch trình/giá vé không đi qua nhánh chọn một địa điểm trước.

Bảng alias landmark/tuyến là quy tắc tham khảo từ dữ liệu dự án, chưa phải NLU tổng quát. Khi thiếu nguồn trả thông báo thiếu dữ liệu; không tạo ETA 12 phút mặc định hoặc giả vờ có feed xe trực tiếp. Rasa chỉ được gọi nếu cấu hình RASA_URL; bộ kiểm thử hiện tại không chạy Rasa.

## Cache, phân trang và chống thao tác lặp

- Tourism dùng một bộ điều kiện SQL cho tổng và danh sách, lọc tuyến/GPS trước OFFSET.
- Mỗi trang ứng viên có thể được sắp lại theo điểm enrich trong phạm vi trang; đây chưa phải ranking toàn bộ corpus theo khoảng cách.
- Frontend GET cache có khóa theo user; mutation và refresh xóa cache để tránh tái sử dụng dữ liệu tài khoản khác.
- Refresh frontend coalesce các request đồng thời; backend chỉ consume refresh cũ một lần.
- Favorite kiểm tra tồn tại và ghi idempotent với khóa giao dịch; hai bảng yêu thích kế thừa được ghi/bỏ lưu nguyên khối.
- Cache hiện nằm trong RAM của từng Node process; chưa có Redis, hạn mức tổng bộ nhớ hoặc điều phối nhiều replica. Chưa nên suy ra khả năng vận hành quy mô lớn từ test này.
