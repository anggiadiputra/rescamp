# Testing Strategy — Customer Domain Dashboard

> **Prinsip:** test yang bikin kita percaya diri deploy. Bukan test coverage 100%.  
> **Dokumen terkait:** `prd.md`, `dashboard-plan.md`, `api-spec.md`

---

## 1. Testing Pyramid

```
           ╱  E2E  ╲          ← 5% — flow kritis: register domain
         ╱──────────╲
       ╱  Integration ╲       ← 20% — API endpoint + DB + LIQUID mock
     ╱──────────────────╲
   ╱    Unit Tests       ╲     ← 75% — service, lib, utility
 ╱──────────────────────────╲
```

---

## 2. Apa yang Di-test (dan Tidak)

### Wajib di-test ✅

| Layer | Apa | Tools | Kenapa |
|-------|-----|-------|--------|
| **Service** | `auth.service.ts` (register, login) | `bun:test` | Bisnis logic paling kritis, salah → security hole |
| **Service** | `domains.service.ts` (register, renew, sync) | `bun:test` | Integrasi LIQUID, paling banyak edge case |
| **Service** | `dns.service.ts` (CRUD records) | `bun:test` | Banyak record type, validasi kompleks |
| **Lib** | `liquid.ts` (LIQUID API client) | `bun:test` + mock | Semua endpoint harus teruji return type |
| **Lib** | `jwt.ts` (sign, verify, expiry) | `bun:test` | Auth foundation |
| **Lib** | `hash.ts` (hash, verify password) | `bun:test` | Bun.password — pastikan round-trip |
| **Middleware** | `auth.ts` (JWT guard) | `bun:test` | Tolak token invalid / expired / missing |
| **Integration** | Setiap endpoint API | `bun:test` + mock LIQUID | Pastikan req→res flow benar |
| **Contract** | Response shape sesuai `api-spec.md` | `bun:test` + snapshot | Frontend dev gak kaget |

### Tidak di-test ❌

| Apa | Kenapa |
|-----|--------|
| HTML layout / CSS / UI rendering | Ganti-ganti terus, test jadi churn. Cukup manual check. |
| Drizzle ORM queries simple | Drizzle sudah tested upstream. Query simple (`select().from()`) gak perlu test. |
| React components presentasional | Kalau cuma render UI, gak ada logic. Test logic di custom hooks/service. |
| Tailwind class / styling | Visual check manual aja. |
| Third-party API LIQUID (live) | Bukan tanggung jawab kita. Kita mock response-nya. |
| CloudPanel / Nginx config | Cukup smoke test satu kali deploy. |

---

## 3. Unit Test Examples

### `lib/jwt.test.ts`

```ts
import { describe, it, expect } from "bun:test";
import { signToken, verifyToken } from "../src/lib/jwt";

describe("JWT", () => {
  it("should sign and verify a valid token", async () => {
    const payload = { sub: 1, email: "test@test.com" };
    const token = await signToken(payload);
    const decoded = await verifyToken(token);
    expect(decoded.sub).toBe(1);
    expect(decoded.email).toBe("test@test.com");
  });

  it("should reject expired token", async () => {
    const token = await signToken({ sub: 1 }, { expiresIn: "0s" });
    await expect(verifyToken(token)).rejects.toThrow();
  });

  it("should reject tampered token", async () => {
    const token = await signToken({ sub: 1 });
    const tampered = token.slice(0, -5) + "xxxxx";
    await expect(verifyToken(tampered)).rejects.toThrow();
  });
});
```

### `lib/hash.test.ts`

```ts
import { describe, it, expect } from "bun:test";
import { hashPassword, verifyPassword } from "../src/lib/hash";

describe("Password Hashing", () => {
  it("should hash and verify correctly", async () => {
    const hash = await hashPassword("rahasia123");
    expect(hash).not.toBe("rahasia123");
    expect(await verifyPassword("rahasia123", hash)).toBe(true);
  });

  it("should reject wrong password", async () => {
    const hash = await hashPassword("rahasia123");
    expect(await verifyPassword("salah", hash)).toBe(false);
  });

  it("should produce unique hashes for same password", async () => {
    const h1 = await hashPassword("same");
    const h2 = await hashPassword("same");
    expect(h1).not.toBe(h2);
    expect(await verifyPassword("same", h1)).toBe(true);
    expect(await verifyPassword("same", h2)).toBe(true);
  });
});
```

