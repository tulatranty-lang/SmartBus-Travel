const request = require("supertest");
const jwt = require("jsonwebtoken");
const env = require("../../config/env");
jest.mock("../../modules/auth/auth.repository", () => ({
  findUserById: jest.fn(),
  createUser: jest.fn(),
  findUserByEmail: jest.fn(),
}));
const repo = require("../../modules/auth/auth.repository");
const app = require("../../app");
const account = { id: 123, role: "user", isActive: true, sessionVersion: 3 };
const token = (claims = {}, options = {}) =>
  jwt.sign({ id: 123, typ: "access", ver: 3, ...claims }, env.jwtAccessSecret, {
    expiresIn: "5m",
    ...options,
  });
beforeEach(() => repo.findUserById.mockResolvedValue({ ...account }));
test("forged admin role in signed legacy claims cannot authorize current normal user", async () => {
  const r = await request(app)
    .get("/api/v1/admin/reviews")
    .set(
      "Authorization",
      "Bearer " + token({ role: "admin", roles: ["admin"] }),
    );
  expect(r.status).toBe(403);
});
test.each([{ ver: 2 }, { typ: "refresh" }, { id: -1 }, { id: 1.5 }])(
  "invalid session claims rejected %j",
  async (claims) => {
    const r = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", "Bearer " + token(claims));
    expect(r.status).toBe(401);
  },
);
test.each([false, 0])(
  "suspended account rejected immediately %j",
  async (isActive) => {
    repo.findUserById.mockResolvedValue({ ...account, isActive });
    expect(
      (
        await request(app)
          .get("/api/v1/users/me")
          .set("Authorization", "Bearer " + token())
      ).status,
    ).toBe(401);
  },
);
test("expired and incorrectly signed tokens rejected without DB lookup", async () => {
  repo.findUserById.mockClear();
  for (const t of [
    token({}, { expiresIn: -1 }),
    jwt.sign({ id: 123 }, "wrong"),
  ])
    expect(
      (
        await request(app)
          .get("/api/v1/users/me")
          .set("Authorization", "Bearer " + t)
      ).status,
    ).toBe(401);
  expect(repo.findUserById).not.toHaveBeenCalled();
});
test("bcrypt 72-byte boundary rejects overly long unicode passwords", async () => {
  const r = await request(app)
    .post("/api/v1/auth/register")
    .send({
      email: "qa@example.test",
      fullName: "QA",
      password: "á".repeat(40),
    });
  expect(r.status).toBe(422);
  expect(repo.createUser).not.toHaveBeenCalled();
});
