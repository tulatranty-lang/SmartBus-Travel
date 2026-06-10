require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const slugify = require('slugify');
const { query, closePool } = require('../config/db');

const DEFAULT_BUS_FILE = path.join(__dirname, '..', 'data', 'import', 'smartbus-bus-data.normalized.json');
const DEFAULT_TOURISM_FILE = path.join(__dirname, '..', 'data', 'import', 'smartbus-tourism-data.normalized.json');

function clean(value) {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}
function numberOrNull(value) {
  const s = clean(value);
  if (!s) return null;
  const m = s.replace(',', '.').match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}
function intOrNull(value) {
  const n = numberOrNull(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}
function boolInt(value) {
  const s = String(value || '').toLowerCase().trim();
  return ['có', 'co', 'yes', 'true', '1', 'x'].includes(s) ? 1 : 0;
}
function moneyText(value) {
  const s = clean(value);
  if (!s) return null;
  if (/không|chưa/i.test(s)) return s;
  const n = intOrNull(s);
  return n !== null ? `${n.toLocaleString('vi-VN')}đ` : s;
}
function makeSlug(name) {
  return slugify(String(name || 'dia-diem'), { lower: true, strict: true, locale: 'vi' }) || `place-${Date.now()}`;
}
function categoryCode(value) {
  const s = String(value || '').toLowerCase();
  if (/biển|bien|đảo|dao/.test(s)) return 'beach';
  if (/lịch|lich|di tích|di_tich|văn hóa|van hoa|bảo tàng|bao tang/.test(s)) return 'culture';
  if (/tâm linh|tam linh|chùa|chua|nhà thờ|nha tho/.test(s)) return 'spiritual';
  if (/vui chơi|giải trí|giai_tri|công viên/.test(s)) return 'entertainment';
  if (/check|cầu|cau|view/.test(s)) return 'checkin';
  if (/chợ|cho|mua/.test(s)) return 'shopping';
  if (/núi|nui|thiên nhiên|thác|thac|suối|suoi/.test(s)) return 'nature';
  return 'general';
}
function colorAt(index) {
  return ['#2563eb', '#16a34a', '#dc2626', '#7c3aed', '#ea580c', '#0891b2', '#be123c', '#65a30d', '#9333ea', '#0f766e', '#ca8a04', '#0284c7'][index % 12];
}
function pick(row, key) { return clean(row[key]); }

function parseCsv(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  const rows = [];
  let cur = '', row = [], quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"' && text[i + 1] === '"') { cur += '"'; i += 1; continue; }
    if (ch === '"') { quoted = !quoted; continue; }
    if (ch === ',' && !quoted) { row.push(cur); cur = ''; continue; }
    if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cur); cur = '';
      if (row.some((x) => clean(x))) rows.push(row);
      row = [];
      continue;
    }
    cur += ch;
  }
  if (cur || row.length) { row.push(cur); if (row.some((x) => clean(x))) rows.push(row); }
  const headers = rows.shift() || [];
  return rows.map((r) => Object.fromEntries(headers.map((h, i) => [h.trim(), clean(r[i])])));
}
function readWorkbook(file) {
  let xlsx;
  try { xlsx = require('xlsx'); }
  catch (err) {
    throw new Error('Thiếu package xlsx để import Excel. Hãy chạy npm install trong backend-api.');
  }
  const wb = xlsx.readFile(file);
  const out = {};
  for (const name of wb.SheetNames) out[name] = xlsx.utils.sheet_to_json(wb.Sheets[name], { defval: '', raw: false });
  return out;
}
function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function loadFile(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.json') return readJson(file);
  if (ext === '.csv') return { records: parseCsv(file) };
  if (ext === '.xlsx' || ext === '.xls') return { rawSheets: readWorkbook(file), sourceExcel: path.basename(file) };
  throw new Error(`Không hỗ trợ định dạng ${ext}. Chỉ hỗ trợ .json, .csv, .xlsx.`);
}

