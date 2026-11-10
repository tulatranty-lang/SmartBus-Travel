# Bản đồ chi tiết và mô phỏng xe buýt

> Tài liệu này lưu đợt khảo sát và mẫu xe 12 m ban đầu. Bản tích hợp đã chuyển sang cấu hình tham chiếu 8 m và có ba kịch bản; xem [SIMULATION_RELEASE.md](SIMULATION_RELEASE.md) để biết kết quả hiện hành và giới hạn chưa nghiệm thu.

Ngày rà soát 10/11/2026. Mục tiêu là kiểm tra nguồn GitHub, bổ sung chi tiết địa lý và thử mô hình chuyển động có điều kiện dừng. Bản thử nằm riêng trong `simulation/preview`; chưa thay thế bản đồ sản phẩm hoặc được nghiệm thu cho toàn bộ mạng bus.

## Kết quả đáng chú ý

Mốc mang tên Võ Văn Kiệt trong JSON tuyến DN-06 là `[16.057,108.24]`. Khoảng cách đến đoạn đường cùng tên gần nhất trong dữ liệu OSM vừa đọc là khoảng 581,73 m, tại way `693403431`. Mốc Võ Nguyên Giáp `[16.06,108.245]` cách đường cùng tên gần nhất khoảng 153,16 m. Đây là sai khác giữa hai nguồn, chưa phải kết luận khảo sát nguồn nào đúng. Tuy nhiên, việc ép router qua mốc thưa này đã tạo một vòng qua phố khác trong bản phác thảo trước.

Đoạn thử mới theo đồ thị đường có hướng qua Cầu Rồng → Võ Văn Kiệt → Võ Nguyên Giáp, có một đoạn nối ngắn không có tên đường. GPS gốc được giữ nguyên để bật so sánh, không bị ghi đè bằng tọa độ đã dựng.

## Thư viện GitHub đã kiểm tra thêm

