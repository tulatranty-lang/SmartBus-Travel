const fs = require("node:fs");
const path = require("node:path");
const request = require("supertest");
const app = require("../../app");

describe("SmartBus 3 production delivery", () => {
  test("the default page serves React and every local entry asset with the right MIME type", async () => {
    const page = await request(app).get("/");
    expect(page.status).toBe(200);
    expect(page.text).toContain('<div id="root"></div>');
    expect(page.text).toMatch(/type="module"/);
    const local = [...page.text.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g)].map(
      (m) => m[1].slice(1),
    );
    expect(
      local.some((file) => file.startsWith("/assets/") && file.endsWith(".js")),
    ).toBe(true);
    for (const file of local) {
      const asset = await request(app).get(file);
      expect(asset.status).toBe(200);
      if (file.endsWith(".js"))
        expect(asset.headers["content-type"]).toMatch(/javascript/);
      if (file.endsWith(".css"))
        expect(asset.headers["content-type"]).toMatch(/css/);
    }
    expect(page.headers["cache-control"]).toContain("no-cache");
  });
  test("MapLibre uses a same-origin worker allowed by CSP and can reach OpenFreeMap", async () => {
    const files = fs.readdirSync(
      path.resolve(__dirname, "../../../frontend/app/assets"),
    );
    const worker = files.find((name) =>
      /^maplibre-gl-worker-.*\.js$/.test(name),
    );
    expect(worker).toBeDefined();
    const res = await request(app).get("/assets/" + worker);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/javascript/);
    expect(res.headers["cache-control"]).toContain("immutable");
    const csp = res.headers["content-security-policy"];
    expect(csp).toContain("worker-src 'self'");
    expect(csp).toMatch(/connect-src [^;]*https:\/\/tiles\.openfreemap\.org/);
    expect(csp).toContain("script-src-attr 'none'");
    expect(csp).not.toContain("unsafe-eval");
  });
  test("runtime configuration uses this server, remains uncached and exposes no secrets", async () => {
    const res = await request(app).get("/runtime-config.js");
    expect(res.status).toBe(200);
    expect(res.text).toContain('window.SMARTBUS_API_BASE="/api/v1"');
    expect(res.text).not.toMatch(/PASSWORD|SECRET|token/i);
    expect(res.headers["cache-control"]).toBe("no-store");
  });
  test("legacy stays available explicitly and neither UI exposes server files", async () => {
    const res = await request(app).get("/legacy/");
    expect(res.status).toBe(200);
    expect(res.text).toContain("script.js");
    for (const file of [
      "/.env",
      "/backend-api/.env",
      "/database/01_SCHEMA_SMARTBUS_CORE.sql",
      "/src/main.tsx",
      "/legacy/.env",
    ])
      expect((await request(app).get(file)).status).toBe(404);
  });
});
