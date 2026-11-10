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
  const errors = [],
    missing = [],
    apiCalls = [];
  try {
    browser = await chromium.launch({
      headless: true,
      ...(process.env.SMARTBUS_BROWSER_CHANNEL
        ? { channel: process.env.SMARTBUS_BROWSER_CHANNEL }
        : {}),
    });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1050 },
      reducedMotion: "reduce",
    });
    await context.addInitScript(() => {
      window.SMARTBUS_PUBLIC_SNAPSHOT = true;
    });
    const page = await context.newPage(),
      base = "http://127.0.0.1:" + server.address().port + "/SmartBus-Travel/";
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => {
      if (r.url().startsWith(base) && r.status() >= 400)
        missing.push(r.status() + " " + r.url());
    });
    page.on("request", (r) => {
      if (new URL(r.url()).pathname.startsWith("/api/")) apiCalls.push(r.url());
    });
    await page.goto(base + "#/simulation");
    await page.getByTestId("simulation-page").waitFor();
    await page.getByText("Kim Long · 40 người", { exact: true }).waitFor();
    const screenshot = async (name) => {
      await page.evaluate(() =>
        window.scrollTo({ top: 0, behavior: "instant" }),
      );
      await page.screenshot({ path: path.join(out, name), fullPage: true });
    };
    await screenshot("desktop-follow.png");
    const start = await page.getByTestId("sim-clock").textContent();
    await page
      .getByRole("button", { name: "Phát mô phỏng", exact: true })
      .click();
    await page.waitForFunction(
      (previous) =>
        document.querySelector('[data-testid="sim-clock"]')?.textContent !==
        previous,
      start,
    );
    await page
      .getByRole("button", { name: "Tạm dừng mô phỏng", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Mở cửa đón khách", exact: true })
      .click();
    await page
      .getByText("Mở cửa · đón và trả khách", { exact: true })
      .first()
      .waitFor();
    assert.match(await page.getByTestId("sim-speed").textContent(), /^0,0$/);
    await screenshot("boarding.png");
    await page
      .getByRole("button", {
        name: "Bánh trước và đuôi xe khi cua",
        exact: true,
      })
      .click();
    await screenshot("corner.png");
    await page.getByRole("button", { name: "Đông khách", exact: true }).click();
    await page.getByText(/dừng 35,5 s/).waitFor();
    await page.getByRole("button", { name: "Đường ướt", exact: true }).click();
    await page.getByText(/Trần kịch bản 28 km\/h/).waitFor();
    await page.getByRole("button", { name: "Nguồn & độ chính xác" }).click();
    await page
      .getByRole("heading", { name: "Thông số nào đã được xác thực?" })
      .waitFor();
    await page
      .getByRole("link", { name: /cập nhật công khai trên LinkedIn/ })
      .waitFor();
    await page
      .getByRole("button", { name: "Đóng hộp thoại", exact: true })
      .click();
    await page.waitForFunction(() =>
      document.activeElement?.textContent?.includes("Nguồn & độ chính xác"),
    );
    await page.getByRole("button", { name: "Lớp bản đồ" }).click();
    await page.getByLabel("Điểm GPS gốc", { exact: true }).check();
    await page.getByLabel("Làn & điểm qua đường", { exact: true }).uncheck();
    await page.getByRole("button", { name: "Lớp bản đồ" }).click();
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await page
        .getByRole("button", { name: "Đặt lại góc nhìn", exact: true })
        .click();
      const size = await page.evaluate(() => ({
        width: innerWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      assert.ok(
        size.scroll <= size.width + 1,
        "horizontal overflow at " + width + " px: " + JSON.stringify(size),
      );
      await screenshot("mobile-" + width + ".png");
    }
    await page.setViewportSize({ width: 1440, height: 1050 });
    await page.goto(base + "#/routes");
    await page
      .getByRole("heading", { name: "Tuyến xe buýt", exact: true })
      .waitFor();
    await page
      .getByText("Sân bay Đà Nẵng – Đại học Việt Hàn", { exact: false })
      .first()
      .waitFor({ timeout: 10000 })
      .catch(async () => {
        assert.ok(
          (await page.locator(".route-card").count()) > 0,
          "public routes load from the committed snapshot",
        );
      });
    await page.goto(base + "#/");
    await page
      .getByRole("button", { name: "Xem chuyến xe mô phỏng" })
      .waitFor();
    await page.waitForFunction(() =>
      [...document.querySelectorAll(".stat-card strong")].some(
        (e) => e.textContent === "39",
      ),
    );
    const failedPage = await context.newPage();
    failedPage.on("pageerror", (e) => errors.push(e.message));
    await failedPage.route("**/simulation/v1/network.json", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: "{}",
      }),
    );
    await failedPage.goto(base + "#/simulation");
    await failedPage
      .getByRole("heading", { name: "Chưa tải được dữ liệu", exact: true })
      .waitFor();
    await failedPage.unroute("**/simulation/v1/network.json");
    await failedPage
      .getByRole("button", { name: "Thử lại", exact: true })
      .click();
    await failedPage.getByTestId("simulation-page").waitFor();
    await failedPage.close();
    assert.deepEqual(errors, []);
    assert.deepEqual(missing, []);
    assert.deepEqual(apiCalls, []);
    const report = {
      checkedAt: new Date().toISOString(),
      viewportWidths: [1440, 390, 320],
      scenarios: Object.keys(profile.scenarios),
      checks: [
        "play/pause",
        "boarding stops",
        "turn view",
        "wet-road and passenger calibration",
        "source links",
        "layers",
        "mobile overflow",
        "public routes and homepage",
        "no backend calls in public mode",
        "network error and retry",
      ],
      pageErrors: errors,
      missingAssets: missing,
    };
    fs.writeFileSync(
      path.join(out, "report.json"),
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report));
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
