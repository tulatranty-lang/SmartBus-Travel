/* ==========================================================
   SMARTBUS – Hệ thống xe buýt và du lịch 5 khu vực
   Fullstack GIS Edition – v5 Modular SQL Server
   Architecture: Event-driven state machine + OSRM routing
   ========================================================== */
"use strict";

function debounce(fn, delay = 300) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/* ----------------------------------------------------------
   0. CONSTANTS & CONFIG
---------------------------------------------------------- */
const CONFIG = {
  DEFAULT_PROVINCE: 'DN',
  MAP_CENTER: [16.0544, 108.2022],
  MAP_ZOOM: 11,
  BUS_LIMIT_PER_PROVINCE: 20,
  PROVINCES: [
    { code: 'DN', name: 'Đà Nẵng', center: [16.0544, 108.2022], zoom: 11 },
    { code: 'QN_CU', name: 'Quảng Nam cũ / Hội An', center: [15.8801, 108.3380], zoom: 10 },
    { code: 'HUE', name: 'Huế', center: [16.4637, 107.5909], zoom: 10 },
    { code: 'QT', name: 'Quảng Trị', center: [16.7505, 107.1893], zoom: 9 },
    { code: 'QNG', name: 'Quảng Ngãi', center: [15.1214, 108.8044], zoom: 9 },
  ],
  TICK_MS: 2500, // Cập nhật vị trí xe mỗi 2.5s
  SCHEDULE: {
    start: { h: 6, m: 30 },
    end: { h: 18, m: 0 },
    lunch: { start: { h: 12, m: 0 }, end: { h: 13, m: 0 } },
    terminalBreakMin: 15,
  },
  SPEEDS: { min: 18, max: 52 }, // km/h mô phỏng
};

const AUTH_KEYS = {
  accessToken: "smartbus_access_token",
  refreshToken: "smartbus_refresh_token",
  user: "smartbus_user",
  legacySession: "danabus_session",
};

const TokenStore = {
  _safeStores() {
    return [window.localStorage, window.sessionStorage].filter(Boolean);
  },

  _storageWith(key) {
    return this._safeStores().find((store) => {
      try { return Boolean(store.getItem(key)); } catch { return false; }
    }) || null;
  },

  _get(key) {
    const store = this._storageWith(key);
    try { return store ? store.getItem(key) : null; } catch { return null; }
  },

  getAccessToken() { return this._get(AUTH_KEYS.accessToken); },
  getRefreshToken() { return this._get(AUTH_KEYS.refreshToken); },

  getUser() {
    const raw = this._get(AUTH_KEYS.user);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  },

  save(authData, remember = true) {
    const data = authData || {};
    const user = data.user || data;
    const accessToken = data.accessToken || data.token || "";
    const refreshToken = data.refreshToken || "";
    const target = remember ? window.localStorage : window.sessionStorage;
    const other = remember ? window.sessionStorage : window.localStorage;

    [target, other].forEach((store) => {
      try {
        store.removeItem(AUTH_KEYS.accessToken);
        store.removeItem(AUTH_KEYS.refreshToken);
        store.removeItem(AUTH_KEYS.user);
        store.removeItem(AUTH_KEYS.legacySession);
      } catch {}
    });

    try {
      if (accessToken) target.setItem(AUTH_KEYS.accessToken, accessToken);
      if (refreshToken) target.setItem(AUTH_KEYS.refreshToken, refreshToken);
      if (user) target.setItem(AUTH_KEYS.user, JSON.stringify(user));
    } catch {}
  },

  updateTokens(authData) {
    const data = authData || {};
    const store = this._storageWith(AUTH_KEYS.refreshToken) || this._storageWith(AUTH_KEYS.user) || window.localStorage;
    const accessToken = data.accessToken || data.token || "";
    const refreshToken = data.refreshToken || "";
    const user = data.user || null;
    try {
      if (accessToken) store.setItem(AUTH_KEYS.accessToken, accessToken);
      if (refreshToken) store.setItem(AUTH_KEYS.refreshToken, refreshToken);
      if (user) store.setItem(AUTH_KEYS.user, JSON.stringify(user));
    } catch {}
  },

  clear() {
    this._safeStores().forEach((store) => {
      try {
        store.removeItem(AUTH_KEYS.accessToken);
        store.removeItem(AUTH_KEYS.refreshToken);
        store.removeItem(AUTH_KEYS.user);
        store.removeItem(AUTH_KEYS.legacySession);
      } catch {}
    });
  },
};

