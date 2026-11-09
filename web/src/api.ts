import type { AuthData, Envelope, User } from "./types";
declare global {
  interface Window {
    SMARTBUS_API_BASE?: string;
  }
}
const keys = {
  access: "smartbus_access_token",
  refresh: "smartbus_refresh_token",
  user: "smartbus_user",
};
let memory: Partial<Record<keyof typeof keys, string>> = {};
function stores() {
  return ["localStorage", "sessionStorage"].flatMap((k) => {
    try {
      return [window[k as "localStorage"]];
    } catch {
      return [];
    }
  });
}
export function session() {
  const read = (k: keyof typeof keys) => {
    for (const s of stores())
      try {
        const v = s.getItem(keys[k]);
        if (v) return v;
      } catch {}
    return memory[k] || null;
  };
  let user: User | null = null;
  try {
    user = JSON.parse(read("user") || "null");
  } catch {}
  return { user, access: read("access"), refresh: read("refresh") };
}
export function saveSession(d: AuthData, remember?: boolean) {
  let target: Storage | undefined;
  try {
    target =
      remember === undefined
        ? stores().find((s) => s.getItem(keys.refresh))
        : remember
          ? localStorage
          : sessionStorage;
  } catch {}
  target ||= stores()[0];
  const values = {
    access: d.accessToken || d.token || "",
    refresh: d.refreshToken,
    user: JSON.stringify(d.user),
  };
  for (const s of stores())
    for (const k of Object.values(keys))
      try {
        s.removeItem(k);
      } catch {}
  memory = values;
  if (target)
    for (const [k, v] of Object.entries(values))
      try {
        target.setItem(keys[k as keyof typeof keys], v);
      } catch {}
  window.dispatchEvent(new Event("smartbus:session"));
}
export function clearSession() {
  memory = {};
  for (const s of stores())
    for (const k of Object.values(keys))
      try {
        s.removeItem(k);
      } catch {}
  window.dispatchEvent(new Event("smartbus:session"));
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
type Options = {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
  anonymous?: boolean;
  refresh?: boolean;
  timeout?: number;
};
let rotation: Promise<void> | null = null;
async function refresh() {
  if (!rotation)
    rotation = (async () => {
      const t = session().refresh;
      if (!t) throw new ApiError("Vui lòng đăng nhập lại.", 401);
      saveSession(
        (
          await api<AuthData>("/auth/refresh-token", {
            method: "POST",
            body: { refreshToken: t },
            anonymous: true,
            refresh: false,
          })
        ).data,
      );
    })()
      .catch((e) => {
        clearSession();
        throw e;
      })
      .finally(() => {
        rotation = null;
      });
  return rotation;
}
export async function api<T>(
  path: string,
  o: Options = {},
): Promise<Envelope<T>> {
  const controller = new AbortController(),
    abort = () => controller.abort();
  if (o.signal?.aborted) abort();
  else o.signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, o.timeout || 20000);
  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (o.body !== undefined) headers["Content-Type"] = "application/json";
    const token = session().access;
    if (token && !o.anonymous) headers.Authorization = "Bearer " + token;
    let r: Response;
    try {
      r = await fetch(
        (window.SMARTBUS_API_BASE || "/api/v1").replace(/\/$/, "") + path,
        {
          method: o.method || "GET",
          headers,
          body: o.body !== undefined ? JSON.stringify(o.body) : undefined,
          credentials: "omit",
          signal: controller.signal,
        },
      );
    } catch {
      if (o.signal?.aborted) throw new DOMException("Đã hủy", "AbortError");
      throw new ApiError(
        controller.signal.aborted
          ? "Kết nối mất nhiều thời gian. Hãy thử lại."
          : "Chưa kết nối được máy chủ. Kiểm tra kết nối và thử lại.",
        controller.signal.aborted ? 408 : 0,
      );
    }
    if (
      r.status === 401 &&
      !o.anonymous &&
      o.refresh !== false &&
      session().refresh
    ) {
      await refresh();
      if (o.signal?.aborted) throw new DOMException("Đã hủy", "AbortError");
      return api<T>(path, { ...o, refresh: false });
    }
    const d = await r
      .json()
      .catch(() => ({
        message: `Máy chủ trả về lỗi ${r.status}. Vui lòng thử lại.`,
      }));
    if (o.signal?.aborted) throw new DOMException("Đã hủy", "AbortError");
    if (
      r.ok &&
      (!d ||
        d.success !== true ||
        !Object.prototype.hasOwnProperty.call(d, "data"))
    )
      throw new ApiError(
        "Máy chủ API chưa được cấu hình đúng hoặc trả về dữ liệu không hợp lệ.",
        502,
      );
    if (!r.ok) {
      if (r.status === 401 && !o.anonymous) clearSession();
      throw new ApiError(
        d.message || "Không thực hiện được thao tác.",
        r.status,
        d.errorCode,
      );
    }
    return d;
  } finally {
    clearTimeout(timer);
    o.signal?.removeEventListener("abort", abort);
  }
}
export function qs(p: Record<string, unknown> = {}) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(p))
    if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  return q.size ? "?" + q.toString() : "";
}
