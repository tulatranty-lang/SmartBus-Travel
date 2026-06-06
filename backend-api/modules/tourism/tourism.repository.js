const slugify = require('slugify');
const { query } = require('../../config/db');
const cache = require('../../common/utils/cache.util');
const { isValidLatLng } = require('../../common/utils/gis-validator.util');

function withCategory(place) {
  return {
    ...place,
    id: Number(place.id),
    category: place.category || 'general',
    categoryName: place.categoryName || 'Địa điểm',
    isActive: place.isActive !== false && place.isActive !== 0,
    averageRating: Number(place.averageRating || 0),
    reviewCount: Number(place.reviewCount || 0),
  };
}

function makeSlug(name) {
  return slugify(String(name || 'dia-diem'), { lower: true, strict: true, locale: 'vi' }) || `place-${Date.now()}`;
}

function normalizeProvinceCode(input = {}) {
  const raw = input.provinceCode || input.province_code || input.province || '';
  const text = String(raw).trim();
  if (!text) return null;
  const upper = text.toUpperCase();
  if (['DN', 'HUE', 'QT', 'QNG', 'QN_CU'].includes(upper)) return upper;
  if (upper.includes('ĐÀ NẴNG') || upper.includes('DA NANG')) return 'DN';
  if (upper.includes('HUẾ') || upper.includes('HUE')) return 'HUE';
  if (upper.includes('QUẢNG TRỊ') || upper.includes('QUANG TRI')) return 'QT';
  if (upper.includes('QUẢNG NGÃI') || upper.includes('QUANG NGAI')) return 'QNG';
  if (upper.includes('HỘI AN') || upper.includes('HOI AN') || upper.includes('QUẢNG NAM') || upper.includes('QUANG NAM')) return 'QN_CU';
  return upper.slice(0, 30);
}

async function resolveCategoryId(input = {}) {
  if (input.categoryId) return Number(input.categoryId);
  const raw = String(input.category || input.categoryName || 'general').trim();
  if (!raw) return null;
  const code = slugify(raw, { lower: true, strict: true, locale: 'vi' }) || 'general';
  const found = await query(`SELECT TOP 1 id FROM tourist_categories WHERE code=@code OR name=@name`, { code, name: raw });
  if (found.recordset[0]) return Number(found.recordset[0].id);
  const inserted = await query(`
    INSERT INTO tourist_categories(code, name, icon, sort_order, is_active)
    OUTPUT INSERTED.id
    VALUES(@code, @name, N'📍', 999, 1)
  `, { code, name: raw });
  return Number(inserted.recordset[0].id);
}

async function listCategories() {
  const rs = await query(`
    SELECT id, code, name, icon
    FROM tourist_categories
    WHERE COALESCE(is_active, 1) = 1
    ORDER BY sort_order, id
  `);
  return rs.recordset;
}

