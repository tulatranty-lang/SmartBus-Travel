// Kinematic bicycle constrained by a path for the FRONT BUMPER.
// A point L = wheelbase + front overhang ahead of the rear axle has velocity
// angle beta = atan(L / wheelbase * tan(delta)) relative to the body.
// Keep the rendered front bumper, axle positions and rear tracking consistent.
function followFrontBumper(
  front,
  previousRear,
  heading,
  wheelbase,
  frontOverhang,
) {
  const distance = wheelbase + frontOverhang;
  const oldRear = previousRear || [
    front[0] - distance * Math.cos(heading),
    front[1] - distance * Math.sin(heading),
  ];
  const bodyAngle = Math.atan2(front[1] - oldRear[1], front[0] - oldRear[0]);
  const beta = Math.atan2(
    Math.sin(heading - bodyAngle),
    Math.cos(heading - bodyAngle),
  );
  return {
    bodyAngle,
    steer: Math.atan((wheelbase / distance) * Math.tan(beta)),
    rear: [
      front[0] - distance * Math.cos(bodyAngle),
      front[1] - distance * Math.sin(bodyAngle),
    ],
  };
}
module.exports = { followFrontBumper };
