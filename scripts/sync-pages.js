const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const root = path.resolve(__dirname, ".."),
  source = path.join(root, "frontend"),
  target = path.join(root, "docs");
let count = 0;
function sync(dir = "") {
  for (const e of fs.readdirSync(path.join(source, dir), {
    withFileTypes: true,
  })) {
    if (e.name.startsWith('qa-') || e.name.startsWith('.')) continue;
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) {
      sync(rel);
      continue;
    }
    const from = path.join(source, rel),
      to = path.join(target, rel);
    if (process.argv.includes("--check"))
      assert.ok(
        fs.existsSync(to) && fs.readFileSync(from).equals(fs.readFileSync(to)),
        `GitHub Pages is stale: ${rel}. Run npm run pages:sync.`,
      );
    else {
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
    }
    count++;
  }
}
sync();
console.log(
  `${count} frontend assets ${process.argv.includes("--check") ? "verified" : "synchronized"}.`,
);
