const tourism = require('../tourism/tourism.service');
const repo = require('./trip.repository');
const activity = require('../activity/activity.repository');
const { inferInterests, chooseLimit } = require('./trip-recommendation.service');

async function options() {
  return { timeAvailable: ['nửa ngày', '1 ngày', '2 ngày', '3 ngày'], interests: ['biển', 'văn hóa', 'check-in', 'mua sắm', 'vui chơi', 'tâm linh', 'tiết kiệm'], budgets: ['low', 'medium', 'high'] };
}
async function generate(input, user = null, save = true) {
  const interests = inferInterests(input.interests);
  const categoryMap = { 'biển': 'beach', 'van hoa': 'culture', 'văn hóa': 'culture', 'check-in': 'checkin', 'mua sắm': 'shopping', 'vui chơi': 'entertainment', 'tâm linh': 'spiritual', 'tiết kiệm': '' };
  let candidates = await tourism.recommended({ lat: input.lat, lng: input.lng, province: input.province || input.provinceCode || null, limit: 16, mood: interests.join(' '), time: input.timeAvailable });
  const wanted = interests.map((i) => categoryMap[i]).filter(Boolean);
  if (wanted.length) candidates = candidates.filter((p) => wanted.includes(p.category) || p.category === 'food').concat(candidates.filter((p) => !wanted.includes(p.category)));
  const balanced = [];
  const wantedOrder = ['beach', 'culture', 'checkin', 'food', 'spiritual', 'entertainment', 'nature', 'shopping'];
  for (const cat of wantedOrder) {
    const found = candidates.find((p) => !balanced.some((x) => x.id === p.id) && (p.category === cat || (cat === 'food' && /ăn|food|ẩm thực/i.test(`${p.categoryName || ''} ${p.foodSuggestions || ''}`))));
    if (found) balanced.push(found);
  }
  candidates.forEach((p) => { if (!balanced.some((x) => x.id === p.id)) balanced.push(p); });
  const slots = ['Buổi sáng', 'Buổi trưa', 'Buổi chiều', 'Buổi tối'];
  const items = balanced.slice(0, chooseLimit(input.timeAvailable)).map((p, idx) => ({
    ...p,
    order: idx + 1,
    timeBlock: slots[idx] || `Điểm ${idx + 1}`,
    suggestedStart: idx === 0 ? '08:00' : idx === 1 ? '11:30' : idx === 2 ? '14:30' : '18:30',
    suggestedDurationMinutes: p.suggestedDurationMinutes || (idx === 1 ? 75 : 90),
    busRoute: p.recommendedRoute,
    stopDown: p.nearestStop?.stop,
    walkingMinutes: p.nearestStop?.walkingMinutes,
    practicalNote: idx === 1 ? 'Ưu tiên ăn uống/nghỉ nhẹ, không nhồi thêm quá nhiều điểm.' : 'Sắp xếp theo cụm gần tuyến để giảm di chuyển vòng.',
    highlightReview: p.reviews?.[0]?.content || null,
  }));
  const totalEstimatedTime = items.reduce((sum, item) => sum + Number(item.suggestedDurationMinutes || 90) + Number(item.walkingMinutes || 0), 0);
  const plan = {
    itineraryId: null,
    title: input.title || `Lịch trình ${input.timeAvailable || 'SmartBus'} cân bằng`,
    summary: 'Lịch trình cân bằng biển, check-in, văn hóa/ăn uống và nghỉ ngơi; tránh liệt kê quá nhiều bãi biển liên tục.',
    totalEstimatedTime,
    stops: items,
    places: items,
    nearestBusStop: items.find((item) => item.stopDown)?.stopDown || null,
    routeSuggestion: items.find((item) => item.busRoute)?.busRoute || null,
    note: 'Đã giới hạn ứng viên để phản hồi nhanh và không treo giao diện.',
    items,
  };
  if (save) {
    const saved = await repo.savePlan(user?.id || null, input, items);
    await activity.logActivity({ userId: user?.id || null, actionType: 'trip_plan_create', targetType: 'trip_plan', targetId: saved?.id, description: `Tạo lịch trình ${input.timeAvailable || 'SmartBus'}` });
    return { ...plan, ...saved, itineraryId: saved?.id || null, items };
  }
  return plan;
}
async function my(user) { return repo.myPlans(user.id); }
async function detail(id, user) { return repo.detail(id, user?.id); }
async function remove(id, user) { return repo.remove(id, user?.id); }
module.exports = { options, generate, my, detail, remove };
