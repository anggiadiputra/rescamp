import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { api } from "../lib/api";
import { useDataCache } from "./DataCacheContext";

interface User {
  id: number; email: string; name: string; role?: string; hasProfile?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  register: (data: any) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { invalidateCache } = useDataCache();

  useEffect(() => {
    // H8: session is in an httpOnly cookie — ask the session probe, no localStorage.
    // /auth/session ALWAYS answers 200 ({authenticated:false} when logged out),
    // so a public page load produces no 401 noise in the browser console.
    const controller = new AbortController();
    api.get<{ authenticated: boolean; user?: User }>("/auth/session", { signal: controller.signal })
      .then((res) => {
        if (res?.authenticated && res.user) {
          setUser(res.user);
        }
      })
      .catch((err: any) => {
        if (err?.name === "AbortError" || err?.message?.includes("aborted")) return;
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, []);


  async function register(data: { email: string; password: string; name: string; reseller_id?: string; api_key?: string; cfTurnstileResponse?: string; company?: string; address?: string; city?: string; state?: string; country?: string; zipcode?: string; phone_cc?: string; phone?: string; code?: string }) {
    const body: any = {
      email: data.email, password: data.password, name: data.name,
      reseller_id: data.reseller_id, cfTurnstileResponse: data.cfTurnstileResponse,
      company: data.company, address: data.address,
      city: data.city, state: data.state, country: data.country,
      zipcode: data.zipcode, phone_cc: data.phone_cc, phone: data.phone,
      code: data.code,
    };
    // C1: api_key is no longer accepted by the backend — registration always creates a customer
    const res = await api.post<{ user: User; token: string }>("/auth/register", body);
    setUser(res.user);
  }

  function logout() {
    api.post("/auth/logout").catch(() => {});
    // Clear all cached data (domains, customers, transactions, balance) so the
    // next user on a shared browser never sees the previous account's data from
    // the in-memory SWR cache.
    invalidateCache();
    setUser(null);
  }

  // Re-probe the session and sync the in-memory user with what the backend
  // knows (role/hasProfile can change server-side after complete-profile, etc).
  // Returns the fresh user (or null) so callers can act on it right away.
  async function refreshUser(): Promise<User | null> {
    try {
      const res = await api.get<{ authenticated: boolean; user?: User }>("/auth/session");
      if (res?.authenticated && res.user) {
        setUser(res.user);
        return res.user;
      }
      setUser(null);
      return null;
    } catch {
      return null;
    }
  }

  return <AuthContext.Provider value={{ user, loading, register, logout, refreshUser }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
