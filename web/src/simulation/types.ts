export type XY = [number, number];
export type CameraMode = "follow" | "signals" | "corner" | "all";
export type ScenarioId = "normal" | "busy" | "rain";
// Vehicle rows: id, front-bumper distance (m), speed (m/s), body angle,
// steering angle (radians), state (0 moving/queueing, 1 signal, 2 doors open).
export type VehicleFrame = [number, number, number, number, number, number];
export interface Replay {
  duration: number;
  period: number;
  scenarioId: ScenarioId;
  scenarioLabel: string;
  specs: {
    id: number;
    type: string;
    length: number;
    width: number;
    wheelbase?: number;
    frontOverhang?: number;
  }[];
  passengers: {
    before: number;
    boarding: number;
    alighting: number;
    after: number;
    capacity: number;
    dwellSeconds: number;
  };
  frames: VehicleFrame[][];
  events: {
    redWait: number | null;
    corner: number | null;
    boarding: number | null;
    exit: number | null;
  };
  stats: Record<string, number>;
}
export interface SimulationNetwork {
  version: string;
  origin: XY;
  scale: XY;
  path: XY[];
  prefix: number[];
  curvature: number[];
  length: number;
  roads: [string, string, number, number, number, number, XY[]][];
  buildings: [string, XY[]][];
  water: [string, XY[]][];
  signals: [string, number, number][];
  crossings: [string, number, number, number, number][];
  gates: { id: string; s: number; coord: XY }[];
  stop: { s: number; source: string; name: string };
  rawPoints: { name: string; coord: XY }[];
  clearance: {
    maxOutsideEstimatedAsphaltM: number;
    bodyCornerSamplesOutsideByOver10cm: number;
    worst: { s: number; point: XY; time: number };
    estimatedRoadWidthEnvelopeOnly: boolean;
  };
  stats: Record<string, number>;
  source: {
    osmBase: string;
    checkedAt: string;
    license: string;
    boundingBox: number[];
  };
}
export interface VehicleProfile {
  version: string;
  label: string;
  mode: string;
  telemetryAvailable: boolean;
  service: {
    routeCode: string;
    operator: string;
    capacity: number;
    seated: number;
    standing: number;
    fleetSize: number;
    routeLengthKm: number;
    headwayMinutes: number[];
  };
  vehicle: {
    length: number;
    width: number;
    wheelbase: number;
    paint: string;
    stripeColors: string[];
  };
  scenarios: Record<
    ScenarioId,
    {
      label: string;
      speedKph: number;
      accel: number;
      decel: number;
      headway: number;
      lateralAccel: number;
      jerk: number;
    }
  >;
  parameters: {
    name: string;
    value: string;
    status: string;
    sourceId?: string;
    note?: string;
  }[];
  sources: {
    id: string;
    type: string;
    title: string;
    url: string;
    checkedAt: string;
    publishedAt?: string;
    usedFor: string;
    accessible?: boolean;
  }[];
  conflicts: { url: string; note: string }[];
}
export interface MapView {
  time: number;
  camera: CameraMode;
  zoom: number;
  pan: XY;
  lanes: boolean;
  signals: boolean;
  buildings: boolean;
  gps: boolean;
  envelope: boolean;
}
