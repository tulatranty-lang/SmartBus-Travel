const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "..");
const source = path.join(root, "frontend/app");
const target = path.join(root, "docs");
const manifest = path.join(target, "app-assets.json");
const check = process.argv.includes("--check");
assert.ok(
  fs.existsSync(path.join(source, "index.html")),
  "Run npm run ui:build before synchronizing GitHub Pages.",
);

function files(dir = "") {
  return fs
    .readdirSync(path.join(source, dir), { withFileTypes: true })
    .flatMap((e) => {
      const rel = path.posix.join(dir, e.name);
      return e.isDirectory() ? files(rel) : [rel];
    });
}
const current = files().sort();
const previous = fs.existsSync(manifest)
  ? JSON.parse(fs.readFileSync(manifest, "utf8"))
  : [];
// Only remove files owned by an earlier UI build. Never clear docs/current or other documentation.
for (const rel of previous) {
  const file = path.resolve(target, rel);
  assert.ok(file.startsWith(target + path.sep), "Unsafe asset manifest path");
  if (!current.includes(rel)) {
    if (check)
      assert.ok(
        !fs.existsSync(file),
        `Stale UI asset: ${rel}. Run npm run pages:sync.`,
      );
    else fs.rmSync(file, { force: true });
  }
}
for (const rel of current) {
  const from = path.join(source, rel),
    to = path.join(target, rel);
  if (check)
    assert.ok(
      fs.existsSync(to) && fs.readFileSync(from).equals(fs.readFileSync(to)),
      `GitHub Pages is stale: ${rel}. Run npm run pages:sync.`,
    );
  else {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
  }
}
if (check) {
  assert.deepEqual(
    previous,
    current,
    "GitHub Pages asset manifest is stale. Run npm run pages:sync.",
  );
  assert.ok(
    fs.existsSync(path.join(target, ".nojekyll")),
    "Missing GitHub Pages .nojekyll marker",
  );
} else {
  fs.writeFileSync(manifest, JSON.stringify(current, null, 2) + "\n");
  fs.writeFileSync(path.join(target, ".nojekyll"), "");
}
console.log(
  `${current.length} SmartBus 3 assets ${check ? "verified" : "synchronized"}.`,
);
