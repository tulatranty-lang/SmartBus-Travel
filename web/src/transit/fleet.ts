export type TransitPosition = [number, number];
export type Direction = "outbound" | "inbound";
export interface RoadDirection {
  coordinates: TransitPosition[];
  distanceM: number;
  durationS: number;
  anchors?: { name: string; s: number; distanceM?: number }[];
}
export interface FleetService {
  firstMinute: number;
  lastMinute: number;
  headwayMinutes: number;
  fleetSize: number;
  source: "published" | "source-estimate";
  historical?: boolean;
  operatingTime?: string;
  intervalText?: string;
  avgSpeedKmh?: number;
  firstByTerminal?: [number, number];
  lastByTerminal?: [number, number];
}
export interface RoadRoute {
  id: string;
  displayCode?: string;
  name: string;
  provinceCode: string;
  color?: string;
  outbound: RoadDirection;
  inbound: RoadDirection;
  geometryStatus?: "road-routed" | "review";
  warnings?: string[];
  service?: FleetService;
}
export interface RoadNetwork {
  version: string;
  checkedAt: string;
  routes: RoadRoute[];
}
export interface FleetSourceRoute {
  id?: string;
  routeCode?: string;
  displayCode?: string;
  name?: string;
  color?: string;
  operatingHours?: string;
  operatingTime?: string;
  time?: string;
  frequencyText?: string;
  intervalText?: string;
  interval?: string;
  vehicleCount?: number;
  avgSpeedKmh?: number;
}
export interface FleetRoute extends RoadRoute {
  service: FleetService;
}
export interface EstimatedVehicle {
  id: string;
  routeId: string;
  displayCode: string;
  position: TransitPosition;
  headingDegrees: number;
  speedKph: number;
  status: "moving" | "stop" | "signal" | "terminal";
  statusLabel: string;
  uncertaintyM: number;
  nextStop?: string;
  etaMinutes?: number;
  direction: Direction;
  confidence: "published-service" | "source-estimate";
  color: string;
}
export interface FleetCounts {
  active: number;
  parked: number;
  totalConfigured: number;
  serviceEnded: number;
  scheduledRoutes: number;
  skippedRoutes: number;
}
export interface FleetPrediction {
  vehicles: EstimatedVehicle[];
  parkedVehicles: EstimatedVehicle[];
  counts: FleetCounts;
  timeLabel: string;
  modelLabel: string;
}
export interface PreparedFleet {
  routes: PreparedRoute[];
  skippedRoutes: number;
  days: Map<number, ScheduledDay>;
}
interface PreparedDirection {
  coordinates: TransitPosition[];
  prefix: number[];
  distanceM: number;
  anchors: { name: string; s: number }[];
  segments: { s0: number; s1: number; seconds: number }[];
}
interface PreparedRoute {
  route: FleetRoute;
  outbound: PreparedDirection;
  inbound: PreparedDirection;
}
interface Phase {
  from: number;
  to: number;
  s0: number;
  s1: number;
  status: "moving" | "stop" | "signal";
  name?: string;
  rampUp?: number;
  rampDown?: number;
}
interface Trip {
  start: number;
  end: number;
  direction: Direction;
  phases: Phase[];
}
interface ScheduledVehicle {
  index: number;
  startTerminal: number;
  trips: Trip[];
}
interface ScheduledRoute {
  prepared: PreparedRoute;
  buses: ScheduledVehicle[];
}
interface ScheduledDay {
  routes: ScheduledRoute[];
}

const DAY = 86400,
  ZONE = 7 * 3600;
const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));
const finite = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;
const angleDelta = (a: number, b: number) =>
  Math.atan2(Math.sin(a - b), Math.cos(a - b));
function metres(a: TransitPosition, b: TransitPosition) {
  const rad = Math.PI / 180,
    dl = (b[0] - a[0]) * rad,
    dp = (b[1] - a[1]) * rad;
  const h =
    Math.sin(dp / 2) ** 2 +
    Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dl / 2) ** 2;
  return 12742000 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