function normalizeBus(input) {
  if (Array.isArray(input.routes) && Array.isArray(input.stops) && Array.isArray(input.routeStops)) return input;
  const sheets = input.rawSheets || input;
  const routesRaw = sheets['03_Tuyến_xe_bus'] || [];
  const stopsRaw = sheets['04_Điểm_dừng_có_GPS'] || [];
  const routeStopsRaw = sheets['05_Thứ_tự_dừng_theo_tuyến'] || [];
  const provincesRaw = sheets['02_Tỉnh_thành'] || [];
  const byRoute = new Map();
  const routeStops = routeStopsRaw.map((r) => {
    const routeCode = pick(r, 'mã_tuyến');
    const sequenceNo = intOrNull(r['thứ_tự_dừng']) || ((byRoute.get(routeCode)?.length || 0) + 1);
    const item = {
      externalRouteStopCode: pick(r, 'mã_điểm_dừng_theo_tuyến'), routeCode, routeNumber: pick(r, 'số_hiệu_tuyến'), provinceCode: pick(r, 'mã_tỉnh_thành'),
      direction: pick(r, 'chiều_tuyến') || 'chiều_đi', sequenceNo, externalStopCode: pick(r, 'mã_điểm_dừng'), stopName: pick(r, 'tên_điểm_dừng'),
      lat: numberOrNull(r['vĩ_độ']), lng: numberOrNull(r['kinh_độ']), distanceFromPreviousKm: numberOrNull(r['khoảng_cách_từ_điểm_trước_km']),
      minutesFromPrevious: intOrNull(r['thời_gian_từ_điểm_trước_phút']), sourceUrl: pick(r, 'đường_dẫn_nguồn'), reliabilityLevel: pick(r, 'mức_độ_tin_cậy'),
      note: pick(r, 'ghi_chú'), googleMapsUrl: pick(r, 'liên_kết_google_maps'), accuracyNote: pick(r, 'ghi_chú_độ_chính_xác'),
    };
    byRoute.set(routeCode, [...(byRoute.get(routeCode) || []), item]);
    return item;
  });
  const routes = routesRaw.map((r, i) => {
    const routeCode = pick(r, 'mã_tuyến');
    const points = (byRoute.get(routeCode) || []).filter((x) => Number.isFinite(x.lat) && Number.isFinite(x.lng)).sort((a, b) => a.sequenceNo - b.sequenceNo);
    return {
      routeCode, displayCode: pick(r, 'số_hiệu_tuyến'), provinceCode: pick(r, 'mã_tỉnh_thành'), provinceName: pick(r, 'tên_tỉnh_thành'), name: pick(r, 'tên_tuyến'),
      operatorName: pick(r, 'đơn_vị_vận_hành'), startStopName: pick(r, 'điểm_đầu'), endStopName: pick(r, 'điểm_cuối'), description: pick(r, 'mô_tả_lộ_trình_chính'),
      distanceKm: numberOrNull(r['cự_ly_tuyến_km']), estimatedMinutes: intOrNull(r['thời_gian_chạy_ước_tính_phút']), fare: moneyText(r['giá_vé_vnd']),
      firstTripTime: pick(r, 'giờ_chuyến_đầu'), lastTripTime: pick(r, 'giờ_chuyến_cuối'), operatingTime: `${pick(r, 'giờ_chuyến_đầu') || '?'} – ${pick(r, 'giờ_chuyến_cuối') || '?'}`,
      operationDays: pick(r, 'ngày_hoạt_động'), peakIntervalMinutes: intOrNull(r['tần_suất_cao_điểm_phút']), offpeakIntervalMinutes: intOrNull(r['tần_suất_thấp_điểm_phút']),
      intervalText: `${intOrNull(r['tần_suất_cao_điểm_phút']) || '?'}–${intOrNull(r['tần_suất_thấp_điểm_phút']) || '?'} phút`, lunchStartTime: pick(r, 'giờ_bắt_đầu_nghỉ_trưa'),
      lunchEndTime: pick(r, 'giờ_kết_thúc_nghỉ_trưa'), breakMinutes: intOrNull(r['thời_gian_nghỉ_giữa_chuyến_phút']), vehicleCount: intOrNull(r['số_lượng_xe']) || 1,
      statusText: pick(r, 'trạng_thái'), sourceUrl: pick(r, 'đường_dẫn_nguồn'), sourceName: pick(r, 'tên_nguồn'), reliabilityLevel: pick(r, 'mức_độ_tin_cậy'),
      note: pick(r, 'ghi_chú'), avgSpeedKmh: numberOrNull(r['tốc_độ_trung_bình_km_h']), minSpeedKmh: numberOrNull(r['tốc_độ_thấp_ước_tính_km_h']),
      maxSpeedKmh: numberOrNull(r['tốc_độ_cao_ước_tính_km_h']), speedNote: pick(r, 'ghi_chú_tốc_độ'), checkedAt: pick(r, 'ngày_kiểm_tra'), color: colorAt(i), path: points.map((p) => [p.lat, p.lng]),
    };
  });
  const stops = stopsRaw.map((r) => ({
    externalStopCode: pick(r, 'mã_điểm_dừng'), provinceCode: pick(r, 'mã_tỉnh_thành'), provinceName: pick(r, 'tên_tỉnh_thành'), name: pick(r, 'tên_điểm_dừng'),
    stopType: pick(r, 'loại_điểm_dừng'), address: pick(r, 'địa_chỉ'), ward: pick(r, 'phường_xã'), district: pick(r, 'quận_huyện'), lat: numberOrNull(r['vĩ_độ']), lng: numberOrNull(r['kinh_độ']),
    nearbyLandmark: pick(r, 'mốc_gần_đó'), isMajor: boolInt(r['là_bến_chính']), sourceUrl: pick(r, 'đường_dẫn_nguồn'), sourceName: pick(r, 'tên_nguồn'), checkedAt: pick(r, 'ngày_kiểm_tra'),
    reliabilityLevel: pick(r, 'mức_độ_tin_cậy'), note: pick(r, 'ghi_chú'), coordinateType: pick(r, 'loại_tọa_độ'), googleMapsUrl: pick(r, 'liên_kết_google_maps'), accuracyNote: pick(r, 'ghi_chú_độ_chính_xác'),
  })).filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng));
  const provinces = provincesRaw.map((r) => ({ code: pick(r, 'mã_tỉnh_thành'), name: pick(r, 'tên_tỉnh_thành'), region: pick(r, 'vùng_miền'), country: pick(r, 'quốc_gia'), note: pick(r, 'ghi_chú') }));
  return { sourceExcel: input.sourceExcel, provinces, routes, stops, routeStops };
}
function normalizeTourism(input) {
  if (Array.isArray(input.places) && Array.isArray(input.busPlaceLinks)) return input;
  const sheets = input.rawSheets || input;
  const placesRaw = sheets['02_Địa_điểm_du_lịch'] || [];
  const linksRaw = sheets['08_Liên_kết_bus_du_lịch'] || [];
  return {
    sourceExcel: input.sourceExcel,
    categories: [
      { code: 'general', name: 'Tổng hợp', icon: '📍', sortOrder: 99 }, { code: 'beach', name: 'Biển/đảo', icon: '🏖️', sortOrder: 1 },
      { code: 'culture', name: 'Lịch sử - văn hóa', icon: '🏛️', sortOrder: 2 }, { code: 'spiritual', name: 'Tâm linh', icon: '🙏', sortOrder: 3 },
      { code: 'nature', name: 'Thiên nhiên', icon: '🌿', sortOrder: 4 }, { code: 'checkin', name: 'Check-in', icon: '📸', sortOrder: 5 },
      { code: 'shopping', name: 'Mua sắm', icon: '🛍️', sortOrder: 6 }, { code: 'entertainment', name: 'Vui chơi', icon: '🎡', sortOrder: 7 }, { code: 'food', name: 'Ẩm thực', icon: '🍜', sortOrder: 8 },
    ],
    places: placesRaw.map((r) => ({
      externalPlaceCode: pick(r, 'mã_địa_điểm'), provinceCode: pick(r, 'mã_tỉnh_thành'), provinceName: pick(r, 'tên_tỉnh_thành'), name: pick(r, 'tên_địa_điểm'), slug: makeSlug(pick(r, 'tên_địa_điểm')),
      categoryCode: categoryCode(r['loại_địa_điểm']), categoryRaw: pick(r, 'loại_địa_điểm'), shortDescription: pick(r, 'mô_tả_ngắn'), description: pick(r, 'mô_tả_chi_tiết'),
      address: pick(r, 'địa_chỉ'), district: pick(r, 'quận_huyện'), lat: numberOrNull(r['vĩ_độ']), lng: numberOrNull(r['kinh_độ']), openingHours: pick(r, 'giờ_mở_cửa'),
      ticketPriceText: pick(r, 'giá_vé_vnd'), suggestedDurationHours: pick(r, 'thời_lượng_gợi_ý_giờ'), bestTime: pick(r, 'thời_điểm_nên_đi'), weatherNote: pick(r, 'ghi_chú_thời_tiết'), idealSeason: pick(r, 'mùa_lý_tưởng'),
      nearestRouteCode: pick(r, 'tuyến_bus_gần_nhất'), nearestRouteName: pick(r, 'tên_tuyến_bus_gần_nhất'), nearestStopName: pick(r, 'tên_điểm_dừng_bus_gần_nhất'), nearestStopLat: numberOrNull(r['vĩ_độ_điểm_dừng_gần_nhất']),
      nearestStopLng: numberOrNull(r['kinh_độ_điểm_dừng_gần_nhất']), nearestDistanceKm: numberOrNull(r['khoảng_cách_đến_điểm_bus_gần_nhất_km']), walkingMinutes: intOrNull(r['thời_gian_đi_bộ_từ_điểm_bus_phút']),
      minBudget: intOrNull(r['ngân_sách_tối_thiểu_vnd']), maxBudget: intOrNull(r['ngân_sách_tối_đa_vnd']), requiredDocuments: pick(r, 'giấy_tờ_thủ_tục_cần_thiết'), foodSuggestions: pick(r, 'gợi_ý_món_ăn'),
      nearbySuggestions: pick(r, 'địa_điểm_gần_đó_nên_ghé'), imageUrl: pick(r, 'ảnh_mẫu_1'), imageUrl2: pick(r, 'ảnh_mẫu_2'), imageUrl3: pick(r, 'ảnh_mẫu_3'), imageSource: pick(r, 'nguồn_ảnh'),
      sourceUrl: pick(r, 'đường_dẫn_nguồn'), sourceName: pick(r, 'tên_nguồn'), checkedAt: pick(r, 'ngày_kiểm_tra'), reliabilityLevel: pick(r, 'mức_độ_tin_cậy'), note: pick(r, 'ghi_chú'),
      coordinateType: pick(r, 'loại_tọa_độ'), googleMapsUrl: pick(r, 'liên_kết_google_maps'), accuracyNote: pick(r, 'ghi_chú_độ_chính_xác'),
    })).filter((p) => p.name && Number.isFinite(p.lat) && Number.isFinite(p.lng)),
    busPlaceLinks: linksRaw.map((r) => ({
      externalLinkCode: pick(r, 'mã_liên_kết'), externalPlaceCode: pick(r, 'mã_địa_điểm'), placeName: pick(r, 'tên_địa_điểm'), provinceCode: pick(r, 'mã_tỉnh_thành'), routeDisplayCode: pick(r, 'tuyến_bus_gần_nhất'),
      routeName: pick(r, 'tên_tuyến_bus_gần_nhất'), externalStopCode: pick(r, 'mã_điểm_dừng_bus_gần_nhất'), stopName: pick(r, 'tên_điểm_dừng_bus_gần_nhất'),
      stopLat: numberOrNull(r['vĩ_độ_điểm_dừng_gần_nhất']), stopLng: numberOrNull(r['kinh_độ_điểm_dừng_gần_nhất']), distanceKm: numberOrNull(r['khoảng_cách_đến_điểm_bus_gần_nhất_km']), walkingMinutes: intOrNull(r['thời_gian_đi_bộ_phút']),
      distanceMethod: pick(r, 'phương_pháp_tính_khoảng_cách'), reliabilityLevel: pick(r, 'mức_tin_cậy_tính_toán'), note: pick(r, 'ghi_chú'), placeMapsUrl: pick(r, 'google_maps_địa_điểm'), stopMapsUrl: pick(r, 'google_maps_điểm_bus_gần_nhất'),
    })),
  };
}

