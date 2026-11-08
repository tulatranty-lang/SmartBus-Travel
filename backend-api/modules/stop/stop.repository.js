const data = require("../../services/data.service");
const cache = require("../../common/utils/cache.util");
const { isValidLatLng } = require("../../common/utils/gis-validator.util");
const { query } = require("../../config/db");
const { haversineMeters } = require("../../common/utils/distance.util");

function numberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function text(value) {
  return String(value || "").trim();
}

function parseRoutesJson(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

function filterStops(stops, filters = {}) {
  let rows = Array.isArray(stops) ? stops : [];
  if (filters.province || filters.provinceCode) {
    const code = String(filters.provinceCode || filters.province).toUpperCase();
    rows = rows.filter(
      (s) =>
        String(s.provinceCode || "").toUpperCase() === code ||
        String(s.provinceName || "")
          .toUpperCase()
          .includes(code),
    );
  }
  if (filters.q || filters.keyword || filters.search) {
    const q = String(
      filters.q || filters.keyword || filters.search,
    ).toLowerCase();
    rows = rows.filter((s) =>
      [
        s.name,
        s.address,
        s.nearbyLandmark,
        s.provinceName,
        s.routeDisplayCode,
        ...(s.routes || []).map(
          (r) => `${r.displayCode || ""} ${r.name || ""}`,
        ),
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }
  return rows;
}

function filterRoute(stops, routeId = null) {
  if (!routeId) return stops;
  const rid = String(routeId).trim().toUpperCase();
  return stops.filter((stop) => {
    if (String(stop.routeId || "").toUpperCase() === rid) return true;
    if (String(stop.routeDisplayCode || "").toUpperCase() === rid) return true;
    return (stop.routes || []).some((r) =>
      [r.id, r.routeCode, r.displayCode].some(
        (v) => String(v || "").toUpperCase() === rid,
      ),
    );
  });
}

function withDistance(stop, origin) {
  const distanceMeters = haversineMeters(origin, stop);
  return {
    ...stop,
    distanceMeters,
    distanceKm: Number(((distanceMeters || 0) / 1000).toFixed(2)),
  };
}

function normalizeDbStop(row) {
  return {
    id: row.id,
    externalStopCode: row.externalStopCode,
    code: row.externalStopCode || row.id,
    routeId: row.routeId,
    routeDisplayCode: row.routeDisplayCode,
    routeCode: row.routeDisplayCode || row.routeId,
    routeName: row.routeName || null,
    provinceCode: row.provinceCode,
    provinceName: row.provinceName,
    name: row.name,
    address: row.address || row.nearbyLandmark || "",
    stopType: row.stopType,
    lat: numberOrNull(row.lat ?? row.latitude),
    lng: numberOrNull(row.lng ?? row.longitude),
    latitude: numberOrNull(row.lat ?? row.latitude),
    longitude: numberOrNull(row.lng ?? row.longitude),
    isMajor: Boolean(row.isMajor),
    nearbyLandmark: row.nearbyLandmark,
    sequence: row.sequence,
    routeCount: row.routeCount,
    routes: parseRoutesJson(row.routesJson || row.routes),
    distanceMeters: Number.isFinite(Number(row.distanceMeters))
      ? Math.round(Number(row.distanceMeters))
      : null,
    distanceKm: Number.isFinite(Number(row.distanceKm))
      ? Number(Number(row.distanceKm).toFixed(2))
      : null,
    source: "sql-server",
  };
}

async function findAll(routeId = null, filters = {}) {
  let stops;
  try {
    stops = await cache.remember(`stops:${routeId || "all"}`, 60_000, () =>
      data.getStops(routeId || null),
    );
  } catch (err) {
    err.status = 503;
    err.errorCode = "STOPS_UNAVAILABLE";
    throw err;
  }
  stops = stops.filter((s) =>
    isValidLatLng(s.lat ?? s.latitude, s.lng ?? s.longitude, true),
  );
  return filterStops(stops, filters);
}

async function findNearby({
  lat,
  lng,
  routeId = null,
  limit = 5,
  province,
  provinceCode,
  q,
  keyword,
} = {}) {
  const origin = { lat: Number(lat), lng: Number(lng) };
  const max = Math.max(1, Math.min(20, Number(limit) || 5));
  if (!Number.isFinite(origin.lat) || !Number.isFinite(origin.lng)) return [];

  try {
    const rs = await query(
      `
      SELECT TOP (@limit)
        CAST(s.id AS NVARCHAR(30)) AS id,
        s.external_stop_code AS externalStopCode,
        COALESCE(rs.route_code, r.route_code) AS routeId,
        COALESCE(r.route_number, COALESCE(rs.route_code, r.route_code)) AS routeDisplayCode,
        r.name AS routeName,
        s.province_code AS provinceCode,
        p.name AS provinceName,
        s.name,
        s.address,
        s.stop_type AS stopType,
        s.latitude AS lat,
        s.longitude AS lng,
        s.is_major AS isMajor,
        s.nearby_landmark AS nearbyLandmark,
        COALESCE(rs.sequence_no, 99999) AS sequence,
        (
          SELECT COUNT(DISTINCT rsx.route_code)
          FROM route_stops rsx
          WHERE rsx.stop_id = s.id
        ) AS routeCount,
        COALESCE((
          SELECT DISTINCT br.route_code AS id, COALESCE(br.route_number, br.route_code) AS displayCode, br.name, br.color
          FROM route_stops rs3
          JOIN bus_routes br ON br.route_code = rs3.route_code
          WHERE rs3.stop_id = s.id
          FOR JSON PATH
        ), '[]') AS routesJson,
        (
          6371000.0 * 2.0 * ASIN(SQRT(
            POWER(SIN(RADIANS((s.latitude - @lat) / 2.0)), 2) +
            COS(RADIANS(@lat)) * COS(RADIANS(s.latitude)) * POWER(SIN(RADIANS((s.longitude - @lng) / 2.0)), 2)
          ))
        ) AS distanceMeters
      FROM bus_stops s
      LEFT JOIN provinces p ON p.code = s.province_code
      LEFT JOIN route_stops rs ON rs.stop_id = s.id AND (@routeId IS NULL OR rs.route_code = @routeId)
      LEFT JOIN bus_routes r ON r.route_code = rs.route_code
      WHERE s.latitude IS NOT NULL
        AND s.longitude IS NOT NULL
        AND s.latitude BETWEEN -90 AND 90
        AND s.longitude BETWEEN -180 AND 180
        AND (@routeId IS NULL OR rs.route_code = @routeId OR r.route_number = @routeId)
        AND (@province IS NULL OR s.province_code = @province OR p.name LIKE N'%' + @province + N'%')
        AND (@q IS NULL OR s.name LIKE N'%' + @q + N'%' OR s.address LIKE N'%' + @q + N'%' OR s.nearby_landmark LIKE N'%' + @q + N'%')
      ORDER BY distanceMeters ASC, s.name ASC
    `,
      {
        lat: origin.lat,
        lng: origin.lng,
        limit: max,
        routeId: routeId || null,
        province: provinceCode || province || null,
        q: q || keyword || null,
      },
    );
    return rs.recordset
      .map(normalizeDbStop)
      .filter((s) => isValidLatLng(s.lat, s.lng, true));
  } catch (err) {
    err.status = 503;
    err.errorCode = "STOPS_UNAVAILABLE";
    throw err;
  }
}

module.exports = { findAll, findNearby };
