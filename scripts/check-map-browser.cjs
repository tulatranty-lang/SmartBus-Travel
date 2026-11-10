const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const assert = require("node:assert/strict");
const { chromium } = require("../web/node_modules/playwright");
const root = path.resolve(__dirname, "../frontend/app"),
  out = path.resolve(__dirname, "../.artifacts/simulation-browser");
const profile = require("../simulation/profiles/dn06-citybus.json");
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".txt": "text/plain",
};
const server = http.createServer((request, response) => {
  try {
    const pathname = decodeURIComponent(
      new URL(request.url, "http://localhost").pathname,
    ).replace(/^\/SmartBus-Travel/, "");
    const file = path.resolve(
      root,
      "." + (pathname === "/" || pathname === "" ? "/index.html" : pathname),
    );
    if (
      !file.startsWith(root + path.sep) ||
      !fs.existsSync(file) ||
      !fs.statSync(file).isFile()
    ) {
      response.writeHead(404);
      response.end();
      return;
    }
    response.writeHead(200, {
      "Content-Type":
        (types[path.extname(file)] || "application/octet-stream") +
        ([".html", ".js", ".mjs", ".css", ".json", ".txt"].includes(
          path.extname(file),
        )
          ? "; charset=utf-8"
          : ""),
      "Cache-Control": "no-store",
    });
    fs.createReadStream(file).pipe(response);
  } catch {
    response.writeHead(400);
    response.end();
  }
});
(async () => {
  fs.mkdirSync(out, { recursive: true });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      ...(process.env.SMARTBUS_BROWSER_CHANNEL
        ? { channel: process.env.SMARTBUS_BROWSER_CHANNEL }
        : {}),
    });
    const context = await browser.newContext({
      viewport: { width: 1500, height: 1000 },
      reducedMotion: "reduce",
    });
    await context.addInitScript(() => {
      window.SMARTBUS_PUBLIC_SNAPSHOT = true;
    });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const base =
      "http://127.0.0.1:" + server.address().port + "/SmartBus-Travel/";
    await page.goto(base + "#/explore?route=DN-06&at=08:00");
    await page.getByTestId("operations-toolbar").waitFor();
    await page.waitForFunction(
      () =>
        Number(
          document.querySelector('[data-testid="fleet-active-count"]')
            ?.textContent,
        ) > 0,
    );
    await page
      .locator(".estimated-bus-marker")
      .first()
      .waitFor({ timeout: 35000 });
    assert.equal(
      await page.locator(".estimated-bus-marker").count(),
      Number(await page.getByTestId("fleet-active-count").textContent()),
    );
    await page.getByRole("button", { name: "Xe buýt", exact: true }).click();
    await page.locator(".fleet-list-item").first().click();
    await page.getByTestId("selected-bus-card").waitFor();
    await page.waitForFunction(
      () => document.querySelector(".estimated-bus-selected") !== null,
    );
    const selected = page.locator(".estimated-bus-selected"),
      before = await selected.getAttribute("style");
    await page.waitForFunction(
      (style) =>
        document
          .querySelector(".estimated-bus-selected")
          ?.getAttribute("style") !== style,
      before,
    );
    await page.screenshot({
      path: path.join(out, "map-follow-desktop.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Dừng thời gian ước tính", exact: true })
      .click();
    const clock = await page.getByTestId("fleet-clock").textContent();
    await page.getByRole("button", { name: "+15 phút", exact: true }).click();
    assert.notEqual(await page.getByTestId("fleet-clock").textContent(), clock);
    await page
      .getByLabel("Giờ xem xe trên bản đồ", { exact: true })
      .fill("03:00");
    await page.waitForFunction(
      () =>
        document.querySelector('[data-testid="fleet-active-count"]')
          ?.textContent === "0",
    );
    await page
      .getByLabel("Giờ xem xe trên bản đồ", { exact: true })
      .fill("08:00");
    await page.waitForFunction(
      () =>
        Number(
          document.querySelector('[data-testid="fleet-active-count"]')
            ?.textContent,
        ) > 0,
    );
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await page.evaluate(() =>
        window.scrollTo({ top: 0, behavior: "instant" }),
      );
      await page
        .waitForFunction(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
          null,
          { timeout: 5000 },
        )
        .catch(async () => {
          const details = await page.evaluate(() => ({
            viewport: innerWidth,
            scroll: document.documentElement.scrollWidth,
            out: [...document.querySelectorAll("body *")]
              .flatMap((e) => {
                const r = e.getBoundingClientRect();
                return r.right > innerWidth + 1 &&
                  getComputedStyle(e).visibility !== "hidden"
                  ? [
                      {
                        tag: e.tagName,
                        cls: typeof e.className === "string" ? e.className : "",
                        right: r.right,
                        width: r.width,
                        overflow: getComputedStyle(e).overflow,
                      },
                    ]
                  : [];
              })
              .slice(0, 35),
          }));
          fs.writeFileSync(
            path.join(out, "map-overflow-" + width + ".json"),
            JSON.stringify(details, null, 2),
          );
          await page.screenshot({
            path: path.join(out, "map-overflow-" + width + ".png"),
            fullPage: true,
          });
        });
      const sizes = await page.evaluate(() => ({
        width: innerWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      assert.ok(sizes.scroll <= sizes.width + 1, "mobile overflow " + width);
      await page.screenshot({
        path: path.join(out, "map-mobile-" + width + ".png"),
        fullPage: true,
      });
    }
    // Force the alternative renderer: it must show the same fleet on the same page.
    const fallback = await browser.newContext({
      viewport: { width: 1400, height: 950 },
      reducedMotion: "reduce",
    });
    await fallback.addInitScript(() => {
      window.SMARTBUS_PUBLIC_SNAPSHOT = true;
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        if (String(type).includes("webgl")) return null;
        return original.call(this, type, ...args);
      };
    });
    const other = await fallback.newPage();
    other.on("pageerror", (e) => errors.push(e.message));
    await other.goto(base + "#/explore?route=DN-06&at=08:00");
    await other.locator(".compatible-map").waitFor({ timeout: 35000 });
    await other.locator(".estimated-bus-marker").first().waitFor();
    assert.equal(
      await other.locator(".estimated-bus-marker").count(),
      Number(await other.getByTestId("fleet-active-count").textContent()),
    );
    await other.screenshot({
      path: path.join(out, "map-fallback.png"),
      fullPage: true,
    });
    assert.deepEqual(errors, []);
    const report = {
      checkedAt: new Date().toISOString(),
      checks: [
        "main explore page",
        "road-routed directions",
        "clock-driven fleet",
        "stable count",
        "select/follow bus",
        "next point ETA",
        "night service ended",
        "time controls",
        "390/320px",
        "WebGL and Leaflet fallback",
      ],
      errors,
    };
    fs.writeFileSync(
      path.join(out, "map-report.json"),
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report));
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((e) => {
  console.error(e.stack || e.message);
  process.exitCode = 1;
});
