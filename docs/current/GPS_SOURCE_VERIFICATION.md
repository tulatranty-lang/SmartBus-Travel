# Xác thực nguồn GPS của SmartBus

Đợt kiểm tra: 09–10/11/2026, theo giờ Việt Nam. Phạm vi: dữ liệu có sẵn trên GitHub, tính toàn vẹn khi chuyển sang JSON, đối chiếu lộ trình với nguồn công khai và điều chỉnh [quy hoạch bản đồ](MAP_ACCURACY_PLAN.md). Đây là kết quả kiểm tra dữ liệu và đề xuất triển khai; chưa sửa GPS trong ứng dụng hoặc nghiệm thu sai số thực địa.

## Kết luận sử dụng

Repository có nhiều nguồn GPS và lộ trình đáng để tái sử dụng. Cần khai thác Word, Excel và bộ seed cũ trước khi dựng tuyến mới. Con số 298 trong bản đo API chỉ mô tả dữ liệu đang dùng để vẽ, không mô tả toàn bộ GPS trong GitHub.

Hai Word tuyến xe đã được chuyển đủ 298 lượt mốc sang JSON hiện hành, khớp tên, thứ tự và tọa độ. Giao diện mới thiếu bước dựng đường đầy đủ vốn có trong giao diện cũ. Ngoài ra, bộ seed lịch sử có nhiều mốc hơn cho một số tuyến. Hai vấn đề này cần được xử lý riêng: phục hồi hình học bám đường và chọn đúng bộ mốc theo phiên bản tuyến.

Chưa có bằng chứng để kết luận mọi tọa độ đều chính xác đến từng mét. Nhiều dòng nguồn tự ghi là ước lượng theo bản đồ/địa danh. Kiểm tra tọa độ hợp lệ và link Google Maps khớp số học xác nhận tính toàn vẹn; chưa xác nhận vị trí bến hoặc hành trình thực tế.

## Phiên bản và cách kiểm tra

- GitHub `main`: `4d0db3231c798c3fd27b8645ed7a65082fffd288`.
- Nhánh `codex/complete-smartbus`: `9c4e703a97f0878987f580fbd1e47428d4cb7fee`.
- Đọc danh sách nhánh và cây `main` trực tiếp qua kết nối GitHub; cây trả đầy đủ, không bị cắt. Các tệp dữ liệu được liệt kê trong bản đo có cùng Git blob trên cả hai phiên bản; bản local không thay đổi các tệp đó.
- Đọc nội dung bảng và hyperlink thật từ OOXML của bốn Word; đọc ô, tên sheet và số dòng của hai Excel. Không sửa các tệp gốc.
- Đối chiếu theo `(routeCode, sequenceNo)`, kiểm tên và tọa độ giữa Word/JSON; kiểm liên kết điểm tuyến → bảng điểm và mảng `path` theo thứ tự.
- So sánh seed JavaScript với CSV có thứ tự. Các bản sao và dữ liệu sinh không được tính thành nguồn quan sát độc lập.
- Kiểm phạm vi số học WGS84, cặp tọa độ phân biệt, URL Maps và nhãn chất lượng. So sánh tên địa danh sau chuẩn hóa dấu/chữ/ký tự và cùng mã tỉnh; đo khoảng cách Haversine, bán kính Trái Đất 6.371.008,8 m.

Số liệu, hash tệp, danh sách URL và các cặp cần đối soát nằm trong [gps-source-audit.json](gps-source-audit.json). Khoảng cách trong báo cáo là đường chim bay, không phải khoảng cách đường bộ hoặc bằng chứng nguồn nào đúng.

## Dữ liệu đã tìm thấy