const API = {
  BASE: window.SMARTBUS_API_BASE || "https://smartbus-backend-xr34.onrender.com/api/v1",

  async request(path, options = {}) {
    const { skipAuth = false, skipRefresh = false, ...fetchOptions } = options;
    const headers = new Headers(fetchOptions.headers || {});

    if (fetchOptions.body && !(fetchOptions.body instanceof FormData) && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const accessToken = TokenStore.getAccessToken();
    if (!skipAuth && accessToken && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }

    let res;
    try {
      res = await fetch(`${this.BASE}${path}`, { ...fetchOptions, headers });
    } catch (_err) {
      const err = new Error("Không kết nối được backend. Kiểm tra backend Render/Azure SQL đã sẵn sàng chưa.");
      err.code = "NETWORK";
      throw err;
    }

    const payload = await res.json().catch(() => ({}));

    if (res.status === 401 && !skipRefresh && !path.includes("/auth/login") && !path.includes("/auth/refresh-token")) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) return this.request(path, { ...fetchOptions, skipAuth, skipRefresh: true });
      if (typeof Auth !== "undefined" && Auth.forceLogout) {
        Auth.forceLogout("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", "warning");
      } else {
        TokenStore.clear();
      }
    }

    if (!res.ok) {
      const err = new Error(payload.message || `HTTP ${res.status}`);
      err.status = res.status;
      err.errors = payload.errors || [];
      err.payload = payload;
      throw err;
    }

    return payload.data ?? payload;
  },

  async refreshAccessToken() {
    const refreshToken = TokenStore.getRefreshToken();
    if (!refreshToken) return false;

    try {
      const res = await fetch(`${this.BASE}/auth/refresh-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || payload.success === false) return false;
      TokenStore.updateTokens(payload.data ?? payload);
      return true;
    } catch (_err) {
      return false;
    }
  },

  get(path, options = {}) { return this.request(path, options); },
  post(path, body, options = {}) { return this.request(path, { ...options, method: "POST", body: JSON.stringify(body || {}) }); },
};

/* ----------------------------------------------------------
   1. STATE – single source of truth cho toàn bộ app
---------------------------------------------------------- */
const State = {
  user: null,
  systemStatus: "offline", // "offline" | "lunch" | "active"
  buses: [],
  stops: [],
  reports: [],
  activityLog: [],
  filterCrowding: "all",
  searchQuery: "",
  selectedBusId: null,
  mapReady: false,
  dataSource: "sql",
  userLocation: null,
  mapFilters: {
    buses: "all", // all | none | active | route | nearby | province
    routes: "all", // all | selected | none | province
    routeId: "",
    province: CONFIG.DEFAULT_PROVINCE,
    stops: true,
    labels: false,
    routeDisplayMode: "all",
    showStopLabels: false,
  },
  routeGeometries: {}, // cache OSRM geometry theo route.id
  geometryStatus: {}, // pending | ok | fallback cho từng tuyến
  busBreaks: {}, // { uid: Date } – thời điểm xe được chạy lại
  tickCount: 0,
};

/* ----------------------------------------------------------
   2. EVENT BUS – giao tiếp giữa các module
---------------------------------------------------------- */
const Events = (() => {
  const listeners = {};
  return {
    on(evt, fn) {
      (listeners[evt] = listeners[evt] || []).push(fn);
    },
    off(evt, fn) {
      listeners[evt] = (listeners[evt] || []).filter((f) => f !== fn);
    },
    emit(evt, d) {
      (listeners[evt] || []).forEach((fn) => fn(d));
    },
  };
})();

/* ----------------------------------------------------------
   3. SCHEDULE ENGINE
---------------------------------------------------------- */
const Schedule = {
  toMin: (h, m) => h * 60 + m,
  now: () => {
    const d = new Date();
    return Schedule.toMin(d.getHours(), d.getMinutes());
  },

  getStatus() {
    const cur = this.now();
    const s = this.toMin(CONFIG.SCHEDULE.start.h, CONFIG.SCHEDULE.start.m);
    const e = this.toMin(CONFIG.SCHEDULE.end.h, CONFIG.SCHEDULE.end.m);
    const ls = this.toMin(
      CONFIG.SCHEDULE.lunch.start.h,
      CONFIG.SCHEDULE.lunch.start.m,
    );
    const le = this.toMin(
      CONFIG.SCHEDULE.lunch.end.h,
      CONFIG.SCHEDULE.lunch.end.m,
    );
    if (cur < s || cur >= e) return "offline";
    if (cur >= ls && cur < le) return "lunch";
    return "active";
  },

  getNextEventTime() {
    const cur = this.now();
    const s = this.toMin(CONFIG.SCHEDULE.start.h, CONFIG.SCHEDULE.start.m);
    const e = this.toMin(CONFIG.SCHEDULE.end.h, CONFIG.SCHEDULE.end.m);
    const ls = this.toMin(
      CONFIG.SCHEDULE.lunch.start.h,
      CONFIG.SCHEDULE.lunch.start.m,
    );
    const le = this.toMin(
      CONFIG.SCHEDULE.lunch.end.h,
      CONFIG.SCHEDULE.lunch.end.m,
    );
    if (cur < s) return { label: "Hoạt động lúc", time: "06:30" };
    if (cur >= ls && cur < le) return { label: "Tiếp tục lúc", time: "13:00" };
    if (cur >= e) return { label: "Hoạt động lúc", time: "06:30 ngày mai" };
    return { label: "Nghỉ trưa lúc", time: "12:00" };
  },

  formatTime() {
    return new Date().toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  },

  formatDateTime() {
    return new Date().toLocaleString("vi-VN", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  },
};

/* ----------------------------------------------------------
   4. DATA STATE – nạp từ Backend API / SQL Server
---------------------------------------------------------- */
let ROUTES = [];


const LOCAL_STOPS = [];


const LOCAL_TOURISM_PLACES = [];


/* ----------------------------------------------------------
   5. CROWDING CONFIG
---------------------------------------------------------- */
const CROWDING = {
  quiet: {
    label: "Vắng",
    min: 5,
    max: 25,
    badgeClass: "badge-quiet",
    iconClass: "bc-quiet",
    color: "var(--green)",
  },
  moderate: {
    label: "Vừa",
    min: 26,
    max: 48,
    badgeClass: "badge-moderate",
    iconClass: "bc-moderate",
    color: "var(--orange)",
  },
  busy: {
    label: "Đông",
    min: 49,
    max: 75,
    badgeClass: "badge-busy",
    iconClass: "bc-busy",
    color: "var(--red)",
  },
};

/* ----------------------------------------------------------
   6. UTILS
---------------------------------------------------------- */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const routeById = (id) => {
  const value = String(id || "");
  return ROUTES.find((r) => [r.id, r.routeCode, r.displayCode].some((x) => String(x || "") === value));
};
const routeLabel = (routeOrId) => {
  const r = typeof routeOrId === "object" ? routeOrId : routeById(routeOrId);
  if (!r) return String(routeOrId || "?");
  return r.displayCode && r.displayCode !== r.id ? `${r.displayCode}` : `${r.id}`;
};

const provinceMeta = (code) => CONFIG.PROVINCES.find((p) => p.code === code) || CONFIG.PROVINCES[0];
const provinceOptionsHtml = (includeAll = false) => `${includeAll ? '<option value="">Tất cả tỉnh/thành</option>' : ''}${CONFIG.PROVINCES.map((p) => `<option value="${p.code}">${p.name}</option>`).join('')}`;
const mapDataQuery = () => {
  const province = State.mapFilters.province || CONFIG.DEFAULT_PROVINCE;
  return `province=${encodeURIComponent(province)}&provinceCode=${encodeURIComponent(province)}&limitPerProvince=${CONFIG.BUS_LIMIT_PER_PROVINCE}`;
};



/* ----------------------------------------------------------
   6a. GIS COORDINATE SAFETY – one source for Leaflet lat/lng
---------------------------------------------------------- */
const CENTRAL_VIETNAM_BOUNDS = {
  // Bao phủ đủ Quảng Trị, Huế, Đà Nẵng, Quảng Nam cũ/Hội An và Quảng Ngãi.
  // Chỉ mở rộng vùng lọc, không đổi cách vẽ marker/tuyến để giữ giống bản desktop.
  minLat: 14.55,
  maxLat: 17.35,
  minLng: 106.70,
  maxLng: 109.35,
};

function toSmartBusNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const normalized = String(value).trim().replace(",", ".");
  if (!normalized) return null;
  const num = Number.parseFloat(normalized);
  return Number.isFinite(num) ? num : null;
}

function isLatLngInValidRange(latLng) {
  if (!Array.isArray(latLng) || latLng.length < 2) return false;
  const lat = toSmartBusNumber(latLng[0]);
  const lng = toSmartBusNumber(latLng[1]);
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function isCoordinateInCentralVietnam(latLng) {
  if (!isLatLngInValidRange(latLng)) return false;
  const [lat, lng] = latLng.map(Number);
  return lat >= CENTRAL_VIETNAM_BOUNDS.minLat &&
    lat <= CENTRAL_VIETNAM_BOUNDS.maxLat &&
    lng >= CENTRAL_VIETNAM_BOUNDS.minLng &&
    lng <= CENTRAL_VIETNAM_BOUNDS.maxLng;
}

function normalizeLatLng(item, options = {}) {
  const { allowOutsideCentral = false, source = "unknown" } = options;
  if (!item && item !== 0) return null;

  let lat = null;
  let lng = null;

  if (Array.isArray(item)) {
    if (item.length < 2) return null;
    const a = toSmartBusNumber(item[0]);
    const b = toSmartBusNumber(item[1]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    // Leaflet uses [lat,lng]. If an array clearly looks like GeoJSON [lng,lat], swap it.
    if ((Math.abs(a) > 90 && Math.abs(b) <= 90) || (a >= 100 && a <= 115 && b >= 5 && b <= 25)) {
      lat = b;
      lng = a;
    } else {
      lat = a;
      lng = b;
    }
  } else if (typeof item === "object") {
    lat = toSmartBusNumber(item.lat) ??
      toSmartBusNumber(item.latitude) ??
      toSmartBusNumber(item.Latitude) ??
      toSmartBusNumber(item.stop_lat) ??
      toSmartBusNumber(item.stopLat) ??
      toSmartBusNumber(item.y);

    lng = toSmartBusNumber(item.lng) ??
      toSmartBusNumber(item.lon) ??
      toSmartBusNumber(item.longitude) ??
      toSmartBusNumber(item.Longitude) ??
      toSmartBusNumber(item.stop_lng) ??
      toSmartBusNumber(item.stop_lon) ??
      toSmartBusNumber(item.stopLng) ??
      toSmartBusNumber(item.stopLon) ??
      toSmartBusNumber(item.x);

    if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && Array.isArray(item.coordinates) && item.coordinates.length >= 2) {
      // GeoJSON/database geography convention is [lng,lat]. Convert before giving to Leaflet.
      lng = toSmartBusNumber(item.coordinates[0]);
      lat = toSmartBusNumber(item.coordinates[1]);
    }
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const point = [lat, lng];
  if (!isLatLngInValidRange(point)) {
    console.warn("SmartBus ignored invalid coordinate range", source, item, point);
    return null;
  }
  if (!allowOutsideCentral && !isCoordinateInCentralVietnam(point)) {
    console.warn("SmartBus ignored coordinate outside Central Vietnam", source, item, point);
    return null;
  }
  return point;
}

function normalizePathPoints(points, options = {}) {
  // Accept Leaflet [lat,lng] arrays, GeoJSON LineString/MultiLineString/Feature,
  // and SQL/API objects that expose geometry/coordinates. This prevents mobile map
  // from losing route polylines when the backend returns GeoJSON instead of path[].
  if (!points) return [];

  if (points.type === "Feature") return normalizePathPoints(points.geometry, options);
  if (points.geometry) return normalizePathPoints(points.geometry, options);

  if (points.type === "LineString" && Array.isArray(points.coordinates)) {
    return normalizePathPoints(points.coordinates, options);
  }
  if (points.type === "MultiLineString" && Array.isArray(points.coordinates)) {
    return points.coordinates.flatMap((line) => normalizePathPoints(line, options));
  }
  if (Array.isArray(points.coordinates)) return normalizePathPoints(points.coordinates, options);

  if (!Array.isArray(points)) return [];
  if (Array.isArray(points[0]) && Array.isArray(points[0][0])) {
    return points.flatMap((line) => normalizePathPoints(line, options));
  }
  return points.map((p) => normalizeLatLng(p, options)).filter(Boolean);
}

function routeKeyCandidates(route) {
  return [
    route?.id,
    route?.routeId,
    route?.route_id,
    route?.routeCode,
    route?.route_code,
    route?.displayCode,
    route?.routeDisplayCode,
  ].map((v) => String(v || "").trim()).filter(Boolean);
}

function stopRouteKeyCandidates(stop) {
  return [
    stop?.routeId,
    stop?.route_id,
    stop?.routeCode,
    stop?.route_code,
    stop?.displayCode,
    stop?.routeDisplayCode,
  ].map((v) => String(v || "").trim()).filter(Boolean);
}

function stopSortValue(stop, index = 0) {
  const value = toSmartBusNumber(stop?.sequence) ??
    toSmartBusNumber(stop?.stopOrder) ??
    toSmartBusNumber(stop?.stop_order) ??
    toSmartBusNumber(stop?.order) ??
    toSmartBusNumber(stop?.sortOrder) ??
    toSmartBusNumber(stop?.id) ??
    index;
  return Number.isFinite(value) ? value : index;
}

function distanceFromPathMeters(point, path) {
  if (!point || !Array.isArray(path) || !path.length) return Number.POSITIVE_INFINITY;
  return path.reduce((min, p) => {
    if (!isLatLngInValidRange(p)) return min;
    return Math.min(min, getDistanceMeters(point, p));
  }, Number.POSITIVE_INFINITY);
}

function getDistanceMeters(a, b) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function getPositionOnPath(path, progress) {
  const cleanPath = normalizePathPoints(path || [], { source: "route-position" });
  if (!cleanPath.length) return [16.0544, 108.2022];
  if (cleanPath.length < 2) return cleanPath[0];

  const segments = [];
  let totalDistance = 0;
  for (let i = 0; i < cleanPath.length - 1; i++) {
    const distance = getDistanceMeters(cleanPath[i], cleanPath[i + 1]);
    segments.push(distance);
    totalDistance += distance;
  }

  if (!totalDistance) return cleanPath[0];
  let target = clamp(progress, 0, 1) * totalDistance;
  for (let i = 0; i < segments.length; i++) {
    if (target <= segments[i]) {
      const ratio = segments[i] ? target / segments[i] : 0;
      return lerp(cleanPath[i], cleanPath[i + 1], ratio);
    }
    target -= segments[i];
  }
  return cleanPath[cleanPath.length - 1];
}

/* ----------------------------------------------------------
   7. OSRM ROUTING – bẻ tuyến theo đường thực tế
---------------------------------------------------------- */
const OSRM_CACHE_PREFIX = "smartbus_osrm_v41_";
const geometryLoading = new Set();
let geometryQueueRunning = false;

function pathSignature(route) {
  return normalizePathPoints(route?.path || [], { source: `signature:${route?.id || "?"}` })
    .map((p) => `${Number(p[0]).toFixed(5)},${Number(p[1]).toFixed(5)}`)
    .join("|");
}

function geometryCacheKey(route) {
  let hash = 0;
  const text = `${route.id}:${pathSignature(route)}`;
  for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  return `${OSRM_CACHE_PREFIX}${route.id}_${Math.abs(hash)}`;
}

function readCachedGeometry(route) {
  try {
    const raw = localStorage.getItem(geometryCacheKey(route));
    if (!raw) return null;
    const pts = JSON.parse(raw);
    const clean = normalizePathPoints(pts, { source: `cached-geometry:${route?.id || "?"}` });
    if (!Array.isArray(clean) || clean.length < 2) return null;
    return clean;
  } catch {
    return null;
  }
}

function saveCachedGeometry(route, pts) {
  try {
    const clean = normalizePathPoints(pts || [], { source: `save-geometry:${route?.id || "?"}` });
    if (Array.isArray(clean) && clean.length >= 2) localStorage.setItem(geometryCacheKey(route), JSON.stringify(clean));
  } catch {}
}

async function fetchSegment(from, to) {
  const start = [Number(from[0]), Number(from[1])];
  const end = [Number(to[0]), Number(to[1])];
  if (!Number.isFinite(start[0]) || !Number.isFinite(start[1]) || !Number.isFinite(end[0]) || !Number.isFinite(end[1])) return [from, to];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6500);
  const url = `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson&continue_straight=false`;
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`OSRM ${res.status}`);
    const data = await res.json();
    const coords = data?.routes?.[0]?.geometry?.coordinates;
    if (!coords?.length) throw new Error("OSRM empty geometry");
    const mapped = coords.map(([lng, lat]) => [lat, lng]).filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
    return mapped.length >= 2 ? mapped : [from, to];
  } catch (_err) {
    return [from, to];
  } finally {
    clearTimeout(timer);
  }
}

async function buildRouteGeometry(route) {
  const basePath = normalizePathPoints(route?.path || [], { source: `route-path:${route?.id || "?"}` });
  if (basePath.length < 2) return basePath;
  const cached = readCachedGeometry(route);
  if (cached?.length >= 2) return cached;

  const segments = [];
  for (let i = 0; i < basePath.length - 1; i += 1) {
    const seg = await fetchSegment(basePath[i], basePath[i + 1]);
    const cleanSeg = normalizePathPoints(seg, { source: `osrm-segment:${route?.id || "?"}` });
    segments.push(...(i === 0 ? cleanSeg : cleanSeg.slice(1)));
  }
  const geometry = segments.length >= 2 ? segments : basePath;
  saveCachedGeometry(route, geometry);
  return geometry;
}

async function loadAllGeometries(onRouteReady = null) {
  if (geometryQueueRunning) return;
  geometryQueueRunning = true;
  const queue = ROUTES.filter((r) => r?.id && r.path?.length >= 2 && !State.routeGeometries[r.id] && !geometryLoading.has(r.id));
  const workers = Array.from({ length: Math.min(3, queue.length || 0) }, async () => {
    while (queue.length) {
      const route = queue.shift();
      if (!route || geometryLoading.has(route.id) || State.routeGeometries[route.id]) continue;
      geometryLoading.add(route.id);
      State.geometryStatus[route.id] = "pending";
      try {
        const pts = await buildRouteGeometry(route);
        State.routeGeometries[route.id] = pts;
        State.geometryStatus[route.id] = pts?.length > route.path.length ? "ok" : "fallback";
        if (typeof onRouteReady === "function") onRouteReady(route);
      } catch (_err) {
        State.geometryStatus[route.id] = "fallback";
      } finally {
        geometryLoading.delete(route.id);
      }
    }
  });
  await Promise.all(workers);
  geometryQueueRunning = false;
}

function startRoadGeometryLoader() {
  loadAllGeometries(() => {
    MapModule.redrawRoutes?.(false);
    MapModule.updateMarkers?.(State.buses);
  });
}

function getPath(routeId) {
  const r = routeById(routeId);
  return State.routeGeometries[r?.id || routeId] || r?.path || [];
}

function sameRouteKey(a, b) {
  const aa = String(a || "").trim().toUpperCase();
  const bb = String(b || "").trim().toUpperCase();
  return Boolean(aa && bb && aa === bb);
}

function routeMatchesStop(route, stop) {
  const routeKeys = routeKeyCandidates(route).map((v) => String(v).trim().toUpperCase()).filter(Boolean);
  const stopKeys = stopRouteKeyCandidates(stop).map((v) => String(v).trim().toUpperCase()).filter(Boolean);
  if (routeKeys.some((rk) => stopKeys.includes(rk))) return true;
  const nestedRoutes = Array.isArray(stop?.routes) ? stop.routes : [];
  return nestedRoutes.some((item) => routeKeys.some((rk) =>
    sameRouteKey(rk, item?.id) || sameRouteKey(rk, item?.routeCode) || sameRouteKey(rk, item?.displayCode) || sameRouteKey(rk, item?.routeDisplayCode)
  ));
}

function buildRoutePathFromStops(route) {
  const matched = (State.stops || [])
    .map((stop, index) => ({ stop, index }))
    .filter(({ stop }) => routeMatchesStop(route, stop))
    .sort((a, b) => stopSortValue(a.stop, a.index) - stopSortValue(b.stop, b.index));
  const points = matched
    .map(({ stop }) => normalizeLatLng(stop, { source: `draw-route-stop-fallback:${route?.id || route?.routeCode || "?"}` }))
    .filter(Boolean);
  const unique = [];
  const seen = new Set();
  points.forEach((pt) => {
    const key = `${Number(pt[0]).toFixed(6)},${Number(pt[1]).toFixed(6)}`;
    if (!seen.has(key)) { seen.add(key); unique.push(pt); }
  });
  return unique;
}

function getRenderableRoutePath(route) {
  if (!route) return [];
  const routeId = route.id || route.routeId || route.routeCode || route.displayCode;
  let pts = normalizePathPoints(State.routeGeometries[route.id] || State.routeGeometries[routeId] || route.path || [], { source: `render-route-primary:${routeId}` });
  if (pts.length < 2) pts = normalizePathPoints(getPath(routeId), { source: `render-route-getPath:${routeId}` });
  if (pts.length < 2) pts = buildRoutePathFromStops(route);
  return pts;
}

const DynamicData = {
  async load(provinceCode = State.mapFilters.province || CONFIG.DEFAULT_PROVINCE) {
    const province = provinceCode || CONFIG.DEFAULT_PROVINCE;
    State.mapFilters.province = province;
    document.body.classList.add('map-loading');
    try {
      const qs = mapDataQuery();
      const [routesRaw, stopsRaw, busesRaw, mapRoutesRaw] = await Promise.all([
        API.get(`/bus/routes?${qs}`, { skipAuth: true }),
        API.get(`/bus/stops?${qs}`, { skipAuth: true }),
        API.get(`/bus/vehicle-locations?${qs}`, { skipAuth: true }),
        API.get(`/map/routes?${qs}`, { skipAuth: true }).catch(() => null),
      ]);

      const geoJsonPathByKey = new Map();
      const geoFeatures = Array.isArray(mapRoutesRaw?.features) ? mapRoutesRaw.features : [];
      geoFeatures.forEach((feature) => {
        const props = feature.properties || {};
        const pts = normalizePathPoints(feature, { source: `map-route-geojson:${props.id || props.routeCode || "?"}` });
        if (pts.length < 2) return;
        [props.id, props.routeCode, props.displayCode, props.routeDisplayCode].forEach((key) => {
          const k = String(key || "").trim();
          if (k) geoJsonPathByKey.set(k, pts);
        });
      });

      const stops = Array.isArray(stopsRaw) ? stopsRaw : [];
      const stopGroups = stops.reduce((acc, stop) => {
        stopRouteKeyCandidates(stop).forEach((key) => {
          (acc[key] = acc[key] || []).push(stop);
        });
        return acc;
      }, {});

      const routes = (Array.isArray(routesRaw) ? routesRaw : []).map((r) => {
        const routeKeys = routeKeyCandidates(r);
        const grouped = routeKeys.flatMap((key) => stopGroups[key] || []);
        const uniqueGrouped = Array.from(new Map(grouped.map((stop, idx) => [String(stop.id || stop.externalStopCode || `${routeKeys[0] || 'route'}-${idx}`), stop])).values());

        let points = normalizePathPoints(r.path || r.geometry || r.coordinates || [], { source: `route-api:${r.id || r.routeCode || '?'}` });
        if (points.length < 2) {
          for (const key of routeKeys) {
            const geoPts = geoJsonPathByKey.get(key);
            if (geoPts?.length >= 2) { points = geoPts; break; }
          }
        }
        if (points.length < 2) {
          points = uniqueGrouped
            .map((s, index) => ({ stop: s, index }))
            .sort((a, b) => stopSortValue(a.stop, a.index) - stopSortValue(b.stop, b.index))
            .map(({ stop }) => normalizeLatLng(stop, { source: `stop-for-route:${r.id || r.routeCode || '?'}` }))
            .filter(Boolean);
        }

        const id = String(r.id || r.routeId || r.routeCode || r.displayCode || r.routeDisplayCode || "").trim();
        return {
          ...r,
          id,
          routeCode: String(r.routeCode || r.route_code || r.id || r.displayCode || id),
          displayCode: r.displayCode || r.routeDisplayCode || r.routeCode || r.id,
          provinceCode: r.provinceCode || r.province_code || province,
          path: points,
          color: r.color || "#2563eb",
          time: r.time || r.operatingTime || "Đang cập nhật",
          interval: r.interval || r.intervalText || "Đang cập nhật",
        };
      }).filter((r) => r.id && r.path?.length >= 2);

      ROUTES.splice(0, ROUTES.length, ...routes);
      State.routeGeometries = {};
      State.geometryStatus = {};

      const validRouteIds = new Set(ROUTES.flatMap((r) => routeKeyCandidates(r)));
      const sqlStops = stops.map((s, idx) => {
        const ll = normalizeLatLng(s, { source: `bus-stop:${s.id || idx}` });
        if (!ll) return null;
        const routeKeys = stopRouteKeyCandidates(s).filter((key) => validRouteIds.has(key));
        const routeId = routeKeys[0] || String(s.routeId || s.routeCode || s.routeDisplayCode || "");
        return {
          ...s,
          id: s.id || s.externalStopCode || `${routeId || province}-stop-${idx}`,
          routeId,
          routeCode: s.routeCode || s.route_code || routeId,
          provinceCode: s.provinceCode || s.province_code || province,
          lat: ll[0],
          lng: ll[1],
        };
      }).filter(Boolean);
      State.stops = sqlStops;

      ROUTES.forEach((route) => {
        const clean = normalizePathPoints(route.path || [], { source: `post-load-route-path:${route.id}` });
        if (clean.length >= 2) route.path = clean;
        else {
          const fallback = buildRoutePathFromStops(route);
          if (fallback.length >= 2) route.path = fallback;
        }
      });

      const apiBuses = (Array.isArray(busesRaw) ? busesRaw : []).map((b, idx) => {
        const ck = CROWDING[b.crowding] ? b.crowding : pick(Object.keys(CROWDING));
        const c = CROWDING[ck];
        const routeId = String(b.routeId || b.route_id || b.routeCode || b.route_code || b.displayCode || "").trim();
        const route = routeById(routeId);
        const path = route?.path || [];
        const apiPoint = normalizeLatLng(b, { source: `bus-api:${b.id || idx}` });
        const isNearRoute = apiPoint && path.length ? distanceFromPathMeters(apiPoint, path) <= 2500 : Boolean(apiPoint);
        const safePoint = isNearRoute ? apiPoint : null;
        return {
          ...b,
          uid: String(b.uid || b.vehicleCode || b.vehicle_code || b.id || `${routeId || 'BUS'}-${idx + 1}`),
          routeId,
          plate: b.plate || b.licensePlate || b.license_plate || b.vehicleCode || `BUS-${idx + 1}`,
          crowding: ck,
          passengers: Number(b.passengers || rnd(c.min, c.max)),
          speed: Number(b.speed || b.speedKmh || b.speed_kmh || CONFIG.SPEEDS.min),
          progress: Number.isFinite(Number(b.progress)) ? Number(b.progress) : ((idx % 10) + 1) / 11,
          status: b.status || "active",
          lat: safePoint ? safePoint[0] : null,
          lng: safePoint ? safePoint[1] : null,
        };
      }).filter((b) => b.routeId && routeById(b.routeId));
      State.buses = apiBuses;
      State.dataSource = "sql";
      this.populateFilters();
      window.safeInvalidateSmartBusMap?.(200);
      return true;
    } catch (err) {
      console.error("Không tải được dữ liệu SQL Server. Frontend không dùng dữ liệu cứng; hãy chạy backend và import SQL Server:", err);
      State.dataSource = "sql_error";
      ROUTES.splice(0, ROUTES.length);
      State.stops = [];
      State.buses = [];
      this.populateFilters();
      Toast?.show?.("Không kết nối được SQL Server/API. Hãy chạy backend và import database.", "error");
      return false;
    } finally {
      document.body.classList.remove('map-loading');
      window.safeInvalidateSmartBusMap?.(250);
    }
  },
  populateFilters() {
    const provinceBox = $("#gis-province-filter");
    const routeBox = $("#gis-route-filter");
    if (provinceBox) {
      provinceBox.innerHTML = provinceOptionsHtml(false);
      provinceBox.value = State.mapFilters.province || CONFIG.DEFAULT_PROVINCE;
    }
    if (routeBox) {
      const current = routeBox.value;
      routeBox.innerHTML = `<option value="">Tất cả tuyến</option>${ROUTES.map((r) => `<option value="${r.id}">T.${routeLabel(r)} · ${r.name}</option>`).join("")}`;
      routeBox.value = current || "";
    }
  },
};

/* ----------------------------------------------------------
   8. BUS FACTORY
---------------------------------------------------------- */
function createBuses() {
  return ROUTES.flatMap((route) =>
    [0, 1].map((i) => {
      const ck = pick(Object.keys(CROWDING));
      const c = CROWDING[ck];
      return {
        uid: `${route.id}-${i + 1}`,
        plate: `43B-${route.id}${String(i + 1).padStart(2, "0")}.${rnd(10, 99)}`,
        routeId: route.id,
        crowding: ck,
        passengers: rnd(c.min, c.max),
        speed: rnd(CONFIG.SPEEDS.min, CONFIG.SPEEDS.max),
        progress: i === 0 ? Math.random() * 0.35 : 0.45 + Math.random() * 0.35,
        status: "active", // "active" | "resting"
        restUntil: null,
      };
    }),
  );
}

/* ----------------------------------------------------------
   9. SIMULATION ENGINE
---------------------------------------------------------- */
function moveBus(bus) {
  const route = routeById(bus.routeId);
  if (!route) return bus;

  // Đang nghỉ đầu/cuối tuyến
  if (bus.status === "resting") {
    if (bus.restUntil && new Date() >= bus.restUntil) {
      return { ...bus, status: "active", restUntil: null, progress: 0 };
    }
    return bus;
  }

  const step = (bus.speed / 1000) * (CONFIG.TICK_MS / 1000) * 0.003;
  let progress = bus.progress + step;

  // Đến cuối tuyến → nghỉ 15 phút
  if (progress >= 1) {
    const restUntil = new Date(
      Date.now() + CONFIG.SCHEDULE.terminalBreakMin * 60 * 1000,
    );
    return { ...bus, progress: 1, status: "resting", restUntil };
  }

  // Biến động hành khách ngẫu nhiên
  let passengers = bus.passengers;
  let crowding = bus.crowding;
  if (Math.random() < 0.12) {
    const ck = pick(Object.keys(CROWDING));
    const c = CROWDING[ck];
    passengers = rnd(c.min, c.max);
    crowding = ck;
  }

  const speed = clamp(
    bus.speed + rnd(-5, 5),
    CONFIG.SPEEDS.min,
    CONFIG.SPEEDS.max,
  );
  return { ...bus, progress, passengers, crowding, speed };
}

function tickSimulation() {
  State.buses = State.buses.map(moveBus);
  Events.emit("buses:updated", State.buses);
}

/* ----------------------------------------------------------
   10. MAP MODULE
---------------------------------------------------------- */
const MapModule = (() => {
  let map = null;
  const markers = new Map();
  const stopMarkers = new Map();
  const routeLines = [];
  let highlightedRouteId = null;
  let userLocationMarker = null;
  let userLocationCircle = null;
  let nearestStopMarker = null;
  let routeRenderer = null;

  function ensureMapPanes() {
    if (!map || !window.L) return;
    const panes = [
      ["routePane", 430],
      ["stopPane", 610],
      ["vehiclePane", 650],
      ["focusPane", 700],
    ];
    panes.forEach(([name, z]) => {
      const pane = map.getPane(name) || map.createPane(name);
      pane.style.zIndex = String(z);
      pane.style.pointerEvents = name === "routePane" ? "auto" : "auto";
    });
    if (!routeRenderer) routeRenderer = L.svg({ pane: "routePane" });
  }

  function init() {
    const mapEl = $("#map");

    if (map) {
      State.mapReady = true;
      ensureMapPanes();
      window.safeInvalidateSmartBusMap?.(150);
      drawRoutes();
      drawStops();
      return;
    }

    if (!window.L) {
      State.mapReady = false;
      if (mapEl) {
        mapEl.innerHTML = `<div class="map-missing">Không tải được thư viện bản đồ Leaflet. Kiểm tra internet hoặc dùng bản local.</div>`;
      }
      Toast.show("Không tải được thư viện bản đồ Leaflet. Kiểm tra internet hoặc dùng bản local.", "warning", 6000);
      return;
    }

    const meta = provinceMeta(State.mapFilters.province || CONFIG.DEFAULT_PROVINCE);
    map = L.map("map", { zoomControl: false, scrollWheelZoom: true, preferCanvas: false }).setView(meta.center || CONFIG.MAP_CENTER, meta.zoom || CONFIG.MAP_ZOOM);
    window.smartBusMap = map;
    window.map = map;

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
    }).addTo(map);

    ensureMapPanes();
    L.control.zoom({ position: "bottomright" }).addTo(map);
    map.on("zoomend", debounce(updateStopLabelVisibility, 120));
    map.on("moveend", debounce(() => { updateMarkers(State.buses); }, 180));
    drawRoutes();
    drawStops();
    State.mapReady = true;
    fitVisibleRoutes();
    window.safeInvalidateSmartBusMap?.(200);
    window.safeInvalidateSmartBusMap?.(500);
  }

  function averageCenter(points) {
    const clean = (points || []).filter((p) => Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1])));
    if (!clean.length) return null;
    return [clean.reduce((sum, p) => sum + Number(p[0]), 0) / clean.length, clean.reduce((sum, p) => sum + Number(p[1]), 0) / clean.length];
  }

  function routeVisible(route) {
    const f = State.mapFilters || {};
    const mode = ["all", "selected", "none", "province"].includes(f.routes) ? f.routes : "all";
    const routeProvince = String(route?.provinceCode || route?.province_code || "").toUpperCase();
    const filterProvince = String(f.province || "").toUpperCase();
    if (mode === "none") return false;
    if (mode === "selected") {
      return Boolean(f.routeId) && routeKeyCandidates(route).some((key) => sameRouteKey(key, f.routeId));
    }
    if (filterProvince && routeProvince && routeProvince !== filterProvince) return false;
    if (mode === "province" && filterProvince && routeProvince && routeProvince !== filterProvince) return false;
    return true;
  }

  function drawRoutes() {
    if (!map || !window.L) return;
    ensureMapPanes();
    routeLines.forEach((l) => l.remove());
    routeLines.length = 0;
    ROUTES.forEach((route) => {
      const pts = getRenderableRoutePath(route);
      if (!pts || pts.length < 2 || !routeVisible(route)) return;
      const isRoadSnapped = State.geometryStatus[route.id] === "ok";
      const line = L.polyline(pts, {
        pane: "overlayPane",
        className: "smartbus-route-line",
        color: route.color || "#22d3ee",
        weight: highlightedRouteId === route.id ? 9 : 6,
        opacity: highlightedRouteId && highlightedRouteId !== route.id ? 0.34 : 1,
        lineCap: "round",
        lineJoin: "round",
        interactive: true,
        bubblingMouseEvents: false,
        dashArray: isRoadSnapped ? null : "10 7",
      }).addTo(map);
      if (line.bringToFront) line.bringToFront();
      line._smartBusRouteId = route.id;
      line.bindPopup(buildRoutePopup(route));
      routeLines.push(line);
    });
    window.safeInvalidateSmartBusMap?.(120);
  }

  function fitVisibleRoutes() {
    if (!map || !window.L || !routeLines.length) return;
    const group = L.featureGroup(routeLines);
    try { map.fitBounds(group.getBounds(), { padding: [28, 28], maxZoom: 10 }); } catch {}
  }

  function buildRoutePopup(r) {
    return `<div class="popup-inner">
      <div class="popup-route" style="color:${r.color}">Tuyến ${routeLabel(r)} · ${r.provinceName || r.provinceCode || ""}</div>
      <div class="popup-row"><span class="popup-key">Lộ trình</span><span class="popup-val">${r.name}</span></div>
      <div class="popup-row"><span class="popup-key">Loại</span><span class="popup-val">${r.type || "Tuyến xe buýt"}</span></div>
      <div class="popup-row"><span class="popup-key">Giá vé</span><span class="popup-val">${r.fare || "Đang cập nhật"}</span></div>
      <div class="popup-row"><span class="popup-key">Giờ</span><span class="popup-val">${r.time || "Đang cập nhật"}</span></div>
      <span class="popup-status" style="background:${r.color}22;color:${r.color};border:1px solid ${r.color}44">${r.interval || "Đang cập nhật"}</span>
      <span class="popup-status">${State.geometryStatus[r.id] === "ok" ? "Đã bám đường thực tế OSRM" : "Đang bẻ tuyến theo đường thực tế"}</span>
    </div>`;
  }

  function buildBusPopup(bus, pos) {
    const route = routeById(bus.routeId);
    const c = CROWDING[bus.crowding] || CROWDING.quiet;
    const pct = Math.round(((bus.passengers || 0) / 75) * 100);
    const isResting = bus.status === "resting";
    const restMins = isResting && bus.restUntil ? Math.max(0, Math.ceil((bus.restUntil - Date.now()) / 60000)) : 0;
    return `<div class="popup-inner">
      <div class="popup-route" style="color:${route?.color || "var(--teal)"}">Tuyến ${routeLabel(route || bus.routeId)} – ${route?.name || ""}</div>
      ${isResting ? `<div class="popup-rest-badge">⏸ Nghỉ đầu/cuối tuyến · còn ${restMins} phút</div>` : ""}
      <div class="popup-row"><span class="popup-key">Biển số</span><span class="popup-val">${bus.plate}</span></div>
      <div class="popup-row"><span class="popup-key">Tốc độ</span><span class="popup-val">${isResting ? "0" : Math.round(bus.speed || 0)} km/h</span></div>
      <div class="popup-row"><span class="popup-key">Hành khách</span><span class="popup-val">${bus.passengers || "?"} người (${pct}%)</span></div>
      <div class="popup-row"><span class="popup-key">Vị trí</span><span class="popup-val">${pos[0].toFixed(4)}, ${pos[1].toFixed(4)}</span></div>
      <span class="popup-status" style="background:${c.color}22;color:${c.color};border:1px solid ${c.color}44">${c.label}</span>
    </div>`;
  }

  function getSafeBusPosition(bus) {
    const path = normalizePathPoints(getPath(bus.routeId), { source: `bus-path:${bus.routeId}` });
    const apiPoint = normalizeLatLng(bus, { source: `bus-marker:${bus.uid || bus.id || "?"}` });
    if (apiPoint && (!path.length || distanceFromPathMeters(apiPoint, path) <= 2500)) return apiPoint;
    return getPositionOnPath(path, Number.isFinite(Number(bus.progress)) ? Number(bus.progress) : 0);
  }

  function makeIcon(bus) {
    const c = CROWDING[bus.crowding] || CROWDING.quiet;
    const route = routeById(bus.routeId);
    const isResting = bus.status === "resting";
    const body = isResting ? `lf-marker-body ${bus.crowding} resting-marker` : `lf-marker-body ${bus.crowding}`;
    const pulse = isResting ? "" : `<div class="lf-marker-pulse ${bus.crowding}"></div>`;
    return L.divIcon({
      className: "bus-div-icon",
      html: `<div class="lf-marker">
        ${pulse}
        <div class="${body}" style="border-color:${route?.color || c.color};background:${route?.color || c.color}">${isResting ? "⏸" : "🚌"}</div>
        <div class="lf-marker-label" style="background:${route?.color || "#222"}">${routeLabel(route || bus.routeId)}</div>
      </div>`,
      iconSize: [34, 44],
      iconAnchor: [17, 22],
      popupAnchor: [0, -24],
    });
  }

  function updateMarkers(buses) {
    if (!map || !window.L) return;
    const currentIds = new Set(buses.map((b) => String(b.uid)));
    markers.forEach((m, id) => { if (!currentIds.has(String(id))) { if (map.hasLayer(m)) m.remove(); markers.delete(id); } });
    const visible = new Set(buses.filter((b) => filterBus(b)).map((b) => b.uid));
    buses.forEach((bus) => {
      const pos = getSafeBusPosition(bus);
      if (!isLatLngInValidRange(pos) || !isCoordinateInCentralVietnam(pos)) return;
      const latlng = [pos[0], pos[1]];
      if (markers.has(bus.uid)) {
        const m = markers.get(bus.uid);
        m.setLatLng(latlng);
        m.setIcon(makeIcon(bus));
        if (m.isPopupOpen()) m.getPopup().setContent(buildBusPopup(bus, pos));
        if (visible.has(bus.uid)) { if (!map.hasLayer(m)) m.addTo(map); } else if (map.hasLayer(m)) m.remove();
      } else {
        const m = L.marker(latlng, { icon: makeIcon(bus), pane: "vehiclePane", zIndexOffset: 100 }).addTo(map);
        m.bindPopup(buildBusPopup(bus, pos), { maxWidth: 320, minWidth: 230 });
        m.on("click", () => Events.emit("bus:select", bus.uid));
        markers.set(bus.uid, m);
        if (!visible.has(bus.uid)) m.remove();
      }
    });
    window.safeInvalidateSmartBusMap?.(120);
  }

  function stopIconType(stop) {
    const text = `${stop.stopType || ""} ${stop.name || ""}`.toLowerCase();
    if (/sân bay|airport/.test(text)) return { emoji: "✈️", cls: "airport" };
    if (/nhà ga|ga /.test(text)) return { emoji: "🚉", cls: "rail" };
    if (/du lịch|tour|điểm tham quan/.test(text)) return { emoji: "🏖️", cls: "tour" };
    if (/trung chuyển|transfer/.test(text)) return { emoji: "🔁", cls: "transfer" };
    if (stop.isMajor || /bến|đầu|cuối/.test(text)) return { emoji: "🚌", cls: "terminal" };
    return { emoji: "🚏", cls: "normal" };
  }

  function makeStopIcon(stop) {
    const type = stopIconType(stop);
    const canShowLabel = Boolean(State.mapFilters.labels && map && map.getZoom() >= 14);
    const label = canShowLabel ? `<span class="stop-label">${escapeHtml(stop.name)}${Number(stop.routeCount) ? ` · ${stop.routeCount} tuyến` : ""}</span>` : "";
    return L.divIcon({
      className: `stop-div-icon stop-${type.cls}`,
      html: `<div class="stop-marker"><span class="stop-emoji">${type.emoji}</span>${label}</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 28],
      popupAnchor: [0, -28],
    });
  }

  function buildStopPopup(stop) {
    const routes = Array.isArray(stop.routes) ? stop.routes : [];
    const routeText = routes.length ? routes.map((r) => `T.${escapeHtml(r.displayCode || r.id)}`).join(", ") : (stop.routeDisplayCode ? `T.${escapeHtml(stop.routeDisplayCode)}` : "Đang cập nhật");
    return `<div class="popup-inner">
      <div class="popup-route">${escapeHtml(stop.name || "Điểm dừng")}</div>
      <div class="popup-row"><span class="popup-key">Loại</span><span class="popup-val">${escapeHtml(stop.stopType || (stop.isMajor ? "Bến chính" : "Điểm dừng"))}</span></div>
      <div class="popup-row"><span class="popup-key">GPS</span><span class="popup-val">${Number(stop.lat).toFixed(5)}, ${Number(stop.lng).toFixed(5)}</span></div>
      <div class="popup-row"><span class="popup-key">Tuyến qua</span><span class="popup-val">${routeText}</span></div>
      <div class="popup-row"><span class="popup-key">Địa chỉ</span><span class="popup-val">${escapeHtml(stop.address || stop.nearbyLandmark || "Đang cập nhật")}</span></div>
      ${State.userLocation ? `<span class="popup-status">Cách bạn ${Math.round(getDistanceMeters([State.userLocation.lat, State.userLocation.lng], [stop.lat, stop.lng]))}m</span>` : ""}
    </div>`;
  }

  function drawStops() {
    if (!map || !window.L) return;
    const zoom = map.getZoom();
    const shouldShow = State.mapFilters.stops && zoom >= 7;
    const majorOnly = zoom < 11;
    const routeFilter = State.mapFilters.routeId;
    const provinceFilter = State.mapFilters.province;
    const allowed = State.stops.filter((s) => {
      if (!shouldShow) return false;
      if (majorOnly && !(s.isMajor || /đầu|cuối|bến|sân bay|ga|trung chuyển/i.test(`${s.stopType || ""} ${s.name || ""}`))) return false;
      if (provinceFilter && s.provinceCode !== provinceFilter) return false;
      if (routeFilter && s.routeId !== routeFilter && !(s.routes || []).some((r) => r.id === routeFilter)) return false;
      return true;
    });
    const activeIds = new Set(allowed.map((s) => String(s.id || s.externalStopCode)));
    stopMarkers.forEach((m, id) => { if (!activeIds.has(id)) { if (map.hasLayer(m)) m.remove(); stopMarkers.delete(id); } });
    allowed.forEach((stop) => {
      const id = String(stop.id || stop.externalStopCode);
      const ll = normalizeLatLng(stop, { source: `draw-stop:${id}` });
      if (!ll) return;
      if (stopMarkers.has(id)) {
        const m = stopMarkers.get(id);
        m.setLatLng(ll);
        m.setIcon(makeStopIcon(stop));
        if (m.isPopupOpen()) m.getPopup().setContent(buildStopPopup(stop));
        if (!map.hasLayer(m)) m.addTo(map);
      } else {
        const m = L.marker(ll, { icon: makeStopIcon(stop), pane: "stopPane", zIndexOffset: 70 }).addTo(map);
        m.bindPopup(buildStopPopup(stop), { maxWidth: 320, minWidth: 230 });
        stopMarkers.set(id, m);
      }
    });
    window.safeInvalidateSmartBusMap?.(120);
  }

  function updateStopLabelVisibility() {
    const showLabels = map && map.getZoom() >= 14 && State.mapFilters.labels;
    State.mapFilters.showStopLabels = Boolean(showLabels);
    document.body.classList.toggle("map-show-stop-labels", Boolean(showLabels));
    drawStops();
  }

  function escapeHtml(v) {
    return String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  }

  function focusBus(uid) {
    const bus = State.buses.find((b) => b.uid === uid);
    if (!bus || !map) return;
    const pos = getSafeBusPosition(bus);
    if (!isLatLngInValidRange(pos)) return;
    map.flyTo([pos[0], pos[1]], 15, { duration: 1.2 });
    window.safeInvalidateSmartBusMap?.(300);
    const m = markers.get(uid);
    if (m) setTimeout(() => m.openPopup(), 400);
  }

  function highlightRoute(routeId) {
    if (!map || !routeId) return;
    const r0 = routeById(routeId);
    const rid = r0?.id || String(routeId);
    highlightedRouteId = rid;
    State.mapFilters.routeId = rid;
    let focused = null;
    drawRoutes();
    routeLines.forEach((line) => {
      const r = routeById(line._smartBusRouteId);
      const active = line._smartBusRouteId === rid;
      line.setStyle({ weight: active ? 8 : 3, opacity: active ? 1 : 0.16, color: r?.color || "var(--teal)" });
      if (active) { focused = line; line.bringToFront(); }
    });
    drawStops();
    if (focused) map.fitBounds(focused.getBounds(), { padding: [36, 36], maxZoom: 14 });
  }

  function clearRouteHighlight() {
    highlightedRouteId = null;
    State.mapFilters.routeId = "";
    redrawRoutes();
  }

  function markUserLocation(lat, lng) {
    if (!map || lat == null || lng == null) return;
    const ll = normalizeLatLng({ lat, lng }, { allowOutsideCentral: true, source: "user-location" });
    if (!ll) return;
    State.userLocation = { lat: ll[0], lng: ll[1] };
    const icon = L.divIcon({ className: "user-location-icon", html: `<div class="user-location-dot"></div>`, iconSize: [24, 24], iconAnchor: [12, 12] });
    if (userLocationMarker) userLocationMarker.setLatLng(ll);
    else userLocationMarker = L.marker(ll, { icon, pane: "focusPane", zIndexOffset: 500 }).addTo(map);
    if (userLocationCircle) userLocationCircle.setLatLng(ll);
    else userLocationCircle = L.circle(ll, { radius: 650, weight: 1, opacity: 0.7, fillOpacity: 0.08 }).addTo(map);
    userLocationMarker.bindPopup("Vị trí hiện tại của bạn");
    updateMarkers(State.buses);
    drawStops();
    window.safeInvalidateSmartBusMap?.(200);
  }

  function focusPlace(place) {
    if (!map || !place) return;
    const ll = normalizeLatLng(place, { source: `focus-place:${place?.id || place?.name || "?"}` });
    if (!ll) return;
    map.flyTo(ll, 15, { duration: 1.1 });
    const icon = L.divIcon({ className: "stop-location-icon", html: `<div class="stop-location-dot"><span>📍</span></div>`, iconSize: [30, 30], iconAnchor: [15, 30], popupAnchor: [0, -30] });
    if (nearestStopMarker) nearestStopMarker.setLatLng(ll);
    else nearestStopMarker = L.marker(ll, { icon, pane: "focusPane", zIndexOffset: 460 }).addTo(map);
    nearestStopMarker.bindPopup(`<b>${escapeHtml(place.name || "Địa điểm")}</b><br/>${escapeHtml(place.provinceName || place.province || "")}`);
    window.safeInvalidateSmartBusMap?.(300);
    setTimeout(() => nearestStopMarker?.openPopup(), 400);
  }

  function focusStop(stop) {
    if (!map || !stop) return;
    const ll = normalizeLatLng(stop, { source: `focus-stop:${stop?.id || stop?.name || "?"}` });
    if (!ll) return;
    const icon = L.divIcon({ className: "stop-location-icon", html: `<div class="stop-location-dot"><span>🚏</span></div>`, iconSize: [30, 30], iconAnchor: [15, 30], popupAnchor: [0, -30] });
    if (nearestStopMarker) nearestStopMarker.setLatLng(ll);
    else nearestStopMarker = L.marker(ll, { icon, pane: "focusPane", zIndexOffset: 450 }).addTo(map);
    nearestStopMarker.bindPopup(`<b>${escapeHtml(stop.name || "Bến gần nhất")}</b><br/>${escapeHtml(stop.address || "Điểm đón gợi ý")}`);
    map.flyTo(ll, 15, { duration: 1.1 });
    window.safeInvalidateSmartBusMap?.(300);
    setTimeout(() => nearestStopMarker?.openPopup(), 450);
  }

  function redrawRoutes(shouldFit = true) {
    if (!map || !window.L) return;
    drawRoutes();
    if (highlightedRouteId) highlightRoute(highlightedRouteId);
    else if (shouldFit) fitVisibleRoutes();
    drawStops();
  }
  function invalidate() { map && setTimeout(() => map.invalidateSize(true), 150); }

  return { init, updateMarkers, drawStops, focusBus, redrawRoutes, invalidate, highlightRoute, clearRouteHighlight, markUserLocation, focusStop, focusPlace };
})();