### `lib/liquid.test.ts` (dengan mock fetch)

```ts
import { describe, it, expect, mock, beforeEach } from "bun:test";
import { LiquidClient } from "../src/lib/liquid";

describe("LiquidClient", () => {
  let client: LiquidClient;

  beforeEach(() => {
    client = new LiquidClient("RESELLER", "APIKEY");
    globalThis.fetch = mock(() => ({
      ok: true,
      json: async () => ({ status: "success", data: {} }),
    }));
  });

  it("should send correct auth header", async () => {
    await client.checkAvailability("example.com");
    const call = (fetch as any).mock.calls[0];
    const headers = call[1].headers;
    expect(headers.Authorization).toBe("Basic " + btoa("RESELLER:APIKEY"));
  });

  it("should throw on non-ok response", async () => {
    globalThis.fetch = mock(() => ({
      ok: false,
      status: 400,
      json: async () => ({ message: "Domain taken" }),
    }));
    await expect(client.checkAvailability("taken.com")).rejects.toThrow("Domain taken");
  });

  it("should build correct URL for availability check", async () => {
    await client.checkAvailability("test.com");
    const url = (fetch as any).mock.calls[0][0];
    expect(url).toBe("https://api.domainsas.com/v1/domains/availability?domain_name=test.com");
  });
});
```

### `modules/auth/auth.service.test.ts` (dengan DB mock)

```ts
import { describe, it, expect, mock, beforeEach } from "bun:test";
// Mock db module
mock.module("../../db", () => ({
  db: {
    select: () => ({ from: () => ({ where: () => [] }) }),
    insert: () => ({ values: () => ({ returning: () => [{ id: 1, email: "test@test.com", name: "Test" }] }) }),
  },
}));

import { register, login } from "../../src/modules/auth/auth.service";

describe("Auth Service", () => {
  it("should register a new user and return token", async () => {
    const result = await register({
      email: "test@test.com",
      password: "rahasia123",
      name: "Test User",
      reseller_id: "RES-123",
      api_key: "sk_test_xxx",
    });
    expect(result.user.email).toBe("test@test.com");
    expect(result.token).toBeString();
    expect(result.token.length).toBeGreaterThan(10);
  });

  it("should reject duplicate email", async () => {
    // Setup mock to return existing user
    const { db } = await import("../../db");
    (db.select as any) = () => ({
      from: () => ({ where: () => [{ id: 2, email: "test@test.com" }] }),
    });

    await expect(
      register({ email: "test@test.com", password: "rahasia123", name: "Test", reseller_id: "X", api_key: "Y" })
    ).rejects.toThrow("Email already registered");
  });

  it("should login with correct credentials", async () => {
    const hashed = await Bun.password.hash("rahasia123");
    const { db } = await import("../../db");
    (db.select as any) = () => ({
      from: () => ({ where: () => [{ id: 1, email: "test@test.com", password_hash: hashed, name: "Test" }] }),
    });

    const result = await login({ email: "test@test.com", password: "rahasia123" });
    expect(result.token).toBeString();
  });

  it("should reject login with wrong password", async () => {
    const hashed = await Bun.password.hash("rahasia123");
    const { db } = await import("../../db");
    (db.select as any) = () => ({
      from: () => ({ where: () => [{ id: 1, email: "test@test.com", password_hash: hashed, name: "Test" }] }),
    });

    await expect(login({ email: "test@test.com", password: "wrong" })).rejects.toThrow("Invalid credentials");
  });
});
```

---

## 4. Integration Test Examples

### `modules/auth/auth.integration.test.ts`

Test full HTTP request → handler → service → DB (sqlite in-memory).

