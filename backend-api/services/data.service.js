const { query } = require('../config/db');
const { BUS_LIMIT_PER_PROVINCE } = require('../common/constants/app.constants');

function routeCode(value) {
  return String(value || '').trim();
}

function normalizeDate(value) {
  return value instanceof Date ? value.toISOString() : value;
}

function parseJson(value, fallback = []) {
  if (!value) return fallback;
  if (Array.isArray(value)) return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function normalizeProvinceCode(row) {
  return String(row.provinceCode || row.province_code || row.province || 'UNKNOWN').toUpperCase();
}

function limitPerProvince(rows = [], limit = BUS_LIMIT_PER_PROVINCE) {
  const max = Math.max(1, Number(limit) || BUS_LIMIT_PER_PROVINCE);
  const count = new Map();
  return rows.filter((row) => {
    const code = normalizeProvinceCode(row);
    const n = count.get(code) || 0;
    if (n >= max) return false;
    count.set(code, n + 1);
    return true;
  });
}

async function getRoutes() {
  const rs = await query(`
    SELECT
      r.route_code AS id,
      r.route_code AS routeCode,
      COALESCE(r.route_number, r.route_code) AS displayCode,
      r.province_code AS provinceCode,
      p.name AS provinceName,
      r.name,
      COALESCE(r.type, N'Tuyến xe buýt') AS type,
      COALESCE(r.fare, N'Đang cập nhật') AS fare,
      COALESCE(r.color, '#2563eb') AS color,
      COALESCE(r.operating_time, N'Đang cập nhật') AS time,
      COALESCE(r.interval_text, N'Đang cập nhật') AS interval,
      r.description,
      r.operator_name AS operatorName,
      r.origin_name AS originName,
      r.destination_name AS destinationName,
      r.distance_km AS distanceKm,
      r.estimated_minutes AS estimatedMinutes,
      r.vehicle_count AS vehicleCount,
      r.avg_speed_kmh AS avgSpeedKmh,
      r.min_speed_kmh AS minSpeedKmh,
      r.max_speed_kmh AS maxSpeedKmh,
      r.reliability_level AS reliabilityLevel,
      COALESCE((
        SELECT s.latitude AS lat, s.longitude AS lng
        FROM route_stops rs2
        JOIN bus_stops s ON s.id = rs2.stop_id
        WHERE rs2.route_code = r.route_code
          AND (rs2.direction = N'chiều_đi' OR rs2.direction IS NULL)
          AND s.latitude IS NOT NULL AND s.longitude IS NOT NULL
        ORDER BY rs2.sequence_no
        FOR JSON PATH
      ), '[]') AS pathJson
    FROM bus_routes r
    LEFT JOIN provinces p ON p.code = r.province_code
    WHERE COALESCE(r.is_active, 1) = 1
    ORDER BY COALESCE(r.province_code, ''), COALESCE(r.route_number, r.route_code), r.route_code
  `);
  return rs.recordset.map((r) => ({
    ...r,
    path: parseJson(r.pathJson).map((p) => [Number(p.lat), Number(p.lng)]).filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1])),
    pathJson: undefined,
  }));
}

