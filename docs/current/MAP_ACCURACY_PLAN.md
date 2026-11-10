# Quy hoạch bản đồ chính xác và mô phỏng giao thông SmartBus

> Phần đã tích hợp và những phần còn đề xuất được ghi trong [SIMULATION_RELEASE.md](SIMULATION_RELEASE.md). SUMO/Valhalla trong kiến trúc đích bên dưới chưa phải động cơ đang chạy của bản web.

Ngày rà soát: 09–10/11/2026. Trạng thái: đề xuất triển khai, có kiểm tra mã nguồn, dữ liệu SQL hiện tại, tài liệu GPS trên GitHub và nguồn thư viện GitHub. Những tính năng đề xuất dưới đây chưa phải tính năng đã được cài vào ứng dụng. Bổ sung xác thực nguồn tại [GPS_SOURCE_VERIFICATION.md](GPS_SOURCE_VERIFICATION.md) và [gps-source-audit.json](gps-source-audit.json).

## 1. Quyết định kiến trúc

Bản đồ và độ đúng của tuyến là chức năng trung tâm. Thứ tự nghiệm thu: **đúng đường → đúng chiều/biến thể tuyến → đúng chuyển động → tương tác giao thông → trình bày 3D**.

Chọn **MapLibre + Valhalla + SUMO + deck.gl**, giữ Express/SQL Server. Turf/RBush phục vụ tính toán hình học. PMTiles và tilemaker dùng khi dựng bản đồ nền từ cùng phiên bản OSM với mạng định tuyến/mô phỏng. Không chuyển toàn bộ ứng dụng sang một framework khác.

- MapLibre: hiển thị, chọn tuyến, bản đồ nền, lớp kiểm tra chất lượng.
- Valhalla: định tuyến bus, map matching khi có trace, trả thông tin cạnh đường.
- SUMO: xe tương tác với làn đường, xe khác, nút giao, đèn và bến.
- deck.gl: lớp xe/mô hình glTF và vệt hành trình; không đóng vai trò động cơ giao thông.
- Express: API, phiên bản tuyến, công việc dựng hình học, truyền trạng thái mô phỏng.
- SQL Server: lưu tuyến chuẩn, nguồn, kiểm chứng, phiên bản, kịch bản và bản ghi phát lại.

Phần mềm được chọn có mã nguồn mở. Có thể chạy bộ dữ liệu khu vực trên máy; việc triển khai lên máy chủ vẫn cần tài nguyên tính toán/lưu trữ. Không dựa vào cam kết miễn phí của public demo API.

## 2. Nguyên nhân suy giảm bản đồ đã xác minh

1. `frontend/script.js:916` có `fetchSegment`: gọi OSRM `/route/v1/driving`, `overview=full`, `geometries=geojson` cho từng cặp điểm.
2. `frontend/script.js:947` có `buildRouteGeometry`: ghép các đoạn đã bám đường và lưu cache trình duyệt.
3. `backend-api/services/data.service.js:41` dựng `route.path` từ tọa độ **bến xe theo thứ tự**. Query đang ưu tiên `chiều_đi` hoặc direction rỗng.
4. `backend-api/modules/map/map.repository.js:7` đổi trực tiếp các tọa độ đó thành `LineString`.
5. `web/src/components/TransitMap.tsx` vẽ GeoJSON này; bước bám đường của giao diện cũ chưa được chuyển sang pipeline mới.

Kết quả đọc SQL trên bản local riêng: **39 tuyến, 298 điểm, mỗi tuyến 3–14 điểm**. Đây là số lượt điểm hiện API dùng để vẽ, không phải toàn bộ dữ liệu GPS trong repository. Kiểm tra bổ sung xác nhận 298 lượt điểm này khớp đầy đủ tên, thứ tự và tọa độ của hai tài liệu Word tuyến xe; không phát hiện mất điểm trong bước Word → JSON hiện tại.

| Tuyến trong dữ liệu hiện có | Điểm đang vẽ | Đoạn thẳng dài nhất giữa hai điểm kế tiếp |
|---|---:|---:|
| DN-02 | 9 | 15,41 km |
| DN-03 | 6 | 11,13 km |
| DN-06 | 8 | 6,06 km |

Các khoảng cách trên là đường chim bay, không phải chiều dài tuyến đường bộ. Xem [bản đo dữ liệu](map-geometry-audit.json).

Bản cũ có thể cho hình nhìn bám đường hơn nhờ OSRM, nhưng profile driving và các cặp bến thưa vẫn có thể chọn một đường khác với tuyến bus thực tế. Nó là mốc đối chiếu cần khôi phục, chưa phải nguồn xác nhận vận hành chính thức.

## 3. Nguồn dữ liệu và tuyến chuẩn

Ưu tiên theo chất lượng bằng chứng, không mặc định mọi nguồn đều đúng:

1. Shape/tuyến được đơn vị vận hành công bố, GTFS `shapes.txt` hoặc dữ liệu khảo sát có nguồn và ngày cập nhật; vẫn kiểm tra phiên bản/độ mới.
2. GPX/GPS hành trình thực, qua kiểm tra nhiễu và map matching.
3. Quan hệ tuyến bus OSM, danh sách đường bắt buộc, các mốc đường và bến đã xác minh.
4. Chỉ có bến: tính đường khả dĩ qua các bến và gắn trạng thái **suy luận**, đưa đoạn mơ hồ vào danh sách cần kiểm chứng.

### 3.1. Dữ liệu GPS có sẵn đã kiểm tra trên GitHub

Đã kiểm tra `main` tại `4d0db3231c798c3fd27b8645ed7a65082fffd288` và nhánh làm việc tại `9c4e703a97f0878987f580fbd1e47428d4cb7fee`. Các tệp nguồn dưới đây có cùng Git blob trên hai phiên bản.

| Nguồn | Dữ liệu đã xác nhận | Cách sử dụng |
|---|---|---|
| Hai Word tuyến xe 4 tỉnh và Quảng Nam cũ | 39 tuyến; 169 + 129 = 298 lượt mốc; có lộ trình tên đường và vai trò điểm | Giữ nguyên GPS gốc, khai thác cả lộ trình và nguồn nhúng trong Word |
| JSON bus hiện hành | 243 bản ghi điểm, 163 cặp tọa độ phân biệt; 298 lượt điểm đều là chiều đi | Phân biệt bản ghi, vị trí vật lý, waypoint và bến đón khách |
| Excel bus V3 | 11 tuyến, 130 bản ghi điểm, 157 lượt điểm; 129 cặp tọa độ phân biệt chưa trùng số học với bộ hiện hành | Nguồn bổ sung để so sánh theo tuyến/địa danh/phiên bản; chưa tự nhập chồng |
| `backend-api/data/seed-data.js` và CSV Rasa | 12 tuyến, 159 vertex; CSV trùng hoàn toàn hình học có thứ tự | Phục hồi mốc cũ để so sánh; không cộng CSV thành nguồn GPS độc lập |
| Hai Word du lịch và JSON du lịch | 60 địa điểm GPS | Điểm đến tham chiếu, không dùng thay shape đường bus |

Ví dụ bộ seed cũ có tuyến 02 với 18 vertex, tuyến 03 có 10 và tuyến 06 có 12; bản hiện hành DN-02/DN-03/DN-06 lần lượt có 9/6/8. Không mặc định các bản ghi cùng số tuyến là cùng hành trình hiện tại.

Có 25 URL nguồn thật trong bảng tuyến Word 4 tỉnh chưa được giữ trong trường `sourceUrl` của JSON. Khôi phục các URL này trước khi đánh giá nguồn; vẫn phân biệt bài tổng hợp với tài liệu nhà vận hành. Google Maps `q=lat,lon` khớp tọa độ chỉ xác nhận tính nhất quán của liên kết.

Đã tìm thấy 16 cặp tọa độ khác nhau trên 20 m giữa các địa danh cùng tên chuẩn hóa và cùng mã tỉnh trong Excel và JSON, sau khi loại trùng. Đây là danh sách cần đối soát, không phải 16 lỗi thực địa đã được kết luận. Riêng DN-02 và QN-02-2025 khác hành lang tuyến; Danabus hiện công bố tuyến 02 đi qua trung tâm và cầu Tiên Sơn, trong khi DN-02 còn qua cầu Thuận Phước. Cần kiểm tra phiên bản/hiệu lực trước khi sử dụng các mốc làm ràng buộc.

Trong các tệp được theo dõi đã kiểm kê, chưa thấy GPX/KML/GeoJSON/PBF hoặc shapes GTFS. Các GPS vừa đọc chủ yếu là mốc/bến/địa danh, không phải trace liên tục có thời gian. **Pipeline triển khai trước mắt là dựng tuyến có ràng buộc từ dữ liệu sẵn có; HMM dùng khi có trace phù hợp.** Cache hình học OSRM cũ vẫn là nguồn đối chiếu cần kiểm kê khi triển khai.

### 3.2. Hợp nhất nguồn theo phiên bản và giữ dữ liệu gốc