/* ----------------------------------------------------------
   10a. LEAFLET RESPONSIVE INVALIDATION – mobile/layout safety
---------------------------------------------------------- */
function safeInvalidateSmartBusMap(delay = 200) {
  setTimeout(() => {
    const liveMap = window.smartBusMap || window.map || null;
    if (liveMap && typeof liveMap.invalidateSize === "function") {
      try { liveMap.invalidateSize(true); } catch (err) { console.warn("SmartBus map invalidate failed", err); }
    }
  }, delay);
}
window.safeInvalidateSmartBusMap = safeInvalidateSmartBusMap;
window.addEventListener("load", () => safeInvalidateSmartBusMap(350));
window.addEventListener("resize", debounce(() => safeInvalidateSmartBusMap(250), 120));
window.addEventListener("orientationchange", () => safeInvalidateSmartBusMap(550));

/* ----------------------------------------------------------
   11. FILTER HELPER – chia sẻ giữa map và list
---------------------------------------------------------- */
function filterBus(bus) {
  const q = State.searchQuery.toLowerCase();
  const route = routeById(bus.routeId);
  const f = State.mapFilters;
  if (f.buses === "none") return false;
  if (f.buses === "active" && bus.status !== "active") return false;
  if ((f.buses === "route" || f.routeId) && f.routeId && bus.routeId !== f.routeId) return false;
  if ((f.buses === "province" || f.province) && f.province && route?.provinceCode !== f.province) return false;
  if (f.buses === "nearby") {
    if (!State.userLocation) return false;
    const path = normalizePathPoints(getPath(bus.routeId), { source: `filter-bus:${bus.routeId}` });
    const apiPoint = normalizeLatLng(bus, { source: `filter-bus-api:${bus.uid || bus.id || "?"}` });
    const pos = apiPoint && (!path.length || distanceFromPathMeters(apiPoint, path) <= 2500)
      ? apiPoint
      : getPositionOnPath(path, bus.progress);
    if (!pos || getDistanceMeters([State.userLocation.lat, State.userLocation.lng], pos) > 5000) return false;
  }
  const matchCrowd = State.filterCrowding === "all" || bus.crowding === State.filterCrowding;
  const matchSearch =
    !q ||
    String(bus.routeId).toLowerCase().includes(q) ||
    String(route?.displayCode || "").toLowerCase().includes(q) ||
    String(bus.plate || "").toLowerCase().includes(q) ||
    String(route?.name || "").toLowerCase().includes(q) ||
    String(route?.provinceName || "").toLowerCase().includes(q);
  return matchCrowd && matchSearch;
}

/* ----------------------------------------------------------
   12. UI MODULES
---------------------------------------------------------- */

// 12a. SCHEDULE OVERLAY
const ScheduleUI = {
  _clockTimer: null,

  show(status) {
    const overlay = $("#schedule-overlay");
    if (!overlay) return;
    if (status === "active") {
      overlay.classList.add("hidden");
      clearInterval(this._clockTimer);
      this._clockTimer = null;
      this._setLiveIndicator(true);
      return;
    }
    overlay.classList.remove("hidden");
    this._setLiveIndicator(false);

    const next = Schedule.getNextEventTime();
    const icon = status === "lunch" ? "🍜" : "🌙";
    const title =
      status === "lunch" ? "Giờ nghỉ trưa" : "Hệ thống ngoài giờ hoạt động";
    const desc =
      status === "lunch"
        ? "Toàn bộ xe buýt đang dừng nghỉ. Hệ thống tiếp tục lúc 13:00."
        : "Xe buýt DanaBus hoạt động từ 06:30 – 18:00 hàng ngày.";

    const el = (id) => $(`#sched-${id}`);
    if (el("icon")) el("icon").textContent = icon;
    if (el("title")) el("title").textContent = title;
    if (el("desc")) el("desc").textContent = desc;
    if (el("next-label")) el("next-label").textContent = next.label;
    if (el("next-time")) el("next-time").textContent = next.time;

    if (!this._clockTimer) {
      const tick = () => {
        const cl = $("#sched-clock");
        if (cl) cl.textContent = Schedule.formatDateTime();
      };
      tick();
      this._clockTimer = setInterval(tick, 1000);
    }
  },

  _setLiveIndicator(isLive) {
    const live = $(".tb-live");
    if (!live) return;
    if (isLive) {
      live.innerHTML = `<div class="tb-live-dot"></div>LIVE`;
      live.style.background = "var(--grn-dim)";
      live.style.borderColor = "rgba(76,217,123,.22)";
      live.style.color = "var(--green)";
    } else {
      const st = State.systemStatus;
      const col = st === "lunch" ? "var(--orange)" : "var(--txt3)";
      const txt = st === "lunch" ? "NGHỈ TRƯA" : "OFFLINE";
      live.innerHTML = `<div class="tb-live-dot" style="background:${col};box-shadow:none"></div>${txt}`;
      live.style.color = col;
    }
  },
};

// 12b. STATS CARDS
const StatsUI = {
  update() {
    const st = State.systemStatus;
    const buses = State.buses;
    const total = buses.length;
    const active =
      st === "active" ? buses.filter((b) => b.status === "active").length : 0;
    const resting =
      st === "active" ? buses.filter((b) => b.status === "resting").length : 0;
    const busy =
      st === "active" ? buses.filter((b) => b.crowding === "busy").length : 0;
    const moderate =
      st === "active"
        ? buses.filter((b) => b.crowding === "moderate").length
        : 0;
    const quiet =
      st === "active" ? buses.filter((b) => b.crowding === "quiet").length : 0;

    const set = (id, v) => {
      const el = $(id);
      if (el) el.textContent = v;
    };
    set("#sc-total", total);
    set("#sc-active", st === "offline" ? "–" : active);
    set("#sc-busy", st === "offline" ? "–" : busy);
    set(
      "#sc-update",
      st === "offline"
        ? "OFFLINE"
        : st === "lunch"
          ? "NGHỈ TRƯA"
          : Schedule.formatTime(),
    );
    set("#sb-badge", total);

    // Donut chart
    const circumference = 100;
    const busyPct = total ? (busy / total) * circumference : 0;
    const modPct = total ? (moderate / total) * circumference : 0;
    const quietPct = total ? (quiet / total) * circumference : 0;

    const sd = (id, arr, ofs) => {
      const el = $(id);
      if (!el) return;
      el.setAttribute("stroke-dasharray", `${arr} ${circumference - arr}`);
      if (ofs !== undefined) el.setAttribute("stroke-dashoffset", String(-ofs));
    };
    sd("#d-busy", busyPct);
    sd("#d-moderate", modPct, busyPct);
    sd("#d-quiet", quietPct, busyPct + modPct);

    set("#d-total", total);
    set("#dl-busy", `Đông: ${busy}`);
    set("#dl-moderate", `Vừa: ${moderate}`);
    set("#dl-quiet", `Vắng: ${quiet}`);

    // Cache for analytics
    this._cache = { total, active, resting, busy, moderate, quiet };
    return this._cache;
  },
};

// 12c. BUS LIST (sidebar panel)
const BusListUI = {
  render() {
    const list = $("#bus-list");
    const countEl = $("#bp-count");
    if (!list) return;

    const data = State.buses.filter(filterBus);
    if (countEl) countEl.textContent = `${data.length} xe`;

    if (!data.length) {
      list.innerHTML = `<div class="bp-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <div>Không tìm thấy xe</div></div>`;
      return;
    }

    list.innerHTML = data
      .map((bus) => {
        const c = CROWDING[bus.crowding];
        const route = routeById(bus.routeId);
        const isResting = bus.status === "resting";
        const restMins =
          isResting && bus.restUntil
            ? Math.max(0, Math.ceil((bus.restUntil - Date.now()) / 60000))
            : 0;
        const hi = bus.uid === State.selectedBusId ? " highlighted" : "";
        return `<div class="bcard${hi}" data-bus-id="${bus.uid}">
        <div class="bc-icon ${c.iconClass}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="1" y="3" width="15" height="13"/>
            <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
            <circle cx="5.5" cy="18.5" r="2.5"/>
            <circle cx="18.5" cy="18.5" r="2.5"/>
          </svg>
        </div>
        <div class="bc-info">
          <div class="bc-route" style="color:${route?.color || "var(--teal)"}">Tuyến ${routeLabel(route || bus.routeId)} · ${bus.plate}</div>
          <div class="bc-stop">${isResting ? `⏸ Nghỉ cuối tuyến (còn ${restMins} ph)` : route?.name || ""}</div>
        </div>
        <div class="bc-meta">
          <span class="bc-badge ${c.badgeClass}">${c.label}</span>
          <div class="bc-eta">${bus.passengers} khách</div>
        </div>
      </div>`;
      })
      .join("");

    $$(".bcard[data-bus-id]").forEach((card) => {
      card.addEventListener("click", () =>
        Events.emit("bus:select", card.dataset.busId),
      );
    });
  },
};

// 12d. BUS TABLE (view-buses)
const BusTableUI = {
  _bound: false,
  bind() {
    if (this._bound) return;
    this._bound = true;
    ["#bus-view-province", "#bus-view-route"].forEach((id) => {
      const el = $(id);
      if (el) el.addEventListener("change", () => this.render());
    });
  },
  populateFilters() {
    const provinceSel = $("#bus-view-province");
    const routeSel = $("#bus-view-route");
    if (provinceSel && !provinceSel.dataset.populated) {
      provinceSel.innerHTML = provinceOptionsHtml(true);
      provinceSel.dataset.populated = "1";
    }
    if (routeSel) {
      const cur = routeSel.value;
      const province = provinceSel?.value || "";
      const routes = ROUTES.filter((r) => !province || r.provinceCode === province);
      routeSel.innerHTML = `<option value="">Tất cả tuyến</option>${routes.map((r) => `<option value="${r.id}">Tuyến ${routeLabel(r)} · ${this._esc(r.name)}</option>`).join("")}`;
      if (routes.some((r) => r.id === cur)) routeSel.value = cur;
    }
  },
  render() {
    this.bind();
    this.populateFilters();
    this.renderRouteCatalog();
    this.renderVehicleTable();
  },
  routeFilter() {
    return { province: $("#bus-view-province")?.value || "", routeId: $("#bus-view-route")?.value || "" };
  },
  visibleRoutes() {
    const f = this.routeFilter();
    return ROUTES.filter((r) => (!f.province || r.provinceCode === f.province) && (!f.routeId || r.id === f.routeId));
  },
  renderRouteCatalog() {
    const box = $("#route-catalog-list");
    const count = $("#route-catalog-count");
    if (!box) return;
    const routes = this.visibleRoutes();
    if (count) count.textContent = `${routes.length} tuyến`;
    if (!routes.length) { box.innerHTML = `<div class="empty-state">Không có tuyến phù hợp bộ lọc.</div>`; return; }
    box.innerHTML = routes.map((r) => {
      const stopCount = LOCAL_STOPS.filter((s) => s.routeId === r.id || (s.routes || []).some((x) => x.id === r.id)).length || (r.path?.length || 0);
      const buses = State.buses.filter((b) => b.routeId === r.id);
      return `<article class="route-catalog-card" style="--route-color:${r.color}">
        <div class="route-catalog-top"><span>Tuyến ${this._esc(routeLabel(r))}</span><b>${this._esc(r.provinceName || r.provinceCode || "")}</b></div>
        <h4>${this._esc(r.name)}</h4>
        <p>${this._esc(r.originName || "Điểm đầu")} → ${this._esc(r.destinationName || "Điểm cuối")}</p>
        <div class="route-catalog-meta">
          <span>🕒 ${this._esc(r.time || "Đang cập nhật")}</span>
          <span>⏱ ${this._esc(r.interval || "Đang cập nhật")}</span>
          <span>🚏 ${stopCount} điểm GPS</span>
          <span>🚌 ${buses.length || r.vehicleCount || "?"} xe</span>
          ${r.distanceKm ? `<span>📏 ${r.distanceKm} km</span>` : ""}
          ${r.avgSpeedKmh ? `<span>⚡ TB ${r.avgSpeedKmh} km/h</span>` : ""}
        </div>
        <div class="route-catalog-actions"><button type="button" class="btn-ghost" data-route-focus="${r.id}">Xem trên bản đồ</button><button type="button" class="btn-ghost" data-route-chat="${r.id}">Hỏi chatbot</button><button type="button" class="btn-ghost" data-route-fav="${r.id}">💚 Lưu tuyến</button></div>
      </article>`;
    }).join("");
    $$('[data-route-focus]').forEach((btn) => btn.addEventListener("click", () => { Nav.go("dashboard"); setTimeout(() => MapModule.highlightRoute(btn.dataset.routeFocus), 250); }));
    $$('[data-route-chat]').forEach((btn) => btn.addEventListener("click", () => SmartBusAssistant.sendQuestion?.(`Tuyến ${btn.dataset.routeChat} đi đâu, giờ chạy thế nào?`)));
    $$('[data-route-fav]').forEach((btn) => btn.addEventListener("click", () => TravelUI.toggleFavoriteRoute(btn.dataset.routeFav, true)));
  },
  renderVehicleTable() {
    const tbody = $("#bus-table-body");
    if (!tbody) return;
    const f = this.routeFilter();
    const data = State.buses.filter(filterBus).filter((b) => {
      const route = routeById(b.routeId);
      return (!f.province || route?.provinceCode === f.province) && (!f.routeId || b.routeId === f.routeId);
    });
    tbody.innerHTML = data
      .map((bus) => {
        const c = CROWDING[bus.crowding];
        const route = routeById(bus.routeId);
        const path = getPath(bus.routeId);
        const pos = (Number.isFinite(Number(bus.lat)) && Number.isFinite(Number(bus.lng))) ? [Number(bus.lat), Number(bus.lng)] : getPositionOnPath(path, bus.progress) || [0, 0];
        const isResting = bus.status === "resting";
        const restMins =
          isResting && bus.restUntil
            ? Math.max(0, Math.ceil((bus.restUntil - Date.now()) / 60000))
            : 0;
        return `<tr class="bus-row${bus.uid === State.selectedBusId ? " row-selected" : ""}" data-bus-row="${bus.uid}">
        <td><span class="mono">${bus.plate}</span></td>
        <td><span style="color:${route?.color};font-weight:600">Tuyến ${routeLabel(route || bus.routeId)}</span><br>
            <span class="txt3 small">${route?.provinceName || ""} · ${route?.name || ""}</span></td>
        <td><span class="bc-badge ${c.badgeClass}">${c.label}</span>
            ${isResting ? `<span class="rest-pill">⏸ ${restMins}ph</span>` : ""}</td>
        <td><span class="mono">${bus.passengers}</span></td>
        <td><span class="mono">${isResting ? "0" : bus.speed} km/h</span></td>
        <td><span class="mono small">${pos[0].toFixed(4)}, ${pos[1].toFixed(4)}</span></td>
      </tr>`;
      })
      .join("");

    $$('[data-bus-row]').forEach((row) => {
      row.addEventListener("click", () =>
        Events.emit("bus:select", row.dataset.busRow),
      );
    });
  },
  _esc(v) { return String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]); },
};

