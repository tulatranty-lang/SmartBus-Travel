const { nowIso } = require('../common/utils/time.util');

const touristCategories = [
  { id: 1, code: 'beach', name: 'Biển' },
  { id: 2, code: 'culture', name: 'Văn hóa' },
  { id: 3, code: 'shopping', name: 'Mua sắm' },
  { id: 4, code: 'checkin', name: 'Check-in' },
  { id: 5, code: 'spiritual', name: 'Tâm linh' },
  { id: 6, code: 'entertainment', name: 'Vui chơi' },
  { id: 7, code: 'nature', name: 'Thiên nhiên' },
  { id: 8, code: 'food', name: 'Ẩm thực' },
];

const touristPlaces = [
  { id: 1, name: 'Hội An', slug: 'hoi-an', description: 'Phố cổ, đèn lồng, ẩm thực và văn hóa di sản. Phù hợp đi tuyến 02 từ Đà Nẵng.', categoryId: 2, category: 'culture', address: 'Phố cổ Hội An, Quảng Nam', latitude: 15.8794, longitude: 108.3380, thumbnailUrl: 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b', openingHours: 'Cả ngày', suggestedDurationMinutes: 180, minBudget: 100000, maxBudget: 450000, averageRating: 4.8, reviewCount: 128, isActive: true, createdAt: nowIso(), updatedAt: nowIso() },
  { id: 2, name: 'Bà Nà Hills', slug: 'ba-na-hills', description: 'Khu du lịch núi nổi tiếng với Cầu Vàng, khí hậu mát và nhiều điểm check-in.', categoryId: 7, category: 'nature', address: 'Hòa Ninh, Hòa Vang, Đà Nẵng', latitude: 15.9975, longitude: 107.9975, thumbnailUrl: 'https://images.unsplash.com/photo-1583417319070-4a69db38a482', openingHours: '07:00 - 17:00', suggestedDurationMinutes: 300, minBudget: 900000, maxBudget: 1500000, averageRating: 4.7, reviewCount: 96, isActive: true, createdAt: nowIso(), updatedAt: nowIso() },
  { id: 3, name: 'Ngũ Hành Sơn', slug: 'ngu-hanh-son', description: 'Danh thắng núi đá vôi, hang động, chùa chiền và làng đá mỹ nghệ Non Nước.', categoryId: 5, category: 'spiritual', address: '81 Huyền Trân Công Chúa, Ngũ Hành Sơn', latitude: 16.0036, longitude: 108.2640, thumbnailUrl: 'https://images.unsplash.com/photo-1528127269322-539801943592', openingHours: '07:00 - 17:30', suggestedDurationMinutes: 120, minBudget: 50000, maxBudget: 200000, averageRating: 4.5, reviewCount: 76, isActive: true, createdAt: nowIso(), updatedAt: nowIso() },
  { id: 4, name: 'Biển Mỹ Khê', slug: 'bien-my-khe', description: 'Bãi biển trung tâm đẹp, dễ tiếp cận bằng xe buýt, hợp tắm biển sáng sớm hoặc chiều mát.', categoryId: 1, category: 'beach', address: 'Võ Nguyên Giáp, Sơn Trà, Đà Nẵng', latitude: 16.0597, longitude: 108.2476, thumbnailUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e', openingHours: 'Cả ngày', suggestedDurationMinutes: 120, minBudget: 0, maxBudget: 250000, averageRating: 4.6, reviewCount: 155, isActive: true, createdAt: nowIso(), updatedAt: nowIso() },
  { id: 5, name: 'Công viên Biển Đông', slug: 'cong-vien-bien-dong', description: 'Không gian biển thoáng, gần bến tuyến 05, nhiều quán cà phê và điểm chụp ảnh.', categoryId: 4, category: 'checkin', address: 'Võ Nguyên Giáp, Sơn Trà', latitude: 16.0686, longitude: 108.2459, thumbnailUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee', openingHours: 'Cả ngày', suggestedDurationMinutes: 90, minBudget: 0, maxBudget: 150000, averageRating: 4.4, reviewCount: 64, isActive: true, createdAt: nowIso(), updatedAt: nowIso() },
  { id: 6, name: 'Cầu Rồng', slug: 'cau-rong', description: 'Biểu tượng Đà Nẵng, đẹp nhất buổi tối; cuối tuần có trình diễn phun lửa/phun nước.', categoryId: 4, category: 'checkin', address: 'Nguyễn Văn Linh, Hải Châu', latitude: 16.0612, longitude: 108.2278, thumbnailUrl: 'https://images.unsplash.com/photo-1528127269322-539801943592', openingHours: 'Cả ngày', suggestedDurationMinutes: 60, minBudget: 0, maxBudget: 120000, averageRating: 4.7, reviewCount: 210, isActive: true, createdAt: nowIso(), updatedAt: nowIso() },
  { id: 7, name: 'Chợ Hàn', slug: 'cho-han', description: 'Chợ trung tâm tiện mua quà, đặc sản và trải nghiệm ẩm thực địa phương.', categoryId: 3, category: 'shopping', address: '119 Trần Phú, Hải Châu', latitude: 16.0680, longitude: 108.2243, thumbnailUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5', openingHours: '06:00 - 19:00', suggestedDurationMinutes: 90, minBudget: 50000, maxBudget: 600000, averageRating: 4.3, reviewCount: 88, isActive: true, createdAt: nowIso(), updatedAt: nowIso() },
  { id: 8, name: 'Chợ Cồn', slug: 'cho-con', description: 'Thiên đường ăn vặt và đặc sản Đà Nẵng, gần trung tâm, dễ kết hợp tuyến bus nội đô.', categoryId: 8, category: 'food', address: '290 Hùng Vương, Hải Châu', latitude: 16.0678, longitude: 108.2148, thumbnailUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836', openingHours: '06:00 - 19:30', suggestedDurationMinutes: 90, minBudget: 50000, maxBudget: 300000, averageRating: 4.5, reviewCount: 103, isActive: true, createdAt: nowIso(), updatedAt: nowIso() },
  { id: 9, name: 'Bảo tàng Chăm', slug: 'bao-tang-cham', description: 'Bảo tàng nghệ thuật điêu khắc Chăm, phù hợp người thích văn hóa lịch sử.', categoryId: 2, category: 'culture', address: '02 đường 2 Tháng 9, Hải Châu', latitude: 16.0603, longitude: 108.2237, thumbnailUrl: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96', openingHours: '07:00 - 17:00', suggestedDurationMinutes: 90, minBudget: 60000, maxBudget: 180000, averageRating: 4.4, reviewCount: 51, isActive: true, createdAt: nowIso(), updatedAt: nowIso() },
  { id: 10, name: 'Bán đảo Sơn Trà', slug: 'ban-dao-son-tra', description: 'Thiên nhiên, biển và điểm ngắm thành phố; nên kiểm tra phương tiện nối chuyến.', categoryId: 7, category: 'nature', address: 'Sơn Trà, Đà Nẵng', latitude: 16.1167, longitude: 108.2734, thumbnailUrl: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e', openingHours: 'Cả ngày', suggestedDurationMinutes: 180, minBudget: 50000, maxBudget: 300000, averageRating: 4.6, reviewCount: 73, isActive: true, createdAt: nowIso(), updatedAt: nowIso() },
  { id: 11, name: 'Chùa Linh Ứng', slug: 'chua-linh-ung', description: 'Điểm tâm linh nổi tiếng ở Sơn Trà với tượng Quan Âm và tầm nhìn biển.', categoryId: 5, category: 'spiritual', address: 'Bãi Bụt, Sơn Trà', latitude: 16.1002, longitude: 108.2762, thumbnailUrl: 'https://images.unsplash.com/photo-1528181304800-259b08848526', openingHours: '06:00 - 18:00', suggestedDurationMinutes: 90, minBudget: 0, maxBudget: 200000, averageRating: 4.6, reviewCount: 84, isActive: true, createdAt: nowIso(), updatedAt: nowIso() },
  { id: 12, name: 'Asia Park / Da Nang Downtown', slug: 'asia-park-da-nang-downtown', description: 'Khu vui chơi giải trí, vòng quay Sun Wheel và nhiều hoạt động buổi tối.', categoryId: 6, category: 'entertainment', address: '01 Phan Đăng Lưu, Hải Châu', latitude: 16.0382, longitude: 108.2265, thumbnailUrl: 'https://images.unsplash.com/photo-1513889961551-628c1e5e2ee9', openingHours: '15:00 - 22:00', suggestedDurationMinutes: 180, minBudget: 150000, maxBudget: 500000, averageRating: 4.3, reviewCount: 69, isActive: true, createdAt: nowIso(), updatedAt: nowIso() },
  { id: 13, name: 'Helio Center', slug: 'helio-center', description: 'Tổ hợp vui chơi, ẩm thực đêm, phù hợp nhóm bạn và gia đình.', categoryId: 6, category: 'entertainment', address: 'Đường 2 Tháng 9, Hải Châu', latitude: 16.0349, longitude: 108.2246, thumbnailUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819', openingHours: '17:00 - 22:30', suggestedDurationMinutes: 150, minBudget: 80000, maxBudget: 350000, averageRating: 4.2, reviewCount: 42, isActive: true, createdAt: nowIso(), updatedAt: nowIso() },
  { id: 14, name: 'Cầu Tình Yêu', slug: 'cau-tinh-yeu', description: 'Điểm check-in ven sông Hàn, gần Cầu Rồng, đẹp vào buổi tối.', categoryId: 4, category: 'checkin', address: 'Trần Hưng Đạo, Sơn Trà', latitude: 16.0632, longitude: 108.2299, thumbnailUrl: 'https://images.unsplash.com/photo-1519681393784-d120267933ba', openingHours: 'Cả ngày', suggestedDurationMinutes: 45, minBudget: 0, maxBudget: 120000, averageRating: 4.4, reviewCount: 58, isActive: true, createdAt: nowIso(), updatedAt: nowIso() },
  { id: 15, name: 'Bãi biển Non Nước', slug: 'bai-bien-non-nuoc', description: 'Bãi biển yên tĩnh hơn Mỹ Khê, gần Ngũ Hành Sơn và các resort ven biển.', categoryId: 1, category: 'beach', address: 'Ngũ Hành Sơn, Đà Nẵng', latitude: 16.0017, longitude: 108.2714, thumbnailUrl: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429', openingHours: 'Cả ngày', suggestedDurationMinutes: 120, minBudget: 0, maxBudget: 250000, averageRating: 4.5, reviewCount: 47, isActive: true, createdAt: nowIso(), updatedAt: nowIso() },
];

const placeNearbyStops = [
  { id: 1, placeId: 1, stopId: '02-S18', routeId: '02', distanceMeters: 350, walkingMinutes: 5, note: 'Xuống gần khu phố cổ, đi bộ vào trung tâm.' },
  { id: 2, placeId: 2, stopId: '03-S10', routeId: '03', distanceMeters: 500, walkingMinutes: 7, note: 'Tuyến 03 kết nối sân bay và khu Bà Nà.' },
  { id: 3, placeId: 3, stopId: '06-S09', routeId: '06', distanceMeters: 650, walkingMinutes: 9, note: 'Phù hợp kết hợp Non Nước.' },
  { id: 4, placeId: 4, stopId: '05-S13', routeId: '05', distanceMeters: 220, walkingMinutes: 3, note: 'Bến gần biển, dễ tìm.' },
  { id: 5, placeId: 5, stopId: '05-S13', routeId: '05', distanceMeters: 180, walkingMinutes: 3, note: 'Tuyến 05 đến Công viên Biển Đông.' },
  { id: 6, placeId: 6, stopId: '02-S08', routeId: '02', distanceMeters: 300, walkingMinutes: 4, note: 'Có thể đi các tuyến qua trung tâm.' },
  { id: 7, placeId: 7, stopId: '07-S07', routeId: '07', distanceMeters: 240, walkingMinutes: 3, note: 'Bến trung tâm gần chợ.' },
  { id: 8, placeId: 8, stopId: '02-S05', routeId: '02', distanceMeters: 260, walkingMinutes: 4, note: 'Đi bộ vào khu chợ Cồn.' },
  { id: 9, placeId: 9, stopId: '02-S08', routeId: '02', distanceMeters: 190, walkingMinutes: 3, note: 'Gần Cầu Rồng và bảo tàng.' },
  { id: 10, placeId: 10, stopId: '05-S13', routeId: '05', distanceMeters: 4200, walkingMinutes: 53, note: 'Cần nối chuyến/xe công nghệ cho đoạn cuối Sơn Trà.' },
  { id: 11, placeId: 11, stopId: '05-S13', routeId: '05', distanceMeters: 6200, walkingMinutes: 78, note: 'Nên kết hợp taxi/xe công nghệ từ bến gần nhất.' },
  { id: 12, placeId: 12, stopId: '07-S10', routeId: '07', distanceMeters: 450, walkingMinutes: 6, note: 'Dễ đi buổi chiều/tối.' },
  { id: 13, placeId: 13, stopId: '07-S10', routeId: '07', distanceMeters: 520, walkingMinutes: 7, note: 'Gần Asia Park.' },
  { id: 14, placeId: 14, stopId: '02-S08', routeId: '02', distanceMeters: 350, walkingMinutes: 5, note: 'Đi bộ ven sông Hàn.' },
  { id: 15, placeId: 15, stopId: '06-S09', routeId: '06', distanceMeters: 900, walkingMinutes: 12, note: 'Gần Ngũ Hành Sơn.' },
];

const placeReviews = [
  { id: 1, placeId: 1, userId: 1, userName: 'Minh Anh', rating: 5, content: 'Đi tuyến 02 đến Hội An hơi lâu nhưng tiết kiệm, phù hợp nếu bạn không vội.', routeId: '02', stopId: '02-S18', visitDate: '2026-05-15', tags: ['tiết kiệm chi phí', 'phù hợp check-in'], status: 'approved', helpfulCount: 18, createdAt: nowIso() },
  { id: 2, placeId: 4, userId: 2, userName: 'Quốc Huy', rating: 5, content: 'Bến gần biển Mỹ Khê khá dễ tìm, nên đi buổi sáng hoặc chiều mát.', routeId: '05', stopId: '05-S13', visitDate: '2026-05-17', tags: ['bến dễ tìm', 'nên đi buổi chiều'], status: 'approved', helpfulCount: 21, createdAt: nowIso() },
  { id: 3, placeId: 2, userId: 3, userName: 'Thanh Trúc', rating: 4, content: 'Bà Nà Hills nên đi sớm vì cần nhiều thời gian tham quan.', routeId: '03', stopId: '03-S10', visitDate: '2026-05-10', tags: ['nên đi buổi sáng', 'phù hợp gia đình'], status: 'approved', helpfulCount: 14, createdAt: nowIso() },
  { id: 4, placeId: 7, userId: 4, userName: 'Gia Bảo', rating: 4, content: 'Chợ Hàn tiện mua quà, đi bus vào trung tâm khá dễ.', routeId: '07', stopId: '07-S07', visitDate: '2026-05-18', tags: ['dễ đi bằng bus', 'tiết kiệm chi phí'], status: 'approved', helpfulCount: 12, createdAt: nowIso() },
  { id: 5, placeId: 6, userId: 5, userName: 'Lan Chi', rating: 5, content: 'Cầu Rồng đẹp nhất buổi tối, nên kiểm tra giờ phun lửa trước khi đi.', routeId: '02', stopId: '02-S08', visitDate: '2026-05-20', tags: ['phù hợp check-in', 'nên đi buổi chiều'], status: 'approved', helpfulCount: 26, createdAt: nowIso() },
];

const communityPosts = [
  { id: 1, userId: 1, userName: 'Admin SmartBus', title: 'Kinh nghiệm đi tuyến 02 đến Hội An tiết kiệm', content: 'Nên xuất phát buổi sáng, mang nước và kiểm tra chuyến cuối về Đà Nẵng.', topic: 'trip_experience', routeId: '02', placeId: 1, status: 'approved', votes: 19, createdAt: nowIso() },
  { id: 2, userId: 2, userName: 'Hải Nam', title: 'Một buổi chiều ở Mỹ Khê bằng tuyến 05', content: 'Xuống gần Công viên Biển Đông rồi đi bộ ra biển, chiều mát rất dễ chịu.', topic: 'itinerary', routeId: '05', placeId: 4, status: 'approved', votes: 15, createdAt: nowIso() },
  { id: 3, userId: 3, userName: 'Thu Hà', title: 'Hỏi tuyến đi Chợ Cồn từ sân bay', content: 'Mình muốn đi ăn vặt ở Chợ Cồn sau khi xuống sân bay, tuyến nào tiện nhất?', topic: 'question', routeId: null, placeId: 8, status: 'approved', votes: 8, createdAt: nowIso() },
];

const postComments = [];
const postVotes = [];
const reviewVotes = [];
const reviewReports = [];
const placeFavorites = [];
const tripPlans = [];
const tripPlanItems = [];
const moderationLogs = [];

module.exports = {
  touristCategories,
  touristPlaces,
  placeNearbyStops,
  placeReviews,
  communityPosts,
  postComments,
  postVotes,
  reviewVotes,
  reviewReports,
  placeFavorites,
  tripPlans,
  tripPlanItems,
  moderationLogs,
};
