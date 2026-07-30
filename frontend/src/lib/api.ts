const API_BASE = import.meta.env.VITE_API_BASE || (typeof window !== "undefined" && window.location.hostname.includes("dash.ekstensi.id") ? "https://api.ekstensi.id/api" : "/api");

let token = localStorage.getItem("token");

function headers(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

export interface RequestOptions {
  signal?: AbortSignal;
}

let isRedirectingToLogin = false;

async function request<T>(method: string, path: string, body?: unknown, options?: RequestOptions): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
    signal: options?.signal,
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401) {
      clearToken();
      if (!isRedirectingToLogin && window.location.pathname !== "/login" && window.location.pathname !== "/") {
        isRedirectingToLogin = true;
        window.location.href = "/login";
      }
    }
    throw new Error(json.error || json.message || "Request failed");
  }

  // If response has meta (paginated), return the full wrapper
  if (json.meta) return json;

  return json.data ?? json;
}

export function setToken(t: string) {
  token = t;
  localStorage.setItem("token", t);
}

export function clearToken() {
  token = null;
  localStorage.removeItem("token");
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>("GET", path, undefined, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>("POST", path, body, options),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>("PUT", path, body, options),
  delete: <T>(path: string, options?: RequestOptions) => request<T>("DELETE", path, undefined, options),
};