```ts
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { Elysia } from "elysia";
import { authRoutes } from "../../src/modules/auth/auth.route";

// Setup: in-memory SQLite untuk test
// sqlite ganti mysql2 via env DB_DRIVER=sqlite

describe("Auth API", () => {
  let app: Elysia;

  beforeAll(() => {
    app = new Elysia().use(authRoutes);
  });

  it("POST /auth/register → 201 + token", async () => {
    const res = await app.handle(
      new Request("http://localhost/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "test@test.com", password: "rahasia123",
          name: "Test", reseller_id: "X", api_key: "Y",
        }),
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.user.email).toBe("test@test.com");
    expect(body.data.token).toBeString();
  });

  it("POST /auth/register → 409 duplicate", async () => {
    // Register twice
    await app.handle(new Request("http://localhost/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "dup@test.com", password: "rahasia123", name: "Dup", reseller_id: "X", api_key: "Y" }),
    }));
    const res = await app.handle(new Request("http://localhost/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "dup@test.com", password: "rahasia123", name: "Dup", reseller_id: "X", api_key: "Y" }),
    }));
    expect(res.status).toBe(409);
  });

  it("POST /auth/login → 200 + token", async () => {
    // Register dulu
    await app.handle(new Request("http://localhost/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "login@test.com", password: "rahasia123", name: "L", reseller_id: "X", api_key: "Y" }),
    }));

    const res = await app.handle(new Request("http://localhost/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "login@test.com", password: "rahasia123" }),
    }));
    expect(res.status).toBe(200);
  });

  it("POST /auth/login → 401 wrong password", async () => {
    const res = await app.handle(new Request("http://localhost/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "login@test.com", password: "wrong" }),
    }));
    expect(res.status).toBe(401);
  });
});
```

### Contract test — validasi response shape sesuai `api-spec.md`

```ts
import { describe, it, expect } from "bun:test";
import type { app } from "../src/index";

describe("API Contract: Domain responses match api-spec.md", () => {
  it("GET /api/domains/:id returns correct shape", async () => {
    const res = await app.handle(new Request("http://localhost/api/domains/1", {
      headers: { Authorization: `Bearer ${VALID_TOKEN}` },
    }));
    expect(res.status).toBe(200);
    const body = await res.json();

    // Semua field yang dijanjikan api-spec harus ada
    const domain = body.data;
    expect(domain).toHaveProperty("id");
    expect(domain).toHaveProperty("domain_name");
    expect(domain).toHaveProperty("tld");
    expect(domain).toHaveProperty("registration_date");
    expect(domain).toHaveProperty("expiry_date");
    expect(domain).toHaveProperty("status");
    expect(domain).toHaveProperty("locked");
    expect(domain).toHaveProperty("theft_protection");
    expect(domain).toHaveProperty("privacy_protection");
    expect(domain).toHaveProperty("nameservers");
    expect(domain.nameservers).toBeArray();
    expect(domain).toHaveProperty("customer");
    expect(domain.customer).toHaveProperty("id");
    expect(domain.customer).toHaveProperty("name");
  });

  it("GET /api/billing/transactions returns paginated response", async () => {
    const res = await app.handle(new Request("http://localhost/api/billing/transactions", {
      headers: { Authorization: `Bearer ${VALID_TOKEN}` },
    }));
    const body = await res.json();
    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("meta");
    expect(body.meta).toHaveProperty("total");
    expect(body.meta).toHaveProperty("page");
    expect(body.meta).toHaveProperty("perPage");
  });
});
```

---

## 5. E2E Test (1 flow aja)

Flow paling kritis: **register → login → cek domain → list domain**.