async function findPlaces(filters = {}) {
  const includeInactive = String(filters.includeInactive || '').toLowerCase() === 'true' || filters.includeInactive === true;
  const rows = await cache.remember(`tourism:places:${includeInactive ? 'all' : 'active'}`, 60_000, async () => {
    const rs = await query(`
      SELECT
        p.id,
        p.name,
        p.slug,
        COALESCE(p.description, p.short_description, N'') AS description,
        p.short_description AS shortDescription,
        p.province_code AS provinceCode,
        pr.name AS provinceName,
        p.category_id AS categoryId,
        c.code AS category,
        c.name AS categoryName,
        p.address,
        p.latitude,
        p.longitude,
        p.image_url AS thumbnailUrl,
        p.opening_hours AS openingHours,
        p.suggested_duration_minutes AS suggestedDurationMinutes,
        p.min_budget AS minBudget,
        p.max_budget AS maxBudget,
        p.best_time AS bestTime,
        p.weather_note AS weatherNote,
        p.food_suggestions AS foodSuggestions,
        p.nearby_suggestions AS nearbySuggestions,
        p.nearby_suggestions AS tips,
        p.tags,
        p.average_rating AS averageRating,
        p.review_count AS reviewCount,
        p.is_active AS isActive,
        p.created_at AS createdAt,
        p.updated_at AS updatedAt
      FROM tourist_places p
      LEFT JOIN tourist_categories c ON c.id = p.category_id
      LEFT JOIN provinces pr ON pr.code = p.province_code
      WHERE (@includeInactive = 1 OR COALESCE(p.is_active, 1) = 1)
      ORDER BY p.average_rating DESC, p.review_count DESC, p.name
    `, { includeInactive: includeInactive ? 1 : 0 });
    return rs.recordset.map(withCategory).filter((p) => isValidLatLng(p.latitude, p.longitude, true));
  });

  let places = rows;
  if (filters.q || filters.keyword) {
    const q = String(filters.q || filters.keyword).toLowerCase();
    places = places.filter((p) => [p.name, p.description, p.shortDescription, p.address, p.categoryName, p.provinceCode, p.provinceName].join(' ').toLowerCase().includes(q));
  }
  if (filters.province || filters.provinceCode) {
    const province = String(filters.provinceCode || filters.province).toUpperCase();
    places = places.filter((p) => String(p.provinceCode || '').toUpperCase() === province || String(p.provinceName || '').toUpperCase().includes(province));
  }
  if (filters.category) places = places.filter((p) => String(p.category) === String(filters.category));
  if (filters.routeId || filters.routeCode) {
    const rid = String(filters.routeId || filters.routeCode).trim();
    const links = await query(`
      SELECT ps.place_id AS placeId
      FROM place_nearby_stops ps
      LEFT JOIN bus_routes br ON br.route_code = ps.route_code
      WHERE ps.route_code=@routeId OR ps.route_display_code=@routeId OR br.route_number=@routeId
    `, { routeId: rid });
    const ids = new Set(links.recordset.map((x) => Number(x.placeId)));
    places = places.filter((p) => ids.has(Number(p.id)));
  }
  return places;
}

async function findById(id) {
  const rs = await query(`
    SELECT TOP 1
      p.id,
      p.name,
      p.slug,
      p.description,
      p.province_code AS provinceCode,
      p.category_id AS categoryId,
      c.code AS category,
      c.name AS categoryName,
      p.address,
      p.latitude,
      p.longitude,
      p.image_url AS thumbnailUrl,
      p.best_time AS bestTime,
      p.nearby_suggestions AS tips,
      p.tags,
      p.opening_hours AS openingHours,
      p.suggested_duration_minutes AS suggestedDurationMinutes,
      p.min_budget AS minBudget,
      p.max_budget AS maxBudget,
      p.average_rating AS averageRating,
      p.review_count AS reviewCount,
      p.is_active AS isActive,
      p.created_at AS createdAt,
      p.updated_at AS updatedAt
    FROM tourist_places p
    LEFT JOIN tourist_categories c ON c.id = p.category_id
    WHERE p.id=@id AND COALESCE(p.is_active, 1) = 1
  `, { id: Number(id) });
  return rs.recordset[0] ? withCategory(rs.recordset[0]) : null;
}


async function findByIdForAdmin(id) {
  const rs = await query(`
    SELECT TOP 1
      p.id,
      p.name,
      p.slug,
      COALESCE(p.description, p.short_description, N'') AS description,
      p.short_description AS shortDescription,
      p.province_code AS provinceCode,
      p.category_id AS categoryId,
      c.code AS category,
      c.name AS categoryName,
      p.address,
      p.latitude,
      p.longitude,
      p.image_url AS thumbnailUrl,
      p.best_time AS bestTime,
      p.nearby_suggestions AS tips,
      p.tags,
      p.opening_hours AS openingHours,
      p.suggested_duration_minutes AS suggestedDurationMinutes,
      p.min_budget AS minBudget,
      p.max_budget AS maxBudget,
      p.average_rating AS averageRating,
      p.review_count AS reviewCount,
      p.is_active AS isActive,
      p.created_at AS createdAt,
      p.updated_at AS updatedAt
    FROM tourist_places p
    LEFT JOIN tourist_categories c ON c.id = p.category_id
    WHERE p.id=@id
  `, { id: Number(id) });
  return rs.recordset[0] ? withCategory(rs.recordset[0]) : null;
}

