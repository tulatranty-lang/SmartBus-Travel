const repo = require('./chat.repository');
const { detect } = require('./chat-intent.service');
const { askRasa } = require('./rasa.service');
const routeService = require('../route/route.service');
const stopService = require('../stop/stop.service');
const busService = require('../bus/bus.service');
const tourismService = require('../tourism/tourism.service');
const tripService = require('../trip/trip.service');
const statsService = require('../stats/stats.service');

function routeLabel(route) {
  if (!route) return '';
  return route.displayCode || route.routeNumber || route.route_number || route.id || route.routeCode || '';
}

async function findRouteSmart(id, provinceCode = null) {
  const raw = String(id || '').trim();
  if (!raw) return null;
  const n = raw.match(/\d{1,2}/)?.[0];
  const prefixes = provinceCode ? [{ QT: 'QT', HUE: 'HUE', DNG: 'DN', DN: 'DN', QNG: 'QNG', QN_CU: 'QN' }[provinceCode]].filter(Boolean) : ['DN', 'QT', 'HUE', 'QNG', 'QN'];
  const candidates = [raw, raw.toUpperCase()];
  if (n) {
    const nn = String(n).padStart(2, '0');
    prefixes.forEach((p) => candidates.push(`${p}-${nn}`));
    candidates.push(nn);
  }
  for (const c of [...new Set(candidates)]) {
    const route = await routeService.getRoute(c);
    if (route) return route;
  }
  return null;
}

async function statsReply() {
  const stats = await statsService.overview().catch(() => null);
  if (!stats) return 'Mình chưa đọc được thống kê từ SQL Server. Bạn kiểm tra backend và database SmartBusDB rồi thử lại nhé.';
  return `SmartBus hiện có ${stats.totalRoutes} tuyến xe, ${stats.totalStops} điểm dừng GPS, ${stats.totalTourismPlaces} địa điểm du lịch, ${stats.totalReviews} review cộng đồng và ${stats.totalProvinces} tỉnh/thành đang hỗ trợ.`;
}



async function destinationRouteReply(message, entities, lat, lng) {
  const looksLikeDestination = /đến|toi|tới|di |đi |đường|duong|tuyến nào|xe bus nào/i.test(message);
  if (!looksLikeDestination) return null;
  const places = await tourismService.search({ q: entities.placeName || message, lat, lng }).catch(() => []);
  const place = places[0];
  if (!place) return null;
  const nearby = await tourismService.nearbyStops(place.id).catch(() => []);
  const destStop = nearby?.[0] || null;
  const route = destStop?.routeId ? await routeService.getRoute(destStop.routeId).catch(() => null) : (place.recommendedRoute || null);
  if (!route) {
    return { reply: `Mình tìm thấy ${place.name}, nhưng dữ liệu hiện chưa có tuyến bus phù hợp đến địa điểm này. Bạn có thể chọn bến hoặc địa điểm gần hơn trên bản đồ.`, intent: 'route_to_place', suggestedPlaces: [place], cta: { label: 'Mở địa điểm du lịch', view: 'tourism', placeId: place.id }, relatedPlaceId: place.id };
  }
  const origin = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) ? await stopService.findNearest({ lat, lng, routeId: route.id }).catch(() => null) : null;
  const walkStart = origin?.walkingMinutes ? `Bến lên gần bạn: ${origin.stop.name}, đi bộ khoảng ${origin.walkingMinutes} phút.` : 'Bật GPS để mình chọn bến lên gần nhất.';
  const walkEnd = destStop?.walkingMinutes ? `Xuống tại ${destStop.stopName || destStop.stopId}, đi bộ khoảng ${destStop.walkingMinutes} phút đến ${place.name}.` : `Xuống tại bến gần ${place.name}.`;
  return {
    reply: `Có phương án đi bằng tuyến ${routeLabel(route)} – ${route.name}. ${walkStart} ${walkEnd} Giờ chạy: ${route.time || 'đang cập nhật'}, tần suất: ${route.interval || 'đang cập nhật'}, giá vé ${route.fare || 'đang cập nhật'}.`,
    intent: 'route_to_place',
    route,
    nearestStop: origin?.stop || (destStop ? { id: destStop.stopId, name: destStop.stopName, lat: destStop.lat, lng: destStop.lng } : null),
    destinationPlace: place,
    suggestedPlaces: [place],
    walkingMinutes: origin?.walkingMinutes || destStop?.walkingMinutes || null,
    fare: route.fare,
    cta: { label: 'Hiện tuyến đường trên bản đồ', view: 'dashboard', routeId: route.id, placeId: place.id },
    relatedPlaceId: place.id,
    relatedRouteId: route.id,
  };
}

