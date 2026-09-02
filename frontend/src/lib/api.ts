const API_BASE = import.meta.env.VITE_API_BASE || (typeof window !== "undefined" && window.location.hostname.includes("dash.ekstensi.id") ? "https://api.ekstensi.id/api" : "/api");

function headers(): Record<string, string> {
  return { "Content-Type": "application/json" };
}

export interface RequestOptions {
  signal?: AbortSignal;
}

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/prices",
  "/verify",
];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (pathname.startsWith("/billing/pay") || pathname.startsWith("/verify")) return true;
  return false;
}

let isRedirectingToLogin = false;

async function request<T>(method: string, path: string, body?: unknown, options?: RequestOptions): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
    signal: options?.signal,
    // H8: session lives in an httpOnly cookie set by the backend — no localStorage token
    credentials: "include",
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401 && path !== "/auth/me" && !path.startsWith("/auth/")) {
      if (!isRedirectingToLogin && typeof window !== "undefined" && !isPublicPath(window.location.pathname)) {
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

// H8: token is no longer stored client-side. Kept as no-op exports so existing
// call sites don't break; the server cookie is the single source of truth.
export function setToken(_t: string) {}
export function clearToken() {}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>("GET", path, undefined, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>("POST", path, body, options),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>("PUT", path, body, options),
  delete: <T>(path: string, options?: RequestOptions) => request<T>("DELETE", path, undefined, options),
};
