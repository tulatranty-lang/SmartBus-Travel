# Cách chạy SQL SmartBus v4

## Cách sạch nhất khi đang bị lỗi cũ

Nếu database `SmartBusDB` chưa có dữ liệu quan trọng, nên xóa database cũ rồi chạy lại từ đầu để tránh cột/index cũ còn sót lại.

Thứ tự khuyến nghị:

1. `01_SCHEMA_SMARTBUS_CORE.sql`
2. `02_IMPORT_4_TINH_HIEN_CO.sql`
3. `03_IMPORT_QUANG_NAM_CU.sql`
4. `04_SEED_BUS_VEHICLES.sql`
5. `05_SEED_CHATBOT_KNOWLEDGE.sql`
6. `99_ARCHITECT_UPGRADE_FIXES.sql`

`00_CHAY_DAU_TIEN_TAO_DATABASE_DAY_DU.sql` là file tổng hợp/seed cũ, vẫn giữ để tương thích. Với bản nâng cấp kiến trúc, nên dùng bộ file tách nhỏ ở trên cho dễ kiểm soát lỗi.

## Nếu không muốn xóa database cũ

Chạy `99_ARCHITECT_UPGRADE_FIXES.sql` trước để mở rộng cột text và chuẩn hóa index, sau đó chạy lại các file import bị lỗi.

Các bảng kết quả `bus_stops_invalid_gis` hoặc `tourist_places_invalid_gis` ở cuối file 99 chỉ là báo cáo kiểm tra tọa độ, không phải lỗi.


## Ghi chú v5 về file `01_IMPORT_DU_LIEU_V3_XE_BUS_DU_LICH.sql`

File này là file import tổng hợp cũ. Bản v5 đã bổ sung các cột `tourist_places.image_source` và `tourist_places.note` để file này không còn báo lỗi `Invalid column name 'image_source'` hoặc `Invalid column name 'note'`.

Khuyến nghị chạy bộ tách nhỏ theo thứ tự:

1. `01_SCHEMA_SMARTBUS_CORE.sql`
2. `02_IMPORT_4_TINH_HIEN_CO.sql`
3. `03_IMPORT_QUANG_NAM_CU.sql`
4. `04_SEED_BUS_VEHICLES.sql`
5. `05_SEED_CHATBOT_KNOWLEDGE.sql`
6. `99_ARCHITECT_UPGRADE_FIXES.sql`

Nếu lỡ chạy file import tổng hợp cũ thì vẫn chạy được sau khi đã chạy schema v5.