async function logImport(sourceType, sourceFile, status, total, success, failed, message) {
  try {
    await query(`INSERT INTO import_history(source_type, source_file, status, rows_total, rows_success, rows_failed, message)
                 VALUES(@sourceType, @sourceFile, @status, @total, @success, @failed, @message)`, { sourceType, sourceFile, status, total, success, failed, message: message || null });
  } catch (err) {
    console.warn('Không ghi được import_history:', err.message);
  }
}
async function scalar(sqlText, params = {}) {
  const rs = await query(sqlText, params);
  return rs.recordset[0] || null;
}

async function importBusData(data, sourceFile) {
  const started = Date.now();
  let success = 0;
  let failed = 0;
  const total = (data.provinces?.length || 0) + (data.stops?.length || 0) + (data.routes?.length || 0) + (data.routeStops?.length || 0);
  try {
    for (const p of data.provinces || []) {
      if (!p.code || !p.name) continue;
      await query(`MERGE provinces AS t USING (SELECT @code AS code) AS s ON t.code=s.code
        WHEN MATCHED THEN UPDATE SET name=@name, region=@region, country=@country, note=@note, updated_at=SYSDATETIME()
        WHEN NOT MATCHED THEN INSERT(code, name, region, country, note) VALUES(@code, @name, @region, @country, @note);`, p);
      success += 1;
    }
    for (const s of data.stops || []) {
      if (!s.externalStopCode || !s.name || !Number.isFinite(Number(s.lat)) || !Number.isFinite(Number(s.lng))) { failed += 1; continue; }
      await query(`MERGE bus_stops AS t USING (SELECT @externalStopCode AS external_stop_code) AS src ON t.external_stop_code=src.external_stop_code
        WHEN MATCHED THEN UPDATE SET name=@name, address=@address, latitude=@lat, longitude=@lng, province_code=@provinceCode, stop_type=@stopType,
          ward=@ward, district=@district, nearby_landmark=@nearbyLandmark, is_major=@isMajor, source_url=@sourceUrl, source_name=@sourceName,
          checked_at=TRY_CONVERT(date, @checkedAt), reliability_level=@reliabilityLevel, note=@note, coordinate_type=@coordinateType,
          google_maps_url=@googleMapsUrl, accuracy_note=@accuracyNote, updated_at=SYSDATETIME()
        WHEN NOT MATCHED THEN INSERT(external_stop_code, name, address, latitude, longitude, province_code, stop_type, ward, district, nearby_landmark, is_major, source_url, source_name, checked_at, reliability_level, note, coordinate_type, google_maps_url, accuracy_note)
          VALUES(@externalStopCode, @name, @address, @lat, @lng, @provinceCode, @stopType, @ward, @district, @nearbyLandmark, @isMajor, @sourceUrl, @sourceName, TRY_CONVERT(date, @checkedAt), @reliabilityLevel, @note, @coordinateType, @googleMapsUrl, @accuracyNote);`, s);
      success += 1;
    }
    for (const r of data.routes || []) {
      if (!r.routeCode || !r.name) { failed += 1; continue; }
      await query(`MERGE bus_routes AS t USING (SELECT @routeCode AS route_code) AS src ON t.route_code=src.route_code
        WHEN MATCHED THEN UPDATE SET name=@name, description=@description, type=N'Tuyến xe buýt', fare=@fare, color=@color, operating_time=@operatingTime,
          interval_text=@intervalText, external_route_code=@routeCode, province_code=@provinceCode, route_number=@displayCode, operator_name=@operatorName,
          origin_name=@startStopName, destination_name=@endStopName, distance_km=@distanceKm, estimated_minutes=@estimatedMinutes,
          first_trip_time=@firstTripTime, last_trip_time=@lastTripTime, operation_days=@operationDays, peak_interval_minutes=@peakIntervalMinutes,
          offpeak_interval_minutes=@offpeakIntervalMinutes, lunch_start_time=@lunchStartTime, lunch_end_time=@lunchEndTime, break_minutes=@breakMinutes,
          vehicle_count=@vehicleCount, status_text=@statusText, source_url=@sourceUrl, source_name=@sourceName, reliability_level=@reliabilityLevel,
          avg_speed_kmh=@avgSpeedKmh, min_speed_kmh=@minSpeedKmh, max_speed_kmh=@maxSpeedKmh, speed_note=@speedNote, checked_at=TRY_CONVERT(date, @checkedAt), updated_at=SYSDATETIME(), is_active=1
        WHEN NOT MATCHED THEN INSERT(route_code, name, description, type, fare, color, operating_time, interval_text, is_active, external_route_code, province_code, route_number, operator_name, origin_name, destination_name, distance_km, estimated_minutes, first_trip_time, last_trip_time, operation_days, peak_interval_minutes, offpeak_interval_minutes, lunch_start_time, lunch_end_time, break_minutes, vehicle_count, status_text, source_url, source_name, reliability_level, avg_speed_kmh, min_speed_kmh, max_speed_kmh, speed_note, checked_at)
          VALUES(@routeCode, @name, @description, N'Tuyến xe buýt', @fare, @color, @operatingTime, @intervalText, 1, @routeCode, @provinceCode, @displayCode, @operatorName, @startStopName, @endStopName, @distanceKm, @estimatedMinutes, @firstTripTime, @lastTripTime, @operationDays, @peakIntervalMinutes, @offpeakIntervalMinutes, @lunchStartTime, @lunchEndTime, @breakMinutes, @vehicleCount, @statusText, @sourceUrl, @sourceName, @reliabilityLevel, @avgSpeedKmh, @minSpeedKmh, @maxSpeedKmh, @speedNote, TRY_CONVERT(date, @checkedAt));`, r);
      success += 1;
    }
    const importedRoutes = new Set((data.routes || []).map((r) => r.routeCode).filter(Boolean));
    for (const routeCode of importedRoutes) await query('DELETE FROM route_stops WHERE route_code=@routeCode', { routeCode });
    for (const rs of data.routeStops || []) {
      const stop = await scalar('SELECT TOP 1 id FROM bus_stops WHERE external_stop_code=@externalStopCode', { externalStopCode: rs.externalStopCode });
      if (!stop?.id || !rs.routeCode) { failed += 1; continue; }
      await query(`INSERT INTO route_stops(external_route_stop_code, route_code, stop_id, external_stop_code, direction, sequence_no, distance_from_previous_km, minutes_from_previous, source_url, reliability_level, note, google_maps_url, accuracy_note)
        VALUES(@externalRouteStopCode, @routeCode, @stopId, @externalStopCode, @direction, @sequenceNo, @distanceFromPreviousKm, @minutesFromPrevious, @sourceUrl, @reliabilityLevel, @note, @googleMapsUrl, @accuracyNote)`, { ...rs, stopId: stop.id });
      success += 1;
    }
    for (const r of data.routes || []) {
      const first = await scalar(`SELECT TOP 1 stop_id FROM route_stops WHERE route_code=@routeCode ORDER BY sequence_no ASC`, { routeCode: r.routeCode });
      const last = await scalar(`SELECT TOP 1 stop_id FROM route_stops WHERE route_code=@routeCode ORDER BY sequence_no DESC`, { routeCode: r.routeCode });
      await query('UPDATE bus_routes SET start_stop_id=@startStopId, end_stop_id=@endStopId WHERE route_code=@routeCode', { routeCode: r.routeCode, startStopId: first?.stop_id || null, endStopId: last?.stop_id || null });
      const vehicleCount = Math.max(1, Math.min(Number(r.vehicleCount || 1), 20));
      for (let i = 1; i <= vehicleCount; i += 1) {
        const vehicleCode = `${r.routeCode}-BUS-${String(i).padStart(2, '0')}`.slice(0, 60);
        const plate = `${r.provinceCode || 'SB'}-${String(i).padStart(3, '0')}`.slice(0, 30);
        const progress = vehicleCount === 1 ? 0.25 : (i - 1) / vehicleCount;
        const point = Array.isArray(r.path) && r.path.length ? r.path[Math.min(r.path.length - 1, Math.floor(progress * (r.path.length - 1)))] : [null, null];
        await query(`MERGE bus_vehicles AS t USING (SELECT @vehicleCode AS vehicle_code) AS src ON t.vehicle_code=src.vehicle_code
          WHEN MATCHED THEN UPDATE SET plate=@plate, route_code=@routeCode, status='active', avg_speed_kmh=@avgSpeedKmh, min_speed_kmh=@minSpeedKmh, max_speed_kmh=@maxSpeedKmh, updated_at=SYSDATETIME()
          WHEN NOT MATCHED THEN INSERT(vehicle_code, plate, route_code, status, capacity, avg_speed_kmh, min_speed_kmh, max_speed_kmh) VALUES(@vehicleCode, @plate, @routeCode, 'active', 40, @avgSpeedKmh, @minSpeedKmh, @maxSpeedKmh);`, { vehicleCode, plate, routeCode: r.routeCode, avgSpeedKmh: r.avgSpeedKmh || 24, minSpeedKmh: r.minSpeedKmh || 16, maxSpeedKmh: r.maxSpeedKmh || 45 });
        await query(`MERGE buses AS t USING (SELECT @vehicleCode AS bus_code) AS src ON t.bus_code=src.bus_code
          WHEN MATCHED THEN UPDATE SET plate=@plate, route_code=@routeCode, status='active', capacity=40, speed_kmh=@speed, progress=@progress, crowding=@crowding, latitude=@lat, longitude=@lng
          WHEN NOT MATCHED THEN INSERT(bus_code, plate, route_code, status, capacity, speed_kmh, progress, crowding, latitude, longitude)
            VALUES(@vehicleCode, @plate, @routeCode, 'active', 40, @speed, @progress, @crowding, @lat, @lng);`, { vehicleCode, plate, routeCode: r.routeCode, speed: r.avgSpeedKmh || 24, progress, crowding: i % 3 === 0 ? 'busy' : i % 2 === 0 ? 'moderate' : 'quiet', lat: point[0], lng: point[1] });
      }
    }
    await logImport('bus', sourceFile, 'success', total, success, failed, `Import bus hoàn tất trong ${Date.now() - started}ms`);
    return { total, success, failed };
  } catch (err) {
    await logImport('bus', sourceFile, 'failed', total, success, failed + 1, err.message);
    throw err;
  }
}

