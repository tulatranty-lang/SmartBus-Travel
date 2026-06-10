const fs = require('fs');
const path = require('path');
const tourism = require('../tourism/tourism.service');
const repo = require('./trip.repository');
const activity = require('../activity/activity.repository');
const cache = require('../../common/utils/cache.util');
const { inferInterests } = require('./trip-recommendation.service');
const { haversineMeters } = require('../../common/utils/distance.util');

async function options() {
  return {
    timeAvailable: ['nửa ngày', '1 ngày', '2 ngày', '3 ngày'],
    interests: ['biển', 'văn hóa', 'check-in', 'mua sắm', 'vui chơi', 'tâm linh', 'tiết kiệm'],
    budgets: ['low', 'medium', 'high'],
  };
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

function toLatLng(item = {}) {
  const lat = Number(item.lat ?? item.latitude ?? item.nearestStopLat);
  const lng = Number(item.lng ?? item.longitude ?? item.nearestStopLng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

function normalizeProvince(input = {}) {
  const raw = String(input.province || input.provinceCode || '').trim();
  const txt = normalizeText(raw).toUpperCase();
  if (!txt) return '';
  if (txt.includes('DN') || txt.includes('DA NANG')) return 'DN';
  if (txt.includes('QN_CU') || txt.includes('HOI AN') || txt.includes('QUANG NAM')) return 'QN_CU';
  if (txt.includes('HUE')) return 'HUE';
  if (txt.includes('QUANG NGAI') || txt.includes('QNG')) return 'QNG';
  if (txt.includes('QUANG TRI') || txt.includes('QT')) return 'QT';
  return raw.toUpperCase();
}

function inferProvinceFromInput(input = {}) {
  const explicit = normalizeProvince(input);
  if (explicit) return explicit;
  const text = normalizeText([...(Array.isArray(input.interests) ? input.interests : []), input.title || '', input.keyword || ''].join(' '));
  if (/hoi an|quang nam|pho co/.test(text)) return 'QN_CU';
  if (/da nang|my khe|son tra|cau rong/.test(text)) return 'DN';
  if (/hue|dai noi|lang vua/.test(text)) return 'HUE';
  if (/ly son|quang ngai|sa ky/.test(text)) return 'QNG';
  if (/quang tri|vinh moc|hien luong|la vang/.test(text)) return 'QT';
  const user = toLatLng(input);
  if (!user) return '';
  const anchors = [
    { code: 'DN', lat: 16.0544, lng: 108.2022 },
    { code: 'QN_CU', lat: 15.8801, lng: 108.3380 },
    { code: 'HUE', lat: 16.4637, lng: 107.5909 },
    { code: 'QNG', lat: 15.1205, lng: 108.7923 },
    { code: 'QT', lat: 16.7500, lng: 107.1900 },
  ];
  return anchors.map((a) => ({ ...a, meters: haversineMeters(user, a) || 9999999 })).sort((a, b) => a.meters - b.meters)[0]?.code || '';
}

function loadStaticTourismPlaces() {
  const key = 'trip:static-tourism-places';
  const cached = cache.get(key);
  if (cached) return cached;
  const file = path.join(__dirname, '../../data/import/smartbus-tourism-data.normalized.json');
  try {
    const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
    const rows = Array.isArray(payload) ? payload : (payload.places || payload.data || payload.items || []);
    const normalized = rows.map((p, index) => normalizePlace(p, index)).filter((p) => toLatLng(p));
    cache.set(key, normalized, 10 * 60 * 1000);
    return normalized;
  } catch (_err) {
    return [];
  }
}

function normalizePlace(place = {}, index = 0) {
  const point = toLatLng(place);
  const id = place.id || place.placeId || place.externalPlaceCode || place.code || `local-place-${index + 1}`;
  const categoryCode = place.categoryCode || place.category || place.categoryRaw || 'general';
  return {
    ...place,
    id,
    placeId: place.placeId || id,
    name: place.name || place.placeName || 'Địa điểm',
    description: place.shortDescription || place.description || place.summary || '',
    shortDescription: place.shortDescription || place.description || '',
    provinceCode: place.provinceCode || place.province_code || place.province || '',
    provinceName: place.provinceName || place.province_name || place.province || '',
    category: categoryCode,
    categoryCode,
    categoryName: place.categoryName || place.categoryRaw || place.category || categoryCode,
    latitude: point?.lat,
    longitude: point?.lng,
    lat: point?.lat,
    lng: point?.lng,
    averageRating: Number(place.averageRating || place.rating || 4.6),
    reviewCount: Number(place.reviewCount || place.reviewsCount || 0),
    suggestedDurationMinutes: Number(place.suggestedDurationMinutes || 0) || suggestedDurationFromText(place.suggestedDurationHours),
    walkingMinutes: Number(place.walkingMinutes || place.nearestStop?.walkingMinutes || 0) || null,
    nearestRouteCode: place.nearestRouteCode || place.routeCode || place.recommendedRoute?.id || '',
    nearestRouteName: place.nearestRouteName || place.routeName || place.recommendedRoute?.name || '',
    nearestStopName: place.nearestStopName || place.nearestStop?.stopName || place.nearestStop?.name || '',
    nearestStop: place.nearestStop || (place.nearestStopName ? { stopName: place.nearestStopName, name: place.nearestStopName, walkingMinutes: place.walkingMinutes } : null),
    recommendedRoute: place.recommendedRoute || (place.nearestRouteCode ? { id: place.nearestRouteCode, routeCode: place.nearestRouteCode, name: place.nearestRouteName } : null),
  };
}

function suggestedDurationFromText(value) {
  const nums = String(value || '').match(/\d+(?:\.\d+)?/g)?.map(Number) || [];
  if (!nums.length) return 90;
  return Math.max(45, Math.min(180, Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 60)));
}

function categoryOf(place = {}) {
  const text = normalizeText(`${place.categoryCode || ''} ${place.category || ''} ${place.categoryName || ''} ${place.name || ''} ${place.foodSuggestions || ''}`);
  if (/bien|beach|dao|hai san/.test(text)) return 'beach';
  if (/cho|shopping|mua sam|dac san/.test(text)) return 'shopping';
  if (/food|am thuc|an uong|mon ngon/.test(text)) return 'food';
  if (/check|song ao|cau rong|bieu tuong|quang truong/.test(text)) return 'checkin';
  if (/chua|tam linh|spiritual|thanh dia/.test(text)) return 'spiritual';
  if (/vui choi|giai tri|entertainment|cong vien/.test(text)) return 'entertainment';
  if (/nui|thac|rung|suoi|ho|nature|son tra/.test(text)) return 'nature';
  if (/di tich|van hoa|lich su|di san|culture|pho co|bao tang/.test(text)) return 'culture';
  return place.categoryCode || place.category || 'general';
}

function categoryPreferences(interests = [], timeAvailable = '') {
  const text = normalizeText(`${Array.isArray(interests) ? interests.join(' ') : interests} ${timeAvailable}`);
  const prefs = [];
  const push = (...items) => items.forEach((item) => { if (!prefs.includes(item)) prefs.push(item); });
  if (/bien|tam bien|hai san|dao/.test(text)) push('beach', 'nature', 'food', 'checkin');
  if (/van hoa|lich su|di san|pho co|bao tang/.test(text)) push('culture', 'spiritual', 'checkin', 'food');
  if (/check|song ao|chup anh/.test(text)) push('checkin', 'culture', 'beach', 'shopping');
  if (/mua sam|cho|shopping|dac san/.test(text)) push('shopping', 'food', 'checkin', 'culture');
  if (/vui choi|giai tri/.test(text)) push('entertainment', 'checkin', 'shopping', 'food');
  if (/tam linh|chua/.test(text)) push('spiritual', 'culture', 'nature', 'food');
  if (/tiet kiem|low|re/.test(text)) push('culture', 'checkin', 'beach', 'food');
  push('culture', 'checkin', 'food', 'beach', 'nature', 'shopping', 'spiritual', 'entertainment', 'general');
  return prefs;
}

function tripSlots(timeAvailable = '1 ngày') {
  const t = normalizeText(timeAvailable);
  if (/3 ngay/.test(t)) return [
    ['Ngày 1 · Buổi sáng', '08:00', 'main', 120], ['Ngày 1 · Buổi chiều', '14:30', 'nearby', 90], ['Ngày 1 · Buổi tối', '18:30', 'food', 90],
    ['Ngày 2 · Buổi sáng', '08:00', 'main', 150], ['Ngày 2 · Buổi chiều', '14:30', 'nearby', 90], ['Ngày 2 · Buổi tối', '18:30', 'checkin', 75],
    ['Ngày 3 · Buổi sáng', '08:30', 'light', 90], ['Ngày 3 · Buổi chiều', '14:00', 'shopping', 75],
  ].map(slotObj);
  if (/2 ngay|cuoi tuan|weekend/.test(t)) return [
    ['Ngày 1 · Buổi sáng', '08:00', 'main', 120], ['Ngày 1 · Buổi trưa', '11:30', 'food', 75], ['Ngày 1 · Buổi chiều', '14:30', 'nearby', 105], ['Ngày 1 · Buổi tối', '18:30', 'checkin', 90],
    ['Ngày 2 · Buổi sáng', '08:30', 'main', 120], ['Ngày 2 · Buổi chiều', '14:00', 'shopping', 90],
  ].map(slotObj);
  if (/1 buoi|nua ngay|half/.test(t)) return [['Điểm chính', '08:30', 'main', 105], ['Điểm gần kề', '10:30', 'nearby', 75]].map(slotObj);
  return [['Buổi sáng', '08:00', 'main', 120], ['Buổi trưa', '11:30', 'food', 75], ['Buổi chiều', '14:30', 'nearby', 105], ['Buổi tối', '18:30', 'checkin', 90]].map(slotObj);
}

function slotObj([timeBlock, suggestedStart, role, duration]) { return { timeBlock, suggestedStart, role, duration }; }

function desiredCategories(slot, prefs) {
  if (slot.role === 'food') return ['food', 'shopping', 'general', ...prefs];
  if (slot.role === 'checkin') return ['checkin', 'culture', 'shopping', 'beach', ...prefs];
  if (slot.role === 'shopping') return ['shopping', 'food', 'checkin', ...prefs];
  if (slot.role === 'light') return ['culture', 'shopping', 'checkin', 'food', ...prefs];
  if (slot.role === 'nearby') return [...prefs, 'checkin', 'culture', 'nature', 'beach', 'shopping', 'food'];
  return [...prefs, 'culture', 'beach', 'nature', 'checkin', 'spiritual', 'entertainment'];
}

function distanceBetween(a, b) {
  const pa = toLatLng(a);
  const pb = toLatLng(b);
  if (!pa || !pb) return 9999999;
  return haversineMeters(pa, pb) || 9999999;
}

async function getCandidatePlaces(input, interests, province) {
  const cacheKey = `trip:candidates:v2:${province}:${interests.join(',')}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  let candidates = [];
  try {
    candidates = await tourism.search({
      lat: input.lat,
      lng: input.lng,
      province,
      limit: 60,
      mood: interests.join(' '),
      time: input.timeAvailable,
    });
  } catch (_err) {
    candidates = [];
  }
  if (!Array.isArray(candidates) || candidates.length < 2) candidates = loadStaticTourismPlaces();
  const normalized = candidates.map((p, index) => normalizePlace(p, index)).filter((p) => toLatLng(p));
  cache.set(cacheKey, normalized, 3 * 60 * 1000);
  return normalized;
}

function buildSmartItinerary(candidates, input, interests, province) {
  const prefs = categoryPreferences(interests, input.timeAvailable);
  const slots = tripSlots(input.timeAvailable);
  const wantedProvince = province || inferProvinceFromInput(input) || 'DN';
  let pool = candidates.filter((p) => !wantedProvince || String(p.provinceCode || '').toUpperCase() === wantedProvince || normalizeText(`${p.provinceName}`).includes(normalizeText(wantedProvince)));
  if (pool.length < Math.min(2, slots.length)) pool = candidates;
  const userPoint = toLatLng(input);
  let anchor = userPoint || pool[0] || null;
  const selected = [];
  const categoryCount = new Map();

  for (const slot of slots) {
    const desired = desiredCategories(slot, prefs);
    const ranked = pool
      .filter((p) => !selected.some((s) => String(s.id) === String(p.id) || normalizeText(s.name) === normalizeText(p.name)))
      .map((place) => {
        const cat = categoryOf(place);
        const rank = desired.includes(cat) ? desired.indexOf(cat) : desired.length + 3;
        const meters = anchor ? distanceBetween(anchor, place) : 0;
        const distancePenalty = Math.min(45, (meters / 1000) * 1.4);
        const sameCatPenalty = Math.max(0, (categoryCount.get(cat) || 0) - 1) * 30;
        const ratingBoost = Number(place.averageRating || 4.5) * 3 + Math.min(12, Number(place.reviewCount || 0) / 8);
        const busBoost = place.nearestRouteCode || place.recommendedRoute || place.nearestStopName ? 8 : 0;
        const foodFit = slot.role === 'food' && (place.foodSuggestions || cat === 'food' || cat === 'shopping') ? -12 : 0;
        const score = rank * 18 + distancePenalty + sameCatPenalty - ratingBoost - busBoost + foodFit;
        return { place, cat, meters, score };
      })
      .sort((a, b) => a.score - b.score);
    const chosen = ranked[0];
    if (!chosen) break;
    categoryCount.set(chosen.cat, (categoryCount.get(chosen.cat) || 0) + 1);
    selected.push({ ...chosen.place, _tripCategory: chosen.cat, _distanceFromPrevMeters: chosen.meters });
    anchor = chosen.place;
  }

  return selected.map((place, index) => {
    const slot = slots[index] || slots[slots.length - 1] || { timeBlock: `Điểm ${index + 1}`, suggestedStart: '', duration: 90 };
    const prev = index ? selected[index - 1] : userPoint;
    const moveMeters = prev ? distanceBetween(prev, place) : null;
    const moveMinutes = Number.isFinite(moveMeters) ? Math.max(5, Math.round((moveMeters / 1000) / 22 * 60)) : null;
    const routeCode = place.nearestRouteCode || place.recommendedRoute?.id || place.recommendedRoute?.routeCode || 'đang cập nhật';
    const stopName = place.nearestStopName || place.nearestStop?.stopName || place.nearestStop?.name || 'bến gần nhất đang cập nhật';
    return {
      ...place,
      order: index + 1,
      timeBlock: slot.timeBlock,
      suggestedStart: slot.suggestedStart,
      suggestedDurationMinutes: place.suggestedDurationMinutes || slot.duration,
      busRoute: place.recommendedRoute || { id: routeCode, routeCode },
      stopDown: place.nearestStop || { stopName, name: stopName, walkingMinutes: place.walkingMinutes },
      walkingMinutes: place.walkingMinutes || place.nearestStop?.walkingMinutes || null,
      transferMinutes: moveMinutes,
      practicalNote: `${index === 0 ? 'Bắt đầu bằng điểm chính' : 'Điểm này được chọn gần điểm trước để giảm di chuyển vòng'}; xuống tại ${stopName}, tuyến ${routeCode}. ${place.bestTime ? `Thời điểm hợp lý: ${place.bestTime}.` : ''}`,
      highlightReview: place.reviews?.[0]?.content || null,
    };
  });
}

async function generate(input, user = null, save = true) {
  const interests = inferInterests(input.interests);
  const province = inferProvinceFromInput(input);
  const candidates = await getCandidatePlaces(input, interests, province);
  const items = buildSmartItinerary(candidates, input, interests, province);
  const totalEstimatedTime = items.reduce((sum, item) => sum + Number(item.suggestedDurationMinutes || 90) + Number(item.walkingMinutes || 0) + Number(item.transferMinutes || 0), 0);
  const provinceName = items[0]?.provinceName || province || 'khu vực đã chọn';
  const plan = {
    itineraryId: null,
    title: input.title || `Lịch trình ${input.timeAvailable || '1 ngày'} tại ${provinceName}`,
    summary: items.length
      ? `Đã sắp xếp ${items.length} điểm theo cùng tỉnh/cụm gần nhau, xen kẽ tham quan - ăn uống/check-in - nghỉ nhẹ để lịch trình hợp lý hơn.`
      : 'Chưa đủ dữ liệu địa điểm để tạo lịch trình hợp lý.',
    totalEstimatedTime,
    stops: items,
    places: items,
    nearestBusStop: items.find((item) => item.stopDown)?.stopDown || null,
    routeSuggestion: items.find((item) => item.busRoute)?.busRoute || null,
    note: 'Logic mới ưu tiên cùng tỉnh, hạn chế nhảy điểm xa, chọn điểm theo thời điểm trong ngày và tuyến/bến gần.',
    items,
  };

  if (save) {
    try {
      const saved = await repo.savePlan(user?.id || null, input, items);
      await activity.logActivity({
        userId: user?.id || null,
        actionType: 'trip_plan_create',
        targetType: 'trip_plan',
        targetId: saved?.id,
        description: `Tạo lịch trình ${input.timeAvailable || 'SmartBus'}`,
      });
      return { ...plan, ...saved, itineraryId: saved?.id || null, items };
    } catch (_err) {
      return plan;
    }
  }
  return plan;
}

async function my(user) { return repo.myPlans(user.id); }
async function detail(id, user) { return repo.detail(id, user?.id); }
async function remove(id, user) { return repo.remove(id, user?.id); }

module.exports = { options, generate, my, detail, remove };