```ts
import { describe, it, expect } from "bun:test";

const BASE = "http://localhost:3000/api";
let token: string;

describe("E2E: Register Domain Flow", () => {
  it("register → login → get domains", async () => {
    // Step 1: Register
    const reg = await fetch(`${BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `e2e_${Date.now()}@test.com`,
        password: "test123",
        name: "E2E User",
        reseller_id: process.env.TEST_RESELLER_ID!,
        api_key: process.env.TEST_API_KEY!,
      }),
    });
    expect(reg.status).toBe(201);
    const regBody = await reg.json();
    token = regBody.data.token;

    // Step 2: Me
    const me = await fetch(`${BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(me.status).toBe(200);

    // Step 3: Check availability
    const avail = await fetch(`${BASE}/domains/availability?domain_name=googlenotreal&tld=com`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const availBody = await avail.json();
    expect(availBody.data.available).toBe(true);

    // Step 4: List domains (should be empty or have mock data)
    const list = await fetch(`${BASE}/domains`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(list.status).toBe(200);
    const listBody = await list.json();
    expect(listBody.data).toBeArray();
    expect(listBody.meta).toBeObject();
  });
});
```

---

## 6. Tools & Setup

| Kebutuhan | Pilihan | Kenapa |
|-----------|---------|--------|
| Test runner | **bun:test** (built-in) | Gak perlu Jest/Vitest. Bun native, fast, Jest-compatible API |
| Assertions | `expect` (built-in, Jest-compatible) | Gak perlu library |
| HTTP test | `app.handle(new Request(...))` (Elysia built-in) | No need supertest |
| Mocking | `mock.module()` (bun:test) + `globalThis.fetch = mock(...)` | Bun native mocking |
| DB test | SQLite in-memory (via `DB_DRIVER=sqlite`) | Cepat, gak perlu spinning up MariaDB |
| E2E | `fetch()` native (Bun) | Bun punya `fetch` built-in |
| Coverage | `bun test --coverage` | Native, lcov format |

### Konfigurasi

Tidak perlu config file. Semua lewat CLI:

```bash
# Run all tests
bun test

# Run specific file
bun test src/lib/jwt.test.ts

# Watch mode
bun test --watch

# Coverage
bun test --coverage

# Integration test (pakai SQLite, bukan MariaDB)
DB_DRIVER=sqlite bun test --preload ./test/setup.ts
```

### `test/setup.ts` — Setup test DB

```ts
// test/setup.ts — dijalankan sebelum integration test
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { db } from "../src/db"; // db akan otomatis pakai sqlite saat DB_DRIVER=sqlite

// Jalankan semua migration
await migrate(db, { migrationsFolder: "./drizzle/migrations" });
```

---

## 7. Coverage Target (Pragmatic)

| Area | Target | Realita |
|------|--------|---------|
| `lib/` (jwt, hash, error, liquid) | **90%+** | Wajib. Logic murni, gampang di-test. |
| `modules/*/auth.service.ts` | **80%+** | Register + login + edge case. |
| `modules/*/domains.service.ts` | **70%+** | Flow utama (register, renew, get), skip edge case LIQUID yang jarang. |
| `modules/*/dns.service.ts` | **60%+** | Satu record per type aja. |
| `middleware/` | **80%+** | Auth guard semua case (missing, invalid, expired). |
| `handler/` | **terserah** | Integration test udah cover. |
| `route/` | **gak perlu** | Elysia route definisi — gak ada logic. |
| Frontend React | **gak perlu** | Manual check. |

---

## 8. CI/CD Integration (GitHub Actions)

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest
      - run: bun install
      - run: bun test --coverage
      - run: DB_DRIVER=sqlite bun test --preload ./test/setup.ts
```

---

## 9. Manual Test Checklist (Sebelum Deploy)

Jalanin ini satu kali sebelum deploy ke production:

- [ ] Register user baru → berhasil, token valid
- [ ] Login → berhasil
- [ ] Login dengan password salah → ditolak
- [ ] Akses endpoint tanpa token → 401
- [ ] Akses endpoint dengan token expired → 401
- [ ] Cek domain availability (domain kosong) → available: true
- [ ] Cek domain availability (google.com) → available: false
- [ ] List DNS record → return array
- [ ] Add DNS record → return record baru
- [ ] Delete DNS record → 204
- [ ] Get balance → return angka
- [ ] List transactions → return array + meta pagination
- [ ] API response shape sesuai `api-spec.md`
- [ ] Dashboard load di mobile (375px) → tidak overflow
- [ ] Dashboard load di desktop (1440px) → layout grid benar
- [ ] Loading spinner muncul saat fetch
- [ ] Error banner muncul saat API error
- [ ] Empty state muncul saat daftar kosong
