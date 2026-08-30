import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { api } from "../lib/api";

interface User {
  id: number; email: string; name: string; role?: string; hasProfile?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  register: (data: any) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // H8: session is in an httpOnly cookie — just ask /auth/me, no localStorage
    const controller = new AbortController();
    api.get<{ user: User }>("/auth/me", { signal: controller.signal })
      .then((res) => {
        setUser(res.user);
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
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, register, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