async function nearbyStops(placeId) {
  const rs = await query(`
    SELECT
      ps.place_id AS placeId,
      CAST(ps.stop_id AS NVARCHAR(30)) AS stopId,
      ps.route_code AS routeId,
      COALESCE(br.route_number, ps.route_display_code, ps.route_code) AS routeDisplayCode,
      ps.distance_meters AS distanceMeters,
      ps.walking_minutes AS walkingMinutes,
      ps.note,
      s.name AS stopName,
      s.address AS stopAddress,
      s.latitude AS lat,
      s.longitude AS lng
    FROM place_nearby_stops ps
    LEFT JOIN bus_stops s ON s.id = ps.stop_id
    LEFT JOIN bus_routes br ON br.route_code = ps.route_code
    WHERE ps.place_id = @placeId
    ORDER BY ps.distance_meters
  `, { placeId: Number(placeId) });
  return rs.recordset;
}


async function nearbyStopsForPlaces(placeIds = []) {
  const ids = [...new Set((placeIds || []).map(Number).filter(Boolean))];
  const result = new Map(ids.map((id) => [id, []]));
  if (!ids.length) return result;
  const values = ids.map((id, index) => `(@id${index})`).join(',');
  const params = Object.fromEntries(ids.map((id, index) => [`id${index}`, id]));
  const rs = await query(`
    SELECT
      ps.place_id AS placeId,
      CAST(ps.stop_id AS NVARCHAR(30)) AS stopId,
      ps.route_code AS routeId,
      COALESCE(br.route_number, ps.route_display_code, ps.route_code) AS routeDisplayCode,
      ps.distance_meters AS distanceMeters,
      ps.walking_minutes AS walkingMinutes,
      ps.note,
      s.name AS stopName,
      s.address AS stopAddress,
      s.latitude AS lat,
      s.longitude AS lng
    FROM place_nearby_stops ps
    JOIN (VALUES ${values}) AS wanted(place_id) ON wanted.place_id = ps.place_id
    LEFT JOIN bus_stops s ON s.id = ps.stop_id
    LEFT JOIN bus_routes br ON br.route_code = ps.route_code
    ORDER BY ps.place_id, ps.distance_meters
  `, params);
  for (const row of rs.recordset) {
    const key = Number(row.placeId);
    if (!result.has(key)) result.set(key, []);
    result.get(key).push(row);
  }
  return result;
}

async function reviews(placeId, includePending = false) {
  const rs = await query(`
    SELECT
      r.id,
      r.place_id AS placeId,
      r.user_id AS userId,
      COALESCE(u.full_name, N'Người dùng SmartBus') AS userName,
      r.rating,
      COALESCE(r.content, r.comment) AS content,
      r.route_code AS routeId,
      CAST(r.stop_id AS NVARCHAR(30)) AS stopId,
      r.visit_date AS visitDate,
      r.tags,
      r.status,
      r.helpful_count AS helpfulCount,
      r.created_at AS createdAt,
      r.updated_at AS updatedAt
    FROM reviews r
    LEFT JOIN users u ON u.id = r.user_id
    WHERE r.place_id = @placeId
      AND (@includePending = 1 OR r.status = 'approved')
    ORDER BY r.created_at DESC
  `, { placeId: Number(placeId), includePending: includePending ? 1 : 0 });
  return rs.recordset;
}

async function favoritePlace(userId, placeId) {
  await query(`
    IF NOT EXISTS (SELECT 1 FROM place_favorites WHERE user_id=@userId AND place_id=@placeId)
    BEGIN
      INSERT INTO place_favorites(user_id, place_id) VALUES(@userId, @placeId)
    END
  `, { userId: Number(userId), placeId: Number(placeId) });
  return { placeId: Number(placeId), favorited: true };
}

async function unfavoritePlace(userId, placeId) {
  await query('DELETE FROM place_favorites WHERE user_id=@userId AND place_id=@placeId', { userId: Number(userId), placeId: Number(placeId) });
  return { placeId: Number(placeId), favorited: false };
}

async function myFavorites(userId) {
  const rs = await query(`
    SELECT p.id, p.name, p.slug, p.description, p.province_code AS provinceCode, p.category_id AS categoryId, c.code AS category, c.name AS categoryName,
           p.address, p.latitude, p.longitude, p.image_url AS thumbnailUrl, p.best_time AS bestTime, p.nearby_suggestions AS tips, p.tags, p.opening_hours AS openingHours,
           p.suggested_duration_minutes AS suggestedDurationMinutes, p.min_budget AS minBudget, p.max_budget AS maxBudget,
           p.average_rating AS averageRating, p.review_count AS reviewCount, p.is_active AS isActive, p.created_at AS createdAt, p.updated_at AS updatedAt
    FROM place_favorites f
    JOIN tourist_places p ON p.id = f.place_id
    LEFT JOIN tourist_categories c ON c.id = p.category_id
    WHERE f.user_id=@userId AND COALESCE(p.is_active, 1) = 1
    ORDER BY f.created_at DESC
  `, { userId: Number(userId) });
  return rs.recordset.map(withCategory);
}