// 12e. ANALYTICS
const AnalyticsUI = {
  render() {
    this._renderRouteBars();
    this._renderPassengerBars();
    this._renderActivityLog();
    this._renderRouteTable();
  },

  _renderRouteBars() {
    const el = $("#route-bars");
    if (!el) return;
    if (State.systemStatus !== "active") {
      el.innerHTML = `<div class="offline-note">Dữ liệu không cập nhật ngoài giờ hoạt động</div>`;
      return;
    }
    el.innerHTML = ROUTES.map((r) => {
      const rBuses = State.buses.filter((b) => b.routeId === r.id);
      const busy = rBuses.filter((b) => b.crowding === "busy").length;
      const pct = rBuses.length ? Math.round((busy / rBuses.length) * 100) : 0;
      return `<div class="bar-row">
        <div class="bar-label" style="color:${r.color}" title="${r.name}">Tuyến ${routeLabel(r)}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${r.color}"></div></div>
        <div class="bar-val">${pct}%</div>
      </div>`;
    }).join("");
  },

  _renderPassengerBars() {
    const el = $("#passenger-bars");
    if (!el) return;
    const sorted = [...State.buses]
      .sort((a, b) => b.passengers - a.passengers)
      .slice(0, 8);
    el.innerHTML = sorted
      .map((bus) => {
        const pct = Math.round((bus.passengers / 75) * 100);
        const col = CROWDING[bus.crowding].color;
        return `<div class="bar-row">
        <div class="bar-label mono small">${routeLabel(bus.routeId)}-${bus.uid.split("-")[1] || ""}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${col}"></div></div>
        <div class="bar-val">${bus.passengers}</div>
      </div>`;
      })
      .join("");
  },

  _renderActivityLog() {
    const el = $("#activity-log");
    if (!el) return;
    const items = State.activityLog.slice(0, 8);
    if (!items.length) {
      el.innerHTML = `<div class="txt3 small">Đang theo dõi hoạt động...</div>`;
      return;
    }
    el.innerHTML = items
      .map(
        (a) =>
          `<div class="tl-item">
        <div class="tl-dot" style="background:${a.color}"></div>
        <div class="tl-body">
          <div class="tl-title">${a.text}</div>
          <div class="tl-time">${a.time}</div>
        </div>
      </div>`,
      )
      .join("");
  },

  _renderRouteTable() {
    const el = $("#analytics-route-table");
    if (!el) return;
    el.innerHTML = ROUTES.map((r) => {
      const rBuses = State.buses.filter((b) => b.routeId === r.id);
      const busy = rBuses.filter((b) => b.crowding === "busy").length;
      const mod = rBuses.filter((b) => b.crowding === "moderate").length;
      const quiet = rBuses.filter((b) => b.crowding === "quiet").length;
      return `<tr>
        <td><span style="color:${r.color};font-weight:700">Tuyến ${routeLabel(r)}</span></td>
        <td class="small">${r.name}</td>
        <td class="center"><span style="color:var(--red)">${busy}</span></td>
        <td class="center"><span style="color:var(--orange)">${mod}</span></td>
        <td class="center"><span style="color:var(--green)">${quiet}</span></td>
        <td class="center mono small">${r.interval}</td>
      </tr>`;
    }).join("");
  },
};

// 12f. ROUTE LEGEND SIDEBAR
const LegendUI = {
  render() {
    const el = $("#route-legend-list");
    if (!el) return;
    el.innerHTML = ROUTES.map(
      (r) => `
      <div class="legend-item">
        <div class="legend-dot" style="background:${r.color}"></div>
        <span class="legend-id" style="color:${r.color}">T.${r.id}</span>
        <span class="legend-name">${r.name}</span>
      </div>`,
    ).join("");
  },
};

/* ----------------------------------------------------------
   13. TOAST SYSTEM
---------------------------------------------------------- */
const Toast = {
  ICONS: {
    success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  },

  show(msg, type = "info", ms = 3500) {
    const box = $("#toast-box");
    if (!box) return;
    const el = document.createElement("div");
    el.className = `toast toast-${type}`;
    el.innerHTML = `${this.ICONS[type] || this.ICONS.info}<span>${msg}</span>`;
    box.appendChild(el);
    setTimeout(() => {
      el.classList.add("out");
      el.addEventListener("animationend", () => el.remove(), { once: true });
    }, ms);
  },
};

/* ----------------------------------------------------------
   13a. MOBILE GPS HELPER – HTTPS/permission/loading/error safe
---------------------------------------------------------- */
const SmartBusGeo = (() => {
  let isRequesting = false;
  let lastPosition = null;

  function setLoading(targets = [], isLoading = false) {
    targets.filter(Boolean).forEach((btn) => {
      btn.disabled = isLoading;
      btn.classList.toggle("loading", isLoading);
      if (isLoading) {
        if (!btn.dataset.originalText) btn.dataset.originalText = btn.textContent.trim();
        btn.textContent = "Đang lấy vị trí...";
      } else if (btn.dataset.originalText) {
        btn.textContent = btn.dataset.originalText;
        delete btn.dataset.originalText;
      }
    });
  }

  function errorMessage(err) {
    if (!err) return "Không lấy được GPS. Hãy bật định vị trên điện thoại và thử lại.";
    if (err.code === 1) return "Bạn chưa cấp quyền vị trí. Hãy bấm biểu tượng ổ khóa trên thanh địa chỉ và bật Location cho trang SmartBus.";
    if (err.code === 2) return "Không xác định được vị trí. Hãy bật GPS, kiểm tra mạng và thử lại.";
    if (err.code === 3) return "Lấy vị trí quá lâu. Hãy bật GPS ngoài trời hoặc thử lại sau.";
    return "Không lấy được GPS. Hãy bật định vị trên điện thoại và thử lại.";
  }

  function get(options = {}) {
    const { showToast = true, timeoutMs = 15000, statusEl = null, buttons = [], allowCache = true, onSuccess = null } = options;
    if (isRequesting) return Promise.resolve(lastPosition);
    if (allowCache && lastPosition) return Promise.resolve(lastPosition);

    if (!window.isSecureContext && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
      const msg = "GPS cần HTTPS. Vui lòng mở SmartBus bằng link GitHub Pages HTTPS.";
      if (statusEl) statusEl.textContent = msg;
      if (showToast) Toast.show(msg, "warning", 5200);
      return Promise.resolve(null);
    }

    if (!navigator.geolocation) {
      const msg = "Trình duyệt không hỗ trợ GPS/vị trí.";
      if (statusEl) statusEl.textContent = msg;
      if (showToast) Toast.show(msg, "warning", 4200);
      return Promise.resolve(null);
    }

    isRequesting = true;
    setLoading(buttons, true);
    if (statusEl) statusEl.textContent = "Đang lấy vị trí GPS...";

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          isRequesting = false;
          setLoading(buttons, false);
          const gps = {
            lat: Number(pos.coords.latitude),
            lng: Number(pos.coords.longitude),
            accuracy: Number(pos.coords.accuracy || 0),
          };
          const gpsPoint = normalizeLatLng(gps, { allowOutsideCentral: true, source: "gps-success" });
          if (!gpsPoint) {
            const msg = "GPS trả về tọa độ không hợp lệ. Hãy bật định vị và thử lại.";
            if (statusEl) statusEl.textContent = msg;
            if (showToast) Toast.show(msg, "warning", 4200);
            resolve(null);
            return;
          }
          gps.lat = gpsPoint[0];
          gps.lng = gpsPoint[1];
          lastPosition = gps;
          if (statusEl) statusEl.textContent = `Đã có GPS – độ chính xác khoảng ${Math.round(gps.accuracy || 0)}m`;
          MapModule.markUserLocation?.(gps.lat, gps.lng);
          State.userLocation = gps;
          window.smartBusUserLocation = gps;
          window.safeInvalidateSmartBusMap?.(200);
          if (typeof onSuccess === "function") onSuccess(gps);
          if (showToast) Toast.show("Đã lấy vị trí hiện tại của bạn.", "success", 2600);
          resolve(gps);
        },
        (err) => {
          isRequesting = false;
          setLoading(buttons, false);
          const msg = errorMessage(err);
          if (statusEl) statusEl.textContent = msg;
          console.warn("SmartBus GPS error:", err);
          if (showToast) Toast.show(msg, "warning", 5600);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30000 },
      );
    });
  }

  function requestFromUserAction(button = null, extra = {}) {
    return get({
      showToast: true,
      timeoutMs: 20000,
      allowCache: false,
      buttons: [button].filter(Boolean),
      ...extra,
    });
  }

  return { get, setLoading, requestFromUserAction };
})();
window.SmartBusGeo = SmartBusGeo;
window.requestSmartBusGpsFromUserAction = (button = null, extra = {}) => SmartBusGeo.requestFromUserAction(button, extra);

function bindSmartBusGpsButtons() {
  const selectors = ["#gis-gps-btn", "#nearby-gps-btn", "#place-near-me", "#chat-gps-btn", "[data-location-button]", ".near-me-btn", ".gps-btn", ".location-btn", "#getLocationBtn"];
  $$(selectors.join(",")).forEach((btn) => {
    if (!btn || btn.dataset.smartbusGpsBound === "true") return;
    const text = (btn.textContent || "").toLowerCase();
    const isLocationButton = btn.id === "gis-gps-btn" || btn.id === "nearby-gps-btn" || btn.id === "place-near-me" || btn.id === "chat-gps-btn" ||
      btn.hasAttribute("data-location-button") || btn.classList.contains("near-me-btn") || btn.classList.contains("gps-btn") || btn.classList.contains("location-btn") ||
      text.includes("lấy vị trí") || text.includes("bến gần tôi") || text.includes("vị trí của tôi");
    if (!isLocationButton) return;
    btn.dataset.smartbusGpsBound = "true";
  });
}
document.addEventListener("DOMContentLoaded", bindSmartBusGpsButtons);
setTimeout(bindSmartBusGpsButtons, 500);
setTimeout(bindSmartBusGpsButtons, 1500);


/* ----------------------------------------------------------
   13b. PUBLIC LANDING PAGE – tổng quan trước đăng nhập
---------------------------------------------------------- */
const Landing = {
  bind() {
    ["#landing-login-btn", "#landing-login-cta"].forEach((sel) =>
      $(sel)?.addEventListener("click", () => Auth.openLogin()),
    );
    $("#landing-register-btn")?.addEventListener("click", () => Auth.openRegister());
    $("#landing-find-route-cta")?.addEventListener("click", () => {
      document.querySelector("#landing-routes")?.scrollIntoView({ behavior: "smooth", block: "start" });
      $("#landing-route-search")?.focus();
    });
    $("#landing-nearest-stop-cta")?.addEventListener("click", async () => {
      SmartBusAssistant.open?.();
      await SmartBusAssistant.requestGPS?.(true);
      SmartBusAssistant.sendQuestion?.("Bến xe buýt gần tôi nhất ở đâu?");
    });
    $("#landing-chatbot-cta")?.addEventListener("click", () => {
      SmartBusAssistant.open?.();
      const input = $("#chat-input");
      if (input) input.placeholder = "Bạn muốn đi đâu? Ví dụ: Hội An, Mỹ Khê, Cầu Rồng...";
      SmartBusAssistant.addBotHint?.("Bạn muốn đi đâu? Ví dụ: Hội An, Mỹ Khê, Cầu Rồng, Đại Nội Huế hoặc Lý Sơn.");
    });
    $("#landing-route-search")?.addEventListener("input", debounce(() => this.renderRoutes(), 180));
    $("#landing-province-filter")?.addEventListener("change", () => this.renderRoutes());
    $$("[data-landing-q]").forEach((btn) => btn.addEventListener("click", () => {
      SmartBusAssistant.open?.();
      SmartBusAssistant.sendQuestion?.(btn.dataset.landingQ || btn.textContent || "");
    }));
    this.populateProvinceFilter();
    this.renderStats();
    this.renderRoutes();
    this.renderPlaces();
  },
  show() {
    document.body.classList.remove("app-active");
    $("#landing-page")?.classList.remove("hidden");
    $("#page-login")?.classList.add("hidden");
    $("#app")?.classList.add("hidden");
  },
  hide() {
    $("#landing-page")?.classList.add("hidden");
  },
  populateProvinceFilter() {
    const sel = $("#landing-province-filter");
    if (!sel) return;
    const provinces = [...new Map(ROUTES.map((r) => [r.provinceCode, r.provinceName])).entries()];
    sel.innerHTML = `<option value="">Tất cả tỉnh/thành</option>` + provinces.map(([code, name]) => `<option value="${this._esc(code)}">${this._esc(name)}</option>`).join("");
  },
  async renderStats() {
    const statBox = $(".landing-stats");
    statBox?.classList.add("is-loading");
    const provinceCount = new Set([
      ...LOCAL_TOURISM_PLACES.map((p) => p.provinceCode).filter(Boolean),
      ...ROUTES.map((r) => r.provinceCode).filter(Boolean),
    ]).size || CONFIG.PROVINCES.length;
    const fallback = {
      totalRoutes: ROUTES.length,
      totalStops: LOCAL_STOPS.length,
      totalTourismPlaces: LOCAL_TOURISM_PLACES.length,
      totalProvinces: provinceCount,
      totalReviews: 30,
    };
    let stats = fallback;
    try {
      const data = await API.get("/stats/overview", { skipAuth: true, skipRefresh: true });
      stats = { ...fallback, ...(data || {}) };
    } catch (_err) {
      // Giữ số liệu fallback từ dữ liệu local đã nạp, không làm trắng trang chủ.
    }
    this._countTo("#landing-stat-routes", stats.totalRoutes ?? stats.routes ?? fallback.totalRoutes);
    this._countTo("#landing-stat-stops", stats.totalStops ?? stats.stops ?? fallback.totalStops);
    this._countTo("#landing-stat-places", stats.totalTourismPlaces ?? stats.tourismPlaces ?? fallback.totalTourismPlaces);
    this._countTo("#landing-stat-provinces", stats.totalProvinces ?? stats.provinces ?? fallback.totalProvinces);
    this._countTo("#landing-stat-reviews", stats.totalReviews ?? stats.reviews ?? fallback.totalReviews);
    setTimeout(() => statBox?.classList.remove("is-loading"), 300);
  },
  _countTo(selector, value) {
    const node = $(selector);
    if (!node) return;
    const target = Math.max(0, Number(value) || 0);
    const duration = 520;
    const start = performance.now();
    const tick = (now) => {
      const ratio = Math.min(1, (now - start) / duration);
      node.textContent = String(Math.round(target * ratio));
      if (ratio < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  },
  renderRoutes() {
    const box = $("#landing-route-list");
    if (!box) return;
    const q = ($("#landing-route-search")?.value || "").trim().toLowerCase();
    const province = $("#landing-province-filter")?.value || "";
    const routes = ROUTES.filter((r) => {
      const text = `${r.id} ${r.name} ${r.provinceName} ${r.originName || ""} ${r.destinationName || ""}`.toLowerCase();
      return (!province || r.provinceCode === province) && (!q || text.includes(q));
    });
    if (!routes.length) {
      box.innerHTML = `<div class="landing-empty landing-empty-strong"><span class="empty-icon">🔎</span><b>Chưa tìm thấy tuyến phù hợp với bộ lọc hiện tại.</b><span>Hãy thử nhập mã tuyến, tỉnh/thành hoặc điểm đầu/cuối khác.</span><button class="landing-btn ghost" type="button" id="landing-clear-route-filter">Xóa bộ lọc</button></div>`;
      $("#landing-clear-route-filter")?.addEventListener("click", () => { const i=$("#landing-route-search"); const s=$("#landing-province-filter"); if (i) i.value=""; if (s) s.value=""; this.renderRoutes(); });
      return;
    }
    box.innerHTML = `<div class="landing-preview-note">💡 Bạn có thể xem trước tuyến cơ bản. Đăng nhập để xem bản đồ, lưu tuyến và nhận gợi ý cá nhân.</div>` + routes.slice(0, 12).map((r) => {
      const stopCount = LOCAL_STOPS.filter((s) => s.routeId === r.id || (s.routes || []).some((x) => x.id === r.id)).length || (r.path?.length || 0);
      return `<article class="landing-route-card" style="--route-color:${this._esc(r.color)}">
        <div class="route-chip">${this._esc(r.provinceName || r.provinceCode || "Miền Trung")}</div>
        <h3>Tuyến ${this._esc(routeLabel(r))}</h3>
        <p>${this._esc(r.originName || "Điểm đầu")} → ${this._esc(r.destinationName || "Điểm cuối")}</p>
        <p class="travel-small">${this._esc(r.name || "Tuyến xe buýt SmartBus")}</p>
        <div class="landing-route-meta"><span>🕒 ${this._esc(r.time || "Đang cập nhật")}</span><span>⏱ ${this._esc(r.interval || "Đang cập nhật")}</span><span>🚏 ${stopCount} điểm GPS</span></div>
        <div class="landing-card-actions">
          <button class="landing-card-action" type="button" data-route-login="${this._esc(r.id)}">Xem chi tiết</button>
          <button class="landing-card-action" type="button" data-route-map="${this._esc(r.id)}">Xem trên bản đồ</button>
          <button class="landing-card-action" type="button" data-route-chat-landing="${this._esc(r.id)}">Hỏi chatbot</button>
        </div>
      </article>`;
    }).join("");
    $$('[data-route-login]').forEach((btn) => btn.addEventListener('click', () => Auth.openLogin(`Đăng nhập để xem tuyến ${btn.dataset.routeLogin} trên bản đồ đầy đủ.`)));
    $$('[data-route-map]').forEach((btn) => btn.addEventListener('click', () => Auth.openLogin(`Đăng nhập để mở tuyến ${btn.dataset.routeMap} trên bản đồ và lưu tuyến yêu thích.`)));
    $$('[data-route-chat-landing]').forEach((btn) => btn.addEventListener('click', () => { SmartBusAssistant.open?.(); SmartBusAssistant.sendQuestion?.(`Tuyến ${btn.dataset.routeChatLanding} đi đâu, giờ chạy thế nào?`); }));
  },
  renderPlaces() {
    const box = $("#landing-place-list");
    if (!box) return;
    box.innerHTML = LOCAL_TOURISM_PLACES.slice(0, 8).map((p) => `<article class="landing-place-card">
      <div class="place-pin">📍</div><div><h4>${this._esc(p.name)}</h4><p>${this._esc(p.provinceName)} · ${this._esc(p.category || "Du lịch")}</p><span>Gần: ${this._esc(p.nearestRouteCode || "đang cập nhật")}</span></div>
    </article>`).join("");
  },
  _esc(v) { return String(v ?? "").replace(/[&<>\"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;" })[c]); },
};

/* ----------------------------------------------------------
   14. LOGIN MODULE
---------------------------------------------------------- */
const Auth = {
  ROLE_LABELS: {
    admin: "Quản trị viên",
    moderator: "Kiểm duyệt viên",
    user: "Người dùng",
    driver: "Tài xế",
  },

  isAdmin(user = State.user || TokenStore.getUser()) {
    const role = String(user?.role || "").toLowerCase();
    const roles = Array.isArray(user?.roles) ? user.roles.map((r) => String(r).toLowerCase()) : [];
    return role === "admin" || roles.includes("admin");
  },

  showLogin(message = "") {
    this.openLogin(message);
  },

  _syncRoleUI(user = State.user) {
    const isAdmin = this.isAdmin(user);
    $$('[data-admin-only]').forEach((el) => el.classList.toggle('hidden', !isAdmin));
    if (!isAdmin && $('.view.active')?.id === 'view-admin') Nav.go('dashboard');
  },

  bind() {
    const form = $("#login-form");

    try {
      window.localStorage.removeItem(AUTH_KEYS.legacySession);
      window.sessionStorage.removeItem(AUTH_KEYS.legacySession);
    } catch {}

    $("#login-close")?.addEventListener("click", () => this.closeAuthPanel());
    $("#switch-to-register")?.addEventListener("click", () => this.openRegister());
    $("#switch-to-login")?.addEventListener("click", () => this.openLogin());

    const saved = this._loadSession();
    if (saved) {
      this._loginSuccess(saved, { silent: true });
    } else {
      Landing.show();
    }

    if (!form || form.dataset.bound) return;
    form.dataset.bound = "1";

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = $("#inp-email")?.value.trim() || "";
      const pw = $("#inp-pw")?.value || "";
      const remember = $("#remember")?.checked === true;
      this._clearErrors();

      let ok = true;
      if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        this._setError("#err-email", "#inp-email", "Email không hợp lệ");
        ok = false;
      }
      if (!pw) {
        this._setError("#err-pw", "#inp-pw", "Mật khẩu bắt buộc");
        ok = false;
      }
      if (!ok) return;

      const btn = $("#login-btn");
      btn?.classList.add("loading");
      if (btn) btn.disabled = true;

      try {
        const data = await API.post("/auth/login", { email, password: pw }, { skipAuth: true, skipRefresh: true });
        const user = this._normalizeUser(data.user || data);
        TokenStore.save({ ...data, user }, remember);
        this._loginSuccess(user);
      } catch (err) {
        this._handleLoginError(err);
      } finally {
        btn?.classList.remove("loading");
        if (btn) btn.disabled = false;
      }
    });

    const regForm = $("#register-form");
    if (regForm && !regForm.dataset.bound) {
      regForm.dataset.bound = "1";
      regForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        await this.register();
      });
    }

    $("#pw-toggle")?.addEventListener("click", () => {
      const inp = $("#inp-pw");
      inp.type = inp.type === "password" ? "text" : "password";
    });
  },

  openLogin(message = "") {
    $("#page-login")?.classList.remove("hidden");
    $("#login-form")?.classList.remove("hidden");
    $("#register-form")?.classList.add("hidden");
    const title = $("#auth-panel-title");
    const sub = $("#auth-panel-sub");
    if (title) title.textContent = "Đăng nhập";
    if (sub) sub.textContent = message || "Đăng nhập để vào dashboard quản lý tuyến, bản đồ, review và dữ liệu cá nhân.";
  },

  openRegister() {
    $("#page-login")?.classList.remove("hidden");
    $("#login-form")?.classList.add("hidden");
    $("#register-form")?.classList.remove("hidden");
    const title = $("#auth-panel-title");
    const sub = $("#auth-panel-sub");
    if (title) title.textContent = "Đăng ký tài khoản";
    if (sub) sub.textContent = "Tạo tài khoản để lưu tuyến, địa điểm yêu thích, review và lịch sử chatbot.";
  },

  closeAuthPanel() {
    $("#page-login")?.classList.add("hidden");
    if (!State.user) Landing.show();
  },

  async register() {
    const fullName = $("#reg-name")?.value.trim() || "SmartBus User";
    const email = $("#reg-email")?.value.trim() || "";
    const password = $("#reg-pw")?.value || "";
    const btn = $("#register-btn");
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) { Toast.show("Email đăng ký không hợp lệ", "error"); return; }
    if (password.length < 6) { Toast.show("Mật khẩu phải có tối thiểu 6 ký tự", "error"); return; }
    btn?.classList.add("loading");
    if (btn) btn.disabled = true;
    try {
      const data = await API.post("/auth/register", { fullName, email, password }, { skipAuth: true, skipRefresh: true });
      const user = this._normalizeUser(data.user || data);
      TokenStore.save({ ...data, user }, true);
      this._loginSuccess(user);
      Toast.show("Đăng ký thành công và đã đăng nhập", "success");
    } catch (err) {
      Toast.show(err?.message || "Không đăng ký được tài khoản", "error", 4200);
    } finally {
      btn?.classList.remove("loading");
      if (btn) btn.disabled = false;
    }
  },

  _normalizeUser(raw = {}) {
    const role = String(raw.role || "user").toLowerCase();
    const name = raw.fullName || raw.name || raw.email || "SmartBus User";
    return {
      ...raw,
      role,
      name,
      roleLabel: this.ROLE_LABELS[role] || "Người dùng",
    };
  },

  _loginSuccess(user, options = {}) {
    const normalized = this._normalizeUser(user);
    State.user = normalized;
    Landing.hide();
    $("#page-login")?.classList.add("hidden");
    $("#app")?.classList.remove("hidden");
    document.body.classList.add("app-active");
    const el = (id) => $(id);
    if (el("#sb-username")) el("#sb-username").textContent = normalized.name;
    if (el(".sb-urole")) el(".sb-urole").textContent = normalized.roleLabel;
    this._syncRoleUI(normalized);
    App.start();
    if (!options.silent) Toast.show(`Chào mừng, ${normalized.name}! 🚌`, "success");
  },

  _handleLoginError(err) {
    const firstError = Array.isArray(err?.errors) ? err.errors[0] : null;
    const field = firstError?.path || firstError?.param;
    const msg = firstError?.msg || err?.message || "Sai thông tin đăng nhập";

    if (field === "email") {
      this._setError("#err-email", "#inp-email", msg || "Email không hợp lệ");
      return;
    }
    if (field === "password") {
      this._setError("#err-pw", "#inp-pw", msg || "Mật khẩu bắt buộc");
      return;
    }

    if (err?.code === "NETWORK") {
      const message = "Không kết nối được backend hoặc backend chưa chạy";
      this._setError("#err-pw", "#inp-pw", message);
      Toast.show(message, "error", 4500);
      return;
    }

    if (err?.status === 401) {
      this._setError("#err-pw", "#inp-pw", "Sai thông tin đăng nhập");
      Toast.show("Sai thông tin đăng nhập", "error");
      return;
    }

    this._setError("#err-pw", "#inp-pw", msg);
    Toast.show(msg, "error", 4500);
  },

  _setError(errSel, inpSel, msg) {
    const err = $(errSel);
    if (err) err.textContent = msg;
    $(inpSel)?.classList.add("err");
  },

  _clearErrors() {
    $$(".fg-inp.err").forEach((el) => el.classList.remove("err"));
    ["#err-email", "#err-pw"].forEach((s) => {
      const el = $(s);
      if (el) el.textContent = "";
    });
  },

  _loadSession() {
    const user = TokenStore.getUser();
    const accessToken = TokenStore.getAccessToken();
    if (!user || !accessToken) return null;
    return this._normalizeUser(user);
  },

  async logout() {
    const refreshToken = TokenStore.getRefreshToken();
    try {
      if (refreshToken) await API.post("/auth/logout", { refreshToken }, { skipRefresh: true });
    } catch (_err) {}
    this.forceLogout("Đã đăng xuất", "info");
  },

  forceLogout(message = "Đã đăng xuất", type = "info") {
    TokenStore.clear();
    State.user = null;
    App.stop?.();
    $("#app")?.classList.add("hidden");
    $("#page-login")?.classList.add("hidden");
    $("#login-form")?.reset();
    $("#register-form")?.reset();
    document.body.classList.remove("app-active");
    this._syncRoleUI(null);
    Landing.show();
    this._clearErrors();
    Toast.show(message, type, 2500);
  },
};

