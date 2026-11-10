# SmartBus — mô phỏng đường phố tích hợp

Ngày kiểm tra: 10/11/2026. Mở `/#/simulation` trong ứng dụng Express hoặc [bản công khai](https://tulatranty-lang.github.io/SmartBus-Travel/#/simulation).

## Phạm vi đang chạy

Màn hình React thực, không nhúng iframe phác thảo. Đoạn thử dài khoảng 2,345 km: Cầu Rồng → Võ Văn Kiệt → Võ Nguyên Giáp. Có theo xe, nút giao, góc cua, toàn đoạn, kéo/phóng bản đồ, lớp công trình, điểm qua đường, đèn, GPS gốc và vùng cần xác minh. Ba tình huống dùng cùng hình học và chương trình đèn để so sánh. Phát/dừng, tua, tốc độ 0,5–4×, chuyển tới cảnh dừng đèn/đón khách/cua. Không tự phát khi vừa mở.

Chuyển động được tính bằng thuật toán rồi xuất các bản phát lại xác định, lấy mẫu 0,25 giây và nội suy trên trình duyệt. Không phải camera, GPS trực tiếp hoặc bản sao hoạt động của một biển số cụ thể. Chỉ có 1 xe buýt và 10 ô tô trong cùng luồng; chưa mô phỏng hỗn hợp xe máy, người đi bộ, chen làn hoặc xe cắt ngang.

## Nguồn và quyết định hiệu chỉnh

| Thông tin | Căn cứ | Cách dùng |
|---|---|---|
| Kim Long điện, 40 người: 19 ngồi + 21 đứng, FUTA, 5 xe, 21,3 km, 30–60 phút | [Danabus 16/1/2026](https://www.danangbus.vn/news/news/thong-bao-ve-viec-mo-tuyen-xe-buyt-so-06-san-bay-da-nang--dai-hoc-viet-han-5582.html), [Danabus 19/1](https://www.danangbus.vn/tin-tuc/tin-tuc/da-nang-tiep-tuc-dua-xe-buyt-dien-vao-hoat-dong-tren-cac-tuyen-buyt-huong-toi-giao-thong-xanh-va-ben-vung-5583.html), [Báo Đà Nẵng 17/1](https://baodanang.vn/van-hanh-tuyen-xe-buyt-noi-san-bay-quoc-te-da-nang-voi-phuong-ngu-hanh-son-tu-25-1-3320504.html) | Sức chứa, loại xe, hành lang tuyến; không dùng tần suất dịch vụ làm thời gian chờ đèn |
| Dòng B40-EV dài khoảng 8 m | [Hãng Kim Long Motor 22/10/2026](https://kimlongmotor.vn/en/truyen-thong/kim-long-motor-ban-giao-lo-15-xe-citybus-dien-kimlongb40-ev-cho-cong-ty-co-phan-thuong-mai-va-du-lich-ha-lan--dong-hanh-phat-trien-giao-thong-xanh-339) | Tham chiếu dòng xe thay mẫu 12 m trước đó; bài nói về lô xe ở Thái Nguyên, chưa chứng minh biến thể của Đà Nẵng |
| Nhóm B30/B40/B60 | [Cập nhật công khai LinkedIn của hãng](https://vn.linkedin.com/company/kim-long-motor), bài 24/7/2026 | Đối chiếu danh mục xe; không suy tốc độ hoặc gia tốc từ nội dung quảng bá |
| Kênh Facebook Danabus | [Trang liên hệ chính thức](https://www.danangbus.vn/lien-he.html) dẫn tới [DanaBusOfficial](https://www.facebook.com/DanaBusOfficial) | Xác thực danh tính kênh; không đọc được bài đăng trong phiên này, không trích thông số từ bài chưa xem |
| Thời gian phục vụ hành khách | [TRB, TCRP Report 90 vol. 2](https://onlinepubs.trb.org/onlinepubs/tcrp/tcrp_rpt_90v2.pdf) | Cấu trúc mô hình dừng bến; hệ số địa phương và số khách vẫn là giả định |
| Đường, chiều đi, đèn, điểm qua đường, công trình | OpenStreetMap, snapshot `2026-11-10T13:50:40Z`, bbox 16.051,108.216,16.069,108.254 | Hình học nền và nút nguồn, giữ ID để truy ngược |

Trang bán xe có thông số dài 7,005 m, cơ sở 3,55 m và số ghế khác. Chưa đủ căn cứ chọn đó là xe của tuyến 06; mâu thuẫn được giữ trong `profile.json`. Rộng 2,35 m, cơ sở 4 m, nhô trước 1,6 m, nhô sau 2,4 m, tạo hình, tốc độ và động học đều là cấu hình tham chiếu, chưa có hồ sơ đăng kiểm/telemetry xác nhận.

Đối chiếu thêm [trang lộ trình Danabus đang công bố](https://www.danangbus.vn/lo-trinh-tuyen.html), đọc ngày 10/11/2026: tuyến 06 màu xanh với ba dải vàng–trắng–xanh; giờ sân bay 05:45–19:25, Việt Hàn 05:30–19:00, cự ly 21,3 km. Bộ nguồn trong Git ghi 24 km và 07:15–14:45 kèm lịch Tết. Snapshot công khai dùng thông tin dịch vụ đã đối chiếu và giữ `originalService` cùng URL/ngày nguồn; không thay tọa độ. Bản Express giữ dữ liệu SQL và thêm chú thích đối chiếu ở chi tiết DN-06, không tự sửa database.

## Thuật toán đang sử dụng

1. **Chọn hành lang trên đồ thị có hướng.** Dijkstra trên nhánh OSM, tôn trọng `oneway` và cấm xe cơ giới. Ưu tiên tên đường được xác nhận, hạn chế nhảy sang đường khác vì điểm mốc lệch. Không kéo GPS gốc sang vị trí mới. Chưa có bằng chứng làn rẽ hoặc cấm xe buýt đầy đủ.
2. **Nối nút và lấy mẫu theo quãng đường.** Nối tiếp tuyến C1 tại các khúc đổi hướng được chọn, cửa sổ 14 m; khoảng lấy mẫu khoảng 0,5 m. Dịch làn theo dữ liệu có sẵn và bề rộng giả định 3,2 m/làn. Hiệu chỉnh ngang cục bộ sau khi kiểm tra 4 góc thân xe; không dùng đường cong tự do qua mọi điểm GPS thưa.
3. **Giới hạn tốc độ theo độ cong.** `v_curve = sqrt(a_lateral / max(kappa, epsilon))`; quét ngược giới hạn phanh bằng `v_i² ≤ v_next² + 2 b Δs`. Trần tốc độ là tham số kịch bản, không phải tốc độ quan sát hay biển hạn chế đã được khảo sát.
4. **Bám xe bằng IDM.** Phương trình gia tốc được chuyển thể từ [BilHim/trafficSimulator](https://github.com/BilHim/trafficSimulator/blob/581ce3fc9200fc49e6a3f265dfd8627c9b7f759c/src/trafficSimulator/core/vehicle.py), MIT, giữ thông báo tác quyền. Tích phân bước 0,05 s, giới hạn biến thiên gia tốc; xe dẫn ảo tại đèn đỏ và bến. Chặn sai số tích phân ở khoảng cách tối thiểu được đếm và báo riêng, không coi là bằng chứng mô hình hoàn hảo.
5. **Hai trục và nhô trước nhất quán.** Mô hình bicycle dùng quỹ đạo cản trước. Với `L = wheelbase + frontOverhang`, `delta = atan(wheelbase/L × tan(beta))`. Cập nhật trục sau mỗi 0,05 s; thân xe và vị trí bánh được vẽ từ cùng tư thế. Có kiểm thử bán kính vòng tròn giải tích để phát hiện nhầm góc thân với góc bánh lái.
6. **Đèn và mở cửa.** Chu kỳ giả định 80 s: đỏ 30 s, xanh 37 s, vàng 4 s, đỏ toàn nút 9 s; hai điểm điều khiển được gán cùng chu kỳ, các điểm khác màu xám. Dừng đón trả `doorSeconds + max(boarding × boardingSeconds, alighting × alightingSeconds)`. Cửa chỉ mở khi đã tới bến và xe dừng. Đây là giả định hai luồng lên/xuống song song, chưa khảo sát cách thu vé thực tế.

## Kết quả kiểm tra mô hình

| Kịch bản | Trần tốc độ | Số khách trước/sau | Dừng bến | Hết đoạn sau | Góc lái lớn nhất | Vượt đỏ / chồng xe |
|---|---:|---:|---:|---:|---:|---:|
| Thông thoáng | 40 km/h | 18 / 19 | 14,5 s | 301,30 s | 15,55° | 0 / 0 |
| Đông khách | 30 km/h | 32 / 35 | 35,5 s | 369,85 s | 15,34° | 0 / 0 |
| Đường ướt | 28 km/h | 22 / 23 | 20 s | 384,55 s | 15,53° | 0 / 0 |

Can thiệp chặn tích phân: 12 / 13 / 8 lần; chỉnh vị trí tối đa 0,0015 / 0,0014 / 0,0011 m. Đây là sửa sai số bước mô hình, không phải sai số định vị xe. Kiểm tra bổ sung từng frame độc lập: tiến độ không lùi, vận tốc hữu hạn không âm, khoảng cách các thân xe, cửa chỉ mở tại bến, sức chứa ≤40, xe kết thúc đoạn.

**Hình học chưa nghiệm thu.** Lấy mẫu 4 góc thân mỗi 0,25 s so với hợp phạm vi đường có bề rộng suy từ OSM: lệch ra ngoài tối đa 0,647 / 0,658 / 0,719 m, đều quanh nhánh nối OSM `1385749133`. Vùng này đánh dấu màu hổ phách. Không có đo đạc mép vỉa, mặt nút giao, đảo giao thông hoặc kiểm tra pháp lý từng làn; kiểm tra 4 góc không chứng minh toàn bộ thân xe tránh mọi đảo hoặc xe cắt ngang. Không được gọi sai số này là độ chính xác GPS thực tế. 298 điểm gốc theo tuyến không thay đổi.

## Website và dữ liệu công khai

- Cùng mã React cho Express/SQL và GitHub Pages. Mô phỏng tải gói bản đồ và kịch bản đã công bố cùng website, không phụ thuộc API định tuyến bên ngoài lúc phát.
- Pages tự dùng snapshot từ các JSON nguồn trong Git: 39 tuyến, 243 điểm riêng biệt, 298 vị trí tuyến và 60 điểm du lịch. Không xuất tài khoản, bài viết, lịch sử hoặc database cá nhân; không đưa đánh giá mẫu thành đánh giá thật.
- Snapshot không nhận ghi dữ liệu. Tài khoản, gửi bài, lưu lịch trình cần bản có backend; UI nói rõ. Express không tự chuyển sang snapshot để che lỗi SQL.
- MapLibre/Leaflet ở trang Khám phá vẫn là đường nối điểm nguồn thưa, nay vẽ nét đứt. Chỉ đoạn mô phỏng có dữ liệu đường chi tiết và báo cáo hình học nói trên.
- Dữ liệu bản đồ dẫn tới file tải và OpenStreetMap ODbL; NOTICE giữ giấy phép MIT và d3-geo/d3-array/InternMap. Các dự án GPL đã xem không được chép vào bản web. SUMO vẫn chưa chạy được do chính sách Windows, không dùng kết quả SUMO giả.

## Kiểm tra và tái tạo

```powershell
npm run test:simulation
npm --prefix web test
node scripts/export-public-data.cjs --check
npm run build
npm run test:simulation-browser
```

Trên Windows đặt `SMARTBUS_BROWSER_CHANNEL=msedge`; trên CI dùng Chromium đã cài. Bộ kiểm tra trình duyệt mở bản dựng thực, kiểm tra các kịch bản, player, lớp bản đồ, bảng nguồn, khôi phục focus sau hộp thoại, màn hình 1440/390/320 px, dữ liệu công khai và không gọi backend ở chế độ công khai. Ảnh và báo cáo ở `.artifacts/simulation-browser/`.

`web/public/simulation/v1/network.json` chứa path/prefix/curvature chính xác đầu vào cho replay. Có thể gọi `buildReplay(network, scenarioId)` từ `simulation/preview/build-replay.cjs` mà không cần nguồn cache. Kiểm thử tính lại cả ba và so với JSON đã xuất. `manifest.json` ghi kích thước và SHA-256 từng tài nguyên. Mã chuẩn bị hình học và sửa ngang ở `simulation/preview`; cần nguồn OSM/cache để tái dựng từ dữ liệu thô, không tự tải nguồn mới trong CI. Các lần hiệu chỉnh ngang đã dùng được giữ trong `pathGeneration`.

Bộ giao diện có 57 kiểm thử; thuật toán và tính toàn vẹn nguồn có 8 kiểm thử; API hiện có 72 kiểm thử. Kết quả phát hành CI và kiểm tra trình duyệt được theo dõi riêng, không dùng kiểm thử mock để tự nhận đã xác thực xe ngoài đường.