async function placeReply(message, entities, lat, lng) {
  const q = entities.placeName || (/biển|tắm biển|mỹ khê/i.test(message) ? 'biển' : /chợ|mua sắm/i.test(message) ? 'chợ' : /check-in|sống ảo/i.test(message) ? 'check-in' : /chùa|tâm linh/i.test(message) ? 'chùa' : message);
  const category = entities.placeCategory || undefined;
  const places = await tourismService.search({ q, category, routeId: entities.routeId, lat, lng });
  const top = places.slice(0, 3);
  const names = top.map((p) => p.name).join(', ');
  return {
    reply: top.length ? `Mình gợi ý bạn đi ${names}. ${top[0]?.recommendedRoute ? `Tuyến phù hợp nhất là ${routeLabel(top[0].recommendedRoute)} – ${top[0].recommendedRoute.name}.` : ''} Bạn có thể mở trang Địa điểm du lịch để xem bến gần nhất, review và chỉ đường bằng xe buýt.` : 'Mình chưa tìm thấy địa điểm phù hợp. Bạn có thể thử: biển, chợ, check-in, tâm linh hoặc Hội An.',
    intent: 'ask_tourist_place',
    suggestedPlaces: top,
    openView: 'tourism',
    cta: top[0] ? { label: 'Xem địa điểm du lịch', view: 'tourism', placeId: top[0].id } : null,
  };
}