- Lưu bản gốc bất biến: Git commit/blob, tệp, sheet hoặc bảng, dòng, tên, tọa độ, URL nhúng, ngày tài liệu và nhãn chất lượng. Không thay bằng tọa độ do router tự suy ra.
- Lập danh sách alias ứng viên cho tên bến và tuyến. Ghép theo khu vực, phiên bản, chiều và vai trò; tên đường giống nhau hoặc số tuyến giống nhau không đủ để ghép.
- Tọa độ được xác minh có thể làm mốc bắt buộc theo dung sai phù hợp. Mốc ước lượng giữ nguyên để tham chiếu, thêm điểm tiếp cận đường riêng và gắn vấn đề cần duyệt khi lệch lớn. Không đặt sai số thiết bị giả cho các tọa độ không có metadata đo.
- Trích xuất danh sách đường từ mô tả thành gợi ý có liên kết về đoạn văn nguồn; kiểm tra tên đường, thứ tự và đoạn lặp trước khi dùng làm ràng buộc. Không tự tách mọi dấu gạch nối thành một đường độc lập.
- Đối chiếu DN-02 với QN-02-2025 như hai ứng viên phiên bản; giữ lịch sử, chỉ chọn phiên bản hiện hành sau đối soát. Nguồn ngày mới hơn không tự chứng minh mọi tọa độ mới hơn đều tốt hơn.
- Điểm `major_stop_or_intermediate_point` không mặc định là bến có đón trả khách. Mô phỏng chỉ dừng tại platform/stop đã xác nhận vai trò, thay vì dừng ở mọi vertex.
- Excel có 11 ô thứ tự đầu tuyến chứa chữ `có`; nhập liệu phải báo việc dùng thứ tự dòng/ID để khôi phục thứ tự, không sửa âm thầm rồi coi là dữ liệu đã kiểm chứng.

### 3.3. Tuyến chuẩn để sử dụng trong ứng dụng

Một shape chuẩn phải có:

`route_id, direction_id, variant_id, geometry_version, network_version, source_type, source_reference, observed_at, validation_status, geometry, length_m`.

- Tách chiều đi, chiều về và biến thể. Chiều về cần tuyến riêng vì đường một chiều có thể khác.
- Giữ điểm bến trên vỉa hè/nền ga; lưu thêm điểm tiếp cận trên đường/làn. Không di chuyển tọa độ bến chỉ để ép nó lên tim đường.
- Bến lặp ở tuyến vòng có `stop_occurrence` và số thứ tự riêng. Chỉ loại điểm trùng liên tiếp; không xóa các lần quay lại hợp lệ.
- Trạng thái chất lượng: `raw`, `inferred`, `matched`, `reviewed`, `incomplete`. Điểm số khớp của thuật toán không được tự đổi thành phần trăm chính xác thực địa.
- Lưu phiên bản gốc và phiên bản chuẩn đã duyệt. Hiệu chỉnh tạo phiên bản mới, có thể hoàn tác.

## 4. Pipeline làm tuyến bám đường

### 4.1. Chuẩn hóa và kiểm tra tọa độ

Chuẩn hóa thứ tự tọa độ một lần ở ranh giới hệ thống: dữ liệu kế thừa dùng `[lat,lng]`, GeoJSON dùng `[lng,lat]`, SUMO dùng hệ tọa độ mét của mạng.

Kiểm tra null, đảo tọa độ, điểm trùng liên tiếp, nhảy bất thường, thứ tự bến và hướng tuyến. Với GPS, kiểm tra timestamp, độ chính xác thiết bị và vận tốc khả dĩ; tách trace có khoảng mất tín hiệu. Không áp dụng bộ lọc làm phẳng để xóa các góc rẽ thật.

### 4.2. Khi có GPS: HMM và Viterbi

Map matching xét **chuỗi điểm và đường có thể đi**, thay vì gắn từng điểm vào đoạn đường gần nhất độc lập.

- Tìm các cạnh đường ứng viên quanh từng quan sát; bán kính phụ thuộc sai số GPS và loại khu vực.
- Xác suất quan sát đánh giá khoảng cách từ GPS tới cạnh, có thể bổ sung hướng khi dữ liệu chuyển động đủ tin cậy.
- Chuyển trạng thái xét đường đi hợp lệ giữa ứng viên, so sánh quãng đường trên mạng với chuyển động quan sát và thời gian đã trôi qua.
- Viterbi chọn chuỗi trạng thái có điểm tổng thể tốt nhất; xử lý mơ hồ khi hai đường song song có điểm gần nhau.
- Cạnh cấm bus, đi ngược chiều hoặc nối sai tầng cầu/hầm phải bị loại bởi mạng/ràng buộc; khoảng cách 2D không đủ để quyết định.

Tích hợp matcher có sẵn của Valhalla (`map_snap`, `trace_route`, `trace_attributes`); tự viết tầng chuẩn hóa, kiểm tra đầu ra và đánh giá chất lượng. Những trọng số riêng chưa được API engine hỗ trợ phải làm ở tầng đánh giá ứng viên hoặc được thử riêng trước, không coi là tùy chọn có sẵn.

### 4.3. Khi chỉ có bến: routing có ràng buộc

Đây là bài toán dựng đường khả dĩ qua các mốc thưa, không đủ bằng chứng để gọi là khôi phục chính xác trace GPS.

