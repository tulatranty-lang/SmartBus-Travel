/*
 * IDM acceleration adapted from BilHim/trafficSimulator (MIT).
 * Copyright (c) 2023 Bilal Himite. Full license: THIRD_PARTY_NOTICES.md.
 * Source commit 581ce3fc9200fc49e6a3f265dfd8627c9b7f759c.
 * Scenario/ballistic integration/guards/replay are SmartBus preview additions.
 */
function acceleration(vehicle, leader, desiredSpeed) {
  const desired = Math.max(0.5, desiredSpeed);
  let alpha = 0;
  if (leader) {
    const gap = Math.max(0.05, leader.s - vehicle.s - leader.length);
    const dv = vehicle.v - leader.v;
    const desiredGap =
      vehicle.minGap +
      Math.max(
        0,
        vehicle.headway * vehicle.v +
          (dv * vehicle.v) / (2 * Math.sqrt(vehicle.accel * vehicle.decel)),
      );
    alpha = desiredGap / gap;
  }
  return Math.max(
    -vehicle.emergencyDecel,
    Math.min(
      vehicle.accel,
      vehicle.accel * (1 - (vehicle.v / desired) ** 4 - alpha ** 2),
    ),
  );
}

function step(vehicle, leader, desiredSpeed, dt) {
  if (!(dt > 0 && dt <= 0.1))
    throw new Error("Preview timestep must be 0–0.1 s");
  const targetA = acceleration(vehicle, leader, desiredSpeed);
  const previousA = vehicle.commandA ?? vehicle.a ?? 0;
  const a = vehicle.jerk
    ? Math.max(
        previousA - vehicle.jerk * dt,
        Math.min(previousA + vehicle.jerk * dt, targetA),
      )
    : targetA;
  const nextV = Math.max(0, vehicle.v + a * dt);
  let ds =
    nextV === 0 && a < 0
      ? vehicle.v ** 2 / (-2 * a)
      : vehicle.v * dt + 0.5 * a * dt * dt;
  ds = Math.max(0, ds);
  let s = vehicle.s + ds;
  let v = nextV;
  // Guard discrete integration against crossing a stop line or a leader.
  // Interventions are counted separately; they never silently become validation.
  let guard = false;
  let guardCorrection = 0;
  if (leader && s > leader.s - leader.length - vehicle.minGap) {
    guardCorrection = s - (leader.s - leader.length - vehicle.minGap);
    s = Math.max(vehicle.s, leader.s - leader.length - vehicle.minGap);
    v = Math.min(v, leader.v);
    guard = true;
  }
  return {
    ...vehicle,
    s,
    v,
    a: (v - vehicle.v) / dt,
    commandA: a,
    guard,
    guardCorrection,
  };
}

function signalAt(time, offset = 0) {
  const t = (((time + offset) % 80) + 80) % 80;
  if (t < 30)
    return {
      main: "red",
      cross: t < 26 ? "green" : t < 29 ? "yellow" : "red",
      remaining: 30 - t,
    };
  if (t < 67) return { main: "green", cross: "red", remaining: 67 - t };
  if (t < 71) return { main: "yellow", cross: "red", remaining: 71 - t };
  return { main: "red", cross: "red", remaining: 80 - t };
}

module.exports = { acceleration, step, signalAt };
