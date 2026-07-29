import { describe, it, expect } from "bun:test";

// Integration test: hit the running backend server
const BASE = "http://localhost:3000/api";

describe("Auth API Integration", () => {
  it("POST /auth/register → 201 + token", async () => {
    const res = await fetch(`${BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `integration_${Date.now()}@test.com`,
        password: "rahasia123",
        name: "Integration",
        reseller_id: "17058",
        api_key: "037f6ef19498ad1e44e31a9871327fa1",
      }),
    });
    expect(res.status).toBe(201);
    const body: any = await res.json();
    expect(body.data.user.email).toContain("@test.com");
    expect(body.data.token).toBeString();
  });

  it("POST /auth/register → 409 duplicate", async () => {
    const email = `dup_${Date.now()}@test.com`;
    await fetch(`${BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "rahasia123", name: "Dup", reseller_id: "17058", api_key: "037f6ef19498ad1e44e31a9871327fa1" }),
    });
    const res = await fetch(`${BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "rahasia123", name: "Dup2", reseller_id: "17058", api_key: "037f6ef19498ad1e44e31a9871327fa1" }),
    });
    expect(res.status).toBe(409);
  });

  it("POST /auth/login → 200 + token", async () => {
    const res = await fetch(`${BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@test.com", password: "rahasia123" }),
    });
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.data.token).toBeString();
  });

  it("POST /auth/login → 401 wrong password", async () => {
    const res = await fetch(`${BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@test.com", password: "wrong123" }),
    });
    expect(res.status).toBe(401);
  });

  it("GET /auth/me → 401 without token", async () => {
    const res = await fetch(`${BASE}/auth/me`);
    expect(res.status).toBe(401);
  });

  it("GET /auth/me → 200 with valid token", async () => {
    const loginRes = await fetch(`${BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@test.com", password: "rahasia123" }),
    });
    const { token } = ((await loginRes.json()) as any).data;

    const res = await fetch(`${BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
  });
});
