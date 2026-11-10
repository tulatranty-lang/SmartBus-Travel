// Only repository source data is published. Never export the SQL database.
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const load = (name) =>
  JSON.parse(
    fs.readFileSync(path.join(root, "backend-api/data/import", name), "utf8"),
  );
const bus = load("smartbus-bus-data.normalized.json"),
  tourism = load("smartbus-tourism-data.normalized.json");
const colors = ["#247f9f", "#087f72", "#ab7a42", "#7466a3", "#5b8b62"];
const provinces = bus.provinces.map((p) => ({ code: p.code, name: p.name }));
const routes = bus.routes.map((r, i) => ({
  id: r.routeCode,
  routeCode: r.routeCode,
  displayCode: r.displayCode,
  name: r.name,
  province: r.provinceName,
  provinceCode: r.provinceCode,
  startPoint: r.startStopName,
  endPoint: r.endStopName,
  originName: r.startStopName,
  destinationName: r.endStopName,
  operatingHours: r.operatingTime,
  frequencyText: r.intervalText,
  fare: r.fare,
  color: colors[i % colors.length],
  description: r.description,
  sourceName: r.sourceName,
  geometryQuality: "source-anchors",
  path: bus.routeStops
    .filter((s) => s.routeCode === r.routeCode && s.direction === "chiều_đi")
    .sort((a, b) => a.sequenceNo - b.sequenceNo)
    .map((s) => [s.lat, s.lng]),
}));
const verifiedProfile = require("../simulation/profiles/dn06-citybus.json");
const verifiedRoute = routes.find(
  (r) => r.id === verifiedProfile.service.routeCode,
);
const originalRoute = bus.routes.find(
  (r) => r.routeCode === verifiedProfile.service.routeCode,
);
if (verifiedRoute && originalRoute)
  Object.assign(verifiedRoute, {
    originalService: {
      operatingHours: originalRoute.operatingTime,
      distanceKm: originalRoute.distanceKm,
      note: originalRoute.note,
    },
    operatingHours: verifiedProfile.service.operatingHours,
    frequencyText:
      verifiedProfile.service.headwayMinutes.join("–") + " phút/chuyến",
    fare: verifiedProfile.service.fareText,
    distanceKm: verifiedProfile.service.routeLengthKm,
    operatorName: verifiedProfile.service.operator,
    sourceUrl: "https://www.danangbus.vn/lo-trinh-tuyen.html",
    sourceCheckedAt: verifiedProfile.version,
    sourceNote:
      "Thông số dịch vụ tuyến 06 đã đối chiếu Danabus ngày 10/11/2026; bản nguồn có giờ lịch Tết. Tọa độ và thứ tự các điểm gốc được giữ nguyên.",
  });
const stops = bus.stops.map((s) => ({
  id: s.externalStopCode,
  name: s.name,
  address: s.address,
  provinceCode: s.provinceCode,
  lat: s.lat,
  lng: s.lng,
  routes: [
    ...new Set(
      bus.routeStops
        .filter((rs) => rs.externalStopCode === s.externalStopCode)
        .map((rs) => rs.routeCode),
    ),
  ]
    .map((id) => routes.find((r) => r.id === id))
    .filter(Boolean)
    .map((r) => ({
      id: r.id,
      name: r.name,
      displayCode: r.displayCode,
      provinceCode: r.provinceCode,
    })),
}));
const routeStops = Object.fromEntries(
  routes.map((r) => [
    r.id,
    bus.routeStops
      .filter((s) => s.routeCode === r.id && s.direction === "chiều_đi")
      .sort((a, b) => a.sequenceNo - b.sequenceNo)
      .map((s) => ({
        id: s.externalRouteStopCode,
        name: s.stopName,
        address: s.stopName,
        lat: s.lat,
        lng: s.lng,
        routeId: r.id,
      })),
  ]),
);
const places = tourism.places.map((p, i) => ({
  id: i + 1,
  name: p.name,
  externalPlaceCode: p.externalPlaceCode,
  description: p.description,
  shortDescription: p.shortDescription,
  province: p.provinceName,
  provinceName: p.provinceName,
  provinceCode: p.provinceCode,
  category: p.categoryCode,
  latitude: p.lat,
  longitude: p.lng,
  openingHours: p.openingHours,
  bestTime: p.bestTime,
  averageRating: 0,
  reviewCount: 0,
  isActive: true,
  suggestedDurationMinutes: 120,
  nearbyStops: [],
}));
const data = {
  version: "2026-11-10",
  mode: "public-source-snapshot",
  sources: [
    "smartbus-bus-data.normalized.json",
    "smartbus-tourism-data.normalized.json",
  ],
  geometryNote: "Original sparse anchors, not surveyed road or lane geometry.",
  provinces,
  routes,
  stops,
  routeStops,
  places,
  categories: tourism.categories.map((c) => ({ code: c.code, name: c.name })),
};
if (routes.length !== 39 || Object.values(routeStops).flat().length !== 298)
  throw Error("Source route/anchor count changed; review the export.");
for (const r of routes)
  if (r.path.some((p) => !p.every(Number.isFinite)))
    throw Error("Invalid source coordinate");
const target = path.join(root, "web/public/data/source-snapshot.json");
fs.mkdirSync(path.dirname(target), { recursive: true });
const text = JSON.stringify(data);
if (process.argv.includes("--check")) {
  if (!fs.existsSync(target) || fs.readFileSync(target, "utf8") !== text)
    throw Error("Public snapshot is stale. Run npm run data:public.");
} else fs.writeFileSync(target, text);
console.log(
  JSON.stringify({
    routes: routes.length,
    anchors: Object.values(routeStops).flat().length,
    uniqueStops: stops.length,
    places: places.length,
    bytes: Buffer.byteLength(text),
  }),
);
