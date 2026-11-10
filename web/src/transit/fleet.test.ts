import { describe, expect, it } from "vitest";
import {
  buildFleetRoutes,
  prepareFleet,
  predictFleet,
  type RoadNetwork,
} from "./fleet";
import network from "../../public/data/road-network.json";
const data = network as unknown as RoadNetwork;
const at = (value: string) => Date.parse("2026-11-11T" + value + "+07:00");
const make = () =>
  prepareFleet(buildFleetRoutes(data.routes.filter((r) => r.id === "DN-06")));
describe("theoretical positions on the main map", () => {
  it("keeps five physical buses across both directions without creating extra vehicles", () => {
    const fleet = make();
    for (let minute = 0; minute < 1440; minute += 7) {
      const p = predictFleet(
        fleet,
        at(
          `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}:00`,
        ),
      );
      expect(p.counts.totalConfigured).toBe(5);
      expect(p.counts.active + p.counts.parked).toBe(5);
      expect(
        new Set([...p.vehicles, ...p.parkedVehicles].map((v) => v.id)).size,
      ).toBe(5);
    }
  });
  it("shows daytime buses and finishes their service rather than faking night traffic", () => {
    const f = make();
    expect(predictFleet(f, at("08:00:00")).counts.active).toBeGreaterThan(0);
    expect(predictFleet(f, at("03:00:00")).counts.active).toBe(0);
    expect(predictFleet(f, at("23:50:00")).counts.active).toBe(0);
  });
  it("reconstructs the same moment deterministically and moves continuously along road geometry", () => {
    const f = make(),
      before = predictFleet(f, at("08:10:00")),
      after = predictFleet(f, at("08:10:01"));
    expect(predictFleet(make(), at("08:10:00"))).toEqual(before);
    for (const v of before.vehicles) {
      const w = after.vehicles.find((x) => x.id === v.id);
      if (!w) continue;
      const distance = Math.hypot(
        (w.position[0] - v.position[0]) * 107000,
        (w.position[1] - v.position[1]) * 111195,
      );
      expect(distance).toBeLessThan(30);
      expect(v.speedKph).toBeGreaterThanOrEqual(0);
      expect(v.speedKph).toBeLessThan(70);
      expect(v.headingDegrees).toBeGreaterThanOrEqual(0);
      expect(v.headingDegrees).toBeLessThan(360);
      expect(v.etaMinutes ?? 0).toBeGreaterThanOrEqual(0);
    }
  });
  it("keeps stopped buses stationary during modeled passenger dwell", () => {
    const f = make();
    let found = false;
    for (let t = at("06:00:00"); t < at("10:00:00"); t += 1000) {
      const p = predictFleet(f, t),
        bus = p.vehicles.find((v) => v.status === "stop");
      if (!bus) continue;
      const later = predictFleet(f, t + 1000).vehicles.find(
        (v) => v.id === bus.id,
      );
      if (later?.status === "stop") {
        expect(later.position).toEqual(bus.position);
        expect(later.speedKph).toBe(0);
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });
  it("routes each direction independently and does not treat historical variants as current buses", () => {
    const route = data.routes.find((r) => r.id === "DN-06")!;
    expect(route.outbound.coordinates.length).toBeGreaterThan(100);
    expect(route.inbound.coordinates).not.toEqual(
      [...route.outbound.coordinates].reverse(),
    );
    const all = prepareFleet(buildFleetRoutes(data.routes));
    const p = predictFleet(all, at("08:00:00"));
    expect(p.vehicles.some((v) => /old|tour/.test(v.routeId))).toBe(false);
    expect(p.counts.skippedRoutes).toBeGreaterThan(0);
  });
});