async function getRoute(id) {
  const rid = routeCode(id);
  const rs = await query(`
    SELECT TOP 1
      r.route_code AS id,
      r.route_code AS routeCode,
      COALESCE(r.route_number, r.route_code) AS displayCode,
      r.province_code AS provinceCode,
      p.name AS provinceName,
      r.name,
      COALESCE(r.type, N'Tuyến xe buýt') AS type,
      COALESCE(r.fare, N'Đang cập nhật') AS fare,
      COALESCE(r.color, '#2563eb') AS color,
      COALESCE(r.operating_time, N'Đang cập nhật') AS time,
      COALESCE(r.interval_text, N'Đang cập nhật') AS interval,
      r.description,
      r.operator_name AS operatorName,
      r.origin_name AS originName,
      r.destination_name AS destinationName,
      r.distance_km AS distanceKm,
      r.estimated_minutes AS estimatedMinutes,
      r.vehicle_count AS vehicleCount,
      r.avg_speed_kmh AS avgSpeedKmh,
      r.min_speed_kmh AS minSpeedKmh,
      r.max_speed_kmh AS maxSpeedKmh,
      r.reliability_level AS reliabilityLevel,
      COALESCE((
        SELECT s.latitude AS lat, s.longitude AS lng
        FROM route_stops rs2
        JOIN bus_stops s ON s.id = rs2.stop_id
        WHERE rs2.route_code = r.route_code
          AND (rs2.direction = N'chiều_đi' OR rs2.direction IS NULL)
          AND s.latitude IS NOT NULL AND s.longitude IS NOT NULL
        ORDER BY rs2.sequence_no
        FOR JSON PATH
      ), '[]') AS pathJson
    FROM bus_routes r
    LEFT JOIN provinces p ON p.code = r.province_code
    WHERE (r.route_code = @id OR r.route_number = @id) AND COALESCE(r.is_active, 1) = 1
    ORDER BY CASE WHEN r.route_code=@id THEN 0 ELSE 1 END
  `, { id: rid });
  const r = rs.recordset[0];
  if (!r) return null;
  return {
    ...r,
    path: parseJson(r.pathJson).map((p) => [Number(p.lat), Number(p.lng)]).filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1])),
    pathJson: undefined,
  };
}

async function getStops(routeId = null) {
  const rid = routeId ? routeCode(routeId) : null;
  const rs = await query(`
    SELECT
      CAST(s.id AS NVARCHAR(30)) AS id,
      s.external_stop_code AS externalStopCode,
      COALESCE(rs.route_code, r.route_code) AS routeId,
      COALESCE(r.route_number, COALESCE(rs.route_code, r.route_code)) AS routeDisplayCode,
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
      ), '[]') AS routesJson
    FROM bus_stops s
    LEFT JOIN provinces p ON p.code = s.province_code
    LEFT JOIN route_stops rs ON rs.stop_id = s.id AND (@routeId IS NULL OR rs.route_code = @routeId)
    LEFT JOIN bus_routes r ON r.route_code = rs.route_code
    WHERE @routeId IS NULL OR rs.route_code = @routeId
    ORDER BY COALESCE(s.province_code, ''), COALESCE(rs.route_code, ''), COALESCE(rs.sequence_no, 99999), s.name
  `, { routeId: rid });
  return rs.recordset.map((s) => ({ ...s, routes: parseJson(s.routesJson), routesJson: undefined }));
}

async function getBuses(routeId = null, filters = {}) {
  const rid = routeId ? routeCode(routeId) : null;
  const province = filters.province || filters.provinceCode || null;
  const rs = await query(`
    SELECT
      b.bus_code AS id,
      b.bus_code AS uid,
      b.plate,
      b.route_code AS routeId,
      COALESCE(r.route_number, b.route_code) AS routeDisplayCode,
      r.province_code AS provinceCode,
      b.status,
      b.capacity,
      b.speed_kmh AS speed,
      b.progress,
      b.crowding,
      b.latitude AS lat,
      b.longitude AS lng
    FROM buses b
    LEFT JOIN bus_routes r ON r.route_code = b.route_code
    WHERE (@routeId IS NULL OR b.route_code = @routeId OR r.route_number = @routeId)
      AND (@province IS NULL OR r.province_code = @province)
    ORDER BY r.province_code, r.route_number, b.bus_code
  `, { routeId: rid, province });
  const rows = rs.recordset.map((b) => ({ ...b, progress: Number(b.progress || 0), speed: Number(b.speed || 22) }));
  return limitPerProvince(rows, filters.limitPerProvince);
}

async function addReport(report) {
  const rs = await query(`
    INSERT INTO reports(user_id, route_code, plate, crowding, problem_type, note, status)
    OUTPUT INSERTED.id, INSERTED.user_id AS userId, INSERTED.route_code AS routeId, INSERTED.plate,
           INSERTED.crowding, INSERTED.problem_type AS problemType, INSERTED.note, INSERTED.status,
           INSERTED.created_at AS createdAt
    VALUES(@userId, @routeId, @plate, @crowding, @problemType, @note, 'new')
  `, {
    userId: report.userId || null,
    routeId: report.routeId ? routeCode(report.routeId) : null,
    plate: report.plate || null,
    crowding: report.crowding || null,
    problemType: report.problemType || 'crowding',
    note: report.note || null,
  });
  return rs.recordset[0];
}