/* ----------------------------------------------------------
   15. NAVIGATION
---------------------------------------------------------- */
const Nav = {
  VIEWS: {
    dashboard: "Bản đồ thực",
    buses: "Danh sách xe buýt",
    "nearby-stops": "Bến gần tôi",
    tourism: "Địa điểm du lịch",
    trip: "Gợi ý lịch trình",
    reviews: "Cộng đồng review",
    "favorite-routes": "Tuyến yêu thích",
    "favorite-places": "Địa điểm yêu thích",
    "chat-history": "Lịch sử chat",
    admin: "Quản trị nội dung",
    report: "Gửi báo cáo",
    analytics: "Thống kê & Phân tích",
  },
  ICONS: {
    dashboard: `<polygon points="3 11 22 2 13 21 11 13 3 11"/>`,
    buses: `<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>`,
    report: `<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>`,
    analytics: `<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>`,
  },

  go(view) {
    if (view === "admin" && !Auth.isAdmin()) {
      Toast.show("Bạn không có quyền truy cập chức năng quản trị nội dung.", "warning", 3500);
      view = "dashboard";
    }
    $$(".view").forEach((v) => v.classList.remove("active"));
    $(`#view-${view}`)?.classList.add("active");
    $$(".sb-link[data-view]").forEach((l) =>
      l.classList.toggle("active", l.dataset.view === view),
    );
    const title = $("#tb-title");
    if (title) title.textContent = this.VIEWS[view] || "DanaBus";
    const icon = $("#tb-icon-path");
    if (icon) icon.innerHTML = this.ICONS[view] || "";
    if (view === "dashboard") MapModule.invalidate();
    if (view === "analytics") AnalyticsUI.render();
    if (view === "buses") BusTableUI.render();
    if (view === "nearby-stops") TravelUI.renderNearestStop();
    if (view === "tourism") TravelUI.renderPlaces();
    if (view === "trip") TravelUI.renderTripIntro();
    if (view === "reviews") TravelUI.renderCommunity();
    if (view === "favorite-routes") TravelUI.renderFavoriteRoutes();
    if (view === "favorite-places") TravelUI.renderFavoritePlaces();
    if (view === "chat-history") TravelUI.renderChatHistory();
    if (view === "admin") TravelUI.renderAdmin();
    this._closeSidebar();
  },

  bind() {
    $$(".sb-link[data-view]").forEach((link) =>
      link.addEventListener("click", () => this.go(link.dataset.view)),
    );
    $("#menu-btn")?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this._toggleSidebar();
    });
    $("#overlay")?.addEventListener("click", () => this._closeSidebar());
    $("#overlay")?.addEventListener("touchstart", () => this._closeSidebar(), { passive: true });
    $("#sidebar")?.addEventListener("click", (event) => event.stopPropagation());
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && document.body.classList.contains("sidebar-open")) this._closeSidebar();
    });
    window.addEventListener("resize", () => {
      if (window.innerWidth > 768 && document.body.classList.contains("sidebar-open")) this._closeSidebar();
    });
    $("#logout-btn")?.addEventListener("click", () => Auth.logout());
  },

  _closeChatbotForMenu() {
    $("#chat-panel")?.classList.add("hidden");
    document.body.classList.remove("chat-open", "chatbot-open");
  },

  _toggleSidebar() {
    if (document.body.classList.contains("sidebar-open") || $("#sidebar")?.classList.contains("open")) this._closeSidebar();
    else this._openSidebar();
  },

  _setMenuButtonState(isOpen) {
    const btn = $("#menu-btn");
    if (!btn) return;
    btn.classList.toggle("is-open", Boolean(isOpen));
    btn.setAttribute("aria-expanded", String(Boolean(isOpen)));
    btn.setAttribute("aria-label", isOpen ? "Thu menu" : "Mở menu");
    btn.innerHTML = isOpen
      ? `<span class="mobile-menu-x" aria-hidden="true">×</span>`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`;
  },

  _openSidebar() {
    this._closeChatbotForMenu();
    $("#sidebar")?.classList.add("open", "active", "is-open");
    $("#overlay")?.classList.add("show", "open", "active", "is-open");
    document.body.classList.add("sidebar-open");
    document.body.style.overflow = "hidden";
    this._setMenuButtonState(true);
    window.safeInvalidateSmartBusMap?.(250);
  },
  _closeSidebar() {
    $("#sidebar")?.classList.remove("open", "active", "is-open");
    $("#overlay")?.classList.remove("show", "open", "active", "is-open");
    document.body.classList.remove("sidebar-open", "menu-open");
    document.body.style.overflow = "";
    this._setMenuButtonState(false);
    window.safeInvalidateSmartBusMap?.(250);
  },
};

/* ----------------------------------------------------------
   16. REPORT FORM
---------------------------------------------------------- */
const ReportForm = {
  _reports: [],

  init() {
    try {
      this._reports = JSON.parse(
        localStorage.getItem("danabus_reports") || "[]",
      );
    } catch {}
    this._populateRoutes();
    this._restoreHistory();
    this._bindEvents();
  },

  _populateRoutes() {
    const sel = $("#rf-route");
    if (!sel) return;
    sel.innerHTML =
      `<option value="">-- Chọn tuyến --</option>` +
      ROUTES.map(
        (r) => `<option value="${r.id}">Tuyến ${routeLabel(r)} – ${r.name}</option>`,
      ).join("");
  },

  _bindEvents() {
    const form = $("#report-form");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const route = $("#rf-route")?.value;
      const plate = $("#rf-plate")?.value.trim();
      const crowding = form.querySelector(
        "input[name='crowding']:checked",
      )?.value;
      const note = $("#rf-note")?.value.trim();
      let ok = true;
      $("#rf-err-route") && ($("#rf-err-route").textContent = "");
      $("#rf-err-crowd") && ($("#rf-err-crowd").textContent = "");
      if (!route) {
        if ($("#rf-err-route"))
          $("#rf-err-route").textContent = "Vui lòng chọn tuyến";
        ok = false;
      }
      if (!crowding) {
        if ($("#rf-err-crowd"))
          $("#rf-err-crowd").textContent = "Vui lòng chọn tình trạng";
        ok = false;
      }
      if (!ok) return;

      const btn = $("#rf-submit");
      btn?.classList.add("loading");
      await new Promise((r) => setTimeout(r, 700));
      btn?.classList.remove("loading");

      const rep = {
        time: Schedule.formatTime(),
        route,
        plate: plate || "—",
        crowding,
        note: note || "—",
      };
      this._reports.unshift(rep);
      try {
        localStorage.setItem(
          "danabus_reports",
          JSON.stringify(this._reports.slice(0, 50)),
        );
      } catch {}
      this._addToHistory(rep);

      State.activityLog.unshift({
        text: `Báo cáo: Tuyến ${route} – ${CROWDING[crowding]?.label}`,
        time: Schedule.formatTime(),
        color: routeById(route)?.color || "var(--teal)",
      });
      Toast.show(`Báo cáo tuyến ${route} đã được gửi ✓`, "success", 4000);
      form.reset();
      if ($("#char-n")) $("#char-n").textContent = "0";
      $$(".crowd-opt").forEach((o) =>
        o.classList.remove("sel-quiet", "sel-moderate", "sel-busy"),
      );
    });

    // Char counter
    $("#rf-note")?.addEventListener("input", (e) => {
      if ($("#char-n")) $("#char-n").textContent = e.target.value.length;
    });

    // Crowd selector highlight
    $$(".crowd-opt input").forEach((inp) =>
      inp.addEventListener("change", () => {
        $$(".crowd-opt").forEach((o) =>
          o.classList.remove("sel-quiet", "sel-moderate", "sel-busy"),
        );
        inp.closest(".crowd-opt")?.classList.add(`sel-${inp.value}`);
      }),
    );
  },

  _restoreHistory() {
    const tbody = $("#report-history-body");
    if (!tbody || !this._reports.length) return;
    tbody.innerHTML = "";
    this._reports.slice(0, 10).forEach((r) => this._addToHistory(r, false));
  },

  _addToHistory(rep, prepend = true) {
    const tbody = $("#report-history-body");
    if (!tbody) return;
    if (tbody.querySelector("[data-empty]")) tbody.innerHTML = "";
    const c = CROWDING[rep.crowding];
    const row = document.createElement("tr");
    row.innerHTML = `
      <td class="mono small">${rep.time}</td>
      <td style="font-weight:600;color:${routeById(rep.route)?.color || "var(--teal)"}">T.${routeLabel(rep.route)}</td>
      <td><span class="bc-badge ${c?.badgeClass || ""}">${c?.label || rep.crowding}</span></td>
      <td class="small txt2">${rep.note}</td>`;
    if (prepend && tbody.firstChild) tbody.insertBefore(row, tbody.firstChild);
    else tbody.appendChild(row);
  },
};

/* ----------------------------------------------------------
   17. SEARCH & FILTER BAR
---------------------------------------------------------- */
const SearchFilter = {
  bind() {
    const refresh = () => { this._refresh(); window.safeInvalidateSmartBusMap?.(180); };

    $("#search-inp")?.addEventListener("input", (e) => {
      State.searchQuery = e.target.value.trim();
      refresh();
    });

    $$(".fpill[data-f]").forEach((btn) =>
      btn.addEventListener("click", () => {
        State.filterCrowding = btn.dataset.f;
        $$(".fpill[data-f]").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        refresh();
      }),
    );

    $("#gis-province-filter")?.addEventListener("change", async (e) => {
      const province = e.target.value || CONFIG.DEFAULT_PROVINCE;
      State.mapFilters.province = province;
      State.mapFilters.routeId = "";
      State.mapFilters.routes = "all";
      const routeMode = $("#gis-route-mode"); if (routeMode) routeMode.value = "all";
      Toast.show(`Đang tải dữ liệu ${provinceMeta(province).name}...`, "info", 1200);
      await DynamicData.load(province);
      const meta = provinceMeta(province);
      MapModule.invalidate();
      MapModule.redrawRoutes();
      startRoadGeometryLoader();
      MapModule.updateMarkers(State.buses);
      refresh();
      Toast.show(`Đã tải dữ liệu ${meta.name}`, "success", 1800);
    });

    $("#gis-route-filter")?.addEventListener("change", (e) => {
      State.mapFilters.routeId = e.target.value;
      if (State.mapFilters.routeId && State.mapFilters.routes === "selected") MapModule.highlightRoute(State.mapFilters.routeId);
      else MapModule.redrawRoutes();
      startRoadGeometryLoader();
      refresh();
    });

    $("#gis-bus-filter")?.addEventListener("change", (e) => {
      State.mapFilters.buses = e.target.value || "all";
      if (State.mapFilters.buses === "nearby" && !State.userLocation) {
        Toast.show("Bấm Định vị GPS trước để lọc xe gần bạn", "warning", 3500);
      }
      refresh();
    });

    $("#gis-route-mode")?.addEventListener("change", (e) => {
      State.mapFilters.routes = e.target.value || "all";
      if (State.mapFilters.routes === "selected" && State.mapFilters.routeId) MapModule.highlightRoute(State.mapFilters.routeId);
      else if (State.mapFilters.routes === "selected" && !State.mapFilters.routeId) { Toast.show("Vui lòng chọn một tuyến để hiển thị", "warning", 3000); MapModule.redrawRoutes(); }
      else MapModule.redrawRoutes();
      refresh();
    });

    $("#gis-show-stops")?.addEventListener("change", (e) => {
      State.mapFilters.stops = e.target.checked;
      MapModule.drawStops();
    });

    $("#gis-show-labels")?.addEventListener("change", (e) => {
      State.mapFilters.labels = e.target.checked;
      State.mapFilters.showStopLabels = e.target.checked;
      MapModule.drawStops();
      Toast.show(e.target.checked ? "Đã bật tên bến khi zoom gần" : "Đã ẩn toàn bộ tên bến", "info", 1800);
    });

    $("#gis-gps-btn")?.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const gps = await SmartBusGeo.get({
        showToast: true,
        timeoutMs: 15000,
        buttons: [$("#gis-gps-btn")],
        allowCache: false,
        onSuccess: () => refresh(),
      });
      if (!gps) {
        Toast.show("Không lấy được GPS. Hãy bật quyền Location cho trình duyệt rồi thử lại.", "warning", 4500);
      }
    });

    $("#refresh-btn")?.addEventListener("click", () => {
      if (State.systemStatus !== "active") {
        Toast.show("Hệ thống ngoài giờ hoạt động (06:30–18:00)", "warning");
        return;
      }
      tickSimulation();
      refresh();
      Toast.show("Đã làm mới dữ liệu xe buýt", "success", 2000);
    });
  },
  _refresh() {
    BusListUI.render();
    BusTableUI.render();
    MapModule.updateMarkers(State.buses);
    MapModule.drawStops?.();
    StatsUI.render?.();
  },
};
/* ----------------------------------------------------------
   18. SMARTBUS TRAVEL CONNECT UI – Tourism, Review, Trip
---------------------------------------------------------- */
const TravelUI = {
  gps: null,
  _placesLoaded: false,

  init() {
    this._populateProvinceFilter();
    this._populateRouteFilter();
    this._bindTourism();
    this._bindTrip();
    this._bindCommunity();
  },

  _populateProvinceFilter() {
    const sel = $("#place-province");
    if (!sel) return;
    sel.innerHTML = provinceOptionsHtml(true);
  },

  _populateRouteFilter() {
    const sel = $("#place-route");
    if (!sel) return;
    sel.innerHTML = `<option value="">Mọi tuyến bus</option>` + ROUTES.map((r) => `<option value="${r.id}">Tuyến ${routeLabel(r)} – ${this._esc(r.name)}</option>`).join("");
  },

  _bindTourism() {
    ["#place-search", "#place-province", "#place-category", "#place-route"].forEach((id) => {
      const el = $(id);
      if (!el || el.dataset.bound) return;
      el.dataset.bound = "1";
      el.addEventListener(id === "#place-search" ? "input" : "change", () => this._debouncedPlaces());
    });
    const nearBtn = $("#place-near-me");
    if (nearBtn && !nearBtn.dataset.bound) {
      nearBtn.dataset.bound = "1";
      nearBtn.addEventListener("click", async () => {
        await this._getGps(true);
        this.renderPlaces();
      });
    }
    const nearbyBtn = $("#nearby-gps-btn");
    if (nearbyBtn && !nearbyBtn.dataset.bound) {
      nearbyBtn.dataset.bound = "1";
      nearbyBtn.addEventListener("click", () => this.renderNearestStop(true));
    }
  },

  _bindTrip() {
    const form = $("#trip-form");
    if (!form || form.dataset.bound) return;
    form.dataset.bound = "1";
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      await this.generateTrip();
    });
  },

  _bindCommunity() {
    const refresh = $("#community-refresh");
    if (refresh && !refresh.dataset.bound) {
      refresh.dataset.bound = "1";
      refresh.addEventListener("click", () => this.renderCommunity());
    }
    const search = $("#community-search");
    if (search && !search.dataset.bound) {
      search.dataset.bound = "1";
      search.addEventListener("input", () => this._debouncedCommunity());
    }
    ["#community-province", "#community-category"].forEach((id) => {
      const el = $(id);
      if (el && !el.dataset.bound) { el.dataset.bound = "1"; el.addEventListener("change", () => this.renderCommunity()); }
    });
    const form = $("#community-review-form");
    if (form && !form.dataset.bound) {
      form.dataset.bound = "1";
      form.addEventListener("submit", (e) => this.submitCommunityReview(e));
    }
  },

  _debouncedPlaces: debounce(function () { TravelUI.renderPlaces(); }, 450),
  _debouncedCommunity: debounce(function () { TravelUI.renderCommunity(); }, 450),

  async _getGps(showToast = false) {
    if (this.gps) return this.gps;
    const gps = await SmartBusGeo.get({
      showToast,
      timeoutMs: 15000,
      buttons: [$("#place-near-me"), $("#nearby-gps-btn")],
      allowCache: true,
    });
    this.gps = gps;
    return gps;
  },

  async renderNearestStop(forceGps = false) {
    const box = $("#nearby-stop-result");
    if (!box) return;
    box.innerHTML = this._loading("Đang tìm bến gần nhất...");
    const gps = forceGps ? await this._getGps(true) : this.gps || await this._getGps(false);
    if (!gps) {
      box.innerHTML = this._empty("Chưa có GPS. Hãy bấm “Lấy vị trí của tôi” hoặc cho phép trình duyệt truy cập vị trí.");
      return;
    }
    try {
      const data = await API.get(`/bus/stops/near?lat=${gps.lat}&lng=${gps.lng}&limit=5`);
      const stop = data.stop || data;
      MapModule.focusStop?.(stop);
      box.innerHTML = `<div class="travel-card wide"><div class="travel-kicker">Bến gần nhất</div><h4>${this._esc(stop.name)}</h4><p>${this._esc(stop.address || "")}</p><div class="travel-meta"><span>${data.distanceMeters || stop.distanceMeters}m</span><span>Đi bộ ${data.walkingMinutes || stop.walkingMinutes || "?"} phút</span>${data.route ? `<span>Tuyến ${data.route.id}</span>` : ""}</div></div>`;
    } catch (err) {
      box.innerHTML = this._empty("Backend chưa phản hồi. Bạn vẫn có thể hỏi chatbot: “Bến xe buýt gần tôi nhất ở đâu?”.");
    }
  },

  async renderPlaces() {
    const list = $("#place-list");
    const state = $("#place-state");
    if (!list) return;
    this._bindTourism();
    state && (state.innerHTML = "Đang tải địa điểm từ SQL Server qua Backend API...");
    list.innerHTML = this._loading("Đang tải địa điểm du lịch...");
    const qRaw = ($("#place-search")?.value || "").trim().toLowerCase();
    const provinceRaw = $("#place-province")?.value || "";
    const catRaw = $("#place-category")?.value || "";
    const routeRaw = $("#place-route")?.value || "";
    const gps = this.gps;
    const qs = [`q=${encodeURIComponent(qRaw)}`, `province=${encodeURIComponent(provinceRaw)}`, `category=${encodeURIComponent(catRaw)}`, `routeId=${encodeURIComponent(routeRaw)}`];
    if (gps) qs.push(`lat=${gps.lat}`, `lng=${gps.lng}`);
    let places = [];
    let source = "SQL Server";
    try {
      const data = await API.get(`/tourism/places?${qs.join("&")}`);
      places = Array.isArray(data) ? data : data.places || [];
    } catch (_err) {
      places = [];
      source = "SQL Server/API lỗi";
    }
    state && (state.innerHTML = `${source} · ${places.length} địa điểm phù hợp`);
    if (!places.length) { list.innerHTML = this._empty("Chưa có địa điểm phù hợp bộ lọc."); return; }
    list.innerHTML = places.map((p) => this._placeCard(p)).join("");
    $$("[data-place-chat]").forEach((btn) => btn.addEventListener("click", () => SmartBusAssistant.sendQuestion?.(`Tôi muốn đến ${btn.dataset.placeChat}`)));
    $$("[data-place-reviews]").forEach((btn) => btn.addEventListener("click", () => { $("#community-search") && ($("#community-search").value = btn.dataset.placeReviews); Nav.go("reviews"); }));
  },

  _filterLocalPlaces({ qRaw = "", provinceRaw = "", catRaw = "", routeRaw = "" } = {}) {
    return LOCAL_TOURISM_PLACES.filter((p) => {
      const text = this._norm(`${p.name} ${p.provinceName} ${p.description} ${p.nearestRouteCode || ""} ${p.categoryName || ""} ${p.foodSuggestions || ""}`);
      if (qRaw && !text.includes(this._norm(qRaw))) return false;
      if (provinceRaw && p.provinceCode !== provinceRaw) return false;
      if (catRaw && p.categoryCode !== catRaw && p.category !== catRaw) return false;
      if (routeRaw && !(String(p.nearestRouteCode || "").includes(routeRaw) || String(p.nearestRouteCode || "").includes(routeLabel(routeRaw)))) return false;
      return true;
    });
  },

  _norm(v) {
    return String(v || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");
  },

  _placeCard(p) {
    const route = p.recommendedRoute || p.nearestStop?.route || (p.nearestRouteCode ? { id: p.nearestRouteCode } : null);
    const stop = p.nearestStop?.stop || (p.nearestStopName ? { name: p.nearestStopName } : null);
    const distanceText = p.distanceMeters ? `${Math.round(p.distanceMeters / 100) / 10} km` : (p.nearestDistanceKm ? `${p.nearestDistanceKm} km tới hub/trạm` : "");
    const walkText = p.nearestStop?.walkingMinutes || p.walkingMinutes;
    return `<article class="travel-card">
      <div class="travel-kicker">${this._esc(p.categoryName || p.category || "Du lịch")}</div>
      <h4>${this._esc(p.name)}</h4>
      <p>${this._esc(p.description || "")}</p>
      <div class="travel-meta"><span>⭐ ${p.averageRating || 0}</span><span>${p.reviewCount || 0} review</span>${distanceText ? `<span>${this._esc(distanceText)}</span>` : ""}</div>
      <div class="travel-meta">${route ? `<span>Bus ${this._esc(route.id || route.routeCode || route)}</span>` : ""}${stop ? `<span>Bến/hub: ${this._esc(stop.name)}</span>` : ""}${walkText ? `<span>Đi bộ/chuyển tiếp ${this._esc(walkText)} phút</span>` : ""}</div>
      ${(p.foodSuggestions || p.bestTime) ? `<p class="travel-small">${this._esc(p.bestTime || "")} ${p.foodSuggestions ? ` · Ẩm thực: ${this._esc(p.foodSuggestions)}` : ""}</p>` : ""}
      <div class="travel-actions"><button class="btn-ghost" data-place-chat="${this._esc(p.name)}">Hỏi chatbot</button><button class="btn-ghost" data-place-reviews="${this._esc(p.name)}">Xem review</button><button class="btn-ghost" data-place-map="${this._esc(p.id)}">Hiện trên bản đồ</button><button class="btn-ghost" data-place-fav="${this._esc(p.id)}">🔖 Lưu địa điểm</button></div>
    </article>`;
  },

  renderTripIntro() {
    this._bindTrip();
    const box = $("#trip-result");
    if (box && !box.innerHTML.trim()) box.innerHTML = this._empty("Chọn thời gian, sở thích rồi bấm “Tạo lịch trình”.");
  },

  async generateTrip() {
    const box = $("#trip-result");
    if (!box) return;
    box.innerHTML = this._loading("Đang tạo lịch trình...");
    const gps = this.gps || await this._getGps(false);
    const body = {
      timeAvailable: $("#trip-time")?.value || "1 buổi",
      interests: ($("#trip-interests")?.value || "").split(",").map((x) => x.trim()).filter(Boolean),
      budget: $("#trip-budget")?.value || "low",
      lat: gps?.lat ?? null,
      lng: gps?.lng ?? null,
    };
    try {
      const plan = await API.post("/trip-plans/generate", body);
      const items = plan.items || [];
      box.innerHTML = `<div class="travel-card wide"><div class="travel-kicker">${this._esc(plan.title || "Lịch trình")}</div><h4>${this._esc(plan.summary || "Gợi ý từ SmartBus")}</h4><div class="travel-actions"><button class="btn-ghost" onclick="Nav.go('dashboard')">Hiện lịch trình trên bản đồ</button><button class="btn-ghost" onclick="SmartBusAssistant.sendQuestion('Hỏi thêm về lịch trình này')">Hỏi chatbot về lịch trình này</button></div></div>` + items.map((it, i) => `<div class="travel-card"><div class="travel-kicker">${this._esc(it.timeBlock || `Buổi ${i + 1}`)} · ${this._esc(it.suggestedStart || "")}</div><h4>${this._esc(it.name)}</h4><p>${this._esc(it.description || "")}</p><div class="travel-meta"><span>Ở lại ${it.suggestedDurationMinutes || 90} phút</span>${it.busRoute ? `<span>Bus ${it.busRoute.id || it.busRoute.routeCode}</span>` : ""}${it.walkingMinutes ? `<span>Đi bộ ${it.walkingMinutes} phút</span>` : ""}</div><p class="travel-small">${this._esc(it.practicalNote || "Sắp xếp để di chuyển hợp lý, không nhồi quá nhiều điểm.")}</p></div>`).join("");
    } catch (err) {
      box.innerHTML = this._empty("Không tạo được lịch trình từ backend. Hãy kiểm tra backend-api hoặc thử lại.");
    }
  },

  async renderCommunity() {
    const box = $("#community-list");
    if (!box) return;
    this._bindCommunity();
    box.innerHTML = this._loading("Đang tải review cộng đồng...");
    const q = encodeURIComponent($("#community-search")?.value || "");
    const province = encodeURIComponent($("#community-province")?.value || "");
    const category = encodeURIComponent($("#community-category")?.value || "");
    try {
      const posts = await API.get(`/reviews?q=${q}&province=${province}&category=${category}`, { skipAuth: true });
      if (!posts.length) { box.innerHTML = this._empty("Chưa có bài review phù hợp."); return; }
      box.innerHTML = posts.map((p) => `<article class="travel-card"><div class="travel-kicker">${this._esc(p.category || "Review")} ${p.isSeed ? "· Bài gợi ý từ SmartBus" : "· Người dùng"}</div><h4>${this._esc(p.title)}</h4><p>${this._esc(p.shortCaption || p.content || "")}</p><div class="travel-meta"><span>⭐ ${this._esc(p.rating || 0)}/5</span><span>${this._esc(p.province || "")}</span><span>${this._esc(p.placeName || "")}</span></div><div class="travel-actions"><button class="btn-ghost" data-review-detail="${this._esc(p.id)}">Xem chi tiết</button><button class="btn-ghost" data-review-chat="${this._esc(p.placeName || p.title)}">Hỏi chatbot</button></div></article>`).join("");
      $$('[data-review-chat]').forEach((btn) => btn.addEventListener('click', () => SmartBusAssistant.sendQuestion?.(`Địa điểm ${btn.dataset.reviewChat} có tuyến bus hoặc review gì?`)));
      $$('[data-review-detail]').forEach((btn) => btn.addEventListener('click', async () => this.showReviewDetail(btn.dataset.reviewDetail)));
    } catch (err) {
      box.innerHTML = this._empty("Chưa kết nối được backend review API hoặc chưa chạy migration community_reviews.");
    }
  },

  async submitCommunityReview(e) {
    e.preventDefault();
    if (!TokenStore.getAccessToken()) { Auth.showLogin?.("Bạn cần đăng nhập trước khi đăng review."); return; }
    const body = {
      title: $("#review-title")?.value.trim(),
      placeName: $("#review-place")?.value.trim(),
      province: $("#review-province")?.value,
      category: $("#review-category")?.value,
      rating: Number($("#review-rating")?.value || 5),
      tags: $("#review-tags")?.value.trim(),
      content: $("#review-content")?.value.trim(),
      tips: $("#review-tips")?.value.trim(),
      imageUrl: $("#review-image")?.value.trim(),
    };
    if (!body.title || !body.placeName || !body.content || body.content.length < 30) { Toast.show("Tiêu đề, địa điểm và nội dung tối thiểu 30 ký tự là bắt buộc", "warning", 3500); return; }
    try {
      const created = await API.post('/reviews', body);
      Toast.show(created?.status === 'pending' ? 'Đã gửi bài review và chờ Admin duyệt.' : 'Đã đăng bài review thành công', 'success', 2500);
      e.target.reset();
      this.renderCommunity();
    } catch (err) { Toast.show(err.message || 'Không đăng được review', 'error', 3500); }
  },

  async showReviewDetail(id) {
    try {
      const p = await API.get(`/reviews/${id}`, { skipAuth: true });
      Toast.show(`${p.title}: ${p.tips || p.shortCaption || 'Đã mở chi tiết review.'}`, 'info', 6000);
    } catch { Toast.show('Không tải được chi tiết review', 'error'); }
  },

  async toggleFavoriteRoute(routeId, add = true) {
    if (!TokenStore.getAccessToken()) { Auth.showLogin?.("Bạn cần đăng nhập để lưu tuyến yêu thích."); return; }
    try {
      if (add) await API.post('/favorite-routes', { routeId }); else await API.request(`/favorite-routes/${encodeURIComponent(routeId)}`, { method: 'DELETE' });
      Toast.show(add ? 'Đã lưu tuyến yêu thích' : 'Đã bỏ lưu tuyến', 'success', 2200);
      if ($('.view.active')?.id === 'view-favorite-routes') this.renderFavoriteRoutes();
    } catch (err) { Toast.show(err.message || 'Không thao tác được tuyến yêu thích', 'error'); }
  },

  async toggleFavoritePlace(placeId, add = true) {
    if (!TokenStore.getAccessToken()) { Auth.showLogin?.("Bạn cần đăng nhập để lưu địa điểm yêu thích."); return; }
    try {
      if (add) await API.post('/favorite-places', { placeId }); else await API.request(`/favorite-places/${encodeURIComponent(placeId)}`, { method: 'DELETE' });
      Toast.show(add ? 'Đã lưu địa điểm yêu thích' : 'Đã bỏ lưu địa điểm', 'success', 2200);
      if ($('.view.active')?.id === 'view-favorite-places') this.renderFavoritePlaces();
    } catch (err) { Toast.show(err.message || 'Không thao tác được địa điểm yêu thích', 'error'); }
  },

  async _fetchPlace(placeId) {
    try { return await API.get(`/tourism/places/${placeId}`, { skipAuth: true }); } catch { return null; }
  },

  async renderFavoriteRoutes() {
    const box = $("#favorite-routes-list");
    if (!box) return;
    box.innerHTML = this._loading("Đang tải tuyến yêu thích...");
    try {
      const routes = await API.get("/favorite-routes");
      if (!routes.length) { box.innerHTML = this._empty("Bạn chưa lưu tuyến nào. Vào Danh sách xe để bấm “Lưu tuyến”."); return; }
      box.innerHTML = routes.map((r) => `<div class="travel-card"><div class="travel-kicker">Tuyến ${this._esc(routeLabel(r))} · ${this._esc(r.provinceName || r.provinceCode || '')}</div><h4>${this._esc(r.name || 'Tuyến không còn tồn tại')}</h4><p>${this._esc(r.originName || 'Điểm đầu')} → ${this._esc(r.destinationName || 'Điểm cuối')}</p><div class="travel-meta"><span>${this._esc(r.time || '')}</span><span>Xe hoạt động: ${this._esc(r.activeBusCount || r.vehicleCount || 0)}</span></div><div class="travel-actions"><button class="btn-ghost" data-fav-route-map="${this._esc(r.id)}">Xem trên bản đồ</button><button class="btn-ghost" data-fav-route-remove="${this._esc(r.id)}">Bỏ yêu thích</button></div></div>`).join("");
      $$('[data-fav-route-map]').forEach((btn) => btn.addEventListener('click', () => { Nav.go('dashboard'); setTimeout(() => MapModule.highlightRoute(btn.dataset.favRouteMap), 250); }));
      $$('[data-fav-route-remove]').forEach((btn) => btn.addEventListener('click', () => this.toggleFavoriteRoute(btn.dataset.favRouteRemove, false)));
    } catch (_err) { box.innerHTML = this._empty("Bạn cần đăng nhập hoặc chạy migration favorites_routes để xem tuyến yêu thích."); }
  },
  async renderFavoritePlaces() {
    const box = $("#favorite-places-list");
    if (!box) return;
    box.innerHTML = this._loading("Đang tải địa điểm yêu thích...");
    try {
      const places = await API.get("/favorite-places");
      if (!places.length) { box.innerHTML = this._empty("Bạn chưa lưu địa điểm nào. Vào trang Địa điểm du lịch để bấm “Lưu địa điểm”."); return; }
      box.innerHTML = places.map((p) => `<div class="travel-card"><div class="travel-kicker">${this._esc(p.categoryName || p.category || 'Du lịch')} · ${this._esc(p.provinceName || p.provinceCode || '')}</div><h4>${this._esc(p.name || 'Địa điểm không còn tồn tại')}</h4><p>${this._esc(p.shortDescription || p.description || '')}</p><div class="travel-meta"><span>⭐ ${this._esc(p.averageRating || 0)}</span><span>${this._esc(p.reviewCount || 0)} review</span></div><div class="travel-actions"><button class="btn-ghost" data-fav-place-map="${this._esc(p.id)}">Xem trên bản đồ</button><button class="btn-ghost" data-fav-place-chat="${this._esc(p.name)}">Hỏi chatbot</button><button class="btn-ghost" data-fav-place-remove="${this._esc(p.id)}">Bỏ yêu thích</button></div></div>`).join("");
      $$('[data-fav-place-map]').forEach((btn) => btn.addEventListener('click', async () => { const p = await this._fetchPlace(btn.dataset.favPlaceMap); if (p) { Nav.go('dashboard'); setTimeout(() => MapModule.focusPlace?.(p), 250); } }));
      $$('[data-fav-place-chat]').forEach((btn) => btn.addEventListener('click', () => SmartBusAssistant.sendQuestion?.(`Từ vị trí của tôi đến ${btn.dataset.favPlaceChat} đi tuyến nào?`)));
      $$('[data-fav-place-remove]').forEach((btn) => btn.addEventListener('click', () => this.toggleFavoritePlace(btn.dataset.favPlaceRemove, false)));
    } catch (_err) { box.innerHTML = this._empty("Bạn cần đăng nhập hoặc chạy migration favorites_places để xem địa điểm yêu thích."); }
  },
  async renderChatHistory() {
    const box = $("#chat-history-list");
    if (!box) return;
    box.innerHTML = this._loading("Đang tải lịch sử chat...");
    try {
      const rows = await API.get("/chat/history");
      if (!rows.length) { box.innerHTML = this._empty("Chưa có lịch sử chat."); return; }
      box.innerHTML = rows.slice(0, 20).map((r) => `<div class="travel-card"><div class="travel-kicker">${this._esc(r.createdAt ? new Date(r.createdAt).toLocaleString('vi-VN') : '')} · ${this._esc(r.intent || "chat")}</div><h4>${this._esc(r.message)}</h4><p>${this._esc(r.reply || r.botResponse || '')}</p><div class="travel-actions">${r.relatedPlaceId ? `<button class="btn-ghost" data-history-review="${this._esc(r.relatedPlaceName || '')}">Xem review cộng đồng</button>` : ''}${r.relatedRouteId ? `<button class="btn-ghost" data-history-route="${this._esc(r.relatedRouteId)}">Xem tuyến</button>` : ''}</div></div>`).join("");
      $$('[data-history-review]').forEach((btn) => btn.addEventListener('click', () => { $('#community-search') && ($('#community-search').value = btn.dataset.historyReview); Nav.go('reviews'); }));
      $$('[data-history-route]').forEach((btn) => btn.addEventListener('click', () => { Nav.go('dashboard'); setTimeout(() => MapModule.highlightRoute(btn.dataset.historyRoute), 250); }));
    } catch { box.innerHTML = this._empty("Bạn cần đăng nhập để xem lịch sử chat cá nhân."); }
  },
  _adminTab: "reviews",
  _adminReviews: [],
  _adminPosts: [],
  _adminPlaces: [],

  async renderAdmin() {
    const box = $("#admin-panel");
    if (!box) return;
    if (!Auth.isAdmin()) {
      box.innerHTML = `<div class="travel-card wide empty-state"><h4>Bạn không có quyền truy cập chức năng quản trị nội dung.</h4><p>Chức năng này chỉ dành cho tài khoản Admin.</p></div>`;
      return;
    }
    box.classList.add("admin-panel");
    box.innerHTML = `
      <div class="travel-card wide admin-shell">
        <div class="admin-toolbar">
          <div>
            <div class="travel-kicker">Khu vực Admin</div>
            <h4>Quản trị nội dung SmartBus</h4>
            <p>Duyệt review cộng đồng, duyệt bài cộng đồng và quản lý địa điểm du lịch.</p>
          </div>
          <button class="btn-ghost" id="admin-refresh-btn">Làm mới dữ liệu</button>
        </div>
        <div class="admin-tabs" role="tablist">
          <button class="admin-tab" data-admin-tab="reviews">Duyệt review cộng đồng</button>
          <button class="admin-tab" data-admin-tab="community">Duyệt bài cộng đồng</button>
          <button class="admin-tab" data-admin-tab="places">Quản lý địa điểm du lịch</button>
        </div>
        <div id="admin-content" class="admin-content"></div>
      </div>`;
    this._bindAdminShell();
    await this._switchAdminTab(this._adminTab || "reviews");
  },

  _bindAdminShell() {
    $$("[data-admin-tab]").forEach((btn) => btn.addEventListener("click", () => this._switchAdminTab(btn.dataset.adminTab)));
    $("#admin-refresh-btn")?.addEventListener("click", () => this._switchAdminTab(this._adminTab));
  },

  async _switchAdminTab(tab) {
    this._adminTab = tab || "reviews";
    $$("[data-admin-tab]").forEach((btn) => btn.classList.toggle("active", btn.dataset.adminTab === this._adminTab));
    if (this._adminTab === "reviews") return this._renderAdminReviews();
    if (this._adminTab === "community") return this._renderAdminCommunity();
    return this._renderAdminPlaces();
  },

  _adminContent() {
    return $("#admin-content");
  },

  async _renderAdminReviews() {
    const box = this._adminContent();
    if (!box) return;
    box.innerHTML = this._loading("Đang tải review cộng đồng...");
    const q = encodeURIComponent($("#admin-review-q")?.value || "");
    const province = encodeURIComponent($("#admin-review-province")?.value || "");
    const category = encodeURIComponent($("#admin-review-category")?.value || "");
    const status = encodeURIComponent($("#admin-review-status")?.value || "pending");
    const sort = encodeURIComponent($("#admin-review-sort")?.value || "newest");
    try {
      const rows = await API.get(`/admin/reviews?q=${q}&province=${province}&category=${category}&status=${status}&sort=${sort}`);
      this._adminReviews = Array.isArray(rows) ? rows : [];
      box.innerHTML = `
        <div class="admin-filters">
          <input id="admin-review-q" class="travel-input" placeholder="Tìm tiêu đề, địa điểm, người đăng..." value="${this._esc(decodeURIComponent(q))}" />
          <select id="admin-review-province" class="travel-input"><option value="">Tất cả tỉnh</option>${this._provinceOptions(decodeURIComponent(province))}</select>
          <input id="admin-review-category" class="travel-input" placeholder="Lọc category" value="${this._esc(decodeURIComponent(category))}" />
          <select id="admin-review-status" class="travel-input"><option value="pending">Chờ duyệt</option><option value="approved">Đã duyệt</option><option value="approved_seed">Bài mẫu</option><option value="hidden">Đã ẩn</option><option value="all">Tất cả</option></select>
          <select id="admin-review-sort" class="travel-input"><option value="newest">Mới nhất</option><option value="oldest">Cũ nhất</option><option value="rating_desc">Rating cao</option></select>
          <button class="btn-primary mini" id="admin-review-filter-btn">Lọc</button>
        </div>
        ${this._adminReviews.length ? this._reviewTable(this._adminReviews) : this._empty("Hiện chưa có review nào chờ duyệt hoặc phù hợp bộ lọc.")}`;
      this._setSelectValue("#admin-review-status", decodeURIComponent(status));
      this._setSelectValue("#admin-review-sort", decodeURIComponent(sort));
      $("#admin-review-filter-btn")?.addEventListener("click", () => this._renderAdminReviews());
      ["#admin-review-q", "#admin-review-category"].forEach((sel) => $(sel)?.addEventListener("keydown", (e) => { if (e.key === "Enter") this._renderAdminReviews(); }));
      this._bindAdminReviewActions();
    } catch (err) {
      box.innerHTML = this._adminError(err, "Không tải được dữ liệu quản trị review. Vui lòng thử lại.");
    }
  },

  _reviewTable(rows) {
    return `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>ID</th><th>Tiêu đề</th><th>Người đăng</th><th>Địa điểm</th><th>Tỉnh/khu vực</th><th>Nhóm</th><th>Rating</th><th>Trạng thái</th><th>Thời gian</th><th>Thao tác</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${this._esc(r.id)}</td><td>${this._esc(r.title || "")}</td><td>${this._esc(r.authorName || "")}</td><td>${this._esc(r.placeName || "")}</td><td>${this._esc(r.province || "")}</td><td>${this._esc(r.category || "")}</td><td>⭐ ${this._esc(r.rating || 0)}</td><td>${this._statusBadge(r.status, r.isSeed)}</td><td>${this._date(r.createdAt)}</td><td><div class="admin-actions"><button class="btn-ghost mini" data-admin-review-detail="${this._esc(r.id)}">Xem</button><button class="btn-ghost mini" data-admin-review-approve="${this._esc(r.id)}">Duyệt</button><button class="btn-ghost mini" data-admin-review-hide="${this._esc(r.id)}">Ẩn</button><button class="btn-ghost mini danger" data-admin-review-delete="${this._esc(r.id)}">Xóa</button></div></td></tr>`).join("")}</tbody></table></div>`;
  },

  _bindAdminReviewActions() {
    $$('[data-admin-review-detail]').forEach((btn) => btn.addEventListener('click', () => this._showReviewAdminDetail(btn.dataset.adminReviewDetail)));
    $$('[data-admin-review-approve]').forEach((btn) => btn.addEventListener('click', () => this._adminReviewStatus(btn.dataset.adminReviewApprove, 'approve')));
    $$('[data-admin-review-hide]').forEach((btn) => btn.addEventListener('click', () => this._adminReviewStatus(btn.dataset.adminReviewHide, 'hide')));
    $$('[data-admin-review-delete]').forEach((btn) => btn.addEventListener('click', () => this._adminDeleteReview(btn.dataset.adminReviewDelete)));
  },

  _showReviewAdminDetail(id) {
    const r = this._adminReviews.find((x) => String(x.id) === String(id));
    if (!r) return Toast.show('Không tìm thấy review', 'error');
    this._showModal('Chi tiết review cộng đồng', `<div class="admin-detail"><h3>${this._esc(r.title)}</h3><p><b>Người đăng:</b> ${this._esc(r.authorName)} · <b>Địa điểm:</b> ${this._esc(r.placeName)}</p><p><b>Tỉnh:</b> ${this._esc(r.province)} · <b>Nhóm:</b> ${this._esc(r.category)} · <b>Rating:</b> ${this._esc(r.rating)}/5</p>${r.imageUrl ? `<img class="admin-detail-img" src="${this._esc(r.imageUrl)}" alt="Ảnh review">` : ''}<p><b>Nội dung:</b></p><p>${this._esc(r.content || '')}</p><p><b>Tips:</b> ${this._esc(r.tips || '')}</p><p><b>Tags:</b> ${this._esc(r.tags || '')}</p><p><b>Trạng thái:</b> ${this._esc(r.status)} ${r.isSeed ? '· Bài seed/demo' : ''}</p><p><b>Tạo lúc:</b> ${this._date(r.createdAt)}</p></div>`);
  },

  async _adminReviewStatus(id, action) {
    const path = action === 'approve' ? `/admin/reviews/${id}/approve` : `/admin/reviews/${id}/hide`;
    try {
      await API.request(path, { method: 'PUT' });
      Toast.show(action === 'approve' ? 'Đã duyệt review thành công' : 'Đã ẩn review', 'success');
      await this._renderAdminReviews();
    } catch (err) { this._handleAdminError(err, 'Thao tác thất bại, vui lòng thử lại'); }
  },

  async _adminDeleteReview(id) {
    const r = this._adminReviews.find((x) => String(x.id) === String(id));
    const message = r?.isSeed ? 'Đây là bài mẫu seed/demo. Bạn có chắc muốn ẩn hoặc xóa không?' : 'Bạn có chắc muốn xóa/ẩn review này không?';
    const ok = await this._confirmModal('Xác nhận xóa review', message);
    if (!ok) return;
    try {
      await API.request(`/admin/reviews/${id}`, { method: 'DELETE' });
      Toast.show('Đã xóa review', 'success');
      await this._renderAdminReviews();
    } catch (err) { this._handleAdminError(err, 'Thao tác thất bại, vui lòng thử lại'); }
  },

  async _renderAdminCommunity() {
    const box = this._adminContent();
    if (!box) return;
    box.innerHTML = this._loading('Đang tải bài cộng đồng chờ duyệt...');
    try {
      const rows = await API.get('/admin/community/pending');
      this._adminPosts = Array.isArray(rows) ? rows : [];
      box.innerHTML = this._adminPosts.length ? `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>ID</th><th>Tiêu đề</th><th>Người gửi</th><th>Loại</th><th>Trạng thái</th><th>Thời gian</th><th>Thao tác</th></tr></thead><tbody>${this._adminPosts.map((p) => `<tr><td>${this._esc(p.id)}</td><td>${this._esc(p.title || p.content || '')}</td><td>${this._esc(p.userName || '')}</td><td>${this._esc(p.topic || 'community')}</td><td>${this._statusBadge(p.status)}</td><td>${this._date(p.createdAt)}</td><td><div class="admin-actions"><button class="btn-ghost mini" data-admin-post-detail="${this._esc(p.id)}">Xem</button><button class="btn-ghost mini" data-admin-post-approve="${this._esc(p.id)}">Duyệt</button><button class="btn-ghost mini" data-admin-post-hide="${this._esc(p.id)}">Ẩn</button><button class="btn-ghost mini danger" data-admin-post-delete="${this._esc(p.id)}">Xóa</button></div></td></tr>`).join('')}</tbody></table></div>` : this._empty('Hiện chưa có bài cộng đồng nào chờ duyệt.');
      this._bindAdminPostActions();
    } catch (err) {
      box.innerHTML = this._adminError(err, 'Không tải được dữ liệu bài cộng đồng. Vui lòng thử lại.');
    }
  },

  _bindAdminPostActions() {
    $$('[data-admin-post-detail]').forEach((btn) => btn.addEventListener('click', () => this._showPostAdminDetail(btn.dataset.adminPostDetail)));
    $$('[data-admin-post-approve]').forEach((btn) => btn.addEventListener('click', () => this._adminPostStatus(btn.dataset.adminPostApprove, 'approve')));
    $$('[data-admin-post-hide]').forEach((btn) => btn.addEventListener('click', () => this._adminPostStatus(btn.dataset.adminPostHide, 'hide')));
    $$('[data-admin-post-delete]').forEach((btn) => btn.addEventListener('click', () => this._adminDeletePost(btn.dataset.adminPostDelete)));
  },

  _showPostAdminDetail(id) {
    const p = this._adminPosts.find((x) => String(x.id) === String(id));
    if (!p) return Toast.show('Không tìm thấy bài cộng đồng', 'error');
    this._showModal('Chi tiết bài cộng đồng', `<div class="admin-detail"><h3>${this._esc(p.title)}</h3><p><b>Người gửi:</b> ${this._esc(p.userName)} · <b>Loại:</b> ${this._esc(p.topic || '')}</p><p><b>Nội dung:</b></p><p>${this._esc(p.content || '')}</p><p><b>Tuyến:</b> ${this._esc(p.routeId || '')} · <b>Địa điểm ID:</b> ${this._esc(p.placeId || '')}</p><p><b>Trạng thái:</b> ${this._esc(p.status)} · <b>Tạo lúc:</b> ${this._date(p.createdAt)}</p></div>`);
  },

  async _adminPostStatus(id, action) {
    const path = action === 'approve' ? `/admin/community/${id}/approve` : `/admin/community/${id}/hide`;
    try {
      await API.request(path, { method: 'PUT' });
      Toast.show(action === 'approve' ? 'Đã duyệt bài cộng đồng' : 'Đã ẩn bài cộng đồng', 'success');
      await this._renderAdminCommunity();
    } catch (err) { this._handleAdminError(err, 'Thao tác thất bại, vui lòng thử lại'); }
  },

  async _adminDeletePost(id) {
    const ok = await this._confirmModal('Xác nhận xóa bài', 'Bạn có chắc muốn xóa/ẩn bài cộng đồng này không?');
    if (!ok) return;
    try {
      await API.request(`/admin/community/${id}`, { method: 'DELETE' });
      Toast.show('Đã xóa/ẩn bài cộng đồng', 'success');
      await this._renderAdminCommunity();
    } catch (err) { this._handleAdminError(err, 'Thao tác thất bại, vui lòng thử lại'); }
  },

  async _renderAdminPlaces() {
    const box = this._adminContent();
    if (!box) return;
    box.innerHTML = this._loading('Đang tải địa điểm du lịch...');
    try {
      const rows = await API.get('/admin/places?includeInactive=true');
      const q = (this._adminPlaceQ || '').toLowerCase();
      this._adminPlaces = Array.isArray(rows) ? rows : [];
      const shown = q ? this._adminPlaces.filter((p) => `${p.name} ${p.provinceCode} ${p.categoryName} ${p.tags || ''}`.toLowerCase().includes(q)) : this._adminPlaces;
      box.innerHTML = `<div class="admin-filters"><input id="admin-place-q" class="travel-input" placeholder="Tìm địa điểm, tỉnh, category..." value="${this._esc(this._adminPlaceQ || '')}" /><button class="btn-primary mini" id="admin-place-add">Thêm địa điểm</button></div>${shown.length ? this._placeAdminTable(shown) : this._empty('Chưa có địa điểm du lịch nào.')}`;
      $('#admin-place-q')?.addEventListener('input', debounce((e) => { this._adminPlaceQ = e.target.value; this._renderAdminPlaces(); }, 350));
      $('#admin-place-add')?.addEventListener('click', () => this._openPlaceForm());
      this._bindAdminPlaceActions();
    } catch (err) {
      box.innerHTML = this._adminError(err, 'Không tải được dữ liệu địa điểm. Vui lòng thử lại.');
    }
  },

  _placeAdminTable(rows) {
    return `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>ID</th><th>Tên địa điểm</th><th>Tỉnh/khu vực</th><th>Category</th><th>Latitude</th><th>Longitude</th><th>Trạng thái</th><th>Tags</th><th>Thao tác</th></tr></thead><tbody>${rows.map((p) => `<tr><td>${this._esc(p.id)}</td><td>${this._esc(p.name || '')}</td><td>${this._esc(p.provinceName || p.provinceCode || '')}</td><td>${this._esc(p.categoryName || p.category || '')}</td><td>${this._esc(p.latitude ?? '')}</td><td>${this._esc(p.longitude ?? '')}</td><td>${this._statusBadge(p.isActive ? 'active' : 'inactive')}</td><td>${this._esc(p.tags || '')}</td><td><div class="admin-actions"><button class="btn-ghost mini" data-admin-place-detail="${this._esc(p.id)}">Xem</button><button class="btn-ghost mini" data-admin-place-edit="${this._esc(p.id)}">Sửa</button>${p.isActive ? `<button class="btn-ghost mini danger" data-admin-place-delete="${this._esc(p.id)}">Ẩn</button>` : `<button class="btn-ghost mini" data-admin-place-activate="${this._esc(p.id)}">Kích hoạt</button>`}</div></td></tr>`).join('')}</tbody></table></div>`;
  },

  _bindAdminPlaceActions() {
    $$('[data-admin-place-detail]').forEach((btn) => btn.addEventListener('click', () => this._showPlaceAdminDetail(btn.dataset.adminPlaceDetail)));
    $$('[data-admin-place-edit]').forEach((btn) => btn.addEventListener('click', () => this._openPlaceForm(this._adminPlaces.find((p) => String(p.id) === String(btn.dataset.adminPlaceEdit)))));
    $$('[data-admin-place-delete]').forEach((btn) => btn.addEventListener('click', () => this._adminDeletePlace(btn.dataset.adminPlaceDelete)));
    $$('[data-admin-place-activate]').forEach((btn) => btn.addEventListener('click', () => this._adminActivatePlace(btn.dataset.adminPlaceActivate)));
  },

  _showPlaceAdminDetail(id) {
    const p = this._adminPlaces.find((x) => String(x.id) === String(id));
    if (!p) return Toast.show('Không tìm thấy địa điểm', 'error');
    this._showModal('Chi tiết địa điểm du lịch', `<div class="admin-detail"><h3>${this._esc(p.name)}</h3><p><b>Tỉnh:</b> ${this._esc(p.provinceName || p.provinceCode || '')} · <b>Nhóm:</b> ${this._esc(p.categoryName || p.category || '')}</p><p><b>Tọa độ:</b> ${this._esc(p.latitude)}, ${this._esc(p.longitude)}</p><p><b>Mô tả:</b></p><p>${this._esc(p.description || '')}</p><p><b>Tips:</b> ${this._esc(p.tips || p.nearbySuggestions || '')}</p><p><b>Thời điểm nên đi:</b> ${this._esc(p.bestTime || '')}</p><p><b>Tags:</b> ${this._esc(p.tags || '')}</p><p><b>Trạng thái:</b> ${p.isActive ? 'Đang hoạt động' : 'Đã ẩn'}</p></div>`);
  },

  _openPlaceForm(place = null) {
    const isEdit = Boolean(place?.id);
    const html = `<form id="admin-place-form" class="admin-form">
      <div class="review-form-grid">
        <input class="travel-input" name="name" placeholder="Tên địa điểm *" value="${this._esc(place?.name || '')}" required />
        <select class="travel-input" name="provinceCode"><option value="DN">Đà Nẵng</option><option value="QN_CU">Quảng Nam cũ / Hội An</option><option value="HUE">Huế</option><option value="QT">Quảng Trị</option><option value="QNG">Quảng Ngãi</option></select>
        <input class="travel-input" name="category" placeholder="Category *" value="${this._esc(place?.categoryName || place?.category || '')}" required />
        <input class="travel-input" name="latitude" placeholder="Latitude *" value="${this._esc(place?.latitude ?? '')}" required />
        <input class="travel-input" name="longitude" placeholder="Longitude *" value="${this._esc(place?.longitude ?? '')}" required />
        <input class="travel-input" name="imageUrl" placeholder="URL ảnh nếu có" value="${this._esc(place?.thumbnailUrl || place?.imageUrl || '')}" />
      </div>
      <textarea class="travel-input" name="description" rows="3" placeholder="Mô tả">${this._esc(place?.description || '')}</textarea>
      <textarea class="travel-input" name="tips" rows="2" placeholder="Tips/gợi ý">${this._esc(place?.tips || place?.nearbySuggestions || '')}</textarea>
      <input class="travel-input" name="bestTime" placeholder="Thời điểm nên đi" value="${this._esc(place?.bestTime || '')}" />
      <input class="travel-input" name="tags" placeholder="Tags, phân tách bằng dấu phẩy" value="${this._esc(place?.tags || '')}" />
      <label class="admin-check"><input type="checkbox" name="isActive" ${place?.isActive === false ? '' : 'checked'} /> Địa điểm đang hoạt động</label>
      <button class="btn-primary mini" type="submit">${isEdit ? 'Cập nhật địa điểm' : 'Thêm địa điểm'}</button>
    </form>`;
    this._showModal(isEdit ? 'Sửa địa điểm' : 'Thêm địa điểm', html, (modal) => {
      const provinceSelect = modal.querySelector('[name="provinceCode"]');
      if (provinceSelect) provinceSelect.value = place?.provinceCode || 'DN';
      modal.querySelector('#admin-place-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const body = Object.fromEntries(fd.entries());
        body.latitude = Number(body.latitude);
        body.longitude = Number(body.longitude);
        body.isActive = e.target.elements.isActive.checked;
        if (!body.name || !body.category || !Number.isFinite(body.latitude) || body.latitude < -90 || body.latitude > 90 || !Number.isFinite(body.longitude) || body.longitude < -180 || body.longitude > 180) {
          Toast.show('Tên, category và tọa độ hợp lệ là bắt buộc', 'warning');
          return;
        }
        if (body.imageUrl && !/^https?:\/\//i.test(body.imageUrl)) {
          Toast.show('Image URL phải bắt đầu bằng http:// hoặc https://', 'warning');
          return;
        }
        try {
          if (isEdit) await API.request(`/admin/places/${place.id}`, { method: 'PUT', body: JSON.stringify(body) });
          else await API.post('/admin/places', body);
          Toast.show(isEdit ? 'Đã cập nhật địa điểm' : 'Đã thêm địa điểm', 'success');
          this._closeModal();
          await this._renderAdminPlaces();
        } catch (err) { this._handleAdminError(err, 'Không lưu được địa điểm'); }
      });
    });
  },

  async _adminDeletePlace(id) {
    const ok = await this._confirmModal('Xác nhận ẩn địa điểm', 'Bạn có chắc muốn ẩn/xóa mềm địa điểm này không?');
    if (!ok) return;
    try {
      await API.request(`/admin/places/${id}`, { method: 'DELETE' });
      Toast.show('Đã ẩn địa điểm', 'success');
      await this._renderAdminPlaces();
    } catch (err) { this._handleAdminError(err, 'Không ẩn được địa điểm'); }
  },

  async _adminActivatePlace(id) {
    const p = this._adminPlaces.find((x) => String(x.id) === String(id));
    if (!p) return;
    try {
      await API.request(`/admin/places/${id}`, { method: 'PUT', body: JSON.stringify({ ...p, provinceCode: p.provinceCode || 'DN', category: p.categoryName || p.category || 'Du lịch', imageUrl: p.thumbnailUrl || p.imageUrl || '', isActive: true }) });
      Toast.show('Đã kích hoạt lại địa điểm', 'success');
      await this._renderAdminPlaces();
    } catch (err) { this._handleAdminError(err, 'Không kích hoạt được địa điểm'); }
  },

  _provinceOptions(selected = '') {
    return CONFIG.PROVINCES.map((p) => `<option value="${this._esc(p.name)}" ${selected === p.name ? 'selected' : ''}>${this._esc(p.name)}</option>`).join('');
  },

  _setSelectValue(selector, value) {
    const el = $(selector);
    if (el) el.value = value;
  },

  _statusBadge(status, isSeed = false) {
    const s = String(status || '').toLowerCase();
    const label = { pending: 'Chờ duyệt', approved: 'Đã duyệt', approved_seed: 'Bài mẫu', hidden: 'Đã ẩn', active: 'Đang hoạt động', inactive: 'Đã ẩn' }[s] || status || 'Không rõ';
    return `<span class="admin-status admin-status-${this._esc(s || 'unknown')}">${this._esc(label)}${isSeed ? ' · Seed' : ''}</span>`;
  },

  _date(value) {
    if (!value) return '';
    try { return new Date(value).toLocaleString('vi-VN'); } catch { return String(value); }
  },

  _adminError(err, fallback) {
    const msg = err?.status === 401 ? 'Bạn cần đăng nhập để sử dụng chức năng này.' : err?.status === 403 ? 'Bạn không có quyền quản trị nội dung.' : (err?.message || fallback);
    return `<div class="travel-card wide empty-state"><h4>${this._esc(fallback)}</h4><p>${this._esc(msg)}</p></div>`;
  },

  _handleAdminError(err, fallback) {
    if (err?.status === 401) return Auth.forceLogout('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 'warning');
    if (err?.status === 403) return Toast.show('Bạn không có quyền quản trị nội dung.', 'error', 4000);
    Toast.show(err?.message || fallback, 'error', 4000);
  },

  _showModal(title, html, onMount) {
    this._closeModal();
    const el = document.createElement('div');
    el.className = 'admin-modal-backdrop';
    el.innerHTML = `<div class="admin-modal"><div class="admin-modal-head"><h3>${this._esc(title)}</h3><button class="btn-ghost mini" data-admin-modal-close>Đóng</button></div><div class="admin-modal-body">${html}</div></div>`;
    document.body.appendChild(el);
    el.addEventListener('click', (e) => { if (e.target === el || e.target.closest('[data-admin-modal-close]')) this._closeModal(); });
    if (typeof onMount === 'function') onMount(el);
    return el;
  },

  _closeModal() {
    document.querySelector('.admin-modal-backdrop')?.remove();
  },

  _confirmModal(title, message) {
    return new Promise((resolve) => {
      this._showModal(title, `<p>${this._esc(message)}</p><div class="admin-confirm-actions"><button class="btn-ghost" data-confirm-no>Hủy</button><button class="btn-primary mini" data-confirm-yes>Đồng ý</button></div>`, (modal) => {
        modal.querySelector('[data-confirm-no]')?.addEventListener('click', () => { this._closeModal(); resolve(false); });
        modal.querySelector('[data-confirm-yes]')?.addEventListener('click', () => { this._closeModal(); resolve(true); });
      });
    });
  },

  _loading(text) { return `<div class="travel-card wide skeleton">${this._esc(text)}</div>`; },
  _empty(text) { return `<div class="travel-card wide empty-state">${this._esc(text)}</div>`; },
  _esc(v) { return String(v ?? "").replace(/[&<>\"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;" })[c]); },
};

