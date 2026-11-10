# Xe ước tính nằm ngay trong bản đồ chính

Ngày cập nhật 11/11/2026. Mở `/#/explore`. Màn hình `/#/simulation` chỉ giữ làm công cụ kiểm tra cũ, không còn là điểm vào chính.

## Những thay đổi có thể nhìn thấy

- Bản đồ chính hiển thị xe theo giờ Việt Nam, số xe trên đường và xe nghỉ đầu bến. Chọn xe từ bản đồ hoặc danh sách để xem hướng, điểm tuyến tiếp theo, thời gian đến và bám camera theo xe. Có góc nhìn 3D trên trình duyệt hỗ trợ.
- Chế độ **Hiện tại** tính theo đồng hồ thật. **Giờ xem** cho chọn thời điểm, nhảy 15 phút, dừng hoặc xem nhanh; được ghi rõ là giờ xem. Khi hết giờ, không tự dựng xe chạy đêm. Ví dụ `/#/explore?route=DN-06&at=08:00` cho cảnh ban ngày trên chính bản đồ này.
- Đã dựng 78 hình học đường riêng cho hai chiều của 39 bản ghi tuyến, tổng 99.908 đỉnh. Không vẽ đường thẳng nối các mốc thưa. Các biến thể lịch sử vẫn tra cứu được nhưng không đưa vào đội xe đang hoạt động.
- DN-06 dùng điểm khống chế trên đúng đường, tách theo chiều đường ở Nguyễn Văn Linh, Cầu Rồng, Võ Văn Kiệt, Võ Nguyên Giáp và đoạn phía nam. Bỏ vòng quay đầu do ép cả hai chiều vào cùng một điểm trên đường phân cách. Đường nội bộ sân bay/FPT chưa xác nhận đủ; hình dựng khoảng 18,6/18,4 km, khác cự ly dịch vụ công bố 21,3 km. Đây là hành lang lý thuyết, không phải hình tuyến đã nghiệm thu.
- Điểm tuyến mặc định được ghép lên hình đường để thống nhất vị trí với xe. Tọa độ gốc giữ nguyên trong các tệp nguồn, không bị sửa thành tọa độ đã ghép. Điểm tuyến chưa được xác nhận là biển trạm hoặc vỉa đón khách thật.

## Cách tính vị trí

`fleet.ts` chuẩn bị độ dài tích lũy của từng chiều và thời gian qua từng đoạn. Tốc độ chịu giới hạn theo độ cong; có tăng tốc/rà phanh, dừng tại mốc tuyến, dự phòng thời gian ở nút giao, hệ số chậm vào giờ cao điểm và 5 phút nghỉ đầu bến.

Lịch được lập từ đội xe hữu hạn: một xe chỉ xuất bến khi đã kết thúc chuyến trước và nghỉ đầu bến; sau đó chạy theo hình chiều ngược lại. Không sinh một xe mới cho mỗi nốt giờ, và không cho một xe xuất hiện ở hai nơi. Tần suất phải nhường ràng buộc số xe nếu đội xe không đủ. Mã `M01…` là mã xe trong mô hình, không phải biển số thật.

DN-06 dùng đội 5 xe, hai đầu bến có khung giờ riêng theo [Danabus](https://www.danangbus.vn/lo-trinh-tuyen.html), tần suất công bố 30–60 phút được lấy **45 phút làm giả định mô hình**, không phải bảng giờ xuất bến từng xe. Những tuyến khác dùng thông tin trong tài liệu nguồn; không tự gọi đó là lịch hiện hành đã xác minh. Tốc độ, dừng đèn, thời gian nghỉ và độ bất định đều là giả định.

Ở mỗi thời điểm, tìm chuyến của từng xe, pha đang đi/dừng và quãng đường đã đi; nội suy trên chính hình đường và tính hướng từ tiếp tuyến. ETA là thời gian còn lại trong mô hình đến mốc tiếp theo. Dải mờ chỉ là mức dự phòng giả định để diễn đạt sự không chắc chắn, không phải khoảng tin cậy được đo từ GPS.

## Những gì chưa thể khẳng định

Chưa có feed GPS, nốt chạy từng xe hoặc dữ liệu ùn tắc hiện trường. Vị trí hiển thị có thể khác xe ngoài đường; đây là ước tính lý thuyết phù hợp yêu cầu POC, không phải theo dõi xe trực tiếp. Chưa mô phỏng tương tác đầy đủ giữa các xe, người đi bộ hoặc đổi làn.

OSRM driving cung cấp hình học đường OSM cho xe cơ giới, chưa xác nhận quyền đi của bus, cấm rẽ hoặc đúng từng làn. 25/39 bản ghi tuyến bị gắn cờ cần soát do mốc cách đường nhiều hoặc cự ly chênh lệch; số này bao gồm tuyến lịch sử. Hai chiều luôn định tuyến riêng. Dữ liệu OSM được ghi công và chia sẻ theo ODbL tại `data/road-network.json`.

## Kiểm tra

`fleet.test.ts` kiểm tra bảo toàn đội 5 xe xuyên ngày, không có xe đêm khi hết chuyến, cùng thời điểm cho cùng kết quả, liên tục vị trí, giới hạn tốc độ, dừng tại mốc, hình chiều về riêng và bỏ tuyến lịch sử khỏi đội xe hiện hành.

`npm run test:map-browser` mở bản dựng thật ở trang Khám phá, kiểm tra xe/chọn/theo xe/ETA/đổi giờ/hết giờ chạy, màn hình 390/320 px và cả MapLibre lẫn Leaflet dự phòng. Báo cáo và ảnh ở `.artifacts/simulation-browser/map-*`.

`scripts/build-road-network.py` dựng dữ liệu từ các JSON gốc và kết quả OSRM lưu trong `.artifacts/road-network`. Dùng `--offline` để tái xuất từ cache; không định tuyến lại từ mạng trong CI. Dữ liệu đã xuất đi cùng website, nên việc xem vị trí ước tính không cần gọi router bên ngoài.
