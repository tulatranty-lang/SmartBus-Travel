/*
SmartBus V3 - Update linked demo features
Yêu cầu: map nhẹ hơn, review cộng đồng, yêu thích tuyến/địa điểm, lịch sử chat.
Chạy sau các file schema/seed hiện có. Script an toàn: không DROP database, không xóa dữ liệu cũ.
*/

USE SmartBusDB;
GO

IF OBJECT_ID(N'dbo.favorites_routes', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.favorites_routes (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NOT NULL,
        route_id NVARCHAR(50) NOT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_favorites_routes_user_route' AND object_id = OBJECT_ID(N'dbo.favorites_routes'))
BEGIN
    CREATE UNIQUE INDEX UX_favorites_routes_user_route ON dbo.favorites_routes(user_id, route_id);
END;
GO

IF OBJECT_ID(N'dbo.favorites_places', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.favorites_places (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NOT NULL,
        place_id INT NOT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_favorites_places_user_place' AND object_id = OBJECT_ID(N'dbo.favorites_places'))
BEGIN
    CREATE UNIQUE INDEX UX_favorites_places_user_place ON dbo.favorites_places(user_id, place_id);
END;
GO

IF OBJECT_ID(N'dbo.community_reviews', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.community_reviews (
        id INT IDENTITY(1,1) PRIMARY KEY,
        review_id NVARCHAR(30) NULL,
        slug NVARCHAR(200) NULL,
        user_id INT NULL,
        author_name NVARCHAR(150) NOT NULL DEFAULT N'SmartBus Demo',
        province NVARCHAR(100) NOT NULL,
        place_name NVARCHAR(200) NOT NULL,
        category NVARCHAR(100) NOT NULL,
        rating DECIMAL(3,1) NOT NULL,
        title NVARCHAR(250) NOT NULL,
        short_caption NVARCHAR(500) NULL,
        content NVARCHAR(MAX) NOT NULL,
        tips NVARCHAR(MAX) NULL,
        tags NVARCHAR(500) NULL,
        source_ref NVARCHAR(100) NULL,
        image_url NVARCHAR(1000) NULL,
        image_urls NVARCHAR(MAX) NULL,
        status NVARCHAR(50) NOT NULL DEFAULT N'approved',
        is_seed BIT NOT NULL DEFAULT 0,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END;
GO

IF COL_LENGTH('dbo.community_reviews', 'review_id') IS NULL ALTER TABLE dbo.community_reviews ADD review_id NVARCHAR(30) NULL;
IF COL_LENGTH('dbo.community_reviews', 'slug') IS NULL ALTER TABLE dbo.community_reviews ADD slug NVARCHAR(200) NULL;
IF COL_LENGTH('dbo.community_reviews', 'image_urls') IS NULL ALTER TABLE dbo.community_reviews ADD image_urls NVARCHAR(MAX) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_community_reviews_filter' AND object_id = OBJECT_ID(N'dbo.community_reviews'))
BEGIN
    CREATE INDEX IX_community_reviews_filter ON dbo.community_reviews(province, category, rating, created_at);
END;
GO

IF OBJECT_ID(N'dbo.chat_history', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.chat_history (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NULL,
        message NVARCHAR(MAX) NOT NULL,
        bot_response NVARCHAR(MAX) NOT NULL,
        intent NVARCHAR(100) NULL,
        related_place_id INT NULL,
        related_route_id NVARCHAR(50) NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END;
GO

IF COL_LENGTH('dbo.chat_history', 'related_place_id') IS NULL ALTER TABLE dbo.chat_history ADD related_place_id INT NULL;
IF COL_LENGTH('dbo.chat_history', 'related_route_id') IS NULL ALTER TABLE dbo.chat_history ADD related_route_id NVARCHAR(50) NULL;
GO

IF OBJECT_ID(N'dbo.tourist_places', N'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.tourist_places', 'tips') IS NULL ALTER TABLE dbo.tourist_places ADD tips NVARCHAR(MAX) NULL;
    IF COL_LENGTH('dbo.tourist_places', 'tags') IS NULL ALTER TABLE dbo.tourist_places ADD tags NVARCHAR(500) NULL;
    IF COL_LENGTH('dbo.tourist_places', 'nearby_routes') IS NULL ALTER TABLE dbo.tourist_places ADD nearby_routes NVARCHAR(MAX) NULL;
    IF COL_LENGTH('dbo.tourist_places', 'nearby_stops') IS NULL ALTER TABLE dbo.tourist_places ADD nearby_stops NVARCHAR(MAX) NULL;
END;
GO

/* View demo không phá dữ liệu: mỗi tỉnh lấy tối đa 20 vị trí xe để map dùng nhẹ hơn nếu cần kiểm tra SQL trực tiếp. */
CREATE OR ALTER VIEW dbo.vw_demo_bus_vehicle_locations AS
WITH ranked AS (
    SELECT v.*, r.province_code,
           ROW_NUMBER() OVER (PARTITION BY ISNULL(r.province_code, N'UNKNOWN') ORDER BY CASE WHEN v.status IN (N'active', N'ACTIVE', N'Đang hoạt động') THEN 0 ELSE 1 END, v.bus_id) AS rn
    FROM dbo.bus_vehicles v
    LEFT JOIN dbo.bus_routes r ON r.route_code = v.route_id
)
SELECT * FROM ranked WHERE rn <= 20;
GO

/* Seed 30 bài review mẫu từ file 30_smartbus.docx: status=approved_seed, is_seed=1. */

IF NOT EXISTS (SELECT 1 FROM community_reviews WHERE review_id = N'RV001')
BEGIN
    INSERT INTO community_reviews
    (review_id, author_name, province, place_name, category, rating, title, short_caption, content, tips, tags, source_ref, image_url, status, is_seed, created_at, updated_at)
    VALUES
    (N'RV001', N'Minh Anh', N'Đà Nẵng', N'Biển Mỹ Khê', N'Biển / check-in bình minh', 4.9,
     N'Bình minh Mỹ Khê: đi sớm một chút là có cả bãi biển cho riêng mình', N'Nên đi lúc 5h15-6h00 để có ánh sáng đẹp, ít nắng gắt và dễ chụp ảnh.', N'Mỹ Khê cho mình cảm giác rất “Đà Nẵng”: rộng, sạch, dễ đi và có nhịp sống địa phương rõ ràng. Sáng sớm thấy người chạy bộ, đá bóng, kéo lưới và vài nhóm bạn ngồi ngắm mặt trời lên. Bãi cát thoải nên đi chân trần khá dễ chịu, ảnh chụp ngược sáng lên màu rất trong. Sau khi tắm biển có thể đi bộ ra các quán hải sản, cà phê ven đường Võ Nguyên Giáp hoặc quay lại khách sạn gần biển nghỉ ngơi. Điểm mình thích nhất là không cần lịch trình phức tạp: chỉ cần một chiếc xe, một bộ đồ thoải mái và dậy sớm. Phù hợp cho bạn nào muốn có bài check-in mở đầu chuyến đi thật nhẹ nhàng.', N'Mang dép dễ rửa cát, khăn nhỏ, tránh xả rác; chiều muộn cũng đẹp nhưng đông hơn.', N'#MyKhe #DaNang #Bien #BinhMinh #CheckIn', N'S1', N'', N'approved_seed', 1, SYSUTCDATETIME(), SYSUTCDATETIME());
END

IF NOT EXISTS (SELECT 1 FROM community_reviews WHERE review_id = N'RV002')
BEGIN
    INSERT INTO community_reviews
    (review_id, author_name, province, place_name, category, rating, title, short_caption, content, tips, tags, source_ref, image_url, status, is_seed, created_at, updated_at)
    VALUES
    (N'RV002', N'Hoài Nam', N'Đà Nẵng', N'Bán đảo Sơn Trà - Chùa Linh Ứng', N'Du lịch / ngắm cảnh', 4.8,
     N'Sơn Trà xanh mát, nhìn xuống biển Đà Nẵng rất đã mắt', N'Một cung ngắn nhưng đủ có biển, rừng, chùa và góc nhìn toàn thành phố.', N'Đi Sơn Trà nên dành ít nhất nửa ngày vì đường lên có nhiều đoạn rất đẹp. Mình thích nhất cảm giác chạy chậm qua những khúc cua có cây rừng hai bên, thỉnh thoảng mở ra một khoảng biển xanh phía dưới. Chùa Linh Ứng là điểm dừng dễ đi, có nhiều góc chụp rộng và không khí yên tĩnh hơn khu trung tâm. Nếu trời trong, nhìn về phía Mỹ Khê và thành phố rất rõ. Đây là bài review hợp để đăng kiểu “đi trốn thành phố mà vẫn ở trong thành phố”. Trải nghiệm này không cần tốn nhiều chi phí, chỉ cần đi cẩn thận, không chạy nhanh, không trêu chọc động vật và giữ yên lặng ở khu chùa.', N'Nên đi sáng hoặc chiều, kiểm tra thắng xe nếu đi xe máy; không cho khỉ ăn.', N'#SonTra #LinhUng #DaNang #NgamCanh #DuLichXanh', N'S1', N'', N'approved_seed', 1, SYSUTCDATETIME(), SYSUTCDATETIME());
END

IF NOT EXISTS (SELECT 1 FROM community_reviews WHERE review_id = N'RV003')
BEGIN
    INSERT INTO community_reviews
    (review_id, author_name, province, place_name, category, rating, title, short_caption, content, tips, tags, source_ref, image_url, status, is_seed, created_at, updated_at)
    VALUES
    (N'RV003', N'Bảo Trân', N'Đà Nẵng', N'Ngũ Hành Sơn', N'Check-in / văn hóa', 4.7,
     N'Ngũ Hành Sơn: leo hơi mỏi nhưng lên cao nhìn biển cực xứng đáng', N'Hợp với nhóm thích chụp ảnh hang động, chùa, bậc đá và góc nhìn cao.', N'Ngũ Hành Sơn không chỉ là điểm check-in mà còn là một trải nghiệm đi bộ khá thú vị. Đường lên có nhiều bậc đá, hang và chùa nằm xen trong núi nên mỗi đoạn lại có cảm giác khác nhau. Mình đi buổi sáng, ánh sáng chiếu vào cửa hang nhìn rất “điện ảnh”, ảnh không cần chỉnh nhiều vẫn có chiều sâu. Điểm cộng là vị trí không quá xa trung tâm, có thể ghép lịch với biển Mỹ Khê hoặc Hội An trong cùng ngày. Tuy nhiên ai không quen leo bậc nên đi chậm, mang nước và giày có độ bám. Với tính năng cộng đồng review, bài này nên gắn nhãn “văn hóa + vận động nhẹ” để người dùng chọn đúng sức.', N'Tránh dép trơn, giữ trật tự ở khu chùa, không vẽ bậy trong hang.', N'#NguHanhSon #DaNang #HangDong #VanHoa #CheckIn', N'S1', N'', N'approved_seed', 1, SYSUTCDATETIME(), SYSUTCDATETIME());
END

IF NOT EXISTS (SELECT 1 FROM community_reviews WHERE review_id = N'RV004')
BEGIN
    INSERT INTO community_reviews
    (review_id, author_name, province, place_name, category, rating, title, short_caption, content, tips, tags, source_ref, image_url, status, is_seed, created_at, updated_at)
    VALUES
    (N'RV004', N'Gia Hân', N'Đà Nẵng', N'Cầu Rồng - Sông Hàn', N'Vui chơi đêm / check-in', 4.8,
     N'Tối ở sông Hàn: vừa đi dạo vừa cảm nhận Đà Nẵng rất trẻ', N'Điểm hợp để đăng review vui chơi buổi tối, ăn vặt, chụp ảnh ánh đèn.', N'Buổi tối ở khu sông Hàn rất dễ chịu vì có gió, nhiều quán ăn và các điểm chụp ảnh gần nhau. Mình đi bộ từ khu Cầu Rồng, ghé vài quán nước rồi đứng ngắm thành phố lên đèn. Cảm giác không quá xô bồ nhưng vẫn có năng lượng du lịch rõ ràng. Nếu đi nhóm bạn, đây là nơi dễ “kéo mood” nhất sau một ngày tắm biển hoặc tham quan. Ảnh chụp ở lan can sông, hướng về cầu, lên màu khá đẹp. Mình khuyên nên đi sau bữa tối, mặc đồ thoải mái, mang ít đồ vì phải đi bộ khá nhiều. Bài review kiểu này rất hợp cho mục cộng đồng vì dễ gợi ý lịch trình ngắn 1-2 tiếng.', N'Cuối tuần có thể đông, nên giữ điện thoại cẩn thận và chọn vị trí đứng an toàn.', N'#CauRong #SongHan #DaNangNight #VuiChoi #CheckInDem', N'S1', N'', N'approved_seed', 1, SYSUTCDATETIME(), SYSUTCDATETIME());
END

IF NOT EXISTS (SELECT 1 FROM community_reviews WHERE review_id = N'RV005')
BEGIN
    INSERT INTO community_reviews
    (review_id, author_name, province, place_name, category, rating, title, short_caption, content, tips, tags, source_ref, image_url, status, is_seed, created_at, updated_at)
    VALUES
    (N'RV005', N'Phúc Khang', N'Đà Nẵng', N'Bà Nà Hills - Cầu Vàng', N'Vui chơi / check-in nổi bật', 4.6,
     N'Bà Nà hợp cho ngày muốn có thật nhiều ảnh trong một chuyến đi', N'Không gian kiểu khu vui chơi - nghỉ dưỡng, nên đi sớm để tránh đông.', N'Bà Nà Hills là điểm mình xem như một “combo ảnh”: cáp treo, Cầu Vàng, vườn hoa, làng Pháp và nhiều góc kiến trúc lạ. Điểm mạnh là mọi thứ được tổ chức thành khu, dễ đi theo nhóm gia đình hoặc bạn bè. Cầu Vàng đẹp nhất lúc trời quang, nhưng nếu có sương nhẹ lại cho cảm giác rất khác, ảnh hơi huyền ảo. Nhược điểm là dễ đông và di chuyển nhiều, nên chuẩn bị pin điện thoại, áo khoác mỏng và giày êm. Bài review nên ghi rõ đây là trải nghiệm vui chơi cả ngày, không phải điểm ghé nhanh. Nếu người dùng SmartBus cần gợi ý, có thể phân loại “check-in nổi bật, phù hợp nhóm, chi phí cao hơn mặt bằng chung”.', N'Đi sớm, xem dự báo thời tiết, mang áo khoác vì trên cao có thể lạnh hơn thành phố.', N'#BaNaHills #CauVang #DaNang #VuiChoi #CheckIn', N'S1', N'', N'approved_seed', 1, SYSUTCDATETIME(), SYSUTCDATETIME());
END

IF NOT EXISTS (SELECT 1 FROM community_reviews WHERE review_id = N'RV006')
BEGIN
    INSERT INTO community_reviews
    (review_id, author_name, province, place_name, category, rating, title, short_caption, content, tips, tags, source_ref, image_url, status, is_seed, created_at, updated_at)
    VALUES
    (N'RV006', N'Quốc Bảo', N'Đà Nẵng - Huế', N'Đèo Hải Vân', N'Phượt nhẹ / ngắm cảnh', 4.9,
     N'Hải Vân đẹp nhất khi đi chậm, dừng đúng chỗ và đừng vội', N'Cung đường hợp với người thích biển, núi và ảnh phong cảnh rộng.', N'Đi đèo Hải Vân là trải nghiệm mình nhớ nhất vì cảnh đổi liên tục: một bên núi, một bên biển, phía xa là vịnh và đường tàu. Nếu trời trong, các khúc cua nhìn xuống rất đã mắt. Điều quan trọng là không nên biến chuyến này thành cuộc chạy tốc độ; cứ đi chậm, dừng ở điểm an toàn rồi chụp vài tấm là đủ. Với người lần đầu đến miền Trung, cung này giúp hiểu vì sao Đà Nẵng, Lăng Cô và Huế có cảm giác gần nhau nhưng mỗi nơi lại rất khác. Bài review phù hợp nhóm “du lịch trải nghiệm” hơn là “vui chơi”. Ai không chắc tay lái nên đi ô tô hoặc tour nhỏ để an toàn.', N'Không dừng giữa cua, không đi khi mưa lớn/sương dày, kiểm tra xăng và thắng xe.', N'#HaiVanPass #DaNang #Hue #PhuotNhe #NgamCanh', N'S1', N'', N'approved_seed', 1, SYSUTCDATETIME(), SYSUTCDATETIME());
END

IF NOT EXISTS (SELECT 1 FROM community_reviews WHERE review_id = N'RV007')
BEGIN
    INSERT INTO community_reviews
    (review_id, author_name, province, place_name, category, rating, title, short_caption, content, tips, tags, source_ref, image_url, status, is_seed, created_at, updated_at)
    VALUES
    (N'RV007', N'Tú Uyên', N'Đà Nẵng', N'Mì Quảng - hải sản ven biển', N'Đặc sản / ăn uống', 4.8,
     N'Đà Nẵng ăn đơn giản mà rất “đã”: mì Quảng rồi thêm hải sản là đủ no vui', N'Bài review ẩm thực hợp gợi ý cho khách lần đầu đến Đà Nẵng.', N'Mình thích ẩm thực Đà Nẵng vì không cần tìm chỗ quá sang vẫn ăn ngon. Buổi trưa ăn một tô mì Quảng có rau sống, đậu phộng, bánh tráng giòn; buổi tối ra khu gần biển gọi hải sản hấp, nướng, vài món ốc là chuyến đi có vị ngay. Mì Quảng ở đây không giống mì nước đầy bát mà có phần nước vừa đủ, ăn đậm nhưng không ngấy. Hải sản thì nên hỏi giá rõ trước khi gọi và chọn quán đông khách địa phương. Với tính năng cộng đồng review, nên cho người dùng chấm riêng “độ ngon”, “giá hợp lý”, “dễ tìm”. Bài này hợp làm mẫu review đặc sản vì ngắn, thật và dễ khơi gợi bình luận.', N'Hỏi giá trước, ưu tiên quán niêm yết rõ; đi nhóm sẽ gọi được nhiều món hơn.', N'#MiQuang #HaiSan #DaNangFood #DacSan #AnGi', N'S1', N'', N'approved_seed', 1, SYSUTCDATETIME(), SYSUTCDATETIME());
END

IF NOT EXISTS (SELECT 1 FROM community_reviews WHERE review_id = N'RV008')
BEGIN
    INSERT INTO community_reviews
    (review_id, author_name, province, place_name, category, rating, title, short_caption, content, tips, tags, source_ref, image_url, status, is_seed, created_at, updated_at)
    VALUES
    (N'RV008', N'Khánh Vy', N'Đà Nẵng', N'Khu An Thượng - gần biển Mỹ Khê', N'Chỗ nghỉ / cafe / đi bộ', 4.7,
     N'Ở gần An Thượng rất tiện: sáng ra biển, tối đi ăn không cần di chuyển xa', N'Gợi ý cho khách trẻ, nhóm bạn hoặc người muốn nghỉ gần biển.', N'Mình chọn ở khu gần An Thượng vì muốn đi bộ ra biển Mỹ Khê và tối có nhiều quán ăn, cafe. Cảm giác tiện hơn ở quá xa trung tâm vì lịch trình không bị phụ thuộc xe. Buổi sáng có thể ra biển nhanh, trưa về nghỉ, chiều đi Sơn Trà hoặc Ngũ Hành Sơn, tối lại xuống phố ăn uống. Chỗ nghỉ ở khu này có nhiều kiểu từ homestay nhỏ đến khách sạn hiện đại, nên review nên tập trung vào tiêu chí: sạch, gần biển, dễ gọi xe, có chỗ gửi xe và cách âm ổn. Nếu đưa vào SmartBus, bài này nên gắn với nhóm “nghỉ ngơi tiện di chuyển” chứ không chỉ đánh giá phòng đẹp.', N'Xem kỹ khoảng cách thực tới biển, hỏi chỗ gửi xe và giờ nhận/trả phòng.', N'#AnThuong #MyKhe #ChoNghi #DaNangStay #Cafe', N'S1', N'', N'approved_seed', 1, SYSUTCDATETIME(), SYSUTCDATETIME());
END

IF NOT EXISTS (SELECT 1 FROM community_reviews WHERE review_id = N'RV009')
BEGIN
    INSERT INTO community_reviews
    (review_id, author_name, province, place_name, category, rating, title, short_caption, content, tips, tags, source_ref, image_url, status, is_seed, created_at, updated_at)
    VALUES
    (N'RV009', N'Lan Chi', N'Quảng Nam cũ / Hội An', N'Phố cổ Hội An', N'Check-in / văn hóa', 5.0,
     N'Hội An buổi tối: đèn lồng, sông Hoài và nhịp đi bộ rất chậm', N'Một trong những review cần có cho cộng đồng vì ai đi Hội An cũng muốn hỏi lịch buổi tối.', N'Hội An đẹp nhất với mình là lúc vừa lên đèn. Đi bộ trong phố cổ, nhìn đèn lồng phản chiếu xuống sông Hoài, nghe tiếng người bán hàng và thỉnh thoảng gặp một chiếc thuyền trôi chậm, cảm giác rất khác với các thành phố biển hiện đại. Ảnh ở Hội An không cần tạo dáng quá nhiều, chỉ cần đứng ở góc tường vàng, cửa gỗ cũ hoặc ven sông là đủ có không khí. Tuy nhiên nên đi có ý thức: không chen lấn, không xả rác, hạn chế nói quá to ở khu phố cổ. Bài review này hợp để gợi ý “đi chậm, ngắm nhiều, chụp vừa đủ” thay vì chỉ chạy theo ảnh đẹp.', N'Đi bộ là chính, nên mang giày êm; tránh giờ quá đông nếu muốn chụp ảnh sạch nền.', N'#HoiAn #PhoCo #DenLong #CheckIn #SongHoai', N'S2', N'', N'approved_seed', 1, SYSUTCDATETIME(), SYSUTCDATETIME());
END

IF NOT EXISTS (SELECT 1 FROM community_reviews WHERE review_id = N'RV010')
BEGIN
    INSERT INTO community_reviews
    (review_id, author_name, province, place_name, category, rating, title, short_caption, content, tips, tags, source_ref, image_url, status, is_seed, created_at, updated_at)
    VALUES
    (N'RV010', N'Nhật Minh', N'Quảng Nam cũ / Hội An', N'Biển An Bàng', N'Biển / nghỉ ngơi', 4.8,
     N'An Bàng là kiểu biển để nằm nghe sóng, không cần làm gì nhiều', N'Phù hợp khách muốn nghỉ nhẹ sau khi đi phố cổ.', N'Sau một buổi tối đi phố cổ, mình chọn An Bàng cho buổi sáng hôm sau và thấy rất hợp lý. Biển không tạo cảm giác quá công nghiệp, vẫn có hàng quán, ghế nghỉ, đồ ăn nhưng nhịp nhìn chung khá thư giãn. Điểm mình thích là có thể vừa tắm biển, vừa gọi nước, đọc sách hoặc ngồi nhìn sóng. Nếu đi từ phố cổ thì thời gian di chuyển ngắn, rất hợp để ghép lịch nửa ngày. Bài review này nên xếp vào nhóm “biển nghỉ ngơi” hơn là “vui chơi mạnh”. Với người đi cùng gia đình hoặc cặp đôi, An Bàng là nơi dễ chịu để cân bằng lại chuyến đi sau những điểm đông khách.', N'Mang kem chống nắng, hỏi giá ghế/nước trước khi ngồi, giữ vệ sinh bãi biển.', N'#AnBang #HoiAn #Bien #NghiNgoi #BeachDay', N'S2', N'', N'approved_seed', 1, SYSUTCDATETIME(), SYSUTCDATETIME());
END

IF NOT EXISTS (SELECT 1 FROM community_reviews WHERE review_id = N'RV011')
BEGIN
    INSERT INTO community_reviews
    (review_id, author_name, province, place_name, category, rating, title, short_caption, content, tips, tags, source_ref, image_url, status, is_seed, created_at, updated_at)
    VALUES
    (N'RV011', N'Thành Đạt', N'Quảng Nam cũ / Hội An', N'Cù Lao Chàm', N'Biển đảo / vui chơi', 4.7,
     N'Cù Lao Chàm hợp cho ngày muốn rời đất liền và nhìn biển trong hơn', N'Nên phân loại là trải nghiệm đảo, phù hợp đi theo tour/ngày.', N'Cù Lao Chàm cho cảm giác chuyến đi “đổi cảnh” rõ rệt so với phố cổ. Đi tàu ra đảo, nhìn nước biển đổi màu và các bãi nhỏ hiện ra, mình thấy rất đáng nếu lịch trình Hội An có thêm một ngày. Hoạt động thường được nhắc tới là tắm biển, ngắm san hô, ăn hải sản và đi dạo quanh khu dân cư. Điểm cần lưu ý là thời tiết ảnh hưởng khá nhiều, biển động hoặc mưa thì trải nghiệm giảm mạnh. Bài review này nên có nhãn “phụ thuộc thời tiết” để người dùng biết trước. Không nên mang quá nhiều đồ, và nếu có đi lặn/ngắm san hô thì cần tuân thủ hướng dẫn để không làm hỏng môi trường biển.', N'Kiểm tra thời tiết, đặt tour uy tín, không bẻ san hô hoặc mang sinh vật biển về.', N'#CuLaoCham #HoiAn #BienDao #SanHo #VuiChoi', N'S2', N'', N'approved_seed', 1, SYSUTCDATETIME(), SYSUTCDATETIME());
END

IF NOT EXISTS (SELECT 1 FROM community_reviews WHERE review_id = N'RV012')
BEGIN
    INSERT INTO community_reviews
    (review_id, author_name, province, place_name, category, rating, title, short_caption, content, tips, tags, source_ref, image_url, status, is_seed, created_at, updated_at)
    VALUES
    (N'RV012', N'Mỹ Duyên', N'Quảng Nam cũ / Hội An', N'Làng rau Trà Quế', N'Du lịch xanh / trải nghiệm', 4.6,
     N'Đạp xe qua Trà Quế: Hội An không chỉ có phố cổ', N'Review phù hợp nhóm thích trải nghiệm địa phương, ảnh đồng ruộng, sống chậm.', N'Đi Trà Quế bằng xe đạp là một trải nghiệm rất nhẹ nhưng lại làm chuyến Hội An đầy hơn. Đường qua cánh đồng, ao nhỏ và vườn rau khiến mình cảm giác thành phố được mở rộng ra ngoài phố cổ. Mình thích nhất là mùi rau, đất ẩm và không khí buổi sáng. Ảnh ở đây không quá rực rỡ nhưng rất đời: nón lá, luống rau, đường nhỏ, ánh nắng thấp. Nếu tính năng cộng đồng có bộ lọc, nên để Trà Quế ở nhóm “trải nghiệm địa phương” hoặc “du lịch xanh”. Người thích check-in sang chảnh có thể thấy bình thường, nhưng ai thích nhịp chậm sẽ rất hợp.', N'Đi sáng sớm, đội nón, mang nước; nếu tham gia hoạt động làm vườn thì nên hỏi trước.', N'#TraQue #HoiAn #DuLichXanh #DapXe #TraiNghiem', N'S2', N'', N'approved_seed', 1, SYSUTCDATETIME(), SYSUTCDATETIME());
END

IF NOT EXISTS (SELECT 1 FROM community_reviews WHERE review_id = N'RV013')
BEGIN
    INSERT INTO community_reviews
    (review_id, author_name, province, place_name, category, rating, title, short_caption, content, tips, tags, source_ref, image_url, status, is_seed, created_at, updated_at)
    VALUES
    (N'RV013', N'Hải Đăng', N'Quảng Nam cũ', N'Thánh địa Mỹ Sơn', N'Di sản / văn hóa', 4.8,
     N'Mỹ Sơn cổ kính, hợp với người thích lịch sử và ảnh màu đất nung', N'Một điểm nên có trong gợi ý “đi ngoài Hội An” cho khách thích di sản.', N'Mỹ Sơn không phải kiểu điểm đến ồn ào, nhưng càng đi càng thấy cuốn. Những cụm tháp Chăm nằm trong thung lũng, màu gạch cũ nổi lên giữa cây xanh, tạo cảm giác rất khác phố cổ Hội An. Mình khuyên nên đọc qua thông tin trước khi đi, vì hiểu bối cảnh sẽ thấy công trình đáng giá hơn nhiều. Góc chụp đẹp là các lối đi có tháp phía sau, nhưng nên tôn trọng khu di tích, không leo trèo lên nền cổ. Nếu viết review cho cộng đồng, nên nhấn mạnh đây là chuyến nửa ngày, phù hợp người thích văn hóa, lịch sử và kiến trúc. Đi nắng khá mệt nên ưu tiên sáng sớm.', N'Mang mũ, nước, giày êm; không chạm/leo lên hiện vật trong khu di tích.', N'#MySon #QuangNam #DiSan #Cham #VanHoa', N'S2', N'', N'approved_seed', 1, SYSUTCDATETIME(), SYSUTCDATETIME());
END

IF NOT EXISTS (SELECT 1 FROM community_reviews WHERE review_id = N'RV014')
BEGIN
    INSERT INTO community_reviews
    (review_id, author_name, province, place_name, category, rating, title, short_caption, content, tips, tags, source_ref, image_url, status, is_seed, created_at, updated_at)
    VALUES
    (N'RV014', N'Ánh Ngọc', N'Quảng Nam cũ / Hội An', N'Ẩm thực Hội An', N'Đặc sản / ăn uống', 4.9,
     N'Cao lầu, hoành thánh, bánh bao bánh vạc: Hội An ăn món nào cũng có câu chuyện', N'Bài mẫu ẩm thực nên gợi ý đi theo nhóm để thử được nhiều món.', N'Ẩm thực Hội An làm mình thích vì mỗi món có một nét riêng. Cao lầu có sợi mì chắc, ăn với rau và thịt khá đậm; hoành thánh thì giòn hoặc mềm tùy quán; bánh bao bánh vạc nhẹ hơn, hợp ăn thử. Đi chợ hoặc các quán lâu năm trong phố cổ rất vui vì vừa ăn vừa nhìn nhịp sống địa phương. Mình nghĩ nên để người dùng cộng đồng chấm từng món thay vì chấm chung cả “ẩm thực Hội An”, vì có người mê cao lầu nhưng lại thấy món khác bình thường. Bài này có thể dùng làm seed cho tính năng gợi ý chatbot: khi khách hỏi “đến Hội An ăn gì?” thì hệ thống trả ra vài món kèm review ngắn.', N'Đi nhóm 2-4 người để gọi nhiều món nhỏ; hỏi món có cay/ngọt nếu không quen khẩu vị.', N'#CaoLau #HoiAnFood #DacSan #HoanhThanh #BanhVac', N'S2', N'', N'approved_seed', 1, SYSUTCDATETIME(), SYSUTCDATETIME());
END

IF NOT EXISTS (SELECT 1 FROM community_reviews WHERE review_id = N'RV015')
BEGIN
    INSERT INTO community_reviews
    (review_id, author_name, province, place_name, category, rating, title, short_caption, content, tips, tags, source_ref, image_url, status, is_seed, created_at, updated_at)
    VALUES
    (N'RV015', N'Thảo My', N'Quảng Nam cũ / Hội An', N'Homestay ven sông / gần phố cổ Hội An', N'Chỗ nghỉ / sống chậm', 4.7,
     N'Ở Hội An nên thử một đêm gần sông hoặc gần phố cổ để đi bộ thật nhiều', N'Review chỗ nghỉ dạng trải nghiệm, không gắn tên khách sạn cụ thể.', N'Mình thấy Hội An hợp với kiểu ở homestay nhỏ, có xe đạp, sân vườn hoặc ban công nhìn ra đường yên tĩnh. Không nhất thiết phải ở ngay giữa phố cổ, chỉ cần đi bộ hoặc đạp xe thuận tiện là đã đủ. Buổi sáng đạp xe ra quán ăn, chiều nghỉ ở phòng, tối đi bộ vào khu đèn lồng, nhịp chuyến đi rất nhẹ. Khi review chỗ nghỉ, nên đánh giá kỹ: phòng có sạch không, có ẩm không, đường về tối có dễ đi không, chủ nhà có hỗ trợ thuê xe/đặt tour không. Đây là kiểu nội dung cộng đồng rất hữu ích vì khách thường cần cảm nhận thật hơn là ảnh phòng quá chỉnh sửa.', N'Xem vị trí trên bản đồ, hỏi có xe đạp miễn phí/thuê không, kiểm tra đánh giá về tiếng ồn.', N'#HoiAnStay #Homestay #ChoNghi #SongCham #GanPhoCo', N'S2', N'', N'approved_seed', 1, SYSUTCDATETIME(), SYSUTCDATETIME());
END

IF NOT EXISTS (SELECT 1 FROM community_reviews WHERE review_id = N'RV016')
BEGIN
    INSERT INTO community_reviews
    (review_id, author_name, province, place_name, category, rating, title, short_caption, content, tips, tags, source_ref, image_url, status, is_seed, created_at, updated_at)
    VALUES
    (N'RV016', N'Ngọc Sơn', N'Huế', N'Đại Nội Huế', N'Di sản / tham quan', 4.9,
     N'Đại Nội Huế: càng đi chậm càng thấy nhiều lớp lịch sử', N'Review cốt lõi cho Huế, phù hợp du khách thích văn hóa và ảnh kiến trúc.', N'Đại Nội là điểm mình nghĩ nên dành nhiều thời gian hơn dự tính. Nếu chỉ vào chụp vài tấm rồi ra thì hơi phí, vì các cổng, sân, điện, hành lang và mảng tường cũ đều có câu chuyện riêng. Mình đi buổi sáng, nắng chưa quá gắt, màu đỏ - vàng của kiến trúc lên ảnh rất đẹp. Không gian rộng nên nên chuẩn bị nước và giày êm. Với tính năng cộng đồng, bài review này nên cho phép người dùng đánh dấu “đã đi theo hướng dẫn viên” hoặc “tự đi”, vì hiểu lịch sử sẽ làm trải nghiệm khác hẳn. Đây không phải nơi để vui chơi ồn ào mà là nơi nên đi chậm và quan sát.', N'Đi sáng, mang mũ; nếu có thể nên thuê thuyết minh/hướng dẫn để hiểu sâu hơn.', N'#DaiNoiHue #Hue #DiSan #LichSu #CheckIn', N'S3', N'', N'approved_seed', 1, SYSUTCDATETIME(), SYSUTCDATETIME());
END

IF NOT EXISTS (SELECT 1 FROM community_reviews WHERE review_id = N'RV017')
BEGIN
    INSERT INTO community_reviews
    (review_id, author_name, province, place_name, category, rating, title, short_caption, content, tips, tags, source_ref, image_url, status, is_seed, created_at, updated_at)
    VALUES
    (N'RV017', N'Việt Hà', N'Huế', N'Chùa Thiên Mụ - sông Hương', N'Tâm linh / ngắm cảnh', 4.8,
     N'Thiên Mụ và sông Hương: Huế dịu nhất là khi đứng yên một lúc', N'Phù hợp lịch trình nhẹ, không mất quá nhiều sức, ảnh đẹp ở tháp và bờ sông.', N'Chùa Thiên Mụ không làm mình choáng ngợp theo kiểu hoành tráng, mà đẹp ở sự yên tĩnh. Đi qua cổng, nhìn tháp, nghe tiếng gió từ sông Hương lên, tự nhiên thấy chuyến đi chậm lại. Mình thích nhất là sau khi tham quan chùa, đứng ở mép nhìn xuống sông và thấy thuyền trôi rất chậm. Ảnh ở đây nên chụp lịch sự, tránh tạo dáng phản cảm trong không gian tâm linh. Nếu app SmartBus có phần gợi ý gần tuyến đi, đây là điểm nên ghép với Đại Nội hoặc các lăng trong cùng ngày. Bài review nên để tag “nhẹ nhàng, văn hóa, ngắm sông” vì đúng cảm giác Huế.', N'Ăn mặc lịch sự, nói nhỏ, không chụp ảnh gây ảnh hưởng người đi lễ.', N'#ThienMu #SongHuong #Hue #TamLinh #NgamCanh', N'S3', N'', N'approved_seed', 1, SYSUTCDATETIME(), SYSUTCDATETIME());
END

IF NOT EXISTS (SELECT 1 FROM community_reviews WHERE review_id = N'RV018')
BEGIN
    INSERT INTO community_reviews
    (review_id, author_name, province, place_name, category, rating, title, short_caption, content, tips, tags, source_ref, image_url, status, is_seed, created_at, updated_at)
    VALUES
    (N'RV018', N'Đức Anh', N'Huế', N'Lăng Minh Mạng - Khải Định - Tự Đức', N'Di sản / kiến trúc', 4.8,
     N'Đi lăng ở Huế: mỗi nơi một kiểu, đừng chỉ chọn một điểm vì ảnh mạng', N'Bài review so sánh nhẹ, giúp người dùng chọn lịch trình theo sở thích.', N'Các lăng ở Huế có cảm giác khác nhau. Lăng Minh Mạng cân đối, nhiều hồ nước và cây; lăng Tự Đức thơ và trầm hơn; lăng Khải Định lại gây ấn tượng bằng chi tiết trang trí và kiến trúc lạ. Nếu có thời gian, nên đi ít nhất hai lăng để thấy rõ sự khác biệt. Mình thích cách Huế dùng không gian, trục đường, bậc thềm và mặt nước để tạo cảm giác trang nghiêm. Nhược điểm là di chuyển giữa các điểm có thể mất thời gian, nên lên lịch rõ thay vì đi ngẫu hứng. Với cộng đồng review, bài này nên gắn bộ lọc “kiến trúc”, “ảnh đẹp”, “cần di chuyển bằng xe”.', N'Mang nước, giày êm; ưu tiên sáng/chiều mát vì nhiều khu vực ngoài trời.', N'#LangHue #MinhMang #KhaiDinh #TuDuc #KienTruc', N'S3', N'', N'approved_seed', 1, SYSUTCDATETIME(), SYSUTCDATETIME());
END

IF NOT EXISTS (SELECT 1 FROM community_reviews WHERE review_id = N'RV019')
BEGIN
    INSERT INTO community_reviews
    (review_id, author_name, province, place_name, category, rating, title, short_caption, content, tips, tags, source_ref, image_url, status, is_seed, created_at, updated_at)
    VALUES
    (N'RV019', N'Hương Ly', N'Huế', N'Chợ Đông Ba - ẩm thực Huế', N'Đặc sản / chợ địa phương', 4.7,
     N'Ăn ở chợ Đông Ba: vị Huế nhỏ nhỏ mà nhớ lâu', N'Bài review ẩm thực tập trung vào trải nghiệm chợ, món ăn dân dã.', N'Chợ Đông Ba là nơi mình thấy rõ “vị Huế” nhất. Không gian chợ đông, nhiều hàng, nhiều mùi đồ ăn nên ai thích trải nghiệm địa phương sẽ rất hợp. Mình thử bánh bèo, bánh khoái, chè và vài món nhỏ, phần ăn không quá lớn nên có thể thử nhiều món. Cái hay là món Huế thường nhỏ xinh nhưng vị đậm, ăn chậm mới cảm nhận được. Tuy nhiên chợ đông nên phải giữ đồ cá nhân, hỏi giá trước và chọn hàng sạch sẽ. Nếu đưa vào tính năng review, nên cho người dùng bình luận về từng quầy/món để sau này chatbot gợi ý chính xác hơn: “ăn nhẹ”, “ăn no”, “mua đặc sản mang về”.', N'Đi lúc không quá đói để chọn món tỉnh táo; chuẩn bị tiền lẻ và hỏi giá rõ.', N'#ChoDongBa #HueFood #DacSanHue #AnVat #ChoDiaPhuong', N'S3', N'', N'approved_seed', 1, SYSUTCDATETIME(), SYSUTCDATETIME());
END

IF NOT EXISTS (SELECT 1 FROM community_reviews WHERE review_id = N'RV020')
BEGIN
    INSERT INTO community_reviews
    (review_id, author_name, province, place_name, category, rating, title, short_caption, content, tips, tags, source_ref, image_url, status, is_seed, created_at, updated_at)
    VALUES
    (N'RV020', N'Đình Phong', N'Huế', N'Đầm Lập An - biển Lăng Cô', N'Biển / nghỉ ngơi', 4.8,
     N'Lập An - Lăng Cô: nơi hợp để dừng lại giữa Huế và Đà Nẵng', N'Review nghỉ ngơi ven nước, hợp lịch trình đi qua đèo Hải Vân.', N'Nếu đi từ Đà Nẵng ra Huế hoặc ngược lại, mình rất khuyên dừng ở khu Lập An - Lăng Cô. Không khí ở đây khác trung tâm Huế: rộng, thoáng, có mặt nước, núi và biển gần nhau. Đầm Lập An hợp chụp ảnh lúc nước rút hoặc chiều muộn, còn Lăng Cô hợp nghỉ ăn hải sản, uống nước rồi đi tiếp. Điểm này không cần quá nhiều hoạt động, cái đáng giá là cảm giác được thở và nhìn cảnh. Với app du lịch, nên gắn điểm này vào nhóm “trạm dừng nghỉ đẹp” hoặc “nghỉ giữa chặng”. Người dùng đi bằng xe máy/ô tô sẽ cần thông tin chỗ dừng an toàn, quán ăn và thời điểm ánh sáng đẹp.', N'Đi chiều mát, kiểm tra thời tiết; không đi xuống bãi bùn/nước nếu không chắc an toàn.', N'#LapAn #LangCo #Hue #NghiNgoi #Bien', N'S3', N'', N'approved_seed', 1, SYSUTCDATETIME(), SYSUTCDATETIME());
END

IF NOT EXISTS (SELECT 1 FROM community_reviews WHERE review_id = N'RV021')
BEGIN
    INSERT INTO community_reviews
    (review_id, author_name, province, place_name, category, rating, title, short_caption, content, tips, tags, source_ref, image_url, status, is_seed, created_at, updated_at)
    VALUES
    (N'RV021', N'Thu Phương', N'Huế', N'Nhà vườn / homestay yên tĩnh ở Huế', N'Chỗ nghỉ / thư giãn', 4.7,
     N'Ở Huế nên thử chỗ nghỉ có sân vườn: sáng dậy nghe chim hơn nghe còi xe', N'Nội dung review chỗ nghỉ mềm, hợp người muốn trải nghiệm Huế chậm.', N'Huế làm mình nhớ nhất không chỉ vì điểm tham quan mà còn vì nhịp nghỉ. Mình chọn một chỗ nghỉ yên tĩnh, có sân nhỏ, cây xanh và khu uống trà. Sau một ngày đi Đại Nội, lăng và chợ, về phòng có không gian xanh để ngồi lại thật sự rất đáng. Với Huế, chỗ nghỉ không cần quá sang, nhưng nên sạch, thoáng, ít ồn và thuận tiện gọi xe. Bài review kiểu này giúp khách hiểu rằng “nghỉ ngơi” cũng là một phần của chuyến đi chứ không chỉ là nơi ngủ. Nếu đưa vào dữ liệu cộng đồng, nên có các tiêu chí riêng: độ yên tĩnh, gần trung tâm, hỗ trợ thuê xe, bữa sáng và sự thân thiện của chủ nhà.', N'Đọc kỹ review về độ ẩm/phòng kín; chọn nơi có ảnh thật và phản hồi gần đây.', N'#HueStay #Homestay #NhaVuon #NghiNgoi #SongCham', N'S3', N'', N'approved_seed', 1, SYSUTCDATETIME(), SYSUTCDATETIME());
END

IF NOT EXISTS (SELECT 1 FROM community_reviews WHERE review_id = N'RV022')
BEGIN
    INSERT INTO community_reviews
    (review_id, author_name, province, place_name, category, rating, title, short_caption, content, tips, tags, source_ref, image_url, status, is_seed, created_at, updated_at)
    VALUES
    (N'RV022', N'Quỳnh Nhi', N'Quảng Trị', N'Biển Cửa Tùng', N'Biển / nghỉ dưỡng nhẹ', 4.7,
     N'Cửa Tùng không quá rộng nhưng có nét riêng rất yên', N'Biển phù hợp cho người thích không gian nhẹ, kết hợp tham quan di tích gần đó.', N'Cửa Tùng cho mình cảm giác khác các bãi biển du lịch quá nổi tiếng. Bãi không quá dài, nhưng nước xanh, cát mịn và không khí khá thư thả. Điều đặc biệt là quanh khu này có thể ghép đi Vịnh Mốc, cầu Hiền Lương - sông Bến Hải nên chuyến đi vừa có biển vừa có chiều sâu lịch sử. Mình thích đi dạo trên bãi, ăn hải sản địa phương rồi ngồi nhìn đảo Cồn Cỏ phía xa khi trời quang. Nếu đưa vào cộng đồng review, nên nhấn mạnh Cửa Tùng hợp nghỉ nhẹ, đi gia đình hoặc người thích chậm, không phải nơi quá nhiều trò chơi biển. Bài này rất hợp nhóm “biển yên, dễ kết hợp di tích”.', N'Đi mùa nắng, hỏi kỹ chỗ tắm an toàn; ghép lịch với Vịnh Mốc hoặc Hiền Lương.', N'#CuaTung #QuangTri #Bien #NghiDuong #HaiSan', N'S4', N'', N'approved_seed', 1, SYSUTCDATETIME(), SYSUTCDATETIME());
END

IF NOT EXISTS (SELECT 1 FROM community_reviews WHERE review_id = N'RV023')
BEGIN
    INSERT INTO community_reviews
    (review_id, author_name, province, place_name, category, rating, title, short_caption, content, tips, tags, source_ref, image_url, status, is_seed, created_at, updated_at)
    VALUES
    (N'RV023', N'Văn Toàn', N'Quảng Trị', N'Địa đạo Vịnh Mốc', N'Lịch sử / tham quan', 4.9,
     N'Vịnh Mốc là điểm khiến chuyến Quảng Trị trầm lại nhưng rất đáng đi', N'Review phù hợp nhóm khách thích lịch sử, cần thái độ tham quan nghiêm túc.', N'Địa đạo Vịnh Mốc không phải điểm vui chơi, nhưng là nơi để hiểu một phần rất thật của Quảng Trị. Khi đi xuống lòng đất, không gian hẹp và mát làm mình tưởng tượng được cuộc sống thời chiến khó khăn đến mức nào. Đây là trải nghiệm nên đi cùng thuyết minh hoặc đọc trước thông tin để không chỉ “vào xem cho biết”. Mình nghĩ cộng đồng review nên có nhãn riêng cho các điểm lịch sử: trang nghiêm, cần giữ trật tự, không đùa giỡn. Sau khi tham quan có thể ghép với Cửa Tùng để cân bằng cảm xúc bằng một buổi ngắm biển. Bài review này nên viết chân thành, không tô hồng quá mức, vì giá trị chính là sự lắng lại.', N'Mang giày dễ đi, không chen lấn trong đường hầm, lắng nghe hướng dẫn viên.', N'#VinhMoc #QuangTri #LichSu #DMZ #ThamQuan', N'S10', N'', N'approved_seed', 1, SYSUTCDATETIME(), SYSUTCDATETIME());
END

IF NOT EXISTS (SELECT 1 FROM community_reviews WHERE review_id = N'RV024')
BEGIN
    INSERT INTO community_reviews
    (review_id, author_name, province, place_name, category, rating, title, short_caption, content, tips, tags, source_ref, image_url, status, is_seed, created_at, updated_at)
    VALUES
    (N'RV024', N'Bích Ngân', N'Quảng Trị', N'Cầu Hiền Lương - sông Bến Hải', N'Lịch sử / check-in', 4.8,
     N'Hiền Lương - Bến Hải: một điểm check-in nhưng nên đi bằng sự tôn trọng', N'Phù hợp tuyến tham quan lịch sử Quảng Trị, ảnh đẹp nhưng nội dung nghiêm túc.', N'Cầu Hiền Lương và sông Bến Hải là nơi mình thấy ảnh check-in cần đi cùng câu chuyện. Khung cảnh không quá cầu kỳ, nhưng ý nghĩa lịch sử rất lớn. Đứng ở cầu, nhìn dòng sông và màu sắc biểu tượng, mình có cảm giác đây không chỉ là điểm du lịch mà còn là nơi nhắc về chia cắt và thống nhất. Bài review kiểu này nên giúp người dùng biết cách đi: dành thời gian đọc bảng thông tin, chụp ảnh vừa phải, không đùa cợt phản cảm. Nếu app có gợi ý lịch trình, nên đặt điểm này cùng Vịnh Mốc, Cửa Tùng hoặc Thành cổ Quảng Trị để thành một ngày du lịch lịch sử - biển hợp lý.', N'Đi sáng hoặc chiều mát; đọc thông tin tại điểm tham quan trước khi chụp ảnh.', N'#HienLuong #BenHai #QuangTri #LichSu #CheckIn', N'S10', N'', N'approved_seed', 1, SYSUTCDATETIME(), SYSUTCDATETIME());
END

IF NOT EXISTS (SELECT 1 FROM community_reviews WHERE review_id = N'RV025')
BEGIN
    INSERT INTO community_reviews
    (review_id, author_name, province, place_name, category, rating, title, short_caption, content, tips, tags, source_ref, image_url, status, is_seed, created_at, updated_at)
    VALUES
    (N'RV025', N'Tuấn Kiệt', N'Quảng Trị', N'Khe Sanh - Tà Cơn', N'Lịch sử / đường đèo núi', 4.7,
     N'Khe Sanh không đông, nhưng rất hợp người muốn hiểu miền Tây Quảng Trị', N'Review kết hợp lịch sử chiến trường và cảnh núi rừng.', N'Khe Sanh - Tà Cơn là chuyến đi khác hẳn tuyến biển. Đường lên có núi, rừng và không khí cao hơn, cảnh hai bên khá rộng. Khu căn cứ chiến đấu gợi nhiều suy nghĩ về chiến tranh, còn thị trấn Khe Sanh thì cho cảm giác đời sống vùng cao chậm hơn. Mình thấy điểm này hợp với người thích lịch sử, thích chạy cung đường dài và không ngại di chuyển. Nếu đi một mình bằng xe máy cần chuẩn bị kỹ vì không phải đoạn nào cũng đông dịch vụ. Bài review nên gắn tag “lịch sử”, “đường xa”, “cảnh núi” để người dùng chọn đúng. Không nên kỳ vọng quá nhiều trò giải trí; giá trị chính là câu chuyện và không gian.', N'Đổ đầy xăng, xem thời tiết, đi ban ngày; chuẩn bị áo khoác nếu trời se lạnh.', N'#KheSanh #TaCon #QuangTri #LichSu #DuongNui', N'S5', N'', N'approved_seed', 1, SYSUTCDATETIME(), SYSUTCDATETIME());
END

IF NOT EXISTS (SELECT 1 FROM community_reviews WHERE review_id = N'RV026')
BEGIN
    INSERT INTO community_reviews
    (review_id, author_name, province, place_name, category, rating, title, short_caption, content, tips, tags, source_ref, image_url, status, is_seed, created_at, updated_at)
    VALUES
    (N'RV026', N'Mai Linh', N'Quảng Trị', N'Thành cổ Quảng Trị - sông Thạch Hãn', N'Tưởng niệm / tham quan', 4.8,
     N'Thành cổ Quảng Trị: một buổi chiều lặng và đáng nhớ', N'Bài review dành cho điểm tưởng niệm, cần giọng văn trang trọng.', N'Mình đến Thành cổ Quảng Trị vào buổi chiều, không khí rất lặng. Đây không phải nơi để vui chơi hay chụp ảnh quá nhiều, mà là nơi nên đi chậm, đọc thông tin và giữ sự trang nghiêm. Khuôn viên rộng vừa đủ để dạo, nhưng cảm giác để lại khá sâu. Nếu ghép với sông Thạch Hãn, chuyến đi càng có nhiều cảm xúc hơn. Với tính năng cộng đồng, mình nghĩ các điểm tưởng niệm nên có mẫu review riêng: hạn chế biểu tượng vui nhộn, ưu tiên từ khóa “tri ân”, “lịch sử”, “yên tĩnh”. Bài này có thể giúp người dùng hiểu trước tinh thần điểm đến, tránh đi sai kỳ vọng như tìm trò chơi hoặc quán xá nhộn nhịp.', N'Ăn mặc lịch sự, nói nhỏ, không leo trèo/khuấy động không gian tưởng niệm.', N'#ThanhCoQuangTri #ThachHan #TuongNiem #LichSu #QuangTri', N'S10', N'', N'approved_seed', 1, SYSUTCDATETIME(), SYSUTCDATETIME());
END

IF NOT EXISTS (SELECT 1 FROM community_reviews WHERE review_id = N'RV027')
BEGIN
    INSERT INTO community_reviews
    (review_id, author_name, province, place_name, category, rating, title, short_caption, content, tips, tags, source_ref, image_url, status, is_seed, created_at, updated_at)
    VALUES
    (N'RV027', N'Hữu Phước', N'Quảng Ngãi', N'Đảo Lý Sơn', N'Biển đảo / check-in', 4.9,
     N'Lý Sơn đẹp kiểu núi lửa gặp biển, góc nào cũng có màu rất riêng', N'Một bài review biển đảo nổi bật cho cộng đồng du lịch miền Trung.', N'Lý Sơn làm mình ấn tượng vì không chỉ có biển xanh mà còn có đá núi lửa, ruộng tỏi và vách đá nhìn rất khác những đảo thông thường. Đi trên đảo lớn, có đoạn nhìn xuống biển thấy màu nước rất trong; qua đảo bé thì cảm giác hoang sơ hơn, hợp chụp ảnh và tắm biển nếu thời tiết đẹp. Đây là nơi nên ở ít nhất một đêm để không bị vội, vì phụ thuộc tàu và thời tiết. Bài review nên có cảnh báo rõ: kiểm tra lịch tàu, đặt phòng trước mùa cao điểm, không chủ quan với nắng gió. Với tính năng cộng đồng, Lý Sơn nên nằm trong nhóm “điểm nổi bật - cần chuẩn bị kỹ”.', N'Theo dõi thời tiết/tàu, mang mũ rộng vành, không xả rác ở bãi đá và bãi tắm.', N'#LySon #QuangNgai #BienDao #NuiLua #CheckIn', N'S7', N'', N'approved_seed', 1, SYSUTCDATETIME(), SYSUTCDATETIME());
END

IF NOT EXISTS (SELECT 1 FROM community_reviews WHERE review_id = N'RV028')
BEGIN
    INSERT INTO community_reviews
    (review_id, author_name, province, place_name, category, rating, title, short_caption, content, tips, tags, source_ref, image_url, status, is_seed, created_at, updated_at)
    VALUES
    (N'RV028', N'Diệu Linh', N'Quảng Ngãi', N'Ẩm thực Lý Sơn', N'Đặc sản / hải sản', 4.8,
     N'Đi Lý Sơn nhớ thử món có tỏi và hải sản tươi: ăn xong mới thấy đúng vị đảo', N'Review ẩm thực đảo, nhấn vào tỏi Lý Sơn và hải sản địa phương.', N'Nếu cảnh làm mình nhớ Lý Sơn bằng mắt thì đồ ăn làm mình nhớ bằng vị. Tỏi ở đây xuất hiện trong nhiều món, thơm nhưng không quá gắt nếu chế biến khéo. Hải sản thì nên chọn món đơn giản như hấp, nướng, cháo hoặc gỏi để giữ vị tươi. Mình thích cách bữa ăn trên đảo thường không quá cầu kỳ, nhưng có cảm giác gần biển rất rõ. Khi viết review ẩm thực Lý Sơn, nên tách “ngon” và “giá hợp lý” vì mùa du lịch có thể thay đổi. Bài này phù hợp để chatbot trả lời câu hỏi “đi Lý Sơn ăn gì?” bằng gợi ý: hải sản, món tỏi, quán gần cảng hoặc gần chỗ nghỉ.', N'Hỏi giá trước khi gọi hải sản, chọn quán có menu rõ, ưu tiên món chế biến đơn giản.', N'#LySonFood #ToiLySon #HaiSan #QuangNgai #DacSan', N'S6', N'', N'approved_seed', 1, SYSUTCDATETIME(), SYSUTCDATETIME());
END

IF NOT EXISTS (SELECT 1 FROM community_reviews WHERE review_id = N'RV029')
BEGIN
    INSERT INTO community_reviews
    (review_id, author_name, province, place_name, category, rating, title, short_caption, content, tips, tags, source_ref, image_url, status, is_seed, created_at, updated_at)
    VALUES
    (N'RV029', N'Thanh Tâm', N'Quảng Ngãi', N'Biển Mỹ Khê Quảng Ngãi', N'Biển / cắm trại nhẹ', 4.7,
     N'Mỹ Khê Quảng Ngãi rộng và thoáng, hợp đi nhóm cuối tuần', N'Không nhầm với Mỹ Khê Đà Nẵng; đây là bãi biển riêng của Quảng Ngãi.', N'Biển Mỹ Khê ở Quảng Ngãi có bãi cát dài, không gian thoáng và cảm giác địa phương nhiều hơn du lịch đông đúc. Mình đi cùng nhóm bạn, trải chiếu ngồi chơi, tắm biển nhẹ rồi ăn hải sản gần đó. Điểm cộng là bãi rộng nên không bị bí, hợp với nhóm muốn nghỉ cuối tuần hoặc gia đình có trẻ nhỏ, nhưng vẫn cần chú ý khu vực tắm an toàn. Đây là bài review nên ghi rõ địa điểm để tránh nhầm với Mỹ Khê Đà Nẵng. Với app SmartBus, có thể tạo phân loại “biển gần thành phố Quảng Ngãi”, “đi nhóm”, “nghỉ nửa ngày”. Nếu phát triển tính năng bản đồ, điểm này nên có ảnh bãi cát và gợi ý quán ăn gần biển.', N'Kiểm tra khu vực tắm, đem túi rác riêng nếu ngồi picnic/cắm trại nhẹ.', N'#MyKheQuangNgai #Bien #QuangNgai #DiNhom #Picnic', N'S6', N'', N'approved_seed', 1, SYSUTCDATETIME(), SYSUTCDATETIME());
END

IF NOT EXISTS (SELECT 1 FROM community_reviews WHERE review_id = N'RV030')
BEGIN
    INSERT INTO community_reviews
    (review_id, author_name, province, place_name, category, rating, title, short_caption, content, tips, tags, source_ref, image_url, status, is_seed, created_at, updated_at)
    VALUES
    (N'RV030', N'Trúc Mai', N'Quảng Ngãi', N'Biển Sa Huỳnh', N'Biển / nghỉ ngơi / đặc sản', 4.8,
     N'Sa Huỳnh có cát vàng, biển êm và cảm giác nghỉ chân rất miền Trung', N'Phù hợp người đi dọc Quốc lộ 1A, muốn dừng nghỉ biển và ăn hải sản.', N'Sa Huỳnh gây ấn tượng với màu cát vàng và nhịp biển khá yên. Mình thấy nơi này hợp để dừng một đến hai ngày hơn là chỉ ghé rất nhanh, vì buổi sáng và chiều có hai cảm giác khác nhau. Bãi biển gần các khu lưu trú, xung quanh có hải sản và đặc sản địa phương nên khá tiện cho người đi đường dài. Nếu thích ảnh, nên chụp lúc nắng nghiêng để màu cát lên rõ. Bài review cho cộng đồng nên nhấn vào “nghỉ chân”, “biển cát vàng”, “hải sản”, thay vì mô tả như một khu vui chơi lớn. Sa Huỳnh hợp với người muốn chuyến đi chậm, ăn đơn giản, ngủ gần biển và sáng dậy nghe sóng.', N'Hỏi kỹ tình trạng phòng mùa cao điểm, chọn chỗ nghỉ gần biển nếu muốn đi bộ sáng sớm.', N'#SaHuynh #QuangNgai #BienCatVang #HaiSan #ChoNghi', N'S8', N'', N'approved_seed', 1, SYSUTCDATETIME(), SYSUTCDATETIME());
END

GO