/* ----------------------------------------------------------
   19. ACTIVITY LOG GENERATOR
---------------------------------------------------------- */
const ActivityLog = {
  TEMPLATES: [
    (b) => `Xe ${b.plate} tuyến ${b.routeId}: ${CROWDING[b.crowding]?.label}`,
    (b) => `Tuyến ${b.routeId} – ${b.passengers} hành khách trên ${b.plate}`,
    (b) => `Cập nhật vị trí xe ${b.plate}`,
    (b) =>
      `Tuyến ${b.routeId} đang ${b.status === "resting" ? "nghỉ đầu/cuối tuyến" : "vận hành"}`,
  ],

  push() {
    if (State.buses.length === 0) return;
    const bus = pick(State.buses);
    const tmpl = pick(this.TEMPLATES);
    State.activityLog.unshift({
      text: tmpl(bus),
      time: Schedule.formatTime(),
      color: routeById(bus.routeId)?.color || "var(--teal)",
    });
    if (State.activityLog.length > 30) State.activityLog.pop();
  },
};

/* ----------------------------------------------------------
   19. APP BOOTSTRAP
---------------------------------------------------------- */
const App = {
  _started: false,
  _simTimer: null,
  _schedTimer: null,

  async start() {
    if (this._started) {
      MapModule.invalidate();
      this._updateAll();
      return;
    }
    this._started = true;

    // 1. Ưu tiên tải dữ liệu thật từ SQL Server; fallback chỉ dùng khi backend chưa chạy.
    State.mapFilters.province = State.mapFilters.province || CONFIG.DEFAULT_PROVINCE;
    const loadedSql = await DynamicData.load(State.mapFilters.province);
    if (!State.buses.length) State.buses = createBuses().filter((b) => routeById(b.routeId)?.provinceCode === State.mapFilters.province).slice(0, CONFIG.BUS_LIMIT_PER_PROVINCE);

    // 2. Khởi tạo bản đồ GIS.
    MapModule.init();

    // 3. Vẽ ngay bằng GPS, sau đó tự bẻ toàn bộ tuyến theo đường thực tế OSRM và cache lại.
    MapModule.redrawRoutes();
    MapModule.updateMarkers(State.buses);
    MapModule.drawStops();
    startRoadGeometryLoader();

    // 4. Legend
    LegendUI.render();

    // 5. Populate report dropdown + travel modules
    ReportForm.init();
    TravelUI.init();

    // 6. First render
    this._updateAll();

    // 7. Start simulation loop
    this._startLoop();

    // 8. Kiểm tra lịch mỗi 30 giây (bắt đúng mốc chuyển)
    if (!this._schedTimer) this._schedTimer = setInterval(() => this._checkSchedule(), 30000);
  },

  _startLoop() {
    if (this._simTimer) clearInterval(this._simTimer);
    this._simTimer = setInterval(() => {
      State.systemStatus = Schedule.getStatus();
      ScheduleUI.show(State.systemStatus);

      if (State.systemStatus !== "active") {
        StatsUI.update();
        return;
      }

      tickSimulation();
      State.tickCount++;

      if (State.tickCount % 8 === 0) ActivityLog.push();

      this._updateAll();
    }, CONFIG.TICK_MS);
  },


  stop() {
    this._started = false;
    if (this._simTimer) {
      clearInterval(this._simTimer);
      this._simTimer = null;
    }
    if (this._schedTimer) {
      clearInterval(this._schedTimer);
      this._schedTimer = null;
    }
    if (ScheduleUI._clockTimer) {
      clearInterval(ScheduleUI._clockTimer);
      ScheduleUI._clockTimer = null;
    }
    State.tickCount = 0;
    State.selectedBusId = null;
  },
  _checkSchedule() {
    const newStatus = Schedule.getStatus();
    if (newStatus !== State.systemStatus) {
      State.systemStatus = newStatus;
      ScheduleUI.show(newStatus);
      if (newStatus === "active") {
        Toast.show("Hệ thống đã bắt đầu hoạt động! 🚌", "success");
      } else if (newStatus === "lunch") {
        Toast.show("Giờ nghỉ trưa 12:00–13:00 🍜", "info");
      } else {
        Toast.show("Hệ thống đã kết thúc hoạt động 🌙", "info");
      }
    }
  },

  _updateAll() {
    ScheduleUI.show(State.systemStatus);
    StatsUI.update();
    BusListUI.render();
    MapModule.updateMarkers(State.buses);
    MapModule.drawStops();

    // Chỉ re-render view đang active
    const activeView = $(".view.active")?.id;
    if (activeView === "view-buses") BusTableUI.render();
    if (activeView === "view-analytics") AnalyticsUI.render();
  },
};