- Dùng Valhalla costing bus và đồ thị có hướng, thông tin quyền đi, nút giao và cấm rẽ.
- Thêm các mốc đường đã biết, đường bắt buộc và thứ tự bến vào từng đoạn. Kiểm tra đường được chọn có đúng hành trình bus hay chỉ là đường ngắn/nhanh hơn.
- Với dữ liệu trong GitHub: dùng GPS và lộ trình sau đối soát ở mục 3.1–3.2. DN-06 cần giữ nhánh vào sân bay và khu FPT theo nguồn; bản tuyến 02 hiện hành cần kiểm chiều đi Trần Phú và chiều về Bạch Đằng. Các mốc/đường này phải có phiên bản hiệu lực và không áp dụng sang bản lịch sử.
- Nguyên lý tìm đường là A*/Dijkstra trên đồ thị có chi phí không âm. Dùng engine đã có; không viết lại toàn bộ routing engine trong Node.
- Các nhánh khả dĩ được xếp hạng theo bằng chứng: thứ tự bến, hành lang tuyến, đường bắt buộc, khả năng tiếp cận bến, độ vòng và tính liên tục hướng.
- Thực hiện ràng buộc qua các waypoint/đoạn ứng viên đã kiểm tra và kiểm tra kết quả cạnh đường; không giả định API Valhalla nhận trực tiếp danh sách tên đường bắt buộc. Giữ các lần đi lại cùng đường/nút khi nguồn có nhánh vòng.
- Đoạn thiếu bằng chứng/không có kết nối hợp lệ trả `incomplete` hoặc `inferred`; UI hiển thị rõ để kiểm tra và bổ sung mốc.

OSRM là adapter chuyển tiếp để khôi phục mức bám đường của bản cũ. Lưu kết quả tại máy chủ, chỉ xử lý tuyến được yêu cầu, tuân thủ giới hạn dịch vụ được sử dụng. Đích chính là engine bus tự chạy; không bắn hàng trăm request vào public demo khi mở trang.

### 4.4. Ghép shape, gắn bến, giữ chi tiết

- Ghép các cạnh đúng chiều, giữ hình học đường và kết nối nút giao; kiểm tra khoảng hở trước khi nối.
- Tính mảng chiều dài tích lũy `s[0..n]` bằng mét. Chiếu bến lên shape với ràng buộc thứ tự tiến triển; không chọn nhánh vòng đầu tiên chỉ vì gần nhất.
- Dùng Turf `nearestPointOnLine`, `along`, `length`, `bearing` và RBush cho tra cứu đoạn ứng viên. Các phép chiếu này không thay thế map matching theo chuỗi.
- Giữ toàn bộ vertex cần thiết ở zoom lớn. Với lớp tuyến được chọn, thử `tolerance: 0` của GeoJSON source và đo lại hiệu năng.
- Chỉ giảm chi tiết cho lớp tổng quan, có ngân sách sai số màn hình; giữ mốc rẽ, bến và nút giao quan trọng. Canonical shape không bị ghi đè bởi bản LOD.
- Nội suy thêm điểm cách nhau 1–3 m có thể phục vụ lấy mẫu/chuyển động; nó không tăng độ đúng của nguồn.
- Cache theo hash đầy đủ của geometry/mốc, direction, profile, phiên bản mạng và engine; không chỉ theo ID hoặc chữ số tọa độ đã làm tròn.

### 4.5. Đồng bộ mạng đường với bản đồ nền

Để kiểm soát việc nét tuyến và nền đường lệch do khác thời điểm dữ liệu, dựng một gói khu vực từ **cùng snapshot OSM**:

`OSM khu vực → Valhalla graph + SUMO network + vector basemap/PMTiles`.

Giữ ngày dữ liệu, cấu hình xử lý, checksum và giấy phép/ghi nguồn. Bản đồ nền có thể khái quát hóa đường theo zoom; cần kiểm cả cấu hình dựng tile và style ở zoom mục tiêu. Cùng nguồn dữ liệu không tự chứng minh đúng so với thực địa.

## 5. Mô phỏng chuyển động và giao thông

Đã bổ sung [nghiên cứu chi tiết và kết quả pilot ngày 10/11/2026](TRAFFIC_DETAIL_RESEARCH.md). Pilot dùng adapter IDM MIT riêng trong `simulation/preview`, chưa phải động cơ SUMO hoặc bản đồ sản phẩm đã nghiệm thu. Bài kiểm vùng quét thân xe vẫn còn một khúc cua vượt đường bao ước tính khoảng 1,01 m; hình học chưa được duyệt.

### 5.1. Trình phát hành trình bus do mình tự viết

Trước khi ghép toàn bộ giao thông, dựng trình phát trên shape chuẩn:

- Trạng thái xe là vị trí theo chiều dài `s(t)`, tốc độ `v(t)`, gia tốc và trạng thái dừng.
- Binary search trên mảng chiều dài tích lũy tìm đoạn trong `O(log n)`; nội suy bên trong đoạn.
- Quỹ đạo vị trí bám shape. Làm chuyển hướng nhìn mượt, không dùng spline tự do cắt qua vỉa hè tại góc rẽ.
- Hạn chế gia tốc/phanh và giới hạn thay đổi gia tốc. Chặn vượt bến khi bước thời gian lớn.
- Có thể giới hạn tốc độ theo độ cong: `v_curve = sqrt(a_lat_max / max(abs(curvature), epsilon))`, sau khi xử lý nhiễu hình học. Các tham số cần hiệu chỉnh.
- FSM: `chờ xuất bến → chạy → giảm tốc → vào bến → đón/trả → rời bến → kết thúc`.
- Fixed timestep cho tính trạng thái; trình duyệt nội suy giữa hai trạng thái đã tính. Hỗ trợ pause, seek, đổi tốc độ và phát lại.

Đây là mô phỏng hành trình một xe, chưa phải mô hình tương tác giao thông hoàn chỉnh.

### 5.2. SUMO làm động cơ giao thông

Dùng các phần có sẵn của `eclipse-sumo/sumo`:

- `netconvert`: nhập OSM thành đường, làn, kết nối nút giao và quyền loại xe.
- `netedit`: kiểm tra/sửa mạng và kịch bản tại các nút khó.
- `carFollowModel="IDM"`: tăng tốc, giảm tốc và giữ khoảng cách với xe trước. Thử EIDM sau khi IDM được nghiệm thu.
- `laneChangeModel="LC2013"`: mô hình đổi làn có sẵn của SUMO. MOBIL là thuật toán tham khảo cho một bản demo JS riêng; không coi LC2013 là MOBIL.
- Mô hình nút giao/đèn sẵn có: xe có thể chờ đèn, nhường đường và xếp hàng theo kịch bản.
- `busStop`, `stop`, lịch xe và hành khách: dừng đúng làn/đúng bến, thời gian đón trả và headway.
- TraCI/Python: đọc trạng thái xe, điều khiển thời gian, đèn, tốc độ mô phỏng và ghi lại kết quả.

Hình học tuyến là hành lang đường đã duyệt. Xe trong SUMO chạy theo tim làn và đường nối nút; phải kiểm tra quỹ đạo đó nằm trong hành lang hợp lệ và đi qua đúng bến theo thứ tự. Tọa độ SUMO được đổi bằng projection/netOffset của chính mạng, không cộng độ lệch pixel vào GPS.

OSM có thể thiếu số làn, hạn chế phương tiện, cấu trúc nút hoặc chương trình đèn. Các phần suy đoán của công cụ import phải được ghi nhận và kiểm tra. Mật độ xe, thời gian đèn và hành khách chưa có dữ liệu thực thì là tham số kịch bản, không phải mô tả giao thông đang xảy ra.

Khi chạy SUMO, SUMO quyết định vật lý xe. Frontend chỉ nội suy để vẽ; không chạy thêm một bộ IDM độc lập để sửa vị trí của cùng xe.

### 5.3. Hiển thị và truyền trạng thái

- Giữ lớp tuyến/điểm dừng của MapLibre. Dùng deck.gl `ScenegraphLayer` cho mô hình xe glTF và `TripsLayer` cho vệt/phát lại.
- GPU instancing theo loại xe, mô hình ít polygon; tránh một DOM marker nặng cho mỗi xe.
- Khởi đầu mô phỏng bước 0,1 s; truyền snapshot/delta khoảng 10 Hz, render nội suy theo nhịp màn hình. Đây là cấu hình ban đầu cần đo, không phải kết quả benchmark.
- Bộ đệm có giới hạn, bỏ bản vẽ trung gian khi client chậm; không ghi SQL mỗi frame.
- Bản đồ toàn mạng xem tải tổng hợp/LOD, khi zoom gần mới hiển thị chi tiết xe/làn. Mobile có chế độ nhẹ.
- Ba chế độ dữ liệu rõ ràng: `replay`, `simulation`, `live` nếu có feed thật. Xe mô phỏng có nhãn nhận diện.

## 6. Thư viện GitHub đã lọc

Bổ sung ngày 10/11: đã lọc thêm BilHim/trafficSimulator (MIT), limabrko/traffic-simulator (MIT), CityFlow (Apache-2.0) và sumo3Dviz (GPL-3.0). Phần phương trình IDM của BilHim đã được chuyển thành adapter cho pilot, có notice giữ tác giả và license. Xem [phạm vi dùng và kiểm tra](TRAFFIC_DETAIL_RESEARCH.md); các repo còn lại chưa được nhúng vào sản phẩm.