async function answer({ message, lat, lng, userId = null }) {
  const { intent, entities } = detect(message);
  const rasaText = await askRasa(message, userId ? `user-${userId}` : 'guest');
  if (intent === 'greet') return logAndReturn({ userId, message, lat, lng }, { reply: 'Xin chào! Mình là SmartBus Travel Assistant. Bạn có thể hỏi tuyến xe, bến gần nhất, giá vé, địa điểm du lịch, review, thống kê hoặc lịch trình bằng xe buýt ở Quảng Trị, Huế, Đà Nẵng, Quảng Ngãi và Quảng Nam cũ.', intent: 'greet' });
  if (intent === 'goodbye') return logAndReturn({ userId, message, lat, lng }, { reply: 'Tạm biệt! Chúc bạn có chuyến đi an toàn và vui vẻ.', intent: 'goodbye' });
  if (intent === 'ask_stats') return logAndReturn({ userId, message, lat, lng }, { reply: await statsReply(), intent: 'ask_stats', cta: { label: 'Xem tổng quan tuyến', view: 'buses' } });

  if (intent === 'ask_gps_location') {
    return logAndReturn({ userId, message, lat, lng }, {
      reply: Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
        ? `Mình đã nhận vị trí hiện tại của bạn. Tọa độ khoảng ${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}. Bạn có thể hỏi tiếp: “Bến gần tôi ở đâu?” hoặc “Từ đây đến Biển Mỹ Khê đi tuyến nào?”.`
        : 'Bạn hãy bấm nút GPS trên chatbot hoặc cho phép trình duyệt truy cập vị trí. Khi có vị trí, mình sẽ tìm bến gần nhất và tuyến phù hợp hơn.',
      intent: 'ask_gps_location',
      cta: { label: 'Mở bản đồ', view: 'map' },
    });
  }

  if (intent === 'ask_food_near_place') {
    const places = await tourismService.search({ q: entities.placeName || message, lat, lng }).catch(() => []);
    const foodPlaces = places.filter((p) => p.foodSuggestions || /food|ẩm thực|am thuc|chợ|cho|đặc sản|dac san/i.test(`${p.categoryCode || ''} ${p.categoryName || ''} ${p.category || ''} ${p.name || ''}`)).slice(0, 4);
    const target = foodPlaces.length ? foodPlaces : places.slice(0, 3);
    const reply = target.length
      ? `Món ngon/đặc sản gợi ý: ${target.map((p) => `${p.name}${p.foodSuggestions ? ` – ${p.foodSuggestions}` : ''}`).join('; ')}. Bạn có thể mở trang du lịch hoặc hỏi rõ hơn như “Gần Hội An ăn gì?” để mình gợi ý sát địa điểm hơn.`
      : 'Mình chưa tìm thấy dữ liệu món ăn phù hợp. Bạn thử hỏi theo khu vực như “Đà Nẵng ăn gì ngon?”, “Hội An có đặc sản gì?” hoặc “Gần Mỹ Khê có gì ăn?”.';
    return logAndReturn({ userId, message, lat, lng }, { reply, intent: 'ask_food_near_place', suggestedPlaces: target, cta: { label: 'Xem địa điểm du lịch', view: 'tourism' } });
  }

  const destinationPlan = await destinationRouteReply(message, entities, lat, lng);
  if (destinationPlan) return logAndReturn({ userId, message, lat, lng }, destinationPlan);

  if (intent === 'ask_trip_plan') {
    const plan = await tripService.generate({ lat, lng, timeAvailable: entities.timeAvailable || '1 buổi', interests: [entities.placeCategory || (entities.budget === 'low' ? 'tiết kiệm' : 'check-in')], budget: entities.budget }, null, false);
    const names = plan.items.map((i) => i.name).join(' → ');
    return logAndReturn({ userId, message, lat, lng }, { reply: `Gợi ý lịch trình ${entities.timeAvailable || '1 buổi'}: ${names}. Mình ưu tiên tuyến bus tiện, bến dễ đi bộ và review tốt.`, intent: 'ask_trip_plan', tripPlan: plan, openView: 'trip', cta: { label: 'Xem gợi ý lịch trình', view: 'trip' } });
  }

  if (['ask_tourist_place', 'ask_place_near_me', 'ask_place_by_category', 'ask_place_by_route'].includes(intent)) {
    return logAndReturn({ userId, message, lat, lng }, await placeReply(message, entities, lat, lng));
  }

  if (intent === 'ask_place_review') {
    const places = await tourismService.search({ q: entities.placeName || message, lat, lng });
    const place = places[0];
    if (!place) return logAndReturn({ userId, message, lat, lng }, { reply: 'Bạn muốn xem review địa điểm nào? Ví dụ: Review Bà Nà Hills thế nào?', intent });
    const detail = await tourismService.detail(place.id, { lat, lng });
    const sample = detail.reviews?.[0]?.content || 'Chưa có review nổi bật.';
    return logAndReturn({ userId, message, lat, lng }, { reply: `${place.name} đang có rating ${place.averageRating}/5 từ ${place.reviewCount} review. Nhận xét nổi bật: “${sample}”`, intent, suggestedPlaces: [place], openView: 'reviews', cta: { label: 'Xem review', view: 'reviews', placeId: place.id } });
  }

  if (intent === 'ask_nearest_stop') {
    const nearest = await stopService.findNearest({ lat, lng, routeId: entities.routeId });
    const response = nearest ? { reply: `Bến gần bạn nhất là ${nearest.stop.name}${nearest.route ? ` trên tuyến ${routeLabel(nearest.route)} – ${nearest.route.name}` : ''}. Khoảng cách khoảng ${nearest.distanceMeters}m, đi bộ khoảng ${nearest.walkingMinutes} phút.`, intent, nearestStop: nearest.stop, route: nearest.route, walkingMinutes: nearest.walkingMinutes } : { reply: 'Mình cần GPS để tìm bến gần nhất. Hãy bấm nút định vị hoặc gửi lat/lng.', intent };
    return logAndReturn({ userId, message, lat, lng }, response);
  }

  let route = entities.routeId ? await findRouteSmart(entities.routeId, entities.provinceCode) : null;
  if (!route && /hội an|hoi an/.test(message.toLowerCase())) route = await findRouteSmart('QN-02-2025');
  if (!route && /bà nà|ba na|sân bay/.test(message.toLowerCase())) route = await findRouteSmart('DN-03');
  if (!route) {
    const fallback = rasaText || 'Mình chưa nhận ra tuyến hoặc địa điểm. Bạn thử: “Tuyến DN-03 đi Bà Nà”, “Đi Hội An bằng xe bus”, “Địa điểm nổi tiếng ở Huế”, “Tuyến QNG-03 giờ chạy thế nào?”, hoặc “Có bao nhiêu tuyến?”.';
    return logAndReturn({ userId, message, lat, lng }, { reply: fallback, intent: 'unknown', suggestions: ['Tôi muốn đến Hội An', 'Tôi muốn đi biển', 'Tuyến 03 giá vé bao nhiêu?', 'Tôi muốn lịch trình tiết kiệm bằng xe buýt'] });
  }

  const nearest = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) ? await stopService.findNearest({ lat, lng, routeId: route.id }) : null;
  const buses = await routeService.getRouteBuses(route.id);
  const eta = buses[0] ? await busService.estimateEta(buses[0].id, nearest?.stop?.id) : null;
  let reply = `Bạn có thể đi tuyến ${routeLabel(route)} – ${route.name}.`;
  if (intent === 'ask_fare') reply = `Tuyến ${routeLabel(route)} – ${route.name} có giá vé tham khảo ${route.fare}.`;
  else if (intent === 'ask_schedule') reply = `Tuyến ${routeLabel(route)} – ${route.name} hoạt động ${route.time}, tần suất khoảng ${route.interval}.`;
  else if (intent === 'ask_bus_eta') reply = `Xe tuyến ${routeLabel(route)} dự kiến đến ${nearest?.stop?.name || 'bến gần nhất'} sau khoảng ${eta?.etaMinutes || 12} phút.`;
  else reply += `${nearest ? ` Bến gợi ý: ${nearest.stop.name}, cách bạn khoảng ${nearest.distanceMeters}m, đi bộ ${nearest.walkingMinutes} phút.` : ' Nếu bật GPS mình sẽ gợi ý bến gần nhất.'} Xe dự kiến đến sau khoảng ${eta?.etaMinutes || 12} phút. Giá vé ${route.fare}.`;
  if (rasaText) reply += `\nGợi ý thêm từ Rasa: ${rasaText}`;
  return logAndReturn({ userId, message, lat, lng }, { reply, intent, route, nearestStop: nearest?.stop || null, walkingMinutes: nearest?.walkingMinutes || null, etaMinutes: eta?.etaMinutes || null, fare: route.fare, bus: eta?.bus || null });
}