| Dự án | Phần phù hợp | Giấy phép đã đọc | Cách sử dụng |
|---|---|---|---|
| [Eclipse SUMO](https://github.com/eclipse-sumo/sumo) | Làn, đường nội bộ nút giao, đèn, quyền ưu tiên, IDM/LC2013, bến và lịch bus | EPL-2.0, kèm điều khoản/notice theo bản phân phối | Giữ làm động cơ đích cho sản phẩm; chuẩn bị bản 1.28.0 nhưng chưa chạy được trên Windows hiện tại |
| [BilHim trafficSimulator](https://github.com/BilHim/trafficSimulator) | Phương trình bám xe IDM, thông số kích thước/khoảng cách | MIT | Đã chuyển phương trình từ `vehicle.py` thành adapter JavaScript cho bản thử, giữ tác giả và toàn bộ license |
| [limabrko traffic-simulator](https://github.com/limabrko/traffic-simulator) | Cách tổ chức đèn, luồng/làn và vỏ đèn Three.js | MIT | Đã đọc `TrafficLight.js`; chỉ tham khảo kiến trúc, chưa chép bundle/mesh vì dùng API Three.js cũ |
| [movsim traffic-simulation-de](https://github.com/movsim/traffic-simulation-de) | IDM/ACC/MOBIL, road/vehicle, nút giao | GPL-3.0 | Nguồn đối chiếu thuật toán; không đưa code GPL vào adapter MIT của bản thử |
| [CityFlow](https://github.com/cityflow-project/CityFlow) | Mô phỏng mạng và nghiên cứu điều khiển đèn/RL | Apache-2.0 | Chưa chọn cho quy trình GIS, bến và vận hành bus của dự án |
| [sumo3Dviz](https://github.com/DerKevinRiehl/sumo3Dviz) | Chuyển kết quả SUMO thành cảnh 3D | GPL-3.0 | Để sau khi hình học và động học đạt, chưa thêm pipeline render 3D riêng |

MapLibre đang có trong sản phẩm tiếp tục làm nền GIS. deck.gl/Three.js phục vụ hiển thị sau khi tuyến và chuyển động đã được kiểm chứng; chúng không tự giải quyết đường sai hoặc xe cắt cua.

Nguồn adapter được chốt tại commit `581ce3fc9200fc49e6a3f265dfd8627c9b7f759c`, blob `7b50de1d7442e3ed7bfe8b0152a1531d32882ebc`. [Mã vehicle.py đã đọc](https://github.com/BilHim/trafficSimulator/blob/581ce3fc9200fc49e6a3f265dfd8627c9b7f759c/src/trafficSimulator/core/vehicle.py), [notice giữ trong dự án](../../simulation/preview/THIRD_PARTY_NOTICES.md).

## Dữ liệu địa lý bổ sung

Đã đọc dữ liệu OSM đầy đủ node/way trong bbox xấp xỉ 16.051–16.069°B, 108.216–108.254°Đ:

- 17.122 node và 4.787 way trong bản tải.
- 63 node `highway=traffic_signals`.
- 682 node `highway=crossing`.
- 3.212 footprint công trình/nhà.
- 1.163 way đường dùng trong mô hình bản đồ thử sau lọc.

Bản xem lấy 514 footprint gần hành lang và 618 điểm qua đường có đường phù hợp để dựng ký hiệu. Mỗi điểm đèn và footprint có ID OSM. Không dựng nhà hoặc đặt đèn theo trí nhớ. Bề rộng đường khi thiếu thuộc tính được suy từ số làn và giả định 3,2 m/làn; vị trí vạch dừng và kích thước ký hiệu qua đường vẫn là giả định dựng hình.

Chỉ hai node đèn nằm thực sự trong chuỗi node của hành lang thử được gán chu kỳ điều khiển. Không lấy mọi đèn gần về khoảng cách rồi mặc định điều khiển hướng bus. Các đèn khác được hiển thị là vị trí nguồn chưa gán pha trong kịch bản.

## Mô hình đã thử

1. Tìm đường có hướng theo hành lang tên đường; đọc `oneway`, số làn và `motor_vehicle:lanes` nếu có. Quyền bus và cấm rẽ còn cần kiểm duyệt đầy đủ.
2. Tạo quỹ đạo làn có kế hoạch chuyển làn êm; các connector có liên tục tiếp tuyến C1. Tăng mật độ mẫu để phát lại, không dùng mật độ mẫu làm bằng chứng đúng thực địa.
3. Xe mẫu dài 12 m, rộng 2,55 m, wheelbase thử 6 m. Mô hình IDM điều chỉnh vận tốc theo xe trước hoặc vạch dừng như chướng ngại ảo; tích phân bước 0,05 s, xuất trạng thái mỗi 0,25 s.
4. Giới hạn vận tốc theo độ cong và lập ngược đường bao vận tốc để phanh trước chỗ cua; theo dõi thân xe và góc bánh lái bằng xấp xỉ động học xe đạp.
5. Chu kỳ đèn thử 80 s, có xanh/vàng/đỏ và pha dọn nút; không có hai luồng xung đột cùng xanh trong bộ kiểm tra.
6. Bến thử đặt cho kịch bản, giữ xe khoảng 12 s rồi đi tiếp. Không nhận đó là bến chính thức hoặc khẳng định có vịnh đón khách ngoài thực địa.
7. Kiểm vùng quét bốn góc thân xe theo bề rộng mặt đường nguồn/suy ra. Một lần hiệu chỉnh ngang cục bộ giảm sai khác, nhưng vẫn còn khoảng 1,01 m vượt đường bao ước tính tại một khúc cua, nên hình học chưa được duyệt.

## Kết quả kiểm tra và giới hạn

Bộ thử chạy 300 s với 11 xe, gồm một bus mẫu. Đã chạy kiểm tra Node cho tăng tốc tự do, phanh trước vạch dừng, pha đèn không xung đột và các thuộc tính của bản phát lại. Trong kịch bản đã chạy: không vượt đèn đỏ, không chồng xe; bus có khoảng 12,1 s xếp hàng trong pha đỏ và khoảng 12,05 s dừng ở bến thử. Góc bánh lái lớn nhất khoảng 34,69°, nằm dưới giới hạn thử 35°.

Có 13 lần chặn sai số tích phân ở khoảng cách dừng tối thiểu, độ hiệu chỉnh lớn nhất khoảng 0,0038 m trong mô hình số. Đây không phải số đo chính xác GPS. Gia tốc, phanh và luật chuyển làn của pilot chưa được hiệu chỉnh theo loại bus đang vận hành. Bản thử chưa phải LC2013/MOBIL và chưa được đối chiếu hình học vỉa hè/mép làn khảo sát.

Kiểm tra trình duyệt xác nhận bản đồ tải, chuyển đến cảnh chờ đèn/dừng bến/cua, phát/tạm dừng, bật/tắt công trình và bố cục hẹp. Những kiểm tra UI này không chứng minh mô hình giao thông đúng ngoài thực tế.

## Tình trạng SUMO

Đã chuẩn bị các gói chính thức `eclipse-sumo`, `sumolib`, `traci` phiên bản 1.28.0 trong thư mục công cụ local được bỏ qua bởi Git. Khi chạy `netconvert --version`, Windows trả mã `0xC0E90002` thuộc chính sách toàn vẹn hệ thống. Không có mạng hoặc bản phát lại SUMO nào được tạo thành công. Bản tương tác hiện tại dùng adapter IDM và bộ điều khiển thử của SmartBus, không gắn nhãn kết quả SUMO.

Phần có thể tiếp tục độc lập là kiểm chứng geometry, footprint và dữ liệu nguồn. Việc chạy SUMO cần môi trường thực thi được phép; không thay đổi thiết lập bảo vệ Windows trong đợt này.

## Điều kiện nghiệm thu tiếp theo

- Thu hẹp vùng lỗi cua, đối chiếu số làn, cạnh nối, quyền rẽ và mép mặt đường; quỹ đạo phải chứa toàn bộ thân xe trong hành lang được duyệt.
- Chọn loại xe thực tế và thông số wheelbase, overhang, bán kính quay; kiểm góc lái/tốc độ cua và bến thực.
- Chạy SUMO có internal links, kiểm lane-to-lane connections, pha đèn và chương trình đèn thực khi có. Phần tự suy phải có nguồn/trạng thái riêng.
- Đưa geometry/phiên bản đã duyệt qua API trước khi tích hợp mô phỏng vào giao diện sản phẩm.

Tài liệu kỹ thuật chính: [SUMO intersections](https://eclipse.dev/sumo/docs/Simulation/Intersections.html), [traffic lights](https://eclipse.dev/sumo/docs/Simulation/Traffic_Lights.html), [public transport](https://eclipse.dev/sumo/docs/Simulation/Public_Transport.html), [netconvert options](https://eclipse.dev/sumo/docs/netconvert.html).
