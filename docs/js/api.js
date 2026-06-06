window.SmartBusApi = window.SmartBusApi || {};
window.SmartBusApi.baseUrl = (
  window.SmartBusConfig?.API_BASE_URL ||
  window.SMARTBUS_API_BASE ||
  "http://192.168.1.34/api/v1"
).replace(/\/$/, "");
window.SmartBusApi.request = async function (path, options = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), options.timeoutMs || 12000);
  try {
    const token =
      localStorage.getItem("smartbus_access_token") ||
      sessionStorage.getItem("smartbus_access_token");
    const headers = new Headers(options.headers || {});
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (
      options.body &&
      !(options.body instanceof FormData) &&
      !headers.has("Content-Type")
    )
      headers.set("Content-Type", "application/json");
    const res = await fetch(
      `${window.SmartBusApi.baseUrl}${path.startsWith("/") ? path : `/${path}`}`,
      { ...options, headers, signal: ctrl.signal },
    );
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(payload.message || `HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return payload.data ?? payload;
  } finally {
    clearTimeout(timer);
  }
};
["get", "post", "put", "patch", "delete"].forEach((m) => {
  window.SmartBusApi[m === "delete" ? "del" : m] = (path, data, opts = {}) =>
    window.SmartBusApi.request(path, {
      ...opts,
      method: m.toUpperCase(),
      body: data ? JSON.stringify(data) : undefined,
    });
});
