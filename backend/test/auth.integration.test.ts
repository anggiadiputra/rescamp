import { describe, it, expect } from "bun:test";

// Integration test: hit the running backend server.
// Creds and seed account are env-driven — never hardcoded.
// Required env (see .env.test.example): TEST_RESELLER_ID, TEST_API_KEY,
// TEST_USER_EMAIL, TEST_USER_PASSWORD.
const BASE = "http://localhost:3000/api";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}. Copy .env.test.example to .env.test and try again.`);
  return v;
}

describe("Auth API Integration", () => {
  it("POST /auth/register → 201 + token", async () => {
    const resellerId = requireEnv("TEST_RESELLER_ID");
    const apiKey = requireEnv("TEST_API_KEY");
    const res = await fetch(`${BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `integration_${Date.now()}@test.com`,
        password: requireEnv("TEST_USER_PASSWORD"),
        name: "Integration",
        reseller_id: resellerId,
        api_key: apiKey,
      }),
    });
    expect(res.status).toBe(201);
    const body: any = await res.json();
    expect(body.data.user.email).toContain("@test.com");
    expect(body.data.token).toBeString();
  });

  it("POST /auth/register → 409 duplicate", async () => {
    const resellerId = requireEnv("TEST_RESELLER_ID");
    const apiKey = requireEnv("TEST_API_KEY");
    const email = `dup_${Date.now()}@test.com`;
    await fetch(`${BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: requireEnv("TEST_USER_PASSWORD"), name: "Dup", reseller_id: resellerId, api_key: apiKey }),
    });
    const res = await fetch(`${BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: requireEnv("TEST_USER_PASSWORD"), name: "Dup2", reseller_id: resellerId, api_key: apiKey }),
    });
    expect(res.status).toBe(409);
  });

  it("POST /auth/login → 200 + token", async () => {
    const res = await fetch(`${BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: requireEnv("TEST_USER_EMAIL"), password: requireEnv("TEST_USER_PASSWORD") }),
    });
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.data.token).toBeString();
  });

  it("POST /auth/login → 401 wrong password", async () => {
    const res = await fetch(`${BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: requireEnv("TEST_USER_EMAIL"), password: "wrong123" }),
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
      body: JSON.stringify({ email: requireEnv("TEST_USER_EMAIL"), password: requireEnv("TEST_USER_PASSWORD") }),
    });
    const { token } = ((await loginRes.json()) as any).data;

    const res = await fetch(`${BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
  });
});