| Tệp hoặc bộ dữ liệu | Quy mô đã đọc | Ý nghĩa |
|---|---|---|
| `SmartBus_TuyenXeBus_GPS_GoogleMap_4Tinh.docx` | 25 tuyến, 169 lượt điểm, 16 dòng lịch | GPS, thứ tự, vai trò, lộ trình tên đường, hyperlink nguồn |
| `SmartBus_TuyenXeBus_GPS_GoogleMap_QuangNamCu.docx` | 14 tuyến, 129 lượt điểm, 17 dòng lịch | Bổ sung Quảng Nam cũ, gồm tuyến 02/21 phiên bản 2025 |
| `smartbus-bus-data.normalized.json` | 39 tuyến, 243 bản ghi điểm, 298 lượt điểm | Toàn bộ lượt điểm đều gắn `chiều_đi`; chưa có shape chiều về riêng |
| `smartbus_xe_bus_V3_tieng_viet_co_toa_do.xlsx` | 11 tuyến, 130 bản ghi điểm, 157 lượt điểm | Bộ nguồn khác với mã `QT_ROUTE_01`…, nhiều tên/điểm khác bộ Word |
| `backend-api/data/seed-data.js` | 12 tuyến, 159 vertex, 112 cặp tọa độ phân biệt | Hình học mốc lịch sử cho nhóm tuyến Đà Nẵng |
| `rasa-smartbus-bot/data_bus/stops.csv` | 159 dòng | Khớp hoàn toàn các mảng `path` có thứ tự của seed, không phải thêm 159 GPS độc lập |
| `SmartBus_DuLich_GanXeBus_GPS_GoogleMap_4Tinh.docx` | 36 địa điểm GPS | Điểm đến du lịch và gợi ý liên kết bus |
| `SmartBus_DuLich_GanXeBus_GPS_GoogleMap_QuangNamCu.docx` | 24 địa điểm GPS | Bổ sung Quảng Nam cũ |
| `smartbus-tourism-data.normalized.json` | 60 địa điểm, 60 liên kết bus | Không dùng tọa độ điểm đến thay geometry đường xe chạy |
| `smartbus_du_lich_V3_tieng_viet_co_toa_do.xlsx` | 25 địa điểm, 25 liên kết bus | Bộ du lịch lịch sử, cần kiểm chứng đường đi bộ riêng |

`smartbus-docx-4tinh.generated.json` chứa 25 tuyến/114 bản ghi điểm/169 lượt điểm bus và 36 địa điểm du lịch. Các đối tượng bus trùng hoàn toàn phần tương ứng của JSON chuẩn hiện hành, không phải dữ liệu độc lập. JSON chuẩn đặt trong `backend-api`, `frontend` và `docs` có cùng Git blob theo từng loại bus/du lịch.

Không cộng 243 + 130 + 159 thành số bến vật lý. Một điểm có thể dùng ở nhiều tuyến, nhiều mã nguồn hoặc nhiều phiên bản. Hai điểm đón ở hai phía đường cũng không được gộp chỉ vì tên giống nhau.