async function getReports() {
  const rs = await query(`
    SELECT TOP 100
      id, user_id AS userId, route_code AS routeId, plate, crowding,
      problem_type AS problemType, note, status, created_at AS createdAt
    FROM reports
    ORDER BY created_at DESC
  `);
  return rs.recordset.map((r) => ({ ...r, createdAt: normalizeDate(r.createdAt) }));
}

async function updateReportStatus(id, status) {
  const rs = await query(`
    UPDATE reports
    SET status = @status
    OUTPUT INSERTED.id, INSERTED.user_id AS userId, INSERTED.route_code AS routeId, INSERTED.plate,
           INSERTED.crowding, INSERTED.problem_type AS problemType, INSERTED.note, INSERTED.status,
           INSERTED.created_at AS createdAt
    WHERE id = @id
  `, { id: Number(id), status });
  return rs.recordset[0] || null;
}

async function addChatLog(log) {
  const rs = await query(`
    INSERT INTO chatbot_logs(user_id, question, answer, intent, lat, lng)
    OUTPUT INSERTED.id, INSERTED.user_id AS userId, INSERTED.question AS message,
           INSERTED.answer AS reply, INSERTED.intent, INSERTED.lat, INSERTED.lng, INSERTED.created_at AS createdAt
    VALUES(@userId, @message, @reply, @intent, @lat, @lng)
  `, {
    userId: log.userId || null,
    message: log.message,
    reply: log.reply,
    intent: log.intent || null,
    lat: log.lat || null,
    lng: log.lng || null,
  });
  // Mirror to new chat_logs/chat_history tables when schema extension exists.
  try {
    await query(`INSERT INTO chat_logs(user_id, message, reply, intent, lat, lng) VALUES(@userId, @message, @reply, @intent, @lat, @lng)`, {
      userId: log.userId || null,
      message: log.message,
      reply: log.reply,
      intent: log.intent || null,
      lat: log.lat || null,
      lng: log.lng || null,
    });
  } catch (_err) {}
  try {
    await query(`INSERT INTO chat_history(user_id, message, bot_response, intent, related_place_id, related_route_id) VALUES(@userId, @message, @reply, @intent, @relatedPlaceId, @relatedRouteId)`, {
      userId: log.userId || null,
      message: log.message,
      reply: log.reply,
      intent: log.intent || null,
      relatedPlaceId: log.relatedPlaceId || null,
      relatedRouteId: log.relatedRouteId || null,
    });
  } catch (_err) {}
  return rs.recordset[0];
}

async function getChatHistory(userId) {
  if (!userId) return [];
  try {
    const rs = await query(`
      SELECT TOP 50
        h.id, h.user_id AS userId, h.message, h.bot_response AS reply, h.intent,
        h.related_place_id AS relatedPlaceId, h.related_route_id AS relatedRouteId, h.created_at AS createdAt,
        p.name AS relatedPlaceName, r.name AS relatedRouteName
      FROM chat_history h
      LEFT JOIN tourist_places p ON p.id = h.related_place_id
      LEFT JOIN bus_routes r ON r.route_code = h.related_route_id
      WHERE h.user_id = @userId
      ORDER BY h.created_at DESC
    `, { userId: Number(userId) });
    return rs.recordset.map((r) => ({ ...r, createdAt: normalizeDate(r.createdAt) }));
  } catch (_err) {
    const rs = await query(`
      SELECT TOP 50
        id, user_id AS userId, question AS message, answer AS reply, intent, lat, lng, created_at AS createdAt
      FROM chatbot_logs
      WHERE user_id = @userId
      ORDER BY created_at DESC
    `, { userId: Number(userId) });
    return rs.recordset.map((r) => ({ ...r, createdAt: normalizeDate(r.createdAt) }));
  }
}

