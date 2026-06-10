const service = require('./tourism.service');
const { ok, created, fail } = require('../../common/utils/response');

function placeDto(p) {
  return {
    ...p,
    id: Number(p.id),
    name: p.name,
    province: p.provinceName || p.province || p.provinceCode,
    provinceCode: p.provinceCode,
    description: p.description || p.shortDescription || '',
    category: p.category,
    latitude: Number(p.latitude ?? p.lat),
    longitude: Number(p.longitude ?? p.lng),
    nearbyStops: p.nearbyStops || [],
    recommendedRoutes: p.recommendedRoutes || p.routes || [],
  };
}
async function categories(_req, res) { return ok(res, await service.categories()); }
async function list(req, res) {
  const places = (await service.search({ ...(req.query || {}), userId: req.user?.id || null })).map(placeDto);
  const limit = Math.max(1, Math.min(80, Number(req.query.limit || req.query.pageSize || 36) || 36));
  const page = Math.max(1, Number(req.query.page || 1) || 1);
  const offset = Number.isFinite(Number(req.query.offset)) ? Math.max(0, Number(req.query.offset)) : (page - 1) * limit;
  return ok(res, places, 'OK', { page, limit, offset, count: places.length, hasMore: places.length >= limit });
}
async function search(req, res) { return list(req, res); }
async function recommended(req, res) { return ok(res, (await service.recommended(req.query)).map(placeDto)); }
async function detail(req, res) { const item = await service.detail(req.params.id, req.query); return item ? ok(res, placeDto(item)) : fail(res, 404, 'Không tìm thấy địa điểm', [], 'TOURISM_PLACE_NOT_FOUND'); }
async function nearbyStops(req, res) { return ok(res, await service.nearbyStops(req.params.id)); }
async function near(req, res) { return list(req, res); }
async function busSuggestion(req, res) { return ok(res, await service.nearbyStops(req.params.id)); }
async function reviews(req, res) { return ok(res, await service.reviews(req.params.id)); }
async function favorite(req, res) { return created(res, await service.favorite(req.user.id, req.params.id), 'Đã lưu địa điểm'); }
async function unfavorite(req, res) { return ok(res, await service.unfavorite(req.user.id, req.params.id), 'Đã bỏ lưu địa điểm'); }
async function favorites(req, res) { return ok(res, await service.favorites(req.user.id)); }
module.exports = { categories, list, search, recommended, detail, nearbyStops, near, busSuggestion, reviews, favorite, unfavorite, favorites, placeDto };
