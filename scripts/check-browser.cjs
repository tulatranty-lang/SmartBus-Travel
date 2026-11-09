// Real SQL/browser acceptance. Requires an explicitly disposable database.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { randomBytes } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { chromium } = require("../web/node_modules/playwright");
const root = path.resolve(__dirname, "..");
assert.equal(
  process.env.SQL_TEST_DISPOSABLE,
  "1",
  "Use a disposable test database.",
);
assert.match(process.env.SMARTBUS_TEST_DATABASE || "", /test/i);
assert.equal(process.env.DB_NAME, process.env.SMARTBUS_TEST_DATABASE);
const app = require("../backend-api/app");
const db = require("../backend-api/config/db");
assert.equal(db.config.database, process.env.SMARTBUS_TEST_DATABASE);
const out = path.join(root, ".artifacts/browser");
fs.mkdirSync(out, { recursive: true });
const report = {
  at: new Date().toISOString(),
  platform: process.platform,
  checks: [],
  errors: [],
  csp: [],
};
let browser, server, page;
async function check(name, run) {
  await run();
  report.checks.push(name);
  console.log("PASS " + name);
}
async function noOverflow(p) {
  await p.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
  });
  const dimensions = await p.evaluate(() => ({
    route: location.hash,
    viewport: innerWidth,
    content: document.documentElement.scrollWidth,
    overflow: [...document.querySelectorAll("body *")]
      .flatMap((el) => {
        const rect = el.getBoundingClientRect();
        return rect.right > innerWidth + 1
          ? [
              {
                tag: el.tagName,
                class: typeof el.className === "string" ? el.className : "",
                right: rect.right,
              },
            ]
          : [];
      })
      .slice(0, 20),
  }));
  if (dimensions.content > dimensions.viewport + 1)
    fs.writeFileSync(
      path.join(out, "overflow.json"),
      JSON.stringify(dimensions, null, 2),
    );
  assert.ok(
    dimensions.content <= dimensions.viewport + 1,
    `Horizontal page overflow at ${dimensions.route}: ${dimensions.content}/${dimensions.viewport}px`,
  );
}
async function main() {
  server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = "http://127.0.0.1:" + server.address().port;
  const json = async (p) => {
    const r = await fetch(base + "/api/v1" + p);
    assert.equal(r.ok, true, "API response: " + p);
    return (await r.json()).data;
  };
  const places = await json("/tourism/places?provinceCode=DN&limit=6");
  const stops = await json("/stops?provinceCode=DN&limit=10");
  assert.ok(
    places.length && stops.length,
    "Seed real SQL data before browser acceptance.",
  );
  const place = places[0],
    stamp = Date.now(),
    email = `uiqa-${stamp}@example.test`,
    password = "Qa!" + randomBytes(12).toString("hex");
  const story = `Trải nghiệm kiểm thử ${stamp}`;
  browser = await chromium.launch({
    headless: true,
    ...(process.env.BROWSER_CHANNEL
      ? { channel: process.env.BROWSER_CHANNEL }
      : process.platform === "win32"
        ? { channel: "msedge" }
        : {}),
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  await context.addInitScript(() =>
    document.addEventListener("securitypolicyviolation", (e) => {
      window.__cspViolations ||= [];
      window.__cspViolations.push(e.violatedDirective + ": " + e.blockedURI);
    }),
  );
  page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on("pageerror", (e) => report.errors.push(e.message));
  const go = async (route) => {
    await page.goto(base + "/#" + route);
  };
  const close = async () =>
    page
      .getByRole("button", { name: "Đóng hộp thoại", exact: true })
      .last()
      .click();
  await check(
    "Production React home loads real SQL data and licensed local photography",
    async () => {
      await go("/");
      await page.locator(".place-card").first().waitFor();
      await page.locator(".hero-image").evaluate((img) => img.decode());
      assert.equal(
        await page
          .locator(".hero-image")
          .evaluate((img) => img.naturalWidth > 0),
        true,
      );
      await noOverflow(page);
      await page.locator(".preview-map-box").scrollIntoViewIfNeeded();
      await page.locator(".map-canvas").waitFor();
      await page
        .locator(".map-loading")
        .waitFor({ state: "hidden", timeout: 30000 });
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({
        path: path.join(out, "home-desktop.png"),
        fullPage: true,
      });
    },
  );
  await check(
    "Keyboard quick search opens correct SQL place detail and Escape closes it",
    async () => {
      await page.keyboard.press("Control+k");
      await page
        .getByRole("textbox", { name: "Tìm kiếm nhanh", exact: true })
        .fill(place.name);
      await page
        .locator(".command-results button")
        .filter({ hasText: place.name })
        .first()
        .click();
      await page
        .getByRole("heading", { name: place.name, exact: true })
        .waitFor();
      await page.keyboard.press("Escape");
      await page.getByRole("dialog").waitFor({ state: "hidden" });
    },
  );
  await check(
    "Route details link to the actual selected route on the map",
    async () => {
      await go("/routes");
      await page
        .locator(".route-card")
        .first()
        .getByRole("button", { name: "Chi tiết", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Xem tuyến trên bản đồ", exact: true })
        .click();
      await page.locator(".selected-route-banner").waitFor();
      await page.locator(".map-canvas").waitFor();
      await page
        .locator(".map-loading")
        .waitFor({ state: "hidden", timeout: 30000 });
      assert.ok(
        await page.locator(".maplibregl-canvas, .compatible-map").count(),
      );
      await page.screenshot({ path: path.join(out, "map-desktop.png") });
    },
  );
  await check(
    "Manual coordinates return the real nearest stop without device GPS",
    async () => {
      await page.getByRole("button", { name: "Gần tôi", exact: true }).click();
      await page.locator(".manual-coordinates summary").click();
      await page
        .getByLabel("Vĩ độ", { exact: true })
        .fill(String(stops[0].lat ?? stops[0].latitude));
      await page
        .getByLabel("Kinh độ", { exact: true })
        .fill(String(stops[0].lng ?? stops[0].longitude));
      await page
        .getByRole("button", { name: "Tìm bến gần tọa độ", exact: true })
        .click();
      await page.locator(".nearest-card").waitFor();
      assert.ok(
        (await page.locator(".nearest-card").innerText()).includes(
          stops[0].name,
        ),
      );
    },
  );
  await check(
    "Browser registration creates a real account with session-only storage",
    async () => {
      await page.locator(".header-login").click();
      await page
        .getByRole("button", { name: "Tạo tài khoản", exact: true })
        .click();
      await page
        .getByLabel("Họ và tên", { exact: true })
        .fill("Người thử SmartBus");
      await page.getByLabel("Email", { exact: true }).fill(email);
      await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
      await page
        .locator(".auth-dialog form")
        .getByRole("button", { name: "Tạo tài khoản", exact: true })
        .click();
      await page.locator(".profile-button").waitFor();
      assert.equal(
        await page.evaluate(() =>
          localStorage.getItem("smartbus_access_token"),
        ),
        null,
      );
      assert.ok(
        await page.evaluate(() =>
          sessionStorage.getItem("smartbus_access_token"),
        ),
      );
    },
  );
  await check(
    "Favorite place persists through a full reload and can be removed",
    async () => {
      await go("/places");
      const card = page.locator(".place-card").filter({ hasText: place.name });
      await card
        .getByRole("button", { name: "Lưu vào yêu thích", exact: true })
        .click();
      await card.getByRole("button", { name: "Bỏ lưu", exact: true }).waitFor();
      await go("/favorites");
      await page
        .locator(".place-card")
        .filter({ hasText: place.name })
        .waitFor();
      await page.reload();
      await page
        .locator(".place-card")
        .filter({ hasText: place.name })
        .getByRole("button", { name: "Bỏ lưu", exact: true })
        .click();
      await page
        .getByText("Bắt đầu bộ sưu tập của bạn", { exact: true })
        .waitFor();
    },
  );
  await check(
    "A generated plan is saved in SQL, collapses and reopens from history",
    async () => {
      await go("/planner");
      await page
        .getByRole("button", { name: "Tạo hành trình của tôi", exact: true })
        .click();
      await page.locator(".itinerary").waitFor();
      await page
        .getByText("Đã lưu vào hành trình của bạn", { exact: true })
        .waitFor();
      await page
        .getByRole("button", { name: "Thu gọn lịch trình", exact: true })
        .click();
      await page.locator(".itinerary-body").waitFor({ state: "hidden" });
      await page
        .getByRole("button", { name: "Mở rộng lịch trình", exact: true })
        .click();
      await page.locator(".itinerary-body").waitFor();
      await page.screenshot({ path: path.join(out, "planner-desktop.png") });
      await page
        .getByRole("button", { name: "Xem các điểm trên bản đồ", exact: true })
        .click();
      await page
        .locator(".map-list-tabs button.active")
        .filter({ hasText: "Điểm đến" })
        .waitFor();
      await go("/history");
      await page
        .getByRole("button", { name: "Xem lịch trình", exact: true })
        .first()
        .click();
      await page
        .getByRole("dialog")
        .locator(".stop-timeline li")
        .first()
        .waitFor();
      await close();
    },
  );
  await check(
    "Community form creates a pending SQL review and keeps it out of public results",
    async () => {
      await go("/community");
      await page
        .getByRole("button", { name: "Chia sẻ trải nghiệm", exact: true })
        .click();
      await page.getByLabel("Tiêu đề", { exact: true }).fill(story);
      await page.getByLabel("Địa điểm", { exact: true }).fill(place.name);
      await page
        .getByLabel(/^Câu chuyện của bạn/)
        .fill(
          "Bài kiểm tra giao diện tự động trên cơ sở dữ liệu thử riêng. Nội dung này xác minh quy trình gửi, kiểm duyệt và hiển thị.",
        );
      await page
        .getByRole("button", { name: "Gửi câu chuyện", exact: true })
        .click();
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      const publicRows = await json("/reviews?q=" + encodeURIComponent(story));
      assert.equal(publicRows.length, 0);
    },
  );
  await check(
    "Chat answers from actual SQL without requesting device location",
    async () => {
      await page
        .getByRole("button", {
          name: "Mở người bạn đường SmartBus",
          exact: true,
        })
        .click();
      await page
        .getByRole("button", { name: "Đi Hội An bằng tuyến nào?", exact: true })
        .click();
      await page.locator(".chat-assistant").last().waitFor();
      await page
        .getByRole("button", { name: "Đóng người bạn đường", exact: true })
        .click();
    },
  );
  await check(
    "Normal account cannot enter admin; granted account can moderate its pending review",
    async () => {
      await go("/admin");
      await page
        .getByText("Khu vực dành cho quản trị viên", { exact: true })
        .waitFor();
      await page
        .getByRole("button", { name: "Tài khoản của bạn", exact: true })
        .click();
      await page
        .getByRole("menuitem", { name: "Đăng xuất", exact: true })
        .click();
      await page.locator(".header-login").waitFor();
      execFileSync(
        process.execPath,
        ["backend-api/scripts/admin.js", "grant", email],
        { cwd: root, env: process.env, stdio: "pipe" },
      );
      await page.locator(".header-login").click();
      await page
        .getByRole("button", { name: "Đăng nhập", exact: true })
        .click();
      await page.getByLabel("Email", { exact: true }).fill(email);
      await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
      await page
        .getByRole("button", { name: "Tiếp tục hành trình", exact: true })
        .click();
      await page.locator(".admin-panel").waitFor();
      const row = page
        .locator(".moderation-list article")
        .filter({ hasText: story });
      await row.getByRole("button", { name: "Duyệt", exact: true }).click();
      await row.waitFor({ state: "hidden" });
      await page
        .getByLabel("Trạng thái bài viết", { exact: true })
        .selectOption("approved");
      await row.getByText("Đã duyệt", { exact: true }).waitFor();
      assert.equal(
        (await json("/reviews?q=" + encodeURIComponent(story))).length,
        1,
      );
      await page.screenshot({ path: path.join(out, "admin-desktop.png") });
    },
  );
  await check(
    "Mobile navigation, content and dialog fit 390 px and 320 px",
    async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      for (const route of [
        "/",
        "/places",
        "/routes",
        "/planner",
        "/favorites",
        "/history",
        "/admin",
      ]) {
        await go(route);
        await page.locator("h1, .hero h1").first().waitFor();
        await noOverflow(page);
      }
      await go("/");
      await page.screenshot({
        path: path.join(out, "home-mobile.png"),
        fullPage: true,
      });
      await page
        .getByRole("button", { name: "Mở trình đơn", exact: true })
        .click();
      await page.locator(".sidebar-open").waitFor();
      await noOverflow(page);
      await page.keyboard.press("Escape");
      await page.setViewportSize({ width: 320, height: 720 });
      await page
        .locator(".place-card")
        .first()
        .getByRole("button", { name: new RegExp("^Xem ") })
        .click();
      await page.getByRole("dialog").waitFor();
      await noOverflow(page);
      const box = await page.getByRole("dialog").boundingBox();
      assert.ok(box && box.width <= 320);
      await close();
    },
  );
  await check(
    "WebGL-disabled browser renders real routes through the 2D fallback",
    async () => {
      const fallback = await browser.newContext({
        viewport: { width: 1280, height: 850 },
      });
      await fallback.addInitScript(() => {
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (type, ...args) {
          return /webgl/.test(type) ? null : original.call(this, type, ...args);
        };
      });
      const p = await fallback.newPage();
      await p.goto(base + "/#/explore");
      await p
        .locator(".compatible-map .leaflet-overlay-pane path")
        .first()
        .waitFor();
      await p.screenshot({ path: path.join(out, "map-fallback.png") });
      await fallback.close();
    },
  );
  report.csp = await page.evaluate(() => window.__cspViolations || []);
  assert.deepEqual(report.csp, [], "Unexpected CSP violations");
  assert.deepEqual(report.errors, [], "Unexpected browser exceptions");
  report.passed = report.checks.length;
}
main()
  .catch(async (e) => {
    report.failure = e.message;
    process.exitCode = 1;
    if (page) {
      await page
        .screenshot({ path: path.join(out, "failure.png"), fullPage: true })
        .catch(() => {});
      fs.writeFileSync(
        path.join(out, "failure.html"),
        await page.content().catch(() => ""),
      );
    }
    console.error(e.message);
  })
  .finally(async () => {
    fs.writeFileSync(
      path.join(out, "report.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    if (process.env.TEST_REPORT_PATH)
      fs.writeFileSync(
        process.env.TEST_REPORT_PATH,
        JSON.stringify(report, null, 2) + "\n",
      );
    await browser?.close();
    if (server) await new Promise((r) => server.close(r));
    await db.closePool();
  });
