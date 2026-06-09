const data = require('../../services/data.service');
const cache = require('../../common/utils/cache.util');
const { isValidLatLng } = require('../../common/utils/gis-validator.util');
const { query } = require('../../config/db');

function normalizeLimit(value, fallback = 20, max = 100) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(n)));
}

async function findAll(routeId = null, filters = {}) {
  let stops = await cache.remember(`stops:${routeId || 'all'}`, 60_000, () => data.getStops(routeId || null));
  stops = stops.filter((s) => isValidLatLng(s.lat ?? s.latitude, s.lng ?? s.longitude, true));
  if (filters.province || filters.provinceCode) {
    const code = String(filters.provinceCode || filters.province).toUpperCase();
    stops = stops.filter((s) => String(s.provinceCode || '').toUpperCase() === code || String(s.provinceName || '').toUpperCase().includes(code));
  }
  if (filters.q || filters.keyword) {
    const q = String(filters.q || filters.keyword).toLowerCase();
    stops = stops.filter((s) => [s.name, s.address, s.nearbyLandmark, s.provinceName, s.routeDisplayCode].join(' ').toLowerCase().includes(q));
  }
  return stops;
}

async function findNearby({ lat, lng, limit = 5, routeId = null, province = null, provinceCode = null, q = null } = {}) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
  const max = normalizeLimit(limit, 5, 20);
  const provinceFilter = String(provinceCode || province || '').trim() || null;
  const routeFilter = routeId ? String(routeId).trim() : null;
  const keyword = String(q || '').trim() || null;

  const rs = await query(`
    ;WITH scored AS (
      SELECT
        s.id,
        s.external_stop_code AS externalStopCode,
        s.name,
        s.address,
        s.stop_type AS stopType,
        s.province_code AS provinceCode,
        p.name AS provinceName,
        s.latitude AS lat,
        s.longitude AS lng,
        s.is_major AS isMajor,
        s.nearby_landmark AS nearbyLandmark,
        primary_route.route_code AS routeId,
        COALESCE(primary_route.route_number, primary_route.route_code) AS routeDisplayCode,
        CAST((6371.0 * 2.0 * ASIN(
          CASE
            WHEN SQRT(
              POWER(SIN(RADIANS((s.latitude - @lat) / 2.0)), 2) +
              COS(RADIANS(@lat)) * COS(RADIANS(s.latitude)) * POWER(SIN(RADIANS((s.longitude - @lng) / 2.0)), 2)
            ) > 1 THEN 1
            ELSE SQRT(
              POWER(SIN(RADIANS((s.latitude - @lat) / 2.0)), 2) +
              COS(RADIANS(@lat)) * COS(RADIANS(s.latitude)) * POWER(SIN(RADIANS((s.longitude - @lng) / 2.0)), 2)
            )
          END
        )) AS FLOAT) AS distanceKm
      FROM bus_stops s
      LEFT JOIN provinces p ON p.code = s.province_code
      OUTER APPLY (
        SELECT TOP 1 rs.route_code, br.route_number, br.name, br.color
        FROM route_stops rs
        LEFT JOIN bus_routes br ON br.route_code = rs.route_code
        WHERE rs.stop_id = s.id
        ORDER BY COALESCE(rs.sequence_no, 99999), rs.route_code
      ) primary_route
      WHERE s.latitude IS NOT NULL AND s.longitude IS NOT NULL
        AND s.latitude BETWEEN -90 AND 90
        AND s.longitude BETWEEN -180 AND 180
        AND (@province IS NULL OR UPPER(s.province_code) = UPPER(@province) OR UPPER(p.name) LIKE '%' + UPPER(@province) + '%')
        AND (@keyword IS NULL OR s.name LIKE '%' + @keyword + '%' OR s.address LIKE '%' + @keyword + '%' OR s.nearby_landmark LIKE '%' + @keyword + '%')
        AND (@routeId IS NULL OR EXISTS (
          SELECT 1
          FROM route_stops rsf
          LEFT JOIN bus_routes brf ON brf.route_code = rsf.route_code
          WHERE rsf.stop_id = s.id
            AND (rsf.route_code = @routeId OR brf.route_number = @routeId)
        ))
    )
    SELECT TOP (@limit)
      CAST(scored.id AS NVARCHAR(30)) AS id,
      scored.externalStopCode,
      scored.name,
      scored.address,
      scored.stopType,
      scored.provinceCode,
      scored.provinceName,
      scored.lat,
      scored.lng,
      scored.isMajor,
      scored.nearbyLandmark,
      scored.routeId,
      scored.routeDisplayCode,
      CAST(ROUND(scored.distanceKm * 1000.0, 0) AS INT) AS distanceMeters,
      scored.distanceKm,
      COALESCE((
        SELECT DISTINCT br.route_code AS id, COALESCE(br.route_number, br.route_code) AS displayCode, br.name, br.color
        FROM route_stops rs3
        JOIN bus_routes br ON br.route_code = rs3.route_code
        WHERE rs3.stop_id = TRY_CONVERT(INT, scored.id)
        FOR JSON PATH
      ), '[]') AS routesJson
    FROM scored
    ORDER BY scored.distanceKm ASC, scored.name ASC
  `, { lat: latitude, lng: longitude, limit: max, province: provinceFilter, routeId: routeFilter, keyword });

  return (rs.recordset || []).map((row) => {
    let routes = [];
    try { routes = row.routesJson ? JSON.parse(row.routesJson) : []; } catch { routes = []; }
    return { ...row, routes, routesJson: undefined };
  });
}

module.exports = { findAll, findNearby };
