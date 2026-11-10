const fs = require("node:fs");
const path = require("node:path");
const { randomBytes } = require("node:crypto");
const root = path.resolve(__dirname, "..");
const target = path.join(root, "backend-api/.env");
if (!fs.existsSync(target))
  fs.copyFileSync(path.join(root, "backend-api/.env.example"), target);
let text = fs.readFileSync(target, "utf8");
for (const key of ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"]) {
  const line = new RegExp(`^${key}=(.*)$`, "m");
  const value = text.match(line)?.[1]?.trim() || "";
  if (!value || /change_me|dev_only/.test(value)) {
    const replacement = `${key}=${randomBytes(48).toString("hex")}`;
    text = line.test(text)
      ? text.replace(line, replacement)
      : `${text}\n${replacement}\n`;
  }
}
fs.writeFileSync(target, text, { mode: 0o600 });
console.log(
  "Local configuration ready. Set DB_SERVER/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD in backend-api/.env. Existing non-default secrets are preserved.",
);
