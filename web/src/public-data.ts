import type { Envelope, Place, Route, Stop } from "./types";
declare global {
  interface Window {
    SMARTBUS_PUBLIC_SNAPSHOT?: boolean;
  }
}
export function isPublicSnapshot() {
  if (window.SMARTBUS_PUBLIC_SNAPSHOT !== undefined)
    return window.SMARTBUS_PUBLIC_SNAPSHOT;
  return (
    window.location.hostname.endsWith(".github.io") &&
    (!window.SMARTBUS_API_BASE || window.SMARTBUS_API_BASE === "/api/v1")
  );
}
interface Snapshot {
  version: string;
  routes: Route[];
  stops: (Stop & { provinceCode: string })[];
  places: Place[];
  provinces: { code: string; name: string }[];
  categories: { code: string; name: string }[];
  routeStops: Record<string, Stop[]>;
}
let cached: Promise<Snapshot> | undefined;
export class PublicDataError extends Error {
  constructor(
    message: string,
    public status = 503,
  ) {
    super(message);
  }
}
const normalize = (v: unknown) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase();
function haversine(a: number, b: number, c: number, d: number) {
  const k = Math.PI / 180,
    x =
      Math.sin(((c - a) * k) / 2) ** 2 +
      Math.cos(a * k) * Math.cos(c * k) * Math.sin(((d - b) * k) / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
export async function publicData<T>(
  requestPath: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal },
): Promise<Envelope<T>> {
  if (options.signal?.aborted) throw new DOMException("Đã hủy", "AbortError");
  const url = new URL(requestPath, "https://snapshot.invalid"),
    p = decodeURIComponent(url.pathname),
    q = url.searchParams;
  if (options.method && options.method !== "GET")
    throw new PublicDataError(
      "Bản công khai hỗ trợ xem bản đồ và mô phỏng. Đăng nhập, lưu hành trình và gửi nội dung cần bản có máy chủ.",
    );
  if (!cached)
    cached = fetch(import.meta.env.BASE_URL + "data/source-snapshot.json")
      .then((r) => {
        if (!r.ok)
          throw new PublicDataError(
            "Chưa tải được dữ liệu công khai. Hãy thử lại.",
          );
        return r.json();
      })
      .catch((e) => {
        cached = undefined;
        throw e;
      });
  const data = await cached;
  if (options.signal?.aborted) throw new DOMException("Đã hủy", "AbortError");
  const province = q.get("provinceCode"),
    text = normalize(q.get("q") || q.get("search"));
  const filter = <U extends { provinceCode: string; name: string }>(
    rows: U[],
  ) =>
    rows.filter(
      (r) =>
        (!province || r.provinceCode === province) &&
        (!text || normalize(JSON.stringify(r)).includes(text)),
    );
  const paginated = <U>(rows: U[]): Envelope<U[]> => {
    const limit = Math.max(1, Math.min(500, Number(q.get("limit")) || 100)),
      page = Math.max(1, Number(q.get("page")) || 1),
      offset = (page - 1) * limit;
    return {
      success: true,
      data: rows.slice(offset, offset + limit),
      message: "Dữ liệu nguồn công khai · " + data.version,
      pagination: {
        total: rows.length,
        page,
        limit,
        offset,
        hasMore: offset + limit < rows.length,
      },
    };
  };
  let result: Envelope<unknown>;
  const detail = /^\/routes\/([^/]+)(\/stops)?$/.exec(p),
    place = /^\/tourism\/places\/(\d+)(\/nearby-stops|\/reviews)?$/.exec(p);
  if (p === "/routes") result = paginated(filter(data.routes));
  else if (p === "/map/routes")
    result = {
      success: true,
      message: "Đường nối các điểm nguồn, chưa khớp làn.",
      data: {
        type: "FeatureCollection",
        features: filter(data.routes)
          .filter((r) => (r.path?.length ?? 0) > 1)
          .map((r) => ({
            type: "Feature",
            properties: {
              ...r,
              path: undefined,
              geometryQuality: "source-anchors",
            },
            geometry: {
              type: "LineString",
              coordinates: r.path!.map(([lat, lng]) => [lng, lat]),
            },
          })),
      },
    };
  else if (p === "/stops/nearest") {
    const lat = Number(q.get("lat")),
      lng = Number(q.get("lng"));
    if (
      !q.has("lat") ||
      !q.has("lng") ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < 8 ||
      lat > 24 ||
      lng < 102 ||
      lng > 110
    )
      throw new PublicDataError("Tọa độ chưa hợp lệ.", 400);
    const nearest = data.stops
      .map((s) => ({
        stop: s,
        distanceMeters: haversine(lat, lng, s.lat, s.lng),
      }))
      .sort((a, b) => a.distanceMeters - b.distanceMeters)[0];
    result = {
      success: true,
      data: { ...nearest, distanceMeters: Math.round(nearest.distanceMeters) },
      message: "Khoảng cách đường chim bay",
    };
  } else if (p === "/stops") result = paginated(filter(data.stops));
  else if (detail) {
    const route = data.routes.find((r) => r.id === detail[1]);
    if (!route) throw new PublicDataError("Chưa có tuyến này.", 404);
    result = {
      success: true,
      message: "",
      data: detail[2] ? data.routeStops[route.id] || [] : route,
    };
  } else if (p === "/tourism/places" || p === "/tourism/recommended")
    result = paginated(
      filter(data.places).filter(
        (v) => !q.get("category") || v.category === q.get("category"),
      ),
    );
  else if (place) {
    const item = data.places.find((v) => v.id === Number(place[1]));
    if (!item) throw new PublicDataError("Chưa có địa điểm này.", 404);
    result = { success: true, message: "", data: place[2] ? [] : item };
  } else if (p === "/tourism/categories")
    result = { success: true, message: "", data: data.categories };
  else if (p === "/provinces")
    result = { success: true, message: "", data: data.provinces };
  else if (p === "/stats/overview")
    result = {
      success: true,
      message: "Chỉ tính dữ liệu công khai",
      data: {
        totalRoutes: data.routes.length,
        totalStops: data.stops.length,
        totalTourismPlaces: data.places.length,
        totalProvinces: data.provinces.length,
        totalReviews: 0,
      },
    };
  else if (p === "/reviews") result = paginated([]);
  else
    throw new PublicDataError(
      "Chức năng này cần bản có máy chủ. Bạn vẫn có thể xem tuyến, điểm đến và mô phỏng trên bản công khai.",
    );
  return result as Envelope<T>;
}