async function importTourismData(data, busData, sourceFile) {
  const started = Date.now();
  let success = 0;
  let failed = 0;
  const total = (data.categories?.length || 0) + (data.places?.length || 0) + (data.busPlaceLinks?.length || 0);
  try {
    for (const c of data.categories || []) {
      await query(`MERGE tourist_categories AS t USING (SELECT @code AS code) AS src ON t.code=src.code
        WHEN MATCHED THEN UPDATE SET name=@name, icon=@icon, sort_order=@sortOrder, is_active=1
        WHEN NOT MATCHED THEN INSERT(code, name, icon, sort_order, is_active) VALUES(@code, @name, @icon, @sortOrder, 1);`, { code: c.code, name: c.name, icon: c.icon || null, sortOrder: c.sortOrder || c.sort_order || 100 });
      success += 1;
    }
    for (const p of data.places || []) {
      const category = await scalar('SELECT TOP 1 id FROM tourist_categories WHERE code=@code', { code: p.categoryCode || 'general' });
      const stop = p.nearestStopName ? await scalar(`SELECT TOP 1 id FROM bus_stops WHERE name=@name OR (province_code=@provinceCode AND ABS(latitude-@lat)<0.0005 AND ABS(longitude-@lng)<0.0005) ORDER BY CASE WHEN name=@name THEN 0 ELSE 1 END`, { name: p.nearestStopName, provinceCode: p.provinceCode, lat: p.nearestStopLat || p.lat, lng: p.nearestStopLng || p.lng }) : null;
      if (!p.externalPlaceCode || !p.name) { failed += 1; continue; }
      await query(`MERGE tourist_places AS t USING (SELECT @externalPlaceCode AS external_place_code) AS src ON t.external_place_code=src.external_place_code
        WHEN MATCHED THEN UPDATE SET name=@name, slug=@slug, description=@description, category_id=@categoryId, address=@address, latitude=@lat, longitude=@lng,
          nearest_stop_id=@nearestStopId, opening_hours=@openingHours, suggested_duration_minutes=@duration, min_budget=@minBudget, max_budget=@maxBudget,
          image_url=@imageUrl, image_url_2=@imageUrl2, image_url_3=@imageUrl3, province_code=@provinceCode, short_description=@shortDescription,
          district=@district, ticket_price_text=@ticketPriceText, best_time=@bestTime, weather_note=@weatherNote, ideal_season=@idealSeason,
          required_documents=@requiredDocuments, food_suggestions=@foodSuggestions, nearby_suggestions=@nearbySuggestions, source_url=@sourceUrl,
          source_name=@sourceName, checked_at=TRY_CONVERT(date, @checkedAt), reliability_level=@reliabilityLevel, coordinate_type=@coordinateType,
          google_maps_url=@googleMapsUrl, accuracy_note=@accuracyNote, updated_at=SYSDATETIME(), is_active=1
        WHEN NOT MATCHED THEN INSERT(name, slug, description, category_id, address, latitude, longitude, nearest_stop_id, opening_hours, suggested_duration_minutes, min_budget, max_budget, image_url, image_url_2, image_url_3, is_active, external_place_code, province_code, short_description, district, ticket_price_text, best_time, weather_note, ideal_season, required_documents, food_suggestions, nearby_suggestions, source_url, source_name, checked_at, reliability_level, coordinate_type, google_maps_url, accuracy_note)
          VALUES(@name, @slug, @description, @categoryId, @address, @lat, @lng, @nearestStopId, @openingHours, @duration, @minBudget, @maxBudget, @imageUrl, @imageUrl2, @imageUrl3, 1, @externalPlaceCode, @provinceCode, @shortDescription, @district, @ticketPriceText, @bestTime, @weatherNote, @idealSeason, @requiredDocuments, @foodSuggestions, @nearbySuggestions, @sourceUrl, @sourceName, TRY_CONVERT(date, @checkedAt), @reliabilityLevel, @coordinateType, @googleMapsUrl, @accuracyNote);`, {
        ...p,
        slug: p.slug || makeSlug(p.name),
        categoryId: category?.id || null,
        nearestStopId: stop?.id || null,
        duration: Math.max(30, Math.round(Number(p.suggestedDurationHours || '1').toString().split('-')[0] * 60) || 90),
        imageUrl: p.imageUrl || null,
      });
      success += 1;
    }
    for (const link of data.busPlaceLinks || []) {
      const place = await scalar('SELECT TOP 1 id FROM tourist_places WHERE external_place_code=@externalPlaceCode', { externalPlaceCode: link.externalPlaceCode });
      const stop = link.externalStopCode ? await scalar('SELECT TOP 1 id FROM bus_stops WHERE external_stop_code=@externalStopCode', { externalStopCode: link.externalStopCode }) : null;
      const route = await resolveRouteCode(link, busData);
      if (!place?.id || !stop?.id || !route) { failed += 1; continue; }
      await query('DELETE FROM place_nearby_stops WHERE external_link_code=@externalLinkCode OR (place_id=@placeId AND stop_id=@stopId AND route_code=@routeCode)', { externalLinkCode: link.externalLinkCode, placeId: place.id, stopId: stop.id, routeCode: route });
      await query(`INSERT INTO place_nearby_stops(place_id, stop_id, route_code, distance_meters, walking_minutes, note, external_link_code, external_place_code, route_display_code, distance_method, reliability_level, place_maps_url, stop_maps_url)
        VALUES(@placeId, @stopId, @routeCode, @distanceMeters, @walkingMinutes, @note, @externalLinkCode, @externalPlaceCode, @routeDisplayCode, @distanceMethod, @reliabilityLevel, @placeMapsUrl, @stopMapsUrl)`, {
        placeId: place.id, stopId: stop.id, routeCode: route, distanceMeters: Math.round(Number(link.distanceKm || 0) * 1000), walkingMinutes: link.walkingMinutes || 0,
        note: link.note || null, externalLinkCode: link.externalLinkCode, externalPlaceCode: link.externalPlaceCode, routeDisplayCode: link.routeDisplayCode,
        distanceMethod: link.distanceMethod, reliabilityLevel: link.reliabilityLevel, placeMapsUrl: link.placeMapsUrl, stopMapsUrl: link.stopMapsUrl,
      });
      success += 1;
    }
    await logImport('tourism', sourceFile, 'success', total, success, failed, `Import du lịch hoàn tất trong ${Date.now() - started}ms`);
    return { total, success, failed };
  } catch (err) {
    await logImport('tourism', sourceFile, 'failed', total, success, failed + 1, err.message);
    throw err;
  }
}
async function resolveRouteCode(link, busData) {
  const fromData = (busData?.routes || []).find((r) => String(r.displayCode) === String(link.routeDisplayCode) && String(r.provinceCode) === String(link.provinceCode));
  if (fromData?.routeCode) return fromData.routeCode;
  const db = await scalar('SELECT TOP 1 route_code FROM bus_routes WHERE province_code=@provinceCode AND route_number=@routeDisplayCode', { provinceCode: link.provinceCode, routeDisplayCode: link.routeDisplayCode });
  return db?.route_code || link.routeDisplayCode || null;
}

async function main() {
  const args = process.argv.slice(2);
  const getArg = (name, fallback) => {
    const idx = args.indexOf(name);
    return idx >= 0 && args[idx + 1] ? path.resolve(args[idx + 1]) : fallback;
  };
  const busFile = getArg('--bus', DEFAULT_BUS_FILE);
  const tourismFile = getArg('--tourism', DEFAULT_TOURISM_FILE);

  console.log('SmartBus importer bắt đầu...');
  console.log('Bus file:', busFile);
  console.log('Tourism file:', tourismFile);

  const busData = fs.existsSync(busFile) ? normalizeBus(loadFile(busFile)) : null;
  const tourismData = fs.existsSync(tourismFile) ? normalizeTourism(loadFile(tourismFile)) : null;
  const result = {};
  if (busData) result.bus = await importBusData(busData, path.basename(busFile));
  if (tourismData) result.tourism = await importTourismData(tourismData, busData, path.basename(tourismFile));
  console.log('Import hoàn tất:', JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error('Import thất bại:', err.message);
  process.exitCode = 1;
}).finally(async () => { await closePool(); });
