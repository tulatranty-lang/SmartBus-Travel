import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError, clearSession, qs, saveSession, session } from "./api";
const account = {
  user: {
    id: 7,
    fullName: "Tài khoản kiểm thử",
    email: "fixture@example.test",
    role: "user",
  },
  accessToken: "test-access",
  refreshToken: "test-refresh",
};
const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const ok = (data: unknown) => ({ success: true, data, message: "OK" });
beforeEach(() => {
  clearSession();
  delete window.SMARTBUS_API_BASE;
  vi.restoreAllMocks();
});
afterEach(() => {
  clearSession();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe("HTTP client and session boundaries", () => {
  it("keeps non-remembered sessions in sessionStorage", () => {
    saveSession(account, false);
    expect(localStorage.getItem("smartbus_access_token")).toBeNull();
    expect(sessionStorage.getItem("smartbus_access_token")).toBe("test-access");
    expect(session().user?.id).toBe(7);
  });
  it("remembers an explicit persistent session and clears both stores on logout", () => {
    saveSession(account, true);
    expect(localStorage.getItem("smartbus_refresh_token")).toBe("test-refresh");
    clearSession();
    expect(session()).toEqual({ user: null, access: null, refresh: null });
  });
  it("preserves storage scope during token rotation", () => {
    saveSession(account, false);
    saveSession({ ...account, accessToken: "rotated" });
    expect(localStorage.getItem("smartbus_access_token")).toBeNull();
    expect(sessionStorage.getItem("smartbus_access_token")).toBe("rotated");
  });
  it("encodes query parameters and preserves numeric zero", () => {
    expect(
      qs({ q: "Hội An & biển", page: 0, missing: undefined, blank: "" }),
    ).toBe("?q=H%E1%BB%99i+An+%26+bi%E1%BB%83n&page=0");
  });
  it("uses configured API base and bearer headers without cookies", async () => {
    saveSession(account);
    window.SMARTBUS_API_BASE = "https://api.example.test/api/v1/";
    const fetcher = vi.fn().mockResolvedValue(response(ok([])));
    vi.stubGlobal("fetch", fetcher);
    await api("/routes");
    expect(fetcher.mock.calls[0][0]).toBe(
      "https://api.example.test/api/v1/routes",
    );
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      credentials: "omit",
      headers: { Authorization: "Bearer test-access" },
    });
  });
  it("never attaches a token to an anonymous authentication request", async () => {
    saveSession(account);
    const fetcher = vi.fn().mockResolvedValue(response(ok(account)));
    vi.stubGlobal("fetch", fetcher);
    await api("/auth/login", {
      method: "POST",
      body: { email: "fixture@example.test" },
      anonymous: true,
    });
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBeUndefined();
    expect(fetcher.mock.calls[0][1].body).toBe(
      '{"email":"fixture@example.test"}',
    );
  });
  it("rotates a refresh token once for simultaneous expired requests", async () => {
    saveSession(account);
    let refreshCalls = 0;
    const fetcher = vi.fn(async (url: string, options: RequestInit) => {
      if (url.endsWith("/auth/refresh-token")) {
        refreshCalls++;
        await Promise.resolve();
        return response(
          ok({
            ...account,
            accessToken: "new-access",
            refreshToken: "new-refresh",
          }),
        );
      }
      return response(
        (options.headers as Record<string, string>).Authorization ===
          "Bearer new-access"
          ? ok(["private"])
          : { message: "Expired" },
        (options.headers as Record<string, string>).Authorization ===
          "Bearer new-access"
          ? 200
          : 401,
      );
    });
    vi.stubGlobal("fetch", fetcher);
    const rows = await Promise.all([
      api("/favorite-places"),
      api("/favorite-routes"),
    ]);
    expect(refreshCalls).toBe(1);
    expect(rows.every((r) => r.success)).toBe(true);
    expect(session().refresh).toBe("new-refresh");
  });
  it("clears unusable sessions after refresh rejection", async () => {
    saveSession(account);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response({ message: "Expired" }, 401)),
    );
    await expect(api("/users/me")).rejects.toMatchObject({ status: 401 });
    expect(session().user).toBeNull();
  });
  it("does not refresh or erase a session on forbidden access", async () => {
    saveSession(account);
    const fetcher = vi
      .fn()
      .mockResolvedValue(response({ message: "Không có quyền" }, 403));
    vi.stubGlobal("fetch", fetcher);
    await expect(api("/admin/places")).rejects.toMatchObject({ status: 403 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(session().user?.id).toBe(7);
  });
  it("shows a useful network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(TypeError("Failed to fetch")),
    );
    await expect(api("/routes")).rejects.toMatchObject({
      status: 0,
      message: expect.stringContaining("Kiểm tra kết nối"),
    });
  });
  it("rejects HTML from a misconfigured static host even with HTTP 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("<html>Not an API</html>")),
    );
    await expect(api("/routes")).rejects.toMatchObject({ status: 502 });
  });
  it("surfaces server validation messages without turning them into success", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          response(
            {
              success: false,
              message: "Tên quá ngắn",
              errorCode: "VALIDATION_ERROR",
            },
            422,
          ),
        ),
    );
    await expect(api("/users/me")).rejects.toEqual(
      new ApiError("Tên quá ngắn", 422, "VALIDATION_ERROR"),
    );
  });
  it("forwards explicit cancellation to fetch", async () => {
    const c = new AbortController();
    let passed: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url, options) =>
          new Promise((_r, reject) => {
            passed = options.signal;
            options.signal.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            );
          }),
      ),
    );
    const pending = api("/trip-plans/generate", { signal: c.signal });
    c.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(passed?.aborted).toBe(true);
  });
  it("does not accept a late response after cancellation", async () => {
    const c = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        c.abort();
        return Promise.resolve(response(ok(["late"])));
      }),
    );
    await expect(api("/routes", { signal: c.signal })).rejects.toMatchObject({
      name: "AbortError",
    });
  });
  it("distinguishes timeout from an explicit user cancellation", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url, options) =>
          new Promise((_r, reject) =>
            options.signal.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            ),
          ),
      ),
    );
    const pending = api("/routes", { timeout: 100 });
    const check = expect(pending).rejects.toMatchObject({
      status: 408,
      name: "ApiError",
    });
    await vi.advanceTimersByTimeAsync(101);
    await check;
  });
});
