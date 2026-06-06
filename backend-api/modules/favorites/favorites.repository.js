const { query } = require('../../config/db');

async function addRoute(userId, routeId) {
  await query(`
    IF NOT EXISTS (SELECT 1 FROM favorites_routes WHERE user_id=@userId AND route_id=@routeId)
      INSERT INTO favorites_routes(user_id, route_id) VALUES(@userId, @routeId)
  `, { userId: Number(userId), routeId: String(routeId) });
  return { routeId: String(routeId), favorited: true };
}

async function removeRoute(userId, routeId) {
  await query('DELETE FROM favorites_routes WHERE user_id=@userId AND route_id=@routeId', { userId: Number(userId), routeId: String(routeId) });
  return { routeId: String(routeId), favorited: false };
}

async function listRoutes(userId) {
  const rs = await query(`
    SELECT fr.id AS favoriteId, fr.created_at AS favoritedAt,
           r.route_code AS id, r.route_code AS routeCode, COALESCE(r.route_number, r.route_code) AS displayCode,
           r.name, r.province_code AS provinceCode, p.name AS provinceName,
           r.origin_name AS originName, r.destination_name AS destinationName,
           r.operating_time AS time, r.interval_text AS interval, r.fare, r.color,
           r.vehicle_count AS vehicleCount,
           (SELECT COUNT(1) FROM buses b WHERE b.route_code = r.route_code AND COALESCE(b.status,'active')='active') AS activeBusCount
    FROM favorites_routes fr
    LEFT JOIN bus_routes r ON r.route_code = fr.route_id
    LEFT JOIN provinces p ON p.code = r.province_code
    WHERE fr.user_id=@userId
    ORDER BY fr.created_at DESC
  `, { userId: Number(userId) });
  return rs.recordset.map((r) => ({ ...r, missing: !r.id }));
}

async function addPlace(userId, placeId) {
  await query(`
    IF NOT EXISTS (SELECT 1 FROM favorites_places WHERE user_id=@userId AND place_id=@placeId)
      INSERT INTO favorites_places(user_id, place_id) VALUES(@userId, @placeId)
  `, { userId: Number(userId), placeId: Number(placeId) });
  try { await query(`IF NOT EXISTS (SELECT 1 FROM place_favorites WHERE user_id=@userId AND place_id=@placeId) INSERT INTO place_favorites(user_id, place_id) VALUES(@userId, @placeId)`, { userId: Number(userId), placeId: Number(placeId) }); } catch (_err) {}
  return { placeId: Number(placeId), favorited: true };
}

async function removePlace(userId, placeId) {
  await query('DELETE FROM favorites_places WHERE user_id=@userId AND place_id=@placeId', { userId: Number(userId), placeId: Number(placeId) });
  try { await query('DELETE FROM place_favorites WHERE user_id=@userId AND place_id=@placeId', { userId: Number(userId), placeId: Number(placeId) }); } catch (_err) {}
  return { placeId: Number(placeId), favorited: false };
}

async function listPlaces(userId) {
  const rs = await query(`
    SELECT fp.id AS favoriteId, fp.created_at AS favoritedAt,
           p.id, p.name, p.description, p.short_description AS shortDescription,
           p.province_code AS provinceCode, pr.name AS provinceName,
           c.code AS category, c.name AS categoryName,
           p.latitude, p.longitude, p.image_url AS thumbnailUrl,
           p.average_rating AS averageRating, p.review_count AS reviewCount,
           p.best_time AS bestTime, p.food_suggestions AS foodSuggestions
    FROM favorites_places fp
    LEFT JOIN tourist_places p ON p.id = fp.place_id
    LEFT JOIN provinces pr ON pr.code = p.province_code
    LEFT JOIN tourist_categories c ON c.id = p.category_id
    WHERE fp.user_id=@userId
    ORDER BY fp.created_at DESC
  `, { userId: Number(userId) });
  return rs.recordset.map((p) => ({ ...p, missing: !p.id }));
}

module.exports = { addRoute, removeRoute, listRoutes, addPlace, removePlace, listPlaces };
