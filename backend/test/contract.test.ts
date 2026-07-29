import { describe, it, expect } from "bun:test";

const BASE = "http://localhost:3000/api";
let token: string;

async function ensureToken() {
  if (token) return;
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "test@test.com", password: "rahasia123" }),
  });
  const body: any = await res.json();
  token = body.data.token;
}

describe("API Contract", () => {
  it("GET /api/auth/me returns correct shape", async () => {
    await ensureToken();
    const res = await fetch(`${BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
    const body: any = await res.json();
    expect(body.data).toHaveProperty("user");
    expect(body.data.user).toHaveProperty("id");
    expect(body.data.user).toHaveProperty("email");
    expect(body.data.user).toHaveProperty("name");
  });

  it("GET /api/billing/balance returns data", async () => {
    await ensureToken();
    const res = await fetch(`${BASE}/billing/balance`, { headers: { Authorization: `Bearer ${token}` } });
    const body: any = await res.json();
    expect(body.data).toBeDefined();
  });

  it("GET /api/domains returns paginated shape", async () => {
    await ensureToken();
    const res = await fetch(`${BASE}/domains`, { headers: { Authorization: `Bearer ${token}` } });
    const body: any = await res.json();
    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("meta");
    expect(body.meta).toHaveProperty("total");
    expect(body.meta).toHaveProperty("page");
    expect(body.meta).toHaveProperty("perPage");
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("GET /api/domains/availability returns data", async () => {
    await ensureToken();
    const res = await fetch(`${BASE}/domains/availability?domain=google.com`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body: any = await res.json();
    expect(body.data).toBeDefined();
  });

  it("GET /api/customers returns data array", async () => {
    await ensureToken();
    const res = await fetch(`${BASE}/customers`, { headers: { Authorization: `Bearer ${token}` } });
    const body: any = await res.json();
    expect(body).toHaveProperty("data");
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("GET /api/billing/transactions returns paginated shape", async () => {
    await ensureToken();
    const res = await fetch(`${BASE}/billing/transactions`, { headers: { Authorization: `Bearer ${token}` } });
    const body: any = await res.json();
    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("meta");
  });

  it("GET /api/settings returns settings data", async () => {
    await ensureToken();
    const res = await fetch(`${BASE}/settings`, { headers: { Authorization: `Bearer ${token}` } });
    const body: any = await res.json();
    expect(res.status).toBe(200);
    expect(body).toHaveProperty("data");
  });

  it("401 on missing auth header", async () => {
    const res = await fetch(`${BASE}/domains`);
    expect(res.status).toBe(401);
  });
});