async function upsertPlace(input) {
  const categoryId = await resolveCategoryId(input);
  const provinceCode = normalizeProvinceCode(input);
  const isActive = input.isActive === undefined && input.is_active === undefined ? null : (input.isActive === false || input.is_active === false || String(input.isActive || input.is_active).toLowerCase() === 'false' || String(input.isActive || input.is_active) === '0' ? 0 : 1);
  const commonParams = {
    name: input.name,
    slug: input.slug || (input.name ? makeSlug(input.name) : null),
    description: input.description || input.shortDescription || null,
    shortDescription: input.shortDescription || input.short_description || null,
    provinceCode,
    categoryId,
    address: input.address || null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    imageUrl: input.imageUrl || input.thumbnailUrl || null,
    openingHours: input.openingHours || null,
    duration: input.suggestedDurationMinutes || input.duration || null,
    minBudget: input.minBudget || null,
    maxBudget: input.maxBudget || null,
    bestTime: input.bestTime || input.best_time || null,
    tips: input.tips || input.nearbySuggestions || null,
    tags: Array.isArray(input.tags) ? input.tags.join(', ') : (input.tags || null),
    isActive,
  };

  if (input.id) {
    const rs = await query(`
      UPDATE tourist_places
      SET name=COALESCE(@name, name),
          slug=COALESCE(@slug, slug),
          description=COALESCE(@description, description),
          short_description=COALESCE(@shortDescription, short_description),
          province_code=COALESCE(@provinceCode, province_code),
          category_id=COALESCE(@categoryId, category_id),
          address=COALESCE(@address, address),
          latitude=COALESCE(@latitude, latitude),
          longitude=COALESCE(@longitude, longitude),
          image_url=COALESCE(@imageUrl, image_url),
          opening_hours=COALESCE(@openingHours, opening_hours),
          suggested_duration_minutes=COALESCE(@duration, suggested_duration_minutes),
          min_budget=COALESCE(@minBudget, min_budget),
          max_budget=COALESCE(@maxBudget, max_budget),
          best_time=COALESCE(@bestTime, best_time),
          nearby_suggestions=COALESCE(@tips, nearby_suggestions),
          tags=COALESCE(@tags, tags),
          is_active=COALESCE(@isActive, is_active),
          updated_at=SYSDATETIME()
      OUTPUT INSERTED.id
      WHERE id=@id
    `, { id: Number(input.id), ...commonParams });
    cache.clear('tourism:places:');
    return rs.recordset[0] ? findByIdForAdmin(input.id) : null;
  }

  const rs = await query(`
    INSERT INTO tourist_places(name, slug, description, short_description, province_code, category_id, address, latitude, longitude, image_url, opening_hours, suggested_duration_minutes, min_budget, max_budget, best_time, nearby_suggestions, tags, is_active)
    OUTPUT INSERTED.id
    VALUES(@name, @slug, @description, @shortDescription, @provinceCode, @categoryId, @address, @latitude, @longitude, @imageUrl, @openingHours, COALESCE(@duration, 90), @minBudget, @maxBudget, @bestTime, @tips, @tags, COALESCE(@isActive, 1))
  `, commonParams);
  cache.clear('tourism:places:');
  return findByIdForAdmin(rs.recordset[0].id);
}

async function removePlace(id) {
  const rs = await query(`
    UPDATE tourist_places
    SET is_active=0, updated_at=SYSDATETIME()
    OUTPUT INSERTED.id
    WHERE id=@id
  `, { id: Number(id) });
  cache.clear('tourism:places:');
  return { id: Number(id), deleted: Boolean(rs.recordset[0]) };
}

module.exports = {
  listCategories,
  findPlaces,
  findById,
  findByIdForAdmin,
  nearbyStops,
  nearbyStopsForPlaces,
  reviews,
  favoritePlace,
  unfavoritePlace,
  myFavorites,
  upsertPlace,
  removePlace,
};
