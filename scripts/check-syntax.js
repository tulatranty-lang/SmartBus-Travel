const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
let count = 0;
function visit(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (
      entry.name === "node_modules" ||
      entry.name === "coverage" ||
      entry.name.startsWith(".")
    )
      continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) visit(file);
    else if (entry.name.endsWith(".js") || entry.name.endsWith(".cjs")) {
      execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
      count++;
    }
  }
}
for (const name of ["backend-api", "frontend", "scripts"])
  visit(path.join(root, name));
console.log(`${count} JavaScript files parsed successfully.`);
