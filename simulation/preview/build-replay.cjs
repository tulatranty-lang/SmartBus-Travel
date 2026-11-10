const fs = require("node:fs");
const path = require("node:path");
const { step, signalAt } = require("./traffic-model.cjs");
const { followFrontBumper } = require("./bicycle.cjs");
const profile = require("../profiles/dn06-citybus.json");

function buildReplay(net, scenarioId = "normal") {
  if (!Object.hasOwn(profile.scenarios, scenarioId))
    throw new Error("Unknown scenario");
  const scenario = profile.scenarios[scenarioId],
    bus = profile.vehicle;
  const dwell =
    scenario.doorSeconds +
    Math.max(
      scenario.boarding * scenario.boardingSeconds,
      scenario.alighting * scenario.alightingSeconds,
    );
  const duration = 420,
    dt = 0.05,
    period = 0.25;
  const limits = net.curvature.map((k) =>
    Math.min(
      scenario.speedKph / 3.6,
      Math.sqrt(scenario.lateralAccel / Math.max(k, 0.0001)),
    ),
  );
  for (let i = limits.length - 2; i >= 0; i--)
    limits[i] = Math.min(
      limits[i],
      Math.sqrt(
        limits[i + 1] ** 2 +
          2 * scenario.decel * (net.prefix[i + 1] - net.prefix[i]),
      ),
    );
  function indexAt(s) {
    let lo = 0,
      hi = net.prefix.length - 2;
    while (lo < hi) {
      const m = (lo + hi + 1) >> 1;
      if (net.prefix[m] <= s) lo = m;
      else hi = m - 1;
    }
    return lo;
  }
  function pointAt(s) {
    const i = indexAt(Math.max(0, Math.min(net.length, s))),
      a = net.path[i],
      b = net.path[i + 1];
    const t = Math.max(
      0,
      Math.min(
        1,
        (s - net.prefix[i]) / (net.prefix[i + 1] - net.prefix[i] || 1),
      ),
    );
    const left = net.path[Math.max(0, i - 3)],
      right = net.path[Math.min(net.path.length - 1, i + 3)];
    return [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      Math.atan2(right[1] - left[1], right[0] - left[0]),
    ];
  }
  const specs = [
    {
      id: 0,
      type: "bus",
      s: 140,
      v: 4,
      length: bus.length,
      width: bus.width,
      wheelbase: bus.wheelbase,
      frontOverhang: bus.frontOverhang,
      accel: scenario.accel,
      decel: scenario.decel,
      jerk: scenario.jerk,
      emergencyDecel: 4.2,
      minGap: 2.5,
      headway: scenario.headway,
    },
    ...[35, 75, 105, 188, 224, 261, 330, 385, 500, 700].map((s, i) => ({
      id: i + 1,
      type: "car",
      s,
      v: s < 270 ? 2 : 5,
      length: 4.5,
      width: 1.8,
      accel: 1.4,
      decel: 2,
      emergencyDecel: 5,
      minGap: 2,
      headway: 1.4,
    })),
  ];
  let vehicles = specs.map((v) => ({
    ...v,
    a: 0,
    dwellUntil: null,
    served: false,
    reason: "running",
  }));
  const frames = [],
    stats = {
      guards: 0,
      maxGuardCorrectionM: 0,
      redCrossings: 0,
      overlaps: 0,
      busDwellSeconds: 0,
      busRedWaitSeconds: 0,
      maxBusAcceleration: 0,
      maxBusDeceleration: 0,
      maxBusSteeringDegrees: 0,
    };
  const events = { redWait: null, corner: null, boarding: null, exit: null };
  let lastRear = null,
    cornerPeak = 0;
  function updatePose(v, time) {
    const pos = pointAt(v.s),
      heading = pos[2];
    v.bodyAngle = heading;
    v.steer = 0;
    if (v.type !== "bus") return;
    const body = followFrontBumper(
      pos,
      lastRear,
      heading,
      bus.wheelbase,
      bus.frontOverhang,
    );
    v.bodyAngle = body.bodyAngle;
    v.steer = body.steer;
    lastRear = body.rear;
    stats.maxBusSteeringDegrees = Math.max(
      stats.maxBusSteeringDegrees,
      (Math.abs(v.steer) * 180) / Math.PI,
    );
    if (v.s > net.length * 0.6 && Math.abs(v.steer) > cornerPeak) {
      cornerPeak = Math.abs(v.steer);
      events.corner = time;
    }
  }
  function snapshot() {
    frames.push(
      vehicles.map((v) => [
        v.id,
        Math.round(v.s * 100) / 100,
        Math.round(v.v * 100) / 100,
        Math.round(v.bodyAngle * 10000) / 10000,
        Math.round(v.steer * 10000) / 10000,
        v.reason === "signal" ? 1 : v.reason === "boarding" ? 2 : 0,
      ]),
    );
  }
  vehicles.forEach((v) => updatePose(v, 0));
  snapshot();
  for (let tick = 1; tick <= duration / dt; tick++) {
    const time = (tick - 1) * dt,
      ordered = [...vehicles].sort((a, b) => b.s - a.s),
      next = [];
    for (let i = 0; i < ordered.length; i++) {
      const v = ordered[i],
        previous = ordered[i - 1];
      let lead = previous
          ? { s: previous.s, length: previous.length, v: previous.v }
          : null,
        reason = "running";
      for (const gate of net.gates) {
        const gap = gate.s - v.s;
        if (gap < -0.05) continue;
        const phase = signalAt(time).main;
        const stop =
          phase === "red" ||
          (phase === "yellow" && gap > (v.v * v.v) / (2 * v.decel) + v.minGap);
        if (stop && (!lead || gate.s < lead.s - lead.length)) {
          lead = { s: gate.s, length: 0, v: 0 };
          reason = "signal";
        }
      }
      if (v.type === "bus" && !v.served) {
        const gap = net.stop.s - v.s;
        if (gap >= -0.05 && (!lead || net.stop.s < lead.s - lead.length)) {
          lead = { s: net.stop.s, length: 0, v: 0 };
          reason = "stop";
        }
        if (gap < v.minGap + 0.25 && v.v < 0.15 && v.dwellUntil === null) {
          v.dwellUntil = time + dwell;
          events.boarding = time;
        }
        if (v.dwellUntil !== null && time >= v.dwellUntil - 1e-8) {
          v.served = true;
          lead = previous
            ? { s: previous.s, length: previous.length, v: previous.v }
            : null;
          reason = "running";
        }
      }
      let nv;
      if (v.type === "bus" && !v.served && v.dwellUntil !== null) {
        nv = { ...v, v: 0, a: 0, commandA: 0, guard: false };
        reason = "boarding";
        stats.busDwellSeconds += dt;
      } else nv = step(v, lead, limits[indexAt(v.s)], dt);
      nv.reason = nv.v < 0.15 ? reason : "running";
      if (nv.guard) {
        stats.guards++;
        stats.maxGuardCorrectionM = Math.max(
          stats.maxGuardCorrectionM,
          nv.guardCorrection,
        );
      }
      for (const gate of net.gates)
        if (v.s < gate.s && nv.s >= gate.s && signalAt(time).main === "red")
          stats.redCrossings++;
      if (previous && previous.s - nv.s - previous.length < -0.01)
        stats.overlaps++;
      if (v.type === "bus") {
        stats.maxBusAcceleration = Math.max(stats.maxBusAcceleration, nv.a);
        stats.maxBusDeceleration = Math.min(stats.maxBusDeceleration, nv.a);
        if (
          nv.v < 0.2 &&
          signalAt(time).main === "red" &&
          net.gates.some((g) => g.s - nv.s > 0 && g.s - nv.s < 120)
        ) {
          stats.busRedWaitSeconds += dt;
          if (events.redWait === null) events.redWait = time;
        }
      }
      updatePose(nv, time + dt);
      if (nv.s < net.length) next.push(nv);
      else if (v.type === "bus" && events.exit === null)
        events.exit = time + dt;
    }
    vehicles = next;
    if (tick % Math.round(period / dt) === 0) snapshot();
  }
  for (const k of Object.keys(stats))
    stats[k] =
      Math.round(stats[k] * (k === "maxGuardCorrectionM" ? 10000 : 100)) /
      (k === "maxGuardCorrectionM" ? 10000 : 100);
  return {
    duration,
    period,
    scenarioId,
    scenarioLabel: scenario.label,
    profileId: profile.id,
    passengers: {
      before: scenario.initialPassengers,
      boarding: scenario.boarding,
      alighting: scenario.alighting,
      after: Math.min(
        profile.service.capacity,
        scenario.initialPassengers - scenario.alighting + scenario.boarding,
      ),
      capacity: profile.service.capacity,
      dwellSeconds: dwell,
    },
    specs: specs.map((v) => ({
      id: v.id,
      type: v.type,
      length: v.length,
      width: v.width,
      wheelbase: v.wheelbase,
      frontOverhang: v.frontOverhang,
    })),
    frames,
    stats,
    events,
    engine: "MIT IDM adapter + SmartBus controller; not SUMO",
    assumptions: {
      ...net.assumptions,
      busLengthM: bus.length,
      busWidthM: bus.width,
      vehicleGeometryEvidence:
        "8 m manufacturer-family reference; remaining geometry is assumed",
    },
  };
}
module.exports = { buildReplay };
if (require.main === module) {
  const dir = path.resolve(__dirname, "../../.artifacts/traffic-detail");
  const net = JSON.parse(
    fs.readFileSync(path.join(dir, "network.json"), "utf8"),
  );
  const scenarioId =
    process.argv.find((a) => a.startsWith("--scenario="))?.split("=")[1] ||
    "normal";
  const replay = buildReplay(net, scenarioId),
    file = path.join(dir, "replay-" + scenarioId + ".json");
  fs.writeFileSync(file, JSON.stringify(replay));
  if (scenarioId === "normal")
    fs.writeFileSync(path.join(dir, "replay.json"), JSON.stringify(replay));
  console.log(
    JSON.stringify({
      scenarioId,
      stats: replay.stats,
      events: replay.events,
      bytes: fs.statSync(file).size,
    }),
  );
  if (replay.stats.redCrossings || replay.stats.overlaps) process.exitCode = 1;
}