Kiểm tra repository/README/LICENSE vào ngày rà soát. Trước khi tích hợp phải chốt release/commit và giữ giấy phép, notice cùng các phụ thuộc; dữ liệu bản đồ và model 3D có nguồn/giấy phép riêng.

| Repository | Phần dùng | Giấy phép được kiểm tra | Quyết định |
|---|---|---|---|
| [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js) | GeoJSON/vector layers, picking, camera | BSD-3-Clause và notice kèm theo | Giữ làm bộ hiển thị |
| [Valhalla](https://github.com/valhalla/valhalla) | Route, Meili map matching, thuộc tính cạnh | MIT trong COPYING | Engine đường/tuyến chính |
| [OSRM backend](https://github.com/Project-OSRM/osrm-backend) | Route/Match, adapter khôi phục bản cũ | BSD-2-Clause | Chuyển tiếp/đối chiếu; không gọi profile driving là tuyến bus đã xác minh |
| [Eclipse SUMO](https://github.com/eclipse-sumo/sumo) | netconvert, netedit, IDM, LC2013, bus stops, TraCI | EPL-2.0 | Engine mô phỏng chính, chạy thành tiến trình riêng |
| [Turf](https://github.com/Turfjs/turf) | along, length, bearing, nearestPointOnLine | MIT | Chọn các module cần dùng |
| [RBush](https://github.com/mourner/rbush) | R-tree tìm đoạn/đối tượng gần | MIT | Chỉ mục hình học phía ứng dụng |
| [deck.gl](https://github.com/visgl/deck.gl) | ScenegraphLayer, TripsLayer | MIT | Lớp xe và phát lại, sau khi đường chuẩn đạt |
| [PMTiles](https://github.com/protomaps/PMTiles) | Gói tile đọc qua HTTP Range | BSD-3 cho reference implementation; specification CC0/public domain | Gói nền khu vực, kiểm soát phiên bản |
| [tilemaker](https://github.com/systemed/tilemaker) | OSM PBF → vector tiles/PMTiles | FTWPL theo LICENCE.txt | Công cụ dựng dữ liệu offline |

Các ứng viên đã loại khỏi phạm vi lõi:

- [sidewalklabs/sumo-web3d](https://github.com/sidewalklabs/sumo-web3d): repository đã archive. Tham khảo cách TraCI → server → khung hình web; không dùng nguyên ứng dụng cũ làm nền.
- [movsim/traffic-simulation-de](https://github.com/movsim/traffic-simulation-de): có `road.js`, `vehicle.js`, `models.js`, IDM/ACC/MOBIL, nhưng là các demo Canvas và LICENSE GPL-3.0. Dùng làm tài liệu thuật toán; phương án lõi hiện tại dùng SUMO và renderer GIS.
- [FMM](https://github.com/cyang-kth/fmm): Apache-2.0, HMM + tiền tính UBODT, phù hợp batch GPS lớn. Chưa cần thêm engine map matching thứ hai cho 39 tuyến; xem lại khi có khối lượng trace và benchmark chứng minh cần.
- [A/B Street](https://github.com/a-b-street/abstreet): Apache-2.0, ứng dụng mô phỏng/quy hoạch đô thị riêng; tích hợp nguyên hệ thống làm phạm vi lớn hơn nhu cầu hiện tại.
- [Three.js](https://github.com/mrdoob/three.js): MIT, chỉ cân nhắc khi cần cảnh 3D tùy biến mà các lớp deck.gl không đáp ứng. Không phải thuật toán làm tuyến đúng hơn.

## 7. Những phần mình có thể trực tiếp thực hiện

- Audit nguồn và so sánh raw/legacy/đã bám đường; viết báo cáo đoạn thiếu bằng chứng.
- Viết adapter Valhalla/OSRM, hàng đợi dựng shape, cache phiên bản, API và migration SQL mới.
- Viết màn kiểm chứng: bật/tắt các lớp raw/chuẩn, điểm bến, cạnh, hướng đi, đoạn mơ hồ; thêm mốc và xuất phiên bản đã duyệt.
- Viết trình phát bus TypeScript/Web Worker, quỹ đạo theo s(t), giảm tốc/dừng bến, phát lại và bộ kiểm thử.
- Viết công cụ dựng kịch bản SUMO theo tuyến và cầu nối Python/TraCI → Express/WebSocket → MapLibre/deck.gl.
- Dựng gói bản đồ khu vực cùng snapshot, ghi checksum/nguồn và cấu hình phân phối có HTTP Range.
- Viết kiểm thử hình học, mô phỏng, trình duyệt, hồi quy và đo hiệu năng.

Đã chuẩn bị bộ SUMO 1.28.0 local trong thư mục bỏ qua bởi Git. Windows chặn khởi chạy `netconvert` với mã `0xC0E90002`; chưa có kết quả chạy SUMO. Không thay thiết lập bảo vệ máy. Chưa xác nhận môi trường Valhalla/Docker hoạt động. Việc nghiệm thu engine còn là hạng mục triển khai; pilot IDM độc lập không được ghi thành kết quả SUMO.

Dữ liệu xác nhận hành trình thực, GPS xe đang chạy, chu kỳ đèn thực hoặc số làn thiếu cần nguồn phù hợp. Mình có thể xây công cụ xử lý, nhưng không tự tạo bằng chứng thực địa từ danh sách bến thưa.

## 8. Thứ tự triển khai và điều kiện chuyển bước

| Mốc | Sản phẩm cụ thể | Điều kiện qua |
|---|---|---|
| M0 — baseline | Bản đo hiện tại, dữ liệu Word/Excel/seed/CSV và URL nguồn, danh sách xung đột, đối chiếu phiên bản | Kiểm kê và đối chiếu Word → JSON đã có; cần xử lý phiên bản/chiều tuyến thử và xác minh mốc trước nghiệm thu thực địa |
| M1 — phục hồi bám đường | Geometry service dùng mốc đã đối soát, cache máy chủ, lớp chất lượng, đầy đủ hình học tuyến được chọn | Không tự hợp nhất các bộ GPS hoặc ép mọi mốc ước lượng lên đường; lỗi nguồn/đứt mạng có trạng thái rõ |
| M2 — tuyến chuẩn | Valhalla bus, chiều đi/về/biến thể, gắn bến, phiên bản, mốc hiệu chỉnh, snapshot mạng | Bộ tuyến thử qua kiểm tra thứ tự bến, hướng, nút/cầu và tham chiếu độc lập khi có |
| M3 — bus có chuyển động đúng | Trình phát s(t), bến, phanh, pause/seek/replay, lớp xe | Xe bám shape, không vượt bến/nhảy tắt qua góc; phát lại tái lập được |
| M4 — giao thông tương tác | Mạng SUMO, bus/xe nền, làn, đèn, hàng chờ, cầu nối trạng thái | Các kịch bản đã chốt không có collision/teleport ngoài những gì được báo lỗi; dừng đúng đèn/bến |
| M5 — hình ảnh và hiệu năng | Xe 3D, vệt hành trình, LOD, chế độ mobile, đo tải | Đạt ngưỡng FPS/frame-time trên máy tham chiếu; lớp 2D vẫn dùng được |

Bộ thử đầu tiên: DN-06 đối chiếu thông báo mở tuyến 2026; QN-02-2025 đối chiếu hành lang tuyến 02 hiện hành và giữ DN-02 làm ca phát hiện phiên bản cũ; DN-03 kiểm tra đường cong/tuyến dài. Đây là lựa chọn kỹ thuật; việc khớp tên đường chưa xác nhận từng GPS là đúng thực địa. Nút giao, cầu/hầm, đường song song, đường một chiều, tuyến vòng và bến gần đường đối diện đều cần ca kiểm tra riêng.

## 9. Tiêu chí nghiệm thu bản đồ là trọng tâm

1. **Tính đúng mạng:** thứ tự bến đúng 100% đối với phiên bản đã duyệt; không chấp nhận nhầm chiều, nhầm cầu/tầng hoặc nối qua cạnh không liên thông trong bộ chuẩn. Tuyến vòng và bến lặp được kiểm riêng.
2. **Độ đúng hình học:** đánh giá với tuyến/mốc độc lập đã kiểm chứng, gồm sai lệch ngang P50/P95, độ phủ đúng đường và sai khác chiều dài theo trường hợp. Mục tiêu thử ban đầu P95 ≤10 m chỉ áp dụng khi nguồn tham chiếu đủ tin cậy, sau đó hiệu chỉnh bằng dữ liệu. Không dùng việc tự snap về OSM rồi đo lại chính OSM để chứng minh đúng thực địa.
3. **Chi tiết hiển thị:** so sánh ở zoom 17–20; lớp được chọn giữ hình học đầy đủ. LOD có ngân sách sai số màn hình, dự kiến 0,5–1 px, cần đo trên các đoạn cong/nút giao. Tăng vertex không được tính là bằng chứng tăng chính xác.
4. **Mô phỏng:** kiểm vị trí trên hành lang/làn hợp lệ, thứ tự bến, vận tốc/gia tốc, dừng đèn, va chạm và teleport; cùng network/version/scenario/seed tái hiện trong dung sai đã quy định.
   - Kiểm vùng quét của xe có kích thước, wheelbase và overhang phù hợp, góc lái và khoảng hở đuôi ở mỗi cua. Không vượt đèn/không chồng xe chưa đủ để duyệt tuyến có thân xe vượt mép đường.
   - Lớp phố cần footprint, đèn, điểm qua đường, số làn, `oneway`, quyền loại xe và cấm rẽ khi có. Bề rộng, vạch dừng, pha đèn hoặc connector suy ra phải có trạng thái riêng. Dựng nét theo mét ở zoom gần, không dùng một độ dày pixel cố định cho mọi đường.
5. **Chất lượng dữ liệu:** mỗi shape có nguồn, phiên bản và trạng thái. Mất nguồn không biến tuyến suy luận thành đã kiểm chứng; mô phỏng và live được nhận diện rõ.
   - Kiểm bảo toàn 298 lượt mốc Word hiện hành; các GPS seed/Excel bổ sung có dòng nguồn và quyết định sử dụng cụ thể, không nhập chồng theo số tuyến.
   - URL nhúng trong Word được giữ; xử lý xung đột tạo phiên bản mới, không ghi đè tọa độ gốc. Bản ghi bến, waypoint và điểm lên/xuống xe được phân biệt.
6. **Hiệu năng — mục tiêu cần đo:** thử 300 xe/desktop và 50 xe/mobile trước; hướng tới ≥45 FPS desktop, ≥30 FPS mobile trên thiết bị tham chiếu. Đây chưa phải benchmark đã đạt. Không giảm chất lượng canonical shape để làm đẹp số FPS.

## 10. Vị trí dự kiến trong mã nguồn

- `backend-api/modules/route-geometry/`: dựng/đọc/kiểm tra và quản lý phiên bản shape.
- `backend-api/modules/map/`: trả geometry chuẩn, mức chi tiết và trạng thái nguồn.
- `backend-api/modules/simulation/`: kịch bản, phiên phát lại, trạng thái mô phỏng.
- `simulation/`: bộ cấu hình SUMO và bridge Python/TraCI.
- `web/src/map/`: các lớp bản đồ, gắn bến, kiểm chứng geometry và overlay xe.
- `web/src/workers/`: trình phát nhẹ, nội suy và xử lý hình học cần tách khỏi giao diện.
- Migration mới cho `route_shapes`, `route_shape_versions`, `shape_stop_measures`, `geometry_issues`, `simulation_scenarios`, `simulation_runs`.
- Bổ sung mô hình nguồn/đối soát như `source_documents`, `source_points`, `route_source_aliases` và `route_anchor_constraints`; lưu raw point và road access point riêng.
- Tệp PBF/PMTiles/mạng sinh lớn đặt ngoài Git, có manifest tái tạo; không thêm binary lớn vào lịch sử mã nguồn.

Không sửa SQL lịch sử đã ghi checksum. Chuyển giao diện sang geometry chuẩn bằng phiên bản có thể quay lại; API cũ tiếp tục có đường chuyển đổi rõ ràng.

## Nguồn kỹ thuật chính

- [Xác thực GPS trong GitHub](GPS_SOURCE_VERIFICATION.md): danh mục gốc, phương pháp, số đo, xung đột và giới hạn kiểm chứng.
- [Danabus — danh sách và lộ trình tuyến](https://www.danangbus.vn/lo-trinh-tuyen.html), [thông báo mở tuyến 06](https://www.danangbus.vn/news/news/thong-bao-ve-viec-mo-tuyen-xe-buyt-so-06-san-bay-da-nang--dai-hoc-viet-han-5582.html).
- [Valhalla map matching](https://valhalla.github.io/valhalla/api/map-matching/), [COPYING](https://github.com/valhalla/valhalla/blob/master/COPYING).
- [OSRM Route/Match API](https://project-osrm.org/docs/v26.6.1/http.html).
- [GTFS schedule reference](https://gtfs.org/documentation/schedule/reference/): shapes và shape_dist_traveled.
- [MapLibre GeoJSON source/tolerance](https://maplibre.org/maplibre-style-spec/sources/#geojson).
- [SUMO OSM import](https://eclipse.dev/sumo/docs/Networks/Import/OpenStreetMap.html), [public transport](https://eclipse.dev/sumo/docs/Simulation/Public_Transport.html).
- [SUMO vehicle models](https://github.com/eclipse-sumo/sumo/blob/main/docs/web/docs/Definition_of_Vehicles%2C_Vehicle_Types%2C_and_Routes.md): IDM/EIDM và LC2013.
- [IDM](https://traffic-simulation.de/info/info_IDM.html), [MOBIL](https://mtreiber.de/MicroApplet/MOBIL.html).
- [deck.gl TripsLayer](https://deck.gl/docs/api-reference/geo-layers/trips-layer), [ScenegraphLayer](https://deck.gl/docs/api-reference/mesh-layers/scenegraph-layer).
- [PMTiles concepts](https://docs.protomaps.com/pmtiles/), [license](https://github.com/protomaps/PMTiles/blob/main/LICENSE).
- [tilemaker README](https://github.com/systemed/tilemaker), [licence](https://github.com/systemed/tilemaker/blob/master/LICENCE.txt).