/* ----------------------------------------------------------
   20. EVENT BINDINGS
---------------------------------------------------------- */
Events.on("bus:select", (uid) => {
  State.selectedBusId = uid;
  MapModule.focusBus(uid);
  BusListUI.render(); // re-highlight card
  if ($(".view.active")?.id === "view-buses") BusTableUI.render();
});

/* ----------------------------------------------------------
   21. DOM READY
---------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  // Bind tất cả UI controls
  Landing.bind();
  Nav.bind();
  SearchFilter.bind();
  Auth.bind();

  // Init schedule overlay ngay khi trang load (trước cả login)
  State.systemStatus = Schedule.getStatus();
  ScheduleUI.show(State.systemStatus);
});

console.log("🚌 SMARTBUS v4.1 – Road-snapped GIS + route catalog + full tourism – Ready");


/* ----------------------------------------------------------
   22. SMARTBUS ASSISTANT – Frontend API + GPS
---------------------------------------------------------- */
const SmartBusAssistant = (() => {
  const API_BASE = window.SMARTBUS_API_BASE || "https://smartbus-backend-xr34.onrender.com/api/v1";
  let currentPosition = null;
  let busy = false;

  const els = () => ({
    panel: $("#chat-panel"),
    toggle: $("#chat-toggle"),
    close: $("#chat-close"),
    form: $("#chat-form"),
    input: $("#chat-input"),
    body: $("#chat-messages"),
    gpsBtn: $("#chat-gps-btn"),
    gpsStatus: $("#chat-gps-status"),
  });

  function bind() {
    const e = els();
    if (!e.panel || !e.toggle) return;
    e.toggle.addEventListener("click", () => {
      if (document.body.classList.contains("sidebar-open")) Nav._closeSidebar?.();
      if (e.panel.classList.contains("hidden")) open();
      else close();
    });
    e.close?.addEventListener("click", close);
    e.gpsBtn?.addEventListener("click", () => requestGPS(true));
    e.form?.addEventListener("submit", onSubmit);
    $$(".chat-suggestions button[data-q]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const input = els().input;
        if (input) input.value = btn.dataset.q || "";
        sendQuestion(btn.dataset.q || "");
      }),
    );
  }

  function addMessage(text, who = "bot", data = null) {
    const body = els().body;
    if (!body) return null;
    const msg = document.createElement("div");
    msg.className = `chat-msg ${who}`;
    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.innerHTML = sanitize(text).replace(/\n/g, "<br>");
    if (data) bubble.insertAdjacentHTML("beforeend", buildCard(data));
    msg.appendChild(bubble);
    body.appendChild(msg);
    body.scrollTop = body.scrollHeight;
    return msg;
  }

  function buildCard(data) {
    const route = data.route || null;
    const stop = data.nearestStop || null;
    if (!route && !stop && !data.fare && !data.cta && !data.suggestedPlaces?.length) return "";
    const rows = [];
    if (route) rows.push(["Tuyến", `T.${route.id || route.route_id} – ${route.name || route.route_name || ""}`]);
    if (stop) rows.push(["Bến gần nhất", stop.name || stop.stop_name || "Điểm đón gợi ý"]);
    if (Number.isFinite(Number(data.walkingMinutes))) rows.push(["Đi bộ", `${data.walkingMinutes} phút`]);
    if (Number.isFinite(Number(data.etaMinutes))) rows.push(["Xe đến", `${data.etaMinutes} phút`]);
    if (data.fare || route?.fare) rows.push(["Giá vé", data.fare || route.fare]);
    let extra = "";
    if (Array.isArray(data.suggestedPlaces) && data.suggestedPlaces.length) {
      extra += `<div class="chat-card-row"><span>Gợi ý</span><b>${data.suggestedPlaces.slice(0,3).map((p) => sanitize(p.name)).join(", ")}</b></div>`;
    }
    if (data.cta?.view) extra += `<button type="button" class="chat-cta" onclick="Nav.go('${sanitize(data.cta.view)}'); ${data.cta.routeId ? `setTimeout(function(){ MapModule.highlightRoute('${sanitize(data.cta.routeId)}'); }, 250);` : ''}">${sanitize(data.cta.label || "Mở trang")}</button>`;
    return `<div class="chat-card">${rows.map(([k,v]) => `<div class="chat-card-row"><span>${sanitize(k)}</span><b>${sanitize(v)}</b></div>`).join("")}${extra}</div>`;
  }

  function sanitize(v) {
    return String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  }

  async function onSubmit(ev) {
    ev.preventDefault();
    const input = els().input;
    const q = input?.value.trim();
    if (!q || busy) return;
    input.value = "";
    await sendQuestion(q);
  }

  function normText(v) {
    return String(v || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
  }

  function findProvinceFromText(text) {
    if (/quang tri|dong ha|vinh moc|cua tung|cua viet|la vang|hien luong/.test(text)) return "QT";
    if (/hue|thua thien|dai noi|dong ba|thien mu|khai dinh|tu duc|lang co/.test(text)) return "HUE";
    if (/da nang|danang|ba na|my khe|son tra|ngu hanh|cau rong|cho han|hai van/.test(text)) return "DN";
    if (/quang ngai|ly son|sa ky|sa huynh|son my|thien an|ba to|dung quat|van tuong/.test(text)) return "QNG";
    if (/quang nam|hoi an|chua cau|my son|cu lao cham|tam ky|vinwonders|cau mong|tra que|thanh ha|an bang|cua dai/.test(text)) return "QN_CU";
    return "";
  }

  function findRouteFromLocal(question) {
    const text = normText(question);
    const code = question.match(/\b(QT|HUE|DN|DNG|QNG|QN)\s*-?\s*(\d{1,2})(?:-?old|-?2025|-?tour)?\b/i);
    if (code) {
      const prefix = code[1].toUpperCase() === "DNG" ? "DN" : code[1].toUpperCase();
      const rid = `${prefix}-${String(code[2]).padStart(2, "0")}`;
      const exact = routeById(rid);
      if (exact) return exact;
    }
    const simple = question.match(/tuyến\s*(\d{1,2})|t\.?\s*(\d{1,2})/i);
    if (simple) {
      const n = String(simple[1] || simple[2]).padStart(2, "0");
      const province = findProvinceFromText(text);
      const byProvince = ROUTES.find((r) => r.provinceCode === province && String(r.id).endsWith(`-${n}`));
      if (byProvince) return byProvince;
      const any = ROUTES.find((r) => String(r.id).endsWith(`-${n}`));
      if (any) return any;
    }
    const rules = [
      [/hoi an|cua dai|viet han/, "DN-02"], [/ba na|cau vang|suoi mo/, "DN-03"], [/my khe|cong vien bien dong/, "DN-05"], [/cau rong|bao tang cham|san bay.*viet han/, "DN-06"], [/cho han|song han/, "DN-05"], [/hai van|khu cong nghe cao/, "DN-14"],
      [/vinh moc|cua tung|cua viet|con co/, "QT-03"], [/hien luong|ben hai|ho xa|vinh chap/, "QT-01"], [/thanh co|la vang|hai lang/, "QT-02"], [/khe sanh|ta con|lao bao/, "QT-01"],
      [/dai noi|kinh thanh|dong ba|truong tien/, "HUE-01"], [/thien mu|tu duc|khai dinh|thuy xuan|lang huong/, "HUE-05"], [/thuan an|vinh hien/, "HUE-03"], [/lang co|lap an|hai van/, "HUE-10"], [/a luoi/, "HUE-12"],
      [/ly son|sa ky|son my|my khe quang ngai/, "QNG-03"], [/sa huynh/, "QNG-02"], [/thien an|song tra/, "QNG-01"], [/ba to|ba vi/, "QNG-04"], [/dung quat|van tuong|doosan/, "QNG-05"], [/tra bong/, "QNG-08"],
    ];
    const found = rules.find(([rx]) => rx.test(text));
    if (found) return routeById(found[1]);
    return ROUTES.find((r) => normText(`${r.name} ${r.description} ${r.originName} ${r.destinationName} ${r.provinceName}`).includes(text) && text.length > 2) || null;
  }

  function searchLocalPlaces(question, route = null) {
    const text = normText(question);
    const province = findProvinceFromText(text);
    let places = LOCAL_TOURISM_PLACES.filter((p) => {
      const hay = normText(`${p.name} ${p.provinceName} ${p.description} ${p.categoryName} ${p.foodSuggestions} ${p.nearestRouteCode}`);
      if (route && String(p.nearestRouteCode || "").includes(route.id)) return true;
      if (province && p.provinceCode === province && /dia diem|du lich|di dau|noi tieng|check|bien|cho|chua|am thuc/.test(text)) return true;
      return text.split(/\s+/).filter((x) => x.length >= 3).some((w) => hay.includes(w));
    });
    if (/bien|tam bien/.test(text)) places = places.filter((p) => /beach|bien|dao|biển|đảo/i.test(`${p.categoryCode} ${p.categoryName}`));
    if (/cho|mua sam|am thuc/.test(text)) places = places.filter((p) => /shopping|food|chợ|ẩm thực/i.test(`${p.categoryCode} ${p.categoryName} ${p.name}`));
    if (/tam linh|chua|hanh huong/.test(text)) places = places.filter((p) => /spiritual|chùa|tâm linh|tôn giáo|lăng/i.test(`${p.categoryCode} ${p.categoryName} ${p.name}`));
    return places.slice(0, 5);
  }

  function nearestLocalStop(lat, lng, routeId = "") {
    const origin = [Number(lat), Number(lng)];
    if (!Number.isFinite(origin[0]) || !Number.isFinite(origin[1])) return null;
    const candidates = LOCAL_STOPS.filter((s) => !routeId || s.routeId === routeId || (s.routes || []).some((r) => r.id === routeId));
    return candidates
      .map((s) => ({ ...s, distanceMeters: Math.round(getDistanceMeters(origin, [Number(s.lat), Number(s.lng)])) }))
      .filter((s) => Number.isFinite(s.distanceMeters))
      .sort((a, b) => a.distanceMeters - b.distanceMeters)[0] || null;
  }

  function buildLocalAnswer(question, payload = {}) {
    const text = normText(question);
    const route = findRouteFromLocal(question);
    const places = searchLocalPlaces(question, route);
    const province = findProvinceFromText(text);
    const wantsStats = /bao nhieu|thong ke|tong so|co may/.test(text);
    if (wantsStats) {
      return { reply: `Dữ liệu chính nằm trong SQL Server. Hãy chạy API /api/v1/bus/routes, /api/v1/tourism/places và /api/v1/chatbot/ask để thống kê dữ liệu 5 khu vực.`, intent: "local_stats", suggestedPlaces: LOCAL_TOURISM_PLACES.slice(0, 3), cta: { label: "Mở bản đồ", view: "map" } };
    }
    if (/ben.*gan|gan.*ben|gan toi|gan tôi/.test(text) && payload.lat && payload.lng) {
      const stop = nearestLocalStop(payload.lat, payload.lng, route?.id);
      if (stop) {
        return { reply: `Bến/điểm GPS gần bạn nhất là ${stop.name} (${stop.provinceName}), cách khoảng ${stop.distanceMeters}m. Tuyến gợi ý: ${stop.routeDisplayCode || stop.routeId}.`, intent: "local_nearest_stop", route, nearestStop: stop, walkingMinutes: Math.max(1, Math.round(stop.distanceMeters / 80)), cta: { label: "Mở bản đồ", view: "map" } };
      }
    }
    if (/danh sach|cac tuyen|chuyen nao|tuyen nao/.test(text) && province) {
      const routes = ROUTES.filter((r) => r.provinceCode === province).slice(0, 8);
      return { reply: `${routes[0]?.provinceName || "Tỉnh này"} hiện có ${routes.length} tuyến trong dữ liệu SmartBus: ${routes.map((r) => `${r.id} (${r.originName} → ${r.destinationName}, ${r.time})`).join("; ")}.`, intent: "local_route_list", route: routes[0] || null, cta: { label: "Xem danh sách xe", view: "buses" } };
    }
    if (route) {
      const stop = payload.lat && payload.lng ? nearestLocalStop(payload.lat, payload.lng, route.id) : null;
      const routePlaces = places.length ? places : LOCAL_TOURISM_PLACES.filter((p) => String(p.nearestRouteCode || "").includes(route.id)).slice(0, 3);
      return { reply: `Bạn có thể đi tuyến ${route.id} – ${route.name}. Giờ chạy: ${route.time || "đang cập nhật"}, tần suất: ${route.interval || "đang cập nhật"}, cự ly khoảng ${route.distanceKm || "?"} km, tốc độ TB ${route.avgSpeedKmh || "?"} km/h. ${stop ? `Bến gần bạn: ${stop.name}, cách ${stop.distanceMeters}m.` : "Bật GPS để mình tìm bến gần bạn."} ${routePlaces.length ? `Điểm du lịch gần/gợi ý: ${routePlaces.map((p) => p.name).join(", ")}.` : ""}`, intent: "local_route", route, nearestStop: stop, suggestedPlaces: routePlaces, walkingMinutes: stop ? Math.max(1, Math.round(stop.distanceMeters / 80)) : null, etaMinutes: 8 + Math.floor(Math.random() * 12), fare: route.fare || "Đang cập nhật", cta: { label: "Xem tuyến trên bản đồ", view: "map" } };
    }
    if (places.length) {
      const first = places[0];
      const firstRoute = routeById(first.nearestRouteCode);
      return { reply: `Mình tìm thấy ${places.length} địa điểm phù hợp: ${places.map((p) => p.name).join(", ")}. Với ${first.name}, tuyến gợi ý là ${first.nearestRouteCode || "đang cập nhật"}, bến/hub gần: ${first.nearestStopName || "đang cập nhật"}, khoảng cách ${first.nearestDistanceKm || "?"} km. Thời điểm đẹp: ${first.bestTime || "theo mùa khô"}. Ẩm thực gợi ý: ${first.foodSuggestions || "đặc sản địa phương"}.`, intent: "local_tourism", route: firstRoute, suggestedPlaces: places, cta: { label: "Mở địa điểm du lịch", view: "tourism" } };
    }
    if (/an gi|mon ngon|dac san|am thuc|food/.test(text)) {
      const foodPlaces = searchLocalPlaces(question).filter((p) => p.foodSuggestions || /food|cho|am thuc|đặc sản|ẩm thực/i.test(`${p.categoryCode} ${p.categoryName} ${p.name}`));
      if (foodPlaces.length) {
        return { reply: `Về ăn uống, bạn có thể tham khảo ${foodPlaces.slice(0,3).map((p) => `${p.name}${p.foodSuggestions ? ` (${p.foodSuggestions})` : ""}`).join("; ")}. Hỏi thêm tên địa điểm cụ thể để mình gợi ý tuyến/bến gần hơn.`, intent: "local_food", suggestedPlaces: foodPlaces.slice(0,3), cta: { label: "Xem địa điểm du lịch", view: "tourism" } };
      }
    }
    if (/review|danh gia|nhan xet/.test(text)) {
      const reviewPlaces = searchLocalPlaces(question);
      return { reply: reviewPlaces.length ? `Mình tìm thấy địa điểm liên quan để xem review: ${reviewPlaces.slice(0,3).map((p) => p.name).join(", ")}. Bạn mở Cộng đồng review để xem bài mẫu và bài người dùng.` : `Mình chưa tìm thấy review đúng địa điểm. Bạn có thể hỏi rõ hơn như “Có review về Biển Mỹ Khê không?” hoặc “Review Lý Sơn thế nào?”.`, intent: "local_review", suggestedPlaces: reviewPlaces.slice(0,3), cta: { label: "Mở cộng đồng review", view: "reviews" } };
    }
    return { reply: `Mình chưa hiểu rõ ý bạn. Bạn có thể hỏi theo mẫu: “Tôi muốn đến Hội An”, “Bến gần tôi ở đâu?”, “Gợi ý lịch trình Đà Nẵng 1 ngày”, “Huế có gì chơi?” hoặc “Có review về Lý Sơn không?”.`, intent: "local_help", suggestions: ["Tôi muốn đến Hội An", "Đi Mỹ Khê bằng tuyến nào?", "Gợi ý lịch trình Đà Nẵng 1 ngày", "Có review về Lý Sơn không?"] };
  }

  async function sendQuestion(question) {
    const safeQuestion = String(question || "").trim();
    if (!safeQuestion || busy) return;
    if (safeQuestion.length > 1000) {
      Toast.show("Câu hỏi quá dài. Vui lòng rút gọn dưới 1000 ký tự.", "warning", 3500);
      return;
    }
    let payload = { message: safeQuestion, lat: null, lng: null };
    busy = true;
    addMessage(safeQuestion, "user");
    const typing = addMessage("Đang tìm gợi ý phù hợp...", "bot");
    typing?.classList.add("chat-typing");

    try {
      const pos = currentPosition || (await requestGPS(false, 1200));
      payload = {
        message: safeQuestion,
        lat: pos?.lat ?? null,
        lng: pos?.lng ?? null,
      };
      const res = await fetch(`${API_BASE}/chatbot/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      typing?.remove();
      addMessage(data.reply || "Tôi đã nhận câu hỏi của bạn.", "bot", data);
      applyMapResult(data, payload);
    } catch (err) {
      console.warn("SmartBus Assistant API error:", err?.message || err);
      typing?.remove();
      const local = buildLocalAnswer(safeQuestion, payload);
      addMessage(local.reply, "bot", local);
      applyMapResult(local, payload);
      Toast.show("Mình chưa kết nối được dữ liệu backend, đang dùng gợi ý dự phòng trên giao diện.", "warning", 3800);
    } finally {
      busy = false;
    }
  }

  function applyMapResult(data, payload) {
    const routeId = data?.route?.id || data?.route?.route_id || data?.routeId;
    if (routeId) MapModule.highlightRoute?.(routeId);
    if (payload?.lat && payload?.lng) MapModule.markUserLocation?.(payload.lat, payload.lng);
    if (data?.nearestStop) MapModule.focusStop?.(data.nearestStop);
  }

  async function requestGPS(showToast = false, timeoutMs = 15000) {
    const e = els();
    const gps = await SmartBusGeo.get({
      showToast,
      timeoutMs,
      statusEl: e.gpsStatus,
      buttons: [e.gpsBtn],
      allowCache: false,
    });
    if (gps) currentPosition = { lat: gps.lat, lng: gps.lng, accuracy: gps.accuracy };
    return currentPosition;
  }

  function close() {
    const e = els();
    e.panel?.classList.add("hidden");
    document.body.classList.remove("chat-open", "chatbot-open");
  }

  function open() {
    const e = els();
    if (document.body.classList.contains("sidebar-open")) Nav._closeSidebar?.();
    e.panel?.classList.remove("hidden");
    document.body.classList.add("chat-open");
    setTimeout(() => e.input?.focus(), 80);
  }

  function addBotHint(text) {
    open();
    addMessage(text, "bot");
  }

  return { bind, sendQuestion, requestGPS, open, addBotHint };
})();

document.addEventListener("DOMContentLoaded", () => {
  SmartBusAssistant.bind();
});