Nguồn GitHub đã xác nhận: [thư mục dữ liệu gốc trên main](https://github.com/tulatranty-lang/SmartBus-Travel/tree/4d0db3231c798c3fd27b8645ed7a65082fffd288/backend-api/data/import), [seed cũ](https://github.com/tulatranty-lang/SmartBus-Travel/blob/4d0db3231c798c3fd27b8645ed7a65082fffd288/backend-api/data/seed-data.js), [CSV điểm của Rasa](https://github.com/tulatranty-lang/SmartBus-Travel/blob/4d0db3231c798c3fd27b8645ed7a65082fffd288/rasa-smartbus-bot/data_bus/stops.csv).

## Kết quả xác thực nội bộ

### Bảo toàn GPS và thứ tự

- 298/298 lượt điểm Word có đúng tên, tọa độ và thứ tự trong JSON chuẩn.
- 298/298 lượt điểm tham chiếu đúng bản ghi điểm và cùng tọa độ trong JSON.
- 39/39 mảng `route.path` bằng các tọa độ lượt điểm của tuyến sau khi sắp thứ tự.
- 243/243 bản ghi điểm JSON có tọa độ số hợp lệ; 243/243 link Maps mở đúng chính cặp số đó. Có 163 cặp tọa độ phân biệt.
- 298/298 link Maps tại các dòng GPS Word tuyến xe khớp cặp số ghi trong dòng. 60/60 link tại bảng chính của Word du lịch cũng khớp.
- 130/130 bản ghi GPS bus Excel có cặp số hợp lệ và link Maps khớp. Có 129 cặp tọa độ phân biệt; cả 129 cặp này đều chưa trùng số học với 163 cặp trong JSON hiện hành. Đây là tọa độ ứng viên cần so sánh, không có nghĩa là thêm 129 bến mới.

Các kết quả này cho phép bảo toàn dữ liệu nguồn khi nâng cấp bản đồ. Chúng không đo sai số thực địa.

### Mốc cũ có thể bổ sung

| Số tuyến lịch sử | Vertex seed cũ | Bản ghi hiện hành được đem so sánh | Vertex hiện hành |
|---|---:|---|---:|
| 02 | 18 | DN-02 | 9 |
| 03 | 10 | DN-03 | 6 |
| 05 | 13 | DN-05 | 6 |
| 06 | 12 | DN-06 | 8 |

Chỉ so sánh độ dày mốc trong bảng này; chưa xác nhận hai cột là cùng phiên bản vận hành. Cần đối chiếu đường, chiều và thời gian hiệu lực trước khi sử dụng mốc cũ.

### Nhãn chất lượng và vai trò điểm

Trong 243 bản ghi điểm JSON:

- 114 ghi `GPS/điểm lớn ước lượng từ bản đồ công khai`.
- 101 ghi `Ước lượng theo mốc đường/địa danh Google Maps`.
- 28 ghi `GPS điểm chính/bến xe`; đây là nhãn trong nguồn, chưa phải kết quả khảo sát của đợt kiểm tra này.

130/130 điểm bus Excel ghi `ước_lượng_có_đánh_dấu`. Phần mở đầu Word cũng nói các điểm nhỏ được gắn theo bến/đường/địa danh, cần kiểm tra trước khi công bố chính thức.

Word bus 4 tỉnh có 50 dòng `endpoint` và 119 dòng `major_stop_or_intermediate_point`. Word Quảng Nam cũ có 14 `Đầu bến`, 14 `Cuối bến` và 101 `Điểm dừng/điểm lớn`. Vì thế không được cho xe mô phỏng dừng đón khách tại mọi vertex: nhiều dòng chỉ là mốc đường.

Nguồn không chứa timestamp theo từng quan sát hoặc sai số thiết bị của một chuyến xe ghi liên tục. HMM/Viterbi cần chờ trace phù hợp; trước mắt dùng routing theo mốc và hành lang tuyến đã kiểm chứng.

## Vấn đề cần giải quyết trước khi dựng tuyến chuẩn

### Khôi phục liên kết nguồn

25 dòng bảng tuyến Word 4 tỉnh có URL thật trong hyperlink. Trong JSON, `sourceUrl` của chúng đang là chuỗi mô tả `Nguồn trong file Word …`. Cần phục hồi URL, đồng thời giữ vị trí bảng/dòng và nhãn chất lượng nguồn.

Ví dụ DN-02 trỏ tới bài Danabus về đơn vị vận hành; một số tuyến khác trỏ tới thông báo vận hành Tết. URL thật giúp tìm bằng chứng, nhưng bài chỉ xác nhận hoạt động ngày Tết chưa đủ để xác nhận mọi tọa độ hoặc mọi đường trong hành trình. Danh sách 25 liên kết đã được trích trong JSON kiểm tra.

### Đối soát tọa độ giữa các bộ nguồn

Có 16 cặp tọa độ khác nhau trên 20 m trên các tên đã chuẩn hóa và cùng mã tỉnh, sau khi loại cặp trùng. Ví dụ:

| Địa danh ứng viên | Excel `[lat,lng]` | JSON `[lat,lng]` | Chênh lệch |
|---|---|---|---:|
| Cầu Thuận Phước | `[16.092,108.2224]` | `[16.091,108.224]` | 203,92 m |
| Bến xe Phía Nam Huế | `[16.4353,107.5973]` | `[16.4435,107.5965]` | 915,78 m |
| Dốc Miếu | `[16.947,107.0525]` | `[16.9765,107.065]` | 3.539,43 m |
| Chợ Do | `[17.0135,107.104]` | `[17.085,107.11]` | 7.975,99 m |

Đây là cặp ứng viên có tên giống nhau, chưa kết luận cùng điểm vật lý hay nguồn nào sai. Tên một con đường có thể chỉ các đoạn khác nhau. Cần dùng địa chỉ, vai trò, chiều và hình học đường để quyết định; không lấy trung bình hai GPS.

Hai bản ghi tên Bến xe Trung tâm Đà Nẵng trong DN-02 và QN-02-2025 cũng lần lượt ở `[16.0739,108.1537]` và `[16.06645,108.17885]`, cách nhau 2.812,06 m. Cần kiểm tra vị trí bến/cổng/điểm tiếp cận trước khi dùng làm mốc cứng.

### Xác minh phiên bản tuyến 02 và chiều về

Trong repository, DN-02 mô tả đường qua cầu Thuận Phước, Hoàng Sa và tuyến ven biển; QN-02-2025 mô tả đường qua trung tâm và cầu Tiên Sơn. Nguồn Danabus đang công bố hành lang qua trung tâm/cầu Tiên Sơn. Thông báo điều chỉnh ngày 14/04/2025 cũng xác nhận thay đổi hành lang từ 15/04/2025. Điều này xác nhận sự khác biệt phiên bản cần xử lý, chưa xác nhận từng GPS của QN-02-2025. [Danh mục lộ trình Danabus](https://www.danangbus.vn/lo-trinh-tuyen.html), [thông báo điều chỉnh tuyến 02](https://www.danangbus.vn/news/news/dieu-chinh-lo-trinh-tuyen-buyt-so-02-ben-xe-trung-tam--dai-hoc-viet-han-5447.html).

Nguồn danh mục hiện tại phân biệt đường qua trung tâm theo chiều: đi qua Trần Phú, về qua Bạch Đằng. JSON hiện hành có toàn bộ 298 lượt điểm ở chiều đi; không được dựng chiều về bằng cách đảo mảng. Cần đưa chiều/phiên bản/ngày hiệu lực vào mô hình trước khi coi shape là hành trình hiện hành.

### Đối chiếu tuyến 06

Thông báo mở tuyến của Danabus ngày 16/01/2026 cung cấp lộ trình hai chiều và việc vào khu sân bay, qua cầu Rồng, khu FPT, tới Đại học Việt Hàn. Mô tả DN-06 trong repository cùng hành lang lớn nhưng rút gọn nhiều đường. Cần bổ sung các mốc đã xác minh cho nhánh sân bay và nhánh FPT, tránh router chọn đường tắt chỉ vì hai GPS đầu cuối gần nhau. [Thông báo mở tuyến 06](https://www.danangbus.vn/news/news/thong-bao-ve-viec-mo-tuyen-xe-buyt-so-06-san-bay-da-nang--dai-hoc-viet-han-5582.html).

### Thứ tự trong Excel

Có 11 ô đầu tuyến ở sheet `05_Thứ_tự_dừng_theo_tuyến` chứa chữ `có` trong cột thứ tự. Importer hiện có fallback theo thứ tự dòng. Đợt nhập lại cần ghi rõ ô gốc, số thứ tự suy ra và cách đối chiếu ID; không coi đây là số nguồn đã hợp lệ ngay từ đầu.

## Điều chỉnh thuật toán theo bằng chứng vừa tìm

1. **Đăng ký nguồn và giữ GPS gốc:** lưu hash, bảng/sheet/dòng, tên, vai trò, URL thật và phiên bản. Raw GPS không bị ghi đè bởi snap.
2. **Đối soát thực thể:** lập ứng viên bằng khu vực, tên, vị trí, chiều và phiên bản. Không ghép bến/tuyến chỉ theo tên hoặc số hiệu; các cặp lệch lớn chờ xem xét.
3. **Dựng tuyến từ mốc và đường đã kiểm chứng:** dùng Valhalla bus/A* của engine; waypoint bắt buộc theo đúng thứ tự cho mốc có bằng chứng. Mốc ước lượng là gợi ý hoặc vấn đề cần duyệt, không buộc tuyến vòng sai chỉ để chạm một GPS chưa chắc đúng.
4. **Kiểm tra cạnh đường và hành lang:** so kết quả với chuỗi đường nguồn, cầu, nhánh sân bay, chiều đi/về và đoạn lặp. Ràng buộc tên đường cần được ánh xạ/kiểm tra ở tầng ứng dụng; không coi đó là tùy chọn tên đường bắt buộc có sẵn của engine.
5. **Giữ chi tiết đường:** lưu geometry đầy đủ từ các cạnh đã chọn; bến vật lý và điểm tiếp cận/làn riêng. Tăng mật độ lấy mẫu để chuyển động mượt không làm tọa độ nguồn chính xác hơn.
6. **Nghiệm thu rồi mô phỏng:** dùng shape đã duyệt cho trình phát bus và SUMO. Kiểm đúng đường/chiều/bến trước khi thêm xe nền, đèn và 3D. Chỉ dùng HMM/Viterbi khi có GPS hành trình phù hợp.

Ưu tiên thử DN-06 và phiên bản tuyến 02 sau đối soát; giữ DN-02 cũ làm ca phát hiện chọn nhầm phiên bản. DN-03 dùng kiểm tra đường dài và góc cong. Kiểm bảo toàn nguồn, thứ tự mốc và thông tin phiên bản trước, sau đó mới đo sai số hình học bằng tham chiếu độc lập đủ tin cậy.

## Giới hạn của đợt xác thực

Đã xác thực cấu trúc, tính nhất quán nguồn, các bản sao, khác biệt giữa các phiên bản và một phần hành lang tuyến bằng nguồn Danabus. Chưa có khảo sát thực địa, trace đo có sai số thiết bị, đối chiếu hình học độc lập từng điểm hoặc bằng chứng chính xác centimet/mét cho toàn bộ GPS.

Đã thử lấy ba địa danh tham chiếu từ Nominatim/OpenStreetMap nhưng kết nối không phân giải được tên miền; không sử dụng kết quả nào từ phép thử đó. Việc này không ảnh hưởng các kết quả đối chiếu GitHub/Word/Excel/JSON hoặc nguồn Danabus ở trên.

Không đổi dữ liệu ứng dụng, không nhập chồng Excel, không xóa bản tuyến lịch sử, không bổ sung thư viện mô phỏng trong đợt kiểm tra này. Những thay đổi triển khai được quy hoạch tại [MAP_ACCURACY_PLAN.md](MAP_ACCURACY_PLAN.md).
