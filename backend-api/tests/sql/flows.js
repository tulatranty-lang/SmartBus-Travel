/* Real SQL integration. Run only against an explicitly designated disposable DB. */
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const request = require("supertest");
const db = require("../../config/db");
const results = [];
const prefix = "/api/v1";
let app, engine;
async function call(method, url, status, body, token) {
  let req = request(app)[method](prefix + url);
  if (token) req = req.set("Authorization", `Bearer ${token}`);
  if (body) req = req.send(body);
  const res = await req;
  assert.equal(
    res.status,
    status,
    `${method} ${url}: ${res.status} ${res.body.message}`,
  );
  return res.body;
}
async function check(name, fn) {
  const start = performance.now();
  try {
    await fn();
    results.push({
      name,
      pass: true,
      ms: Math.round(performance.now() - start),
    });
    console.log("PASS", name);
  } catch (e) {
    results.push({ name, pass: false });
    throw e;
  }
}
async function main() {
  assert.equal(
    process.env.SQL_TEST_DISPOSABLE,
    "1",
    "Explicit SQL_TEST_DISPOSABLE=1 required",
  );
  assert.equal(
    db.config.database,
    process.env.SMARTBUS_TEST_DATABASE,
    "Target must match SMARTBUS_TEST_DATABASE",
  );
  assert.match(
    db.config.database,
    /test|qa/i,
    "Refuse production-like database name",
  );
  app = require("../../app");
  engine = (
    await db.query(
      "SELECT CAST(SERVERPROPERTY('ProductVersion') AS varchar(40)) version, CAST(SERVERPROPERTY('Edition') AS varchar(120)) edition",
    )
  ).recordset[0];
  const suffix = randomUUID().slice(0, 8);
  const email = `qa-${suffix}@example.test`,
    otherEmail = `qa-other-${suffix}@example.test`;
  const password = `Qa!${randomUUID()}`;
  let user, other, admin, placeId, routeId, reviewId, planId, customId;
  const login = async (mail = email) =>
    (await call("post", "/auth/login", 200, { email: mail, password })).data;
  await check("database and migration journal", async () => {
    assert.equal((await db.healthCheck()).connected, true);
    assert.equal(
      (await db.query("SELECT COUNT(*) n FROM smartbus_migrations"))
        .recordset[0].n,
      13,
    );
  });
  await check(
    "register hashes password and returns private profile",
    async () => {
      user = (
        await call("post", "/auth/register", 201, {
          fullName: "QA SmartBus",
          email,
          password,
        })
      ).data;
      assert.ok(user.token);
      assert.equal(user.user.passwordHash, undefined);
      const row = (
        await db.query("SELECT password_hash hash FROM users WHERE id=@id", {
          id: user.user.id,
        })
      ).recordset[0];
      assert.ok(await require("bcryptjs").compare(password, row.hash));
      assert.notEqual(row.hash, password);
      other = (
        await call("post", "/auth/register", 201, {
          fullName: "QA Other",
          email: otherEmail,
          password,
        })
      ).data;
    },
  );
  await check("invalid registration and duplicate email", async () => {
    await call("post", "/auth/register", 422, {
      fullName: "",
      email: "wrong",
      password: "x",
    });
    await call("post", "/auth/register", 409, {
      fullName: "Duplicate",
      email,
      password,
    });
  });
  await check("wrong password and SQL injection login rejected", async () => {
    await call("post", "/auth/login", 401, {
      email,
      password: "wrong-password",
    });
    await call("post", "/auth/login", 422, { email: "' OR 1=1--", password });
  });
  await check("current authenticated profile", async () => {
    const r = await call("get", "/users/me", 200, null, user.token);
    assert.equal(r.data.email, email);
  });
  await check(
    "refresh rotation concurrency and replay prevention",
    async () => {
      const previousToken = user.refreshToken;
      const pair = await Promise.all(
        [0, 1].map(() =>
          request(app)
            .post(prefix + "/auth/refresh-token")
            .send({ refreshToken: user.refreshToken }),
        ),
      );
      assert.deepEqual(pair.map((r) => r.status).sort(), [200, 401]);
      const fresh = pair.find((r) => r.status === 200).body.data;
      assert.notEqual(fresh.refreshToken, user.refreshToken);
      user = fresh;
      await call("post", "/auth/refresh-token", 401, {
        refreshToken: previousToken,
      });
    },
  );
  await check("normal user cannot access administration", async () => {
    await call("get", "/admin/reviews", 403, null, user.token);
  });
  await check("grant admin invalidates old session", async () => {
    await require("../../scripts/admin").role(email, true);
    await call("get", "/users/me", 401, null, user.token);
    admin = await login();
    assert.equal(admin.user.role, "admin");
    await call("get", "/admin/reviews/pending", 200, null, admin.token);
  });
  await check("suspended account denied immediately", async () => {
    await db.query("UPDATE users SET is_active=0 WHERE id=@id", {
      id: other.user.id,
    });
    await call("get", "/users/me", 401, null, other.token);
    await db.query("UPDATE users SET is_active=1 WHERE id=@id", {
      id: other.user.id,
    });
  });
  await check("public route and tourism queries use SQL", async () => {
    const routes = await call("get", "/routes?limit=10", 200);
    assert.ok(routes.data.length);
    routeId = routes.data[0].id;
    const places = await call("get", "/tourism/places?limit=2", 200);
    assert.equal(places.data.length, 2);
    assert.ok(places.pagination.total > 2);
    placeId = places.data[0].id;
    await call("get", `/tourism/places/${placeId}`, 200);
  });
  await check("pagination stable empty and invalid inputs", async () => {
    const r = await call("get", "/tourism/places?offset=1000000", 200);
    assert.equal(r.data.length, 0);
    assert.equal(r.pagination.hasMore, false);
    await call("get", "/tourism/places?limit=-1", 422);
    await call("get", "/tourism/places/2147483647", 404);
  });
  await check("nearest stop and invalid GPS", async () => {
    const r = await call("get", "/stops/nearest?lat=16.047&lng=108.206", 200);
    assert.ok(r.data.nearestStop);
    await call("get", "/stops/nearest?lat=999&lng=108", 422);
    await call("get", "/bus/stops/near?lat=bad&lng=108", 422);
  });
  await check("map layers are GeoJSON", async () => {
    for (const layer of ["routes", "stops", "tourism"]) {
      const r = await call("get", `/map/${layer}`, 200);
      assert.equal((r.data || r).type, "FeatureCollection");
    }
  });
  await check("route favorites idempotent and private", async () => {
    for (let i = 0; i < 2; i++)
      await call("post", "/favorite-routes", 201, { routeId }, other.token);
    const r = await call("get", "/favorite-routes", 200, null, other.token);
    assert.equal(r.data.filter((x) => x.id === routeId).length, 1);
    assert.equal(
      (await call("get", "/favorite-routes", 200, null, admin.token)).data
        .length,
      0,
    );
    await call("delete", `/favorite-routes/${routeId}`, 200, null, other.token);
  });
  await check(
    "parallel place favorites consistent across endpoints",
    async () => {
      await Promise.all(
        [0, 1, 2].map(() =>
          call("post", "/favorite-places", 201, { placeId }, other.token),
        ),
      );
      const r = await call("get", "/favorite-places", 200, null, other.token);
      assert.equal(r.data.filter((x) => x.id === placeId).length, 1);
      const canonical = await call(
        "get",
        "/tourism/favorites/places",
        200,
        null,
        other.token,
      );
      assert.ok(canonical.data.some((x) => x.id === placeId));
      await call(
        "delete",
        `/favorite-places/${placeId}`,
        200,
        null,
        other.token,
      );
      await call(
        "post",
        "/favorite-places",
        404,
        { placeId: 2147483647 },
        other.token,
      );
      await call("post", "/favorite-places", 422, {}, other.token);
    },
  );
  await check(
    "community review pending privacy and XSS sanitization",
    async () => {
      const r = await call(
        "post",
        "/reviews",
        201,
        {
          title: "Địa điểm kiểm thử",
          placeName: "Đà Nẵng",
          province: "Đà Nẵng",
          rating: 4,
          content:
            "<script>alert(1)</script> Nội dung trải nghiệm kiểm thử đủ dài, chỉ dùng trong database thử nghiệm.",
        },
        other.token,
      );
      assert.equal(r.data.status, "pending");
      reviewId = r.data.id;
      assert.ok(!r.data.content.includes("<script>"));
      await call("get", `/reviews/${reviewId}`, 404);
      await call("get", `/reviews/${reviewId}`, 200, null, other.token);
    },
  );
  await check("admin moderation public visibility and hide", async () => {
    await call(
      "post",
      `/admin/reviews/${reviewId}/approve`,
      200,
      {},
      admin.token,
    );
    await call("get", `/reviews/${reviewId}`, 200);
    await call("put", `/admin/reviews/${reviewId}/hide`, 200, {}, admin.token);
    await call("get", `/reviews/${reviewId}`, 404);
  });
  await check("admin place CRUD and hidden listing", async () => {
    const body = {
      name: `QA ${suffix}`,
      provinceCode: "DN",
      category: "heritage",
      latitude: 16.047,
      longitude: 108.206,
      description: "Dữ liệu chỉ dùng kiểm thử",
    };
    const r = await call("post", "/admin/places", 201, body, admin.token);
    customId = r.data.id;
    await call(
      "put",
      `/admin/places/${customId}`,
      200,
      { ...body, name: body.name + " updated" },
      admin.token,
    );
    await call("delete", `/admin/places/${customId}`, 200, null, admin.token);
    await call("get", `/tourism/places/${customId}`, 404);
    const list = await call(
      "get",
      `/tourism/places?q=QA%20${suffix}&includeInactive=true`,
      200,
    );
    assert.equal(list.data.length, 0);
  });
  await check("import invalid batch is atomic", async () => {
    const before = (await db.query("SELECT COUNT(*) n FROM tourist_places"))
      .recordset[0].n;
    await call(
      "post",
      "/import/tourism-data",
      422,
      {
        items: [
          {
            name: "Valid entry",
            provinceCode: "DN",
            latitude: 16,
            longitude: 108,
          },
          { name: "Bad entry", provinceCode: "DN", latitude: 0, longitude: 0 },
        ],
      },
      admin.token,
    );
    assert.equal(
      (await db.query("SELECT COUNT(*) n FROM tourist_places")).recordset[0].n,
      before,
    );
    await call(
      "post",
      "/import/tourism-data",
      422,
      { filePath: "/etc/passwd" },
      admin.token,
    );
  });
  await check("admin JSON import updates SQL and records history", async () => {
    const r = await call(
      "post",
      "/import/tourism-data",
      201,
      {
        items: [
          {
            name: `Imported ${suffix}`,
            provinceCode: "DN",
            latitude: 16.047,
            longitude: 108.206,
          },
        ],
      },
      admin.token,
    );
    assert.equal(r.data.processedRows, 1);
    await call("get", "/import/history", 200, null, admin.token);
  });
  await check("trip generation saves complete plan and ownership", async () => {
    const r = await call(
      "post",
      "/trip-plans/generate",
      201,
      {
        timeAvailable: "1 ngày",
        interests: ["văn hóa"],
        provinceCode: "DN",
        budget: "medium",
      },
      other.token,
    );
    assert.ok(r.data.items.length);
    assert.ok(r.data.items.every((x) => x.provinceCode === "DN"));
    planId = r.data.itineraryId;
    assert.ok(planId);
    const detail = await call(
      "get",
      `/trip-plans/${planId}`,
      200,
      null,
      other.token,
    );
    assert.equal(detail.data.items.length, r.data.items.length);
    await call("get", `/trip-plans/${planId}`, 404, null, admin.token);
    await call("delete", `/trip-plans/${planId}`, 404, null, admin.token);
    await call("delete", `/trip-plans/${planId}`, 200, null, other.token);
  });
  await check("trip failure rolls back parent insertion", async () => {
    const before = (await db.query("SELECT COUNT(*) n FROM trip_plans"))
      .recordset[0].n;
    await assert.rejects(() =>
      require("../../modules/trip/trip.repository").savePlan(
        other.user.id,
        {},
        [{ id: 2147483647 }],
      ),
    );
    assert.equal(
      (await db.query("SELECT COUNT(*) n FROM trip_plans")).recordset[0].n,
      before,
    );
  });
  await check("chat response and own history", async () => {
    const r = await call(
      "post",
      "/chatbot/ask",
      200,
      { message: "Tôi muốn đến Hội An" },
      other.token,
    );
    assert.ok(r.data?.reply || r.reply);
    assert.ok(
      (await call("get", "/chat/history", 200, null, other.token)).data.length,
    );
  });
  await check(
    "chat named destination is not replaced by unrelated place",
    async () => {
      const r = await call("post", "/chatbot/ask", 200, {
        message: "Đi Hội An bằng tuyến nào?",
      });
      const d = r.data || r;
      if (d.destinationPlace) assert.match(d.destinationPlace.name, /Hội An/i);
      else assert.match(d.route?.id || "", /^QN-/);
    },
  );
  await check("chat fare and itinerary intents stay distinct", async () => {
    const fare = await call("post", "/chatbot/ask", 200, {
      message: "Tuyến DN-03 giá vé bao nhiêu?",
    });
    assert.equal((fare.data || fare).intent, "ask_fare");
    const plan = await call("post", "/chatbot/ask", 200, {
      message: "Gợi ý lịch trình Hội An 1 ngày",
    });
    assert.equal((plan.data || plan).intent, "ask_trip_plan");
    assert.ok(
      (plan.data || plan).tripPlan.items.every(
        (x) => x.provinceCode === "QN_CU",
      ),
    );
  });
  await check("no live arrival estimate is invented", async () => {
    const r = await call("post", "/chatbot/ask", 200, {
      message: "Tuyến DN-03 khi nào đến?",
    });
    assert.equal((r.data || r).etaMinutes, null);
    assert.doesNotMatch((r.data || r).reply, /sau khoảng 12 phút/);
  });
  await check("logout invalidates access and refresh", async () => {
    await call("post", "/auth/logout", 200, {
      refreshToken: other.refreshToken,
    });
    await call("get", "/users/me", 401, null, other.token);
    await call("post", "/auth/refresh-token", 401, {
      refreshToken: other.refreshToken,
    });
  });
  await check("static application and sensitive files isolation", async () => {
    const r = await request(app).get("/");
    assert.equal(r.status, 200);
    assert.match(r.text, /runtime-config.js/);
    assert.match(
      r.headers["content-security-policy"],
      /script-src-attr 'none'/,
    );
    for (const path of [
      "/.env",
      "/backend-api/.env",
      "/database/01_SCHEMA_SMARTBUS_CORE.sql",
    ])
      assert.equal((await request(app).get(path)).status, 404);
    const runtime = await request(app).get("/runtime-config.js");
    assert.match(runtime.text, /\/api\/v1/);
    assert.doesNotMatch(runtime.text, /PASSWORD|SECRET|token/i);
  });
}
main()
  .catch((e) => {
    console.error("FAIL", e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.closePool();
    const summary = {
      at: new Date().toISOString(),
      engine: engine
        ? `SQL Server ${engine.version} ${engine.edition} (actual database, no repository mocks)`
        : "SQL Server (not connected)",
      passed: results.filter((x) => x.pass).length,
      total: results.length,
      cases: results,
    };
    console.log(JSON.stringify(summary, null, 2));
    if (process.env.TEST_REPORT_PATH)
      require("node:fs").writeFileSync(
        process.env.TEST_REPORT_PATH,
        JSON.stringify(summary, null, 2) + "\n",
      );
  });
