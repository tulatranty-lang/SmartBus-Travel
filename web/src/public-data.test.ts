import { afterEach, expect, it, vi } from "vitest";
import { isPublicSnapshot, publicData } from "./public-data";
afterEach(() => {
  delete window.SMARTBUS_PUBLIC_SNAPSHOT;
  delete window.SMARTBUS_API_BASE;
  vi.unstubAllGlobals();
});
it("uses a public snapshot only on the public host or when explicitly selected", () => {
  expect(isPublicSnapshot()).toBe(false);
  window.SMARTBUS_PUBLIC_SNAPSHOT = true;
  expect(isPublicSnapshot()).toBe(true);
  window.SMARTBUS_PUBLIC_SNAPSHOT = false;
  expect(isPublicSnapshot()).toBe(false);
});
it("never sends credentials or pretends to save data in the public build", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  await expect(
    publicData("/auth/login", {
      method: "POST",
      body: { email: "private@example.test" },
    }),
  ).rejects.toThrow("cần bản có máy chủ");
  expect(fetcher).not.toHaveBeenCalled();
});
it("returns an aborted request before loading a snapshot", async () => {
  const c = new AbortController();
  c.abort();
  await expect(
    publicData("/routes", { signal: c.signal }),
  ).rejects.toHaveProperty("name", "AbortError");
});