async function findUserByEmail(email) {
  const rs = await query(`
    SELECT TOP 1
      id,
      full_name AS fullName,
      email,
      password_hash AS passwordHash,
      role,
      is_active AS isActive,
      phone
    FROM users
    WHERE LOWER(email) = LOWER(@email)
  `, { email });
  return rs.recordset[0] || null;
}

async function createUser({ fullName, email, passwordHash, role = 'user' }) {
  const rs = await query(`
    INSERT INTO users(full_name, email, password_hash, role, is_active)
    OUTPUT INSERTED.id, INSERTED.full_name AS fullName, INSERTED.email, INSERTED.role, INSERTED.is_active AS isActive
    VALUES(@fullName, @email, @passwordHash, @role, 1)
  `, { fullName, email, passwordHash, role });
  return rs.recordset[0];
}

async function getVehicles(filters = {}) {
  const rs = await query(`
    SELECT
      v.id,
      v.vehicle_code AS vehicleCode,
      v.vehicle_name AS vehicleName,
      COALESCE(v.license_plate, v.plate) AS licensePlate,
      v.province_code AS provinceCode,
      v.route_code AS routeId,
      COALESCE(r.route_number, v.route_code) AS routeDisplayCode,
      r.name AS routeName,
      v.vehicle_type AS vehicleType,
      v.capacity,
      v.status,
      v.avg_speed_kmh AS avgSpeedKmh,
      v.min_speed_kmh AS minSpeedKmh,
      v.max_speed_kmh AS maxSpeedKmh,
      v.created_at AS createdAt,
      v.updated_at AS updatedAt
    FROM bus_vehicles v
    LEFT JOIN bus_routes r ON r.route_code = v.route_code
    WHERE (@province IS NULL OR v.province_code=@province OR r.province_code=@province)
      AND (@routeId IS NULL OR v.route_code=@routeId OR r.route_number=@routeId)
    ORDER BY COALESCE(v.province_code, r.province_code), v.vehicle_code
  `, { province: filters.province || null, routeId: filters.routeId || null });
  return rs.recordset;
}

async function getVehicleLocations(filters = {}) {
  const rs = await query(`
    SELECT
      COALESCE(v.vehicle_code, b.bus_code) AS vehicleCode,
      COALESCE(v.vehicle_name, b.bus_code) AS vehicleName,
      COALESCE(v.license_plate, v.plate, b.plate) AS licensePlate,
      COALESCE(v.province_code, r.province_code) AS provinceCode,
      COALESCE(v.route_code, b.route_code) AS routeId,
      COALESCE(r.route_number, COALESCE(v.route_code, b.route_code)) AS routeDisplayCode,
      b.latitude AS lat,
      b.longitude AS lng,
      b.speed_kmh AS speedKmh,
      NULL AS heading,
      b.progress,
      b.crowding,
      COALESCE(v.status, b.status) AS status,
      SYSDATETIME() AS recordedAt
    FROM buses b
    LEFT JOIN bus_vehicles v ON v.vehicle_code=b.bus_code
    LEFT JOIN bus_routes r ON r.route_code=COALESCE(v.route_code, b.route_code)
    WHERE (@province IS NULL OR COALESCE(v.province_code, r.province_code)=@province)
      AND (@routeId IS NULL OR COALESCE(v.route_code, b.route_code)=@routeId OR r.route_number=@routeId)
    ORDER BY COALESCE(v.province_code, r.province_code), COALESCE(v.route_code, b.route_code), COALESCE(v.vehicle_code, b.bus_code)
  `, { province: filters.province || null, routeId: filters.routeId || null });
  return limitPerProvince(rs.recordset, filters.limitPerProvince);
}

module.exports = {
  getRoutes,
  getRoute,
  getStops,
  getBuses,
  getVehicles,
  getVehicleLocations,
  addReport,
  getReports,
  updateReportStatus,
  addChatLog,
  getChatHistory,
  findUserByEmail,
  createUser,
};