function heading(a: TransitPosition, b: TransitPosition) {
  return Math.atan2(
    (b[0] - a[0]) * Math.cos(((a[1] + b[1]) * Math.PI) / 360),
    b[1] - a[1],
  );
}
function parseTimes(value: string) {
  return [...value.matchAll(/(\d{1,2})\s*[:h]\s*(\d{2})/g)]
    .map((m) => Number(m[1]) * 60 + Number(m[2]))
    .filter((n) => n >= 0 && n <= 1440);
}
/** Join service metadata without changing a source route, coordinate or ordering. */
export function buildFleetRoutes(
  roads: RoadRoute[],
  sourceRoutes: FleetSourceRoute[] = [],
): FleetRoute[] {
  const sources = new Map(sourceRoutes.map((s) => [s.id || s.routeCode, s]));
  return roads.map((road) => {
    const source = sources.get(road.id),
      times = parseTimes(
        source?.operatingHours || source?.operatingTime || source?.time || "",
      );
    const frequencies =
      (source?.frequencyText || source?.intervalText || source?.interval || "")
        .match(/\d+/g)
        ?.map(Number)
        .filter((n) => n >= 5 && n <= 180) || [];
    const h = frequencies.length
      ? frequencies.slice(0, 2).reduce((a, b) => a + b, 0) /
        Math.min(2, frequencies.length)
      : 30;
    const average = finite(source?.avgSpeedKmh, 27),
      estimated = Math.ceil(
        ((road.outbound?.distanceM || 10000) +
          (road.inbound?.distanceM || 10000)) /
          (average / 3.6) /
          (h * 60) +
          10 / h,
      );
    let service: FleetService = road.service || {
      firstMinute: times.length ? Math.min(...times) : 330,
      lastMinute: times.length > 1 ? Math.max(...times) : 1140,
      headwayMinutes: h,
      fleetSize: finite(source?.vehicleCount, clamp(estimated, 2, 20)),
      source: "source-estimate",
      avgSpeedKmh: average,
    };
    if (road.id === "DN-06")
      service = {
        ...service,
        firstMinute: 330,
        lastMinute: 1165,
        firstByTerminal: [345, 330],
        lastByTerminal: [1165, 1140],
        headwayMinutes: 45,
        fleetSize: 5,
        source: "published",
      };
    service = {
      ...service,
      fleetSize: Math.round(clamp(finite(service.fleetSize, 4), 1, 80)),
      headwayMinutes: clamp(finite(service.headwayMinutes, 30), 5, 180),
      historical: service.historical || /(-old|-tour)$/i.test(road.id),
    };
    return {
      ...road,
      displayCode: road.displayCode || source?.displayCode || road.id,
      color: source?.color || road.color || "#168b7b",
      service,
    };
  });
}
function prepareDirection(
  input: RoadDirection,
  service: FleetService,
): PreparedDirection | null {
  const coordinates = input?.coordinates;
  if (
    !coordinates ||
    coordinates.length < 2 ||
    coordinates.some((c) => c.length !== 2 || !c.every(Number.isFinite))
  )
    return null;
  const prefix = [0];
  for (let i = 1; i < coordinates.length; i++)
    prefix.push(prefix[i - 1] + metres(coordinates[i - 1], coordinates[i]));
  const length = prefix[prefix.length - 1];
  if (length < 100) return null;
  const rawDuration = finite(input.durationS, 0),
    avg = clamp(finite(service.avgSpeedKmh, 27), 18, 50) / 3.6;
  const baseSpeed = Math.min(
    avg,
    rawDuration > 0 ? length / (rawDuration * 1.18) : avg,
  );
  const segments: PreparedDirection["segments"] = [];
  let s0 = 0,
    seconds = 0;
  for (let i = 1; i < coordinates.length; i++) {
    const d = prefix[i] - prefix[i - 1];
    if (d <= 0.01) continue;
    let k = 0;
    if (i < coordinates.length - 1) {
      const before = heading(coordinates[i - 1], coordinates[i]),
        after = heading(coordinates[i], coordinates[i + 1]);
      k =
        Math.abs(angleDelta(after, before)) /
        Math.max(8, (d + metres(coordinates[i], coordinates[i + 1])) / 2);
    }
    const speed = Math.max(
      2,
      Math.min(baseSpeed, Math.sqrt(0.85 / Math.max(k, 0.00001))),
    );
    seconds += d / speed;
    if (prefix[i] - s0 >= 140 || k > 0.012 || i === coordinates.length - 1) {
      segments.push({ s0, s1: prefix[i], seconds });
      s0 = prefix[i];
      seconds = 0;
    }
  }
  const anchors = (input.anchors || [])
    .filter((a) => Number.isFinite(a.s))
    .map((a) => ({ name: a.name, s: clamp(a.s, 0, length) }))
    .sort((a, b) => a.s - b.s)
    .filter((a, i, rows) => !i || a.s - rows[i - 1].s > 35);
  if (!anchors.length || anchors[0].s > 40)
    anchors.unshift({ name: "Điểm đầu tuyến", s: 0 });
  if (length - anchors[anchors.length - 1].s > 40)
    anchors.push({ name: "Điểm cuối tuyến", s: length });
  return { coordinates, prefix, distanceM: length, anchors, segments };
}
/** Cache arc lengths and travel-time envelopes once, not on every animation tick. */
export function prepareFleet(routes: FleetRoute[]): PreparedFleet {
  const prepared: PreparedRoute[] = [];
  let skippedRoutes = 0;
  for (const route of routes) {
    if (route.service.historical) {
      skippedRoutes++;
      continue;
    }
    const outbound = prepareDirection(route.outbound, route.service),
      inbound = prepareDirection(route.inbound, route.service);
    if (!outbound || !inbound) {
      skippedRoutes++;
      continue;
    }
    prepared.push({ route, outbound, inbound });
  }
  return { routes: prepared, skippedRoutes, days: new Map() };
}
function signalWait(seconds: number, offset: number) {
  const phase = (((seconds + offset) % 80) + 80) % 80;
  return phase < 30 ? 30 - phase : phase >= 67 ? 80 - phase : 0;
}
function trip(
  prepared: PreparedRoute,
  direction: Direction,
  start: number,
  vehicleIndex: number,
): Trip {
  const geometry = prepared[direction],
    interior = geometry.anchors.filter(
      (a) => a.s > 60 && a.s < geometry.distanceM - 60,
    );
  const events: { s: number; status: "stop" | "signal"; name?: string }[] =
    interior.map((a) => ({ s: a.s, status: "stop", name: a.name }));
  // These are timing allowances for unobserved junctions, not surveyed signal locations.
  const signalCount = Math.min(10, Math.floor(geometry.distanceM / 1500));
  for (let i = 1; i <= signalCount; i++) {
    const s = (geometry.distanceM * i) / (signalCount + 1);
    if (!interior.some((a) => Math.abs(a.s - s) < 80))
      events.push({ s, status: "signal", name: "Nút giao trong mô hình" });
  }
  events.sort((a, b) => a.s - b.s);
  const phases: Phase[] = [],
    rush =
      (start / 3600 >= 7 && start / 3600 < 9) ||
      (start / 3600 >= 16 && start / 3600 < 18),
    factor = rush ? 1.22 : 1;
  let time = start,
    eventIndex = 0,
    needsAcceleration = true;
  for (const segment of geometry.segments) {
    let from = segment.s0;
    const boundaries = [
      ...events
        .slice(eventIndex)
        .filter((e) => e.s > from + 0.001 && e.s <= segment.s1 + 0.001)
        .map((e) => e.s),
      segment.s1,
    ].filter((s, i, rows) => i === 0 || s - rows[i - 1] > 0.001);
    for (const to of boundaries) {
      const event =
        events[eventIndex]?.s <= to + 0.01 ? events[eventIndex] : undefined;
      const baseSeconds =
        ((segment.seconds * (to - from)) / (segment.s1 - segment.s0)) * factor;
      const up: number = needsAcceleration ? 4 : 0;
      const anticipated: number = time + baseSeconds + up / 2;
      const stopping: boolean =
        event?.status === "stop" ||
        (event?.status === "signal" &&
          signalWait(anticipated, eventIndex * 7) > 0) ||
        to >= geometry.distanceM - 0.01;
      const down = stopping ? 5 : 0,
        duration = baseSeconds + (up + down) / 2;
      phases.push({
        from: time,
        to: time + duration,
        s0: from,
        s1: to,
        status: "moving",
        rampUp: Math.min(up, duration * 0.3),
        rampDown: Math.min(down, duration * 0.3),
      });
      time += duration;
      needsAcceleration = false;
      if (event) {
        const wait =
          event.status === "stop"
            ? 18 + ((vehicleIndex + eventIndex) % 4) * 4
            : signalWait(time, eventIndex * 7);
        if (wait > 0.01) {
          phases.push({
            from: time,
            to: time + wait,
            s0: to,
            s1: to,
            status: event.status,
            name: event.name,
          });
          time += wait;
          needsAcceleration = true;
        } else needsAcceleration = stopping;
        eventIndex++;
      }
      from = to;
    }
  }
  return { start, end: time, direction, phases };
}
function scheduleRoute(prepared: PreparedRoute): ScheduledRoute {
  const { service } = prepared.route;
  const first = service.firstByTerminal || [
      service.firstMinute,
      service.firstMinute,
    ],
    last = (
      service.lastByTerminal || [service.lastMinute, service.lastMinute]
    ).map((n, i) => (n < first[i] ? n + 1440 : n));
  const buses: ScheduledVehicle[] = Array.from(
    { length: service.fleetSize },
    (_, index) => ({ index, startTerminal: index % 2, trips: [] }),
  );
  const available = buses.map((bus) => ({
    terminal: bus.startTerminal,
    ready: first[bus.startTerminal] * 60,
  }));
  const nextAllowed = first.map((n) => n * 60);
  for (let count = 0; count < 2000; count++) {
    let chosen = -1,
      start = Infinity;
    for (let i = 0; i < buses.length; i++) {
      const a = available[i],
        candidate = Math.max(
          a.ready,
          nextAllowed[a.terminal],
          first[a.terminal] * 60,
        );
      if (candidate <= last[a.terminal] * 60 + 0.01 && candidate < start) {
        chosen = i;
        start = candidate;
      }
    }
    if (chosen < 0) break;
    const a = available[chosen],
      direction = a.terminal === 0 ? "outbound" : "inbound",
      journey = trip(prepared, direction, start, chosen);
    buses[chosen].trips.push(journey);
    nextAllowed[a.terminal] = start + service.headwayMinutes * 60;
    a.terminal = 1 - a.terminal;
    a.ready = journey.end + 300;
  }
  return { prepared, buses };
}
function schedule(fleet: PreparedFleet, day: number) {
  let value = fleet.days.get(day);
  if (value) return value;
  value = { routes: fleet.routes.map(scheduleRoute) };
  fleet.days.set(day, value);
  while (fleet.days.size > 2)
    fleet.days.delete(fleet.days.keys().next().value!);
  return value;
}
function indexBefore<T>(rows: T[], value: number, key: (row: T) => number) {
  let lo = 0,
    hi = rows.length - 1,
    result = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (key(rows[mid]) <= value) {
      result = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return result;
}
function roadPosition(direction: PreparedDirection, s: number) {
  const i = clamp(
      indexBefore(direction.prefix, s, (x) => x),
      0,
      direction.prefix.length - 2,
    ),
    a = direction.coordinates[i],
    b = direction.coordinates[i + 1],
    u = clamp(
      (s - direction.prefix[i]) /
        (direction.prefix[i + 1] - direction.prefix[i] || 1),
      0,
      1,
    );
  const before = direction.coordinates[Math.max(0, i - 1)],
    after =
      direction.coordinates[Math.min(direction.coordinates.length - 1, i + 2)];
  return {
    position: [
      a[0] + (b[0] - a[0]) * u,
      a[1] + (b[1] - a[1]) * u,
    ] as TransitPosition,
    headingDegrees: ((heading(before, after) * 180) / Math.PI + 360) % 360,
  };
}
function progress(phase: Phase, seconds: number) {
  if (phase.status !== "moving") return { s: phase.s0, speedKph: 0 };
  const T = phase.to - phase.from,
    t = clamp(seconds - phase.from, 0, T),
    a = phase.rampUp || 0,
    b = phase.rampDown || 0,
    D = phase.s1 - phase.s0,
    v = D / (T - (a + b) / 2);
  const distance =
    a && t < a
      ? ((0.5 * v) / a) * t * t
      : b && t > T - b
        ? D - ((0.5 * v) / b) * (T - t) ** 2
        : v * (t - a / 2);
  const speed =
    a && t < a ? (v * t) / a : b && t > T - b ? (v * (T - t)) / b : v;
  return { s: phase.s0 + clamp(distance, 0, D), speedKph: speed * 3.6 };
}
function predictVehicle(
  scheduled: ScheduledRoute,
  bus: ScheduledVehicle,
  seconds: number,
): { vehicle: EstimatedVehicle; active: boolean; ended: boolean } {
  const { prepared } = scheduled,
    { route } = prepared,
    index = indexBefore(bus.trips, seconds, (t) => t.start),
    journey = bus.trips[index];
  const base = {
    id: `${route.id}-M${String(bus.index + 1).padStart(2, "0")}`,
    routeId: route.id,
    displayCode: route.displayCode || route.id,
    confidence:
      route.service.source === "published"
        ? ("published-service" as const)
        : ("source-estimate" as const),
    color: route.color || "#168b7b",
  };
  if (journey && seconds < journey.end) {
    const phase =
        journey.phases[
          Math.max(
            0,
            indexBefore(journey.phases, seconds, (p) => p.from),
          )
        ],
      moving = progress(phase, seconds),
      location = roadPosition(prepared[journey.direction], moving.s);
    const next = journey.phases.find(
      (p) => p.status === "stop" && p.to > seconds,
    );
    const nextAnchor =
      prepared[journey.direction].anchors.find((a) => a.s > moving.s + 2) ||
      prepared[journey.direction].anchors.at(-1);
    const eta = Math.max(0, ((next?.from ?? journey.end) - seconds) / 60),
      uncertainty = Math.round(
        clamp(
          (route.service.source === "published" ? 250 : 550) +
            ((seconds - journey.start) / 60) * 17 +
            (route.geometryStatus === "review" ? 500 : 0),
          250,
          3000,
        ),
      );
    return {
      active: true,
      ended: false,
      vehicle: {
        ...base,
        ...location,
        direction: journey.direction,
        speedKph: Math.round(moving.speedKph * 10) / 10,
        status: phase.status,
        statusLabel:
          phase.status === "stop"
            ? "Dừng tại điểm tuyến (ước tính)"
            : phase.status === "signal"
              ? "Chờ nút giao (mô hình)"
              : "Đang di chuyển (ước tính)",
        uncertaintyM: uncertainty,
        nextStop:
          phase.status === "stop" ? phase.name : next?.name || nextAnchor?.name,
        etaMinutes: Math.round(eta * 10) / 10,
      },
    };
  }
  const direction: Direction = journey
      ? journey.direction
      : bus.startTerminal === 0
        ? "outbound"
        : "inbound",
    geometry = prepared[direction],
    s = journey ? geometry.distanceM : 0,
    location = roadPosition(geometry, s),
    ended =
      !!bus.trips.length && seconds >= bus.trips[bus.trips.length - 1].end;
  return {
    active: false,
    ended,
    vehicle: {
      ...base,
      ...location,
      direction,
      speedKph: 0,
      status: "terminal",
      statusLabel: !journey
        ? "Chưa đến giờ xuất bến"
        : ended
          ? "Đã kết thúc chuyến trong ngày"
          : "Nghỉ đầu bến",
      uncertaintyM: 300,
    },
  };
}
/** Reconstruct the fleet at a real or explicitly previewed Vietnam clock time. */
export function predictFleet(
  fleet: PreparedFleet,
  epochMs: number,
): FleetPrediction {
  if (!Number.isFinite(epochMs)) throw Error("Invalid fleet prediction time");
  const local = epochMs / 1000 + ZONE,
    day = Math.floor(local / DAY),
    seconds = local - day * DAY,
    current = schedule(fleet, day),
    previous = schedule(fleet, day - 1);
  const vehicles: EstimatedVehicle[] = [],
    parkedVehicles: EstimatedVehicle[] = [];
  let serviceEnded = 0;
  for (let r = 0; r < current.routes.length; r++)
    for (const bus of current.routes[r].buses) {
      let prediction = predictVehicle(current.routes[r], bus, seconds);
      if (!prediction.active) {
        const prior = predictVehicle(
          previous.routes[r],
          previous.routes[r].buses[bus.index],
          seconds + DAY,
        );
        if (prior.active) prediction = prior;
      }
      if (prediction.active) vehicles.push(prediction.vehicle);
      else {
        parkedVehicles.push(prediction.vehicle);
        if (prediction.ended) serviceEnded++;
      }
    }
  const hour = Math.floor(seconds / 3600),
    minute = Math.floor((seconds % 3600) / 60),
    second = Math.floor(seconds % 60),
    pad = (n: number) => String(n).padStart(2, "0");
  return {
    vehicles,
    parkedVehicles,
    counts: {
      active: vehicles.length,
      parked: parkedVehicles.length,
      totalConfigured: vehicles.length + parkedVehicles.length,
      serviceEnded,
      scheduledRoutes: current.routes.length,
      skippedRoutes: fleet.skippedRoutes,
    },
    timeLabel: `${pad(hour)}:${pad(minute)}:${pad(second)} · giờ Việt Nam`,
    modelLabel:
      "Vị trí ước tính theo lịch chạy và thời gian hành trình; chưa có GPS xe trực tiếp.",
  };
}
