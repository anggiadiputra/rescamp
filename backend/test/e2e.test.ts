import { describe, it, expect } from "bun:test";

// E2E: Full user flow tanpa order domain sungguhan
// Hanya read operations + availability check
const BASE = "http://localhost:3000/api";

describe("E2E Flow", () => {
  it("register → login → me → balance → availability → domains", async () => {
    // Step 1: Register
    const email = `e2e_${Date.now()}@test.com`;
    const regRes = await fetch(`${BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password: "e2etest123",
        name: "E2E User",
        reseller_id: "17058",
        api_key: "037f6ef19498ad1e44e31a9871327fa1",
      }),
    });
    expect(regRes.status).toBe(201);
    const regBody: any = await regRes.json();
    const token = regBody.data.token;
    expect(token).toBeString();

    // Step 2: Me
    const meRes = await fetch(`${BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
    expect(meRes.status).toBe(200);
    const meBody: any = await meRes.json();
    expect(meBody.data.user.email).toBe(email);

    // Step 3: Balance (read-only)
    const balRes = await fetch(`${BASE}/billing/balance`, { headers: { Authorization: `Bearer ${token}` } });
    expect(balRes.status).toBe(200);

    // Step 4: Domain availability (read-only, no purchase)
    const availRes = await fetch(`${BASE}/domains/availability?domain=google.com`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(availRes.status).toBe(200);
    const availBody: any = await availRes.json();
    expect(availBody.data).toBeDefined();

    // Step 5: List domains (should be empty for new user)
    const listRes = await fetch(`${BASE}/domains`, { headers: { Authorization: `Bearer ${token}` } });
    expect(listRes.status).toBe(200);
    const listBody: any = await listRes.json();
    expect(listBody.data).toBeArray();
    expect(listBody.meta.total).toBe(0);

    // Step 6: Prices (read-only)
    const pricesRes = await fetch(`${BASE}/billing/prices`, { headers: { Authorization: `Bearer ${token}` } });
    expect(pricesRes.status).toBe(200);
  });
});
