const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { step, signalAt } = require("./traffic-model.cjs");
const { buildReplay } = require("./build-replay.cjs");
const profile = require("../profiles/dn06-citybus.json");
const { followFrontBumper } = require("./bicycle.cjs");
const bus = () => ({
  s: 0,
  v: 0,
  length: 12,
  minGap: 2.5,
  headway: 1.6,
  accel: 1.05,
  decel: 1.7,
  emergencyDecel: 4.2,
});
test("a free bus accelerates forward without exceeding its desired speed", () => {
  let v = bus();
  for (let i = 0; i < 2400; i++) {
    const prev = v;
    v = step(v, null, 11.11, 0.05);
    assert.ok(v.s >= prev.s);
    assert.ok(v.v >= 0 && v.v <= 11.111);
  }
  assert.ok(v.v > 10.5);
});
test("a bus brakes before a stationary stop line and never moves backwards", () => {
  let v = { ...bus(), v: 10 };
  for (let i = 0; i < 2000; i++) {
    const prev = v;
    v = step(v, { s: 90, length: 0, v: 0 }, 11.11, 0.05);
    assert.ok(v.s >= prev.s);
    assert.ok(v.s <= 87.501);
    assert.ok(v.v >= 0);
  }
  assert.ok(v.v < 0.1);
});
test("signal phases never give both conflicting streams green", () => {
  for (let t = 0; t < 1000; t += 0.1) {
    const s = signalAt(t);
    assert.ok(!(s.main === "green" && s.cross === "green"));
    assert.ok(s.remaining >= 0);
  }
});
test("commanded acceleration changes smoothly until a discrete safety intervention", () => {
  let v = { ...bus(), jerk: 0.8 };
  for (let i = 0; i < 1000; i++) {
    const previous = v;
    v = step(v, null, 9, 0.05);
    assert.ok(
      Math.abs(v.commandA - (previous.commandA || 0)) <= 0.8 * 0.05 + 1e-9,
    );
  }
});
test("a bus settles onto the analytic steering radius of a circular bumper path", () => {
  const radius = 30,
    wheelbase = 4,
    overhang = 1.6,
    L = wheelbase + overhang,
    increment = 0.0005;
  let rear = null,
    result;
  for (let angle = 0; angle < Math.PI * 4; angle += increment) {
    result = followFrontBumper(
      [radius * Math.cos(angle), radius * Math.sin(angle)],
      rear,
      angle + Math.PI / 2,
      wheelbase,
      overhang,
    );
    rear = result.rear;
  }
  const expected = Math.atan(wheelbase / Math.sqrt(radius * radius - L * L));
  assert.ok(
    Math.abs(result.steer - expected) < 0.001,
    "steering must match the analytic bicycle constraint",
  );
});
test("all published scenarios reproduce their replay and preserve following, stops and capacity", () => {
  const dir = path.resolve(__dirname, "../../web/public/simulation/v1");
  const n = JSON.parse(fs.readFileSync(path.join(dir, "network.json"), "utf8"));
  const replays = {};
  for (const id of Object.keys(profile.scenarios)) {
    const r = buildReplay(n, id),
      expected = JSON.parse(
        fs.readFileSync(path.join(dir, "replay-" + id + ".json"), "utf8"),
      );
    assert.equal(
      JSON.stringify(r),
      JSON.stringify(expected),
      "published JSON must match the shipped algorithm and inputs",
    );
    replays[id] = r;
    assert.equal(r.stats.redCrossings, 0);
    assert.equal(r.stats.overlaps, 0);
    assert.ok(r.stats.maxBusSteeringDegrees <= profile.vehicle.maxSteerDegrees);
    assert.ok(r.stats.busRedWaitSeconds > 5);
    assert.equal(r.stats.busDwellSeconds, r.passengers.dwellSeconds);
    assert.ok(
      r.stats.maxGuardCorrectionM < 0.03,
      "discrete guard must not conceal a large trajectory correction",
    );
    assert.ok(r.passengers.after <= profile.service.capacity);
    assert.ok(r.events.exit < r.duration, "bus must complete the corridor");
    const last = new Map();
    let boardingFrames = 0;
    for (const frame of r.frames) {
      const ordered = [...frame].sort((a, b) => b[1] - a[1]);
      for (let i = 0; i < ordered.length; i++) {
        const v = ordered[i];
        assert.ok(v.every(Number.isFinite));
        assert.ok(v[2] >= 0);
        assert.ok(!last.has(v[0]) || v[1] >= last.get(v[0]));
        last.set(v[0], v[1]);
        if (i) {
          const leader = ordered[i - 1],
            spec = r.specs.find((s) => s.id === leader[0]);
          assert.ok(
            leader[1] - spec.length - v[1] >= -0.03,
            "independent frame collision check",
          );
        }
        if (v[0] === 0 && v[5] === 2) {
          boardingFrames++;
          assert.equal(v[2], 0);
          assert.ok(
            Math.abs(n.stop.s - v[1] - 2.5) < 0.3,
            "doors only open at the scenario stop",
          );
        }
      }
    }
    assert.ok(
      Math.abs(boardingFrames * r.period - r.passengers.dwellSeconds) <=
        r.period,
    );
  }
  assert.ok(
    replays.busy.passengers.dwellSeconds >
      replays.normal.passengers.dwellSeconds,
  );
  assert.ok(replays.rain.events.exit > replays.normal.events.exit);
});
test("map snapshot and license bundle match their published hashes", () => {
  const { createHash } = require("node:crypto"),
    dir = path.resolve(__dirname, "../../web/public/simulation/v1");
  const manifest = JSON.parse(
    fs.readFileSync(path.join(dir, "manifest.json"), "utf8"),
  );
  for (const file of manifest.files) {
    const b = fs.readFileSync(path.join(dir, file.name));
    assert.equal(b.length, file.bytes);
    assert.equal(createHash("sha256").update(b).digest("hex"), file.sha256);
  }
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(dir, "profile.json"), "utf8"))
      .telemetryAvailable,
    false,
  );
});
test("published service corrections preserve every original route anchor and its order", () => {
  const original = require("../../backend-api/data/import/smartbus-bus-data.normalized.json");
  const snapshot = require("../../web/public/data/source-snapshot.json");
  assert.equal(snapshot.routes.length, 39);
  assert.equal(Object.values(snapshot.routeStops).flat().length, 298);
  for (const route of snapshot.routes) {
    const points = original.routeStops
      .filter((s) => s.routeCode === route.id && s.direction === "chiều_đi")
      .sort((a, b) => a.sequenceNo - b.sequenceNo)
      .map((s) => [s.lat, s.lng]);
    assert.deepEqual(route.path, points);
  }
  const corrected = snapshot.routes.find((r) => r.id === "DN-06");
  assert.equal(
    corrected.originalService.operatingHours,
    original.routes.find((r) => r.routeCode === "DN-06").operatingTime,
  );
  assert.equal(corrected.operatingHours, profile.service.operatingHours);
  assert.equal(corrected.sourceCheckedAt, profile.version);
});