async function logAndReturn(ctx, response) {
  await repo.addLog({ userId: ctx.userId, message: ctx.message, reply: response.reply, intent: response.intent, lat: ctx.lat, lng: ctx.lng, relatedPlaceId: response.relatedPlaceId || response.destinationPlace?.id || response.cta?.placeId || null, relatedRouteId: response.relatedRouteId || response.route?.id || response.cta?.routeId || null });
  return response;
}

async function suggestions() {
  return [
    'Xin chào SmartBus',
    'Tôi muốn đến Hội An',
    'Đi Mỹ Khê bằng tuyến nào?',
    'Bến xe buýt gần tôi nhất ở đâu?',
    'Gợi ý lịch trình Đà Nẵng 1 ngày',
    'Huế có gì chơi?',
    'Có review về Lý Sơn không?',
    'Địa điểm du lịch nào gần tuyến xe bus?',
    'Đà Nẵng ăn gì ngon?',
    'Tuyến DN-03 đi đâu?',
    'Quảng Nam cũ có những tuyến nào?',
    'Tôi muốn đi Thánh địa Mỹ Sơn',
    'Quảng Ngãi có tuyến nào đi Sa Kỳ?',
  ];
}

async function history(userId) { return repo.history(userId || null); }
module.exports = { answer, history, suggestions };
