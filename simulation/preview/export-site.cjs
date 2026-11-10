// Publish reproducible, public simulation inputs; no SQL/account data is read.
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const root = path.resolve(__dirname, "../..");
const dir = path.join(root, ".artifacts/traffic-detail");
const out = path.join(root, "web/public/simulation/v1");
const read = (name) =>
  JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
const profile = require("../profiles/dn06-citybus.json");
const n = read("network.json"),
  packed = read("preview-data.json");
const osm = fs.readFileSync(path.join(dir, "danang-detail.osm.xml"), "utf8");
const source = {
  osmBase: /osm_base="([^"]+)"/.exec(osm)?.[1],
  checkedAt: profile.version,
  license: "OpenStreetMap ODbL 1.0",
  boundingBox: [16.051, 108.216, 16.069, 108.254],
};
if (!source.osmBase) throw Error("OSM timestamp is required");
const network = {
  ...packed,
  version: "dn06-corridor-v1",
  path: n.path,
  prefix: n.prefix,
  curvature: n.curvature,
  length: n.length,
  source,
};
delete network.replay;
delete network.oldShape;
network.stop = { ...n.stop };
delete network.stop.duration;
network.pathGeneration = {
  spacingM: 0.5,
  connectorWindowM: 14,
  lateralCorrections: n.clearanceCorrections || [],
  status: "generated, pending field validation",
};
network.clearanceByScenario = Object.fromEntries(
  Object.keys(profile.scenarios).map((id) => [
    id,
    read("clearance-" + id + ".json"),
  ]),
);
network.clearance = Object.values(network.clearanceByScenario).sort(
  (a, b) => b.maxOutsideEstimatedAsphaltM - a.maxOutsideEstimatedAsphaltM,
)[0];
network.assumptions = {
  ...n.assumptions,
  busLengthM: profile.vehicle.length,
  busWidthM: profile.vehicle.width,
  officialRouteConfirmed: false,
};
fs.mkdirSync(out, { recursive: true });
const put = (name, value) =>
  fs.writeFileSync(
    path.join(out, name),
    typeof value === "string" ? value : JSON.stringify(value),
  );
put("network.json", network);
put("profile.json", profile);
for (const scenario of Object.keys(profile.scenarios))
  put("replay-" + scenario + ".json", read("replay-" + scenario + ".json"));
put(
  "NOTICE.txt",
  fs.readFileSync(
    path.join(root, "simulation/preview/THIRD_PARTY_NOTICES.md"),
    "utf8",
  ).replace(/\r\n/g, '\n') +
    "\n\nOSM snapshot: " +
    source.osmBase +
    "\nBounding box (south, west, north, east): " +
    source.boundingBox.join(", ") +
    "\nDerived map data: network.json in this directory. Original GPS anchors remain separate.\nRebuild instructions: https://github.com/tulatranty-lang/SmartBus-Travel/tree/main/simulation\n",
);
const names = [
  "network.json",
  "profile.json",
  "replay-normal.json",
  "replay-busy.json",
  "replay-rain.json",
  "NOTICE.txt",
];
put("manifest.json", {
  version: network.version,
  generatedAt: profile.version,
  source,
  files: names.map((name) => {
    const bytes = fs.readFileSync(path.join(out, name));
    return {
      name,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
  }),
});
console.log(
  JSON.stringify({
    directory: "web/public/simulation/v1",
    files: names.length + 1,
    bytes: names.reduce(
      (sum, name) => sum + fs.statSync(path.join(out, name)).size,
      0,
    ),
  }),
);
