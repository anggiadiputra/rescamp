# Architecture Decision Records (ADR)
## Customer Domain Dashboard

> **Format:** Michael Nygard ADR style (disederhanakan)  
> **Status:** Accepted / Proposed / Superseded  
> **Dokumen terkait:** `prd.md`, `dashboard-plan.md`, `design.md`

---

## ADR-001: Backend Runtime — Bun vs Node.js vs Go

### Status
**Accepted** — 28 Juli 2026

### Context
Perlu memilih runtime untuk backend API yang akan berkomunikasi dengan LIQUID API, mengakses MariaDB, dan menangani autentikasi JWT. Target deploy: CloudPanel VPS.

### Options Considered

| | Bun | Node.js (Express/Fastify) | Go (Chi/Echo) |
|---|---|---|---|
| Performa | 2-3x Node | Baseline | Paling tinggi |
| DX (TS native) | Yes, zero config | Perlu ts-node/tsx | Gak ada |
| Hot reload | Built-in (`--watch`) | Nodemon/tsx | Air |
| Package mgmt | `bun install` (cepat) | npm/yarn/pnpm | `go mod` |
| ORM support | Drizzle (full) | Drizzle (full) | sqlx (raw SQL) |
| CloudPanel support | Sebagai Node.js site | Native | Manual systemd |
| Learning curve | Rendah (identik Node) | Rendah | Tinggi |
| Binary deploy | N/A | N/A | Single binary |
| Memory usage | Rendah | Menengah | Paling rendah |

### Decision
**Pilih Bun** dengan ElysiaJS framework.

### Rationale
1. **CloudPanel native support** — Bun bisa jalan sebagai Node.js site tanpa setup tambahan. Go butuh systemd manual.
2. **TypeScript native** — tanpa compile step. DX setara Node.js.
3. **Cukup cepat untuk skala ini** — dashboard internal reseller dengan ~50-500 user, gak butuh ribuan req/detik. Bun 2-3x Node.js sudah lebih dari cukup.
4. **Ekosistem JS/TS mature** — Drizzle ORM, JWT library, Elysia typed validation. Go butuh lebih banyak boilerplate.
5. **Time to market** — Estimasi 3 minggu backend dengan Bun vs 4-5 minggu dengan Go (lebih banyak kode manual).

### Consequences
- Gak dapet single binary deploy seperti Go. Tetap perlu `bun install` di server.
- Memory usage lebih tinggi dari Go (tapi masih lebih rendah dari Node.js).
- Kalau project scale ke ribuan req/detik, bisa ganti ke Go nanti. Service layer sudah decoupled — tinggal rewrite handler.

---

## ADR-002: Backend Framework — ElysiaJS vs Hono vs Fastify

### Status
**Accepted** — 28 Juli 2026

### Context
Perlu HTTP framework untuk Bun yang: typed, fast, built-in validation, ergonomic untuk pola modular (service/handler/schema/route).

### Options Considered

| | ElysiaJS | Hono | Fastify (via Bun) |
|---|---|---|---|
| Type safety | End-to-end typed | Good | Good |
| Built-in validation | `t` object (Eden-like) | Zod integration | JSON Schema |
| DX | Paling ergonomic | Minimalis | Verbose |
| Performance | Setara Hono | Tercepat | Cepat |
| Plugin system | First-class | Middleware | Decorator |
| Community | Growing fast | Large | Very large |
| Bun native | Yes, optimized | Yes | Partial |

### Decision
**Pilih ElysiaJS**.

### Rationale
1. **Built-in typed validation** — `t.Object({...})` tanpa install Zod. Schema = validation = TypeScript type.
2. **Pattern modular** — `new Elysia({ prefix })` + `.use()` cocok banget dengan arsitektur modul 4-file (schema/service/handler/route).
3. **Ecosystem integration** — `@elysiajs/cors`, `@elysiajs/static`, `@elysiajs/html` — official plugin, teruji.
4. **OpenAPI/Swagger auto-generate** — dari schema `t` langsung jadi Swagger doc. Gak perlu tulis manual.
5. **Hono terlalu mikro** — butuh banyak tambahan untuk validation, OpenAPI. Elysia lebih "baterai included".

### Consequences
- Elysia lebih baru dibanding Fastify — API berubah antar major version.
- Komunitas lebih kecil dari Fastify/Hono. Tapi cukup untuk kebutuhan proyek ini.
- Kalau migrasi ke Node.js nanti, perlu rewrite ke Fastify.

---

## ADR-003: ORM — Drizzle vs Prisma vs raw SQL

### Status
**Accepted** — 28 Juli 2026

### Context
Perlu akses MariaDB dari Bun. Butuh: type safety, migration, query builder yang SQL-like. Gak butuh abstraction berat.

### Options Considered

| | Drizzle | Prisma | raw SQL (mysql2 + sqlx) |
|---|---|---|---|
| Type safety | Full | Full | Manual |
| Migration | Built-in | Built-in | Manual / golang-migrate |
| Bundle size | Kecil | Besar (engine) | Kecil |
| Bun support | Full | Partial (engine binary) | Full |
| SQL-like API | Yes (`eq()`, `and()`, `like()`) | Prisma schema language | Raw string |
| Learning curve | Rendah | Menengah | Rendah (tapi verbose) |
| JOIN support | Bagus | Bagus (tapi kadang unexpected queries) | Manual |
| Performance | Sangat dekat raw SQL | Overhead engine | Paling cepat |

### Decision
**Pilih Drizzle ORM**.

### Rationale
1. **Bun-native** — jalan tanpa binary engine tambahan. Prisma butuh engine binary yang kadang masalah di Bun.
2. **SQL-like API** — `db.select().from(users).where(eq(users.email, data.email))` — readable, predictable, gak generate query aneh.
3. **Lightweight** — gak ada code generation step besar. Schema = TypeScript file.
4. **Migration built-in** — `drizzle-kit generate` + `drizzle-kit push`. Cukup untuk proyek ini.
5. **Kalau butuh raw SQL** — Drizzle support `.execute(sql`...`)` — fallback aman.

### Consequences
- Relasi antar tabel harus di-manage manual di TypeScript. Gak ada `include` / eager loading otomatis seperti Prisma.
- Query complex (subquery, window function) tetap perlu raw SQL.
- Kalau project jadi besar dengan banyak join, Prisma mungkin lebih nyaman nanti.

---

## ADR-004: Frontend Stack — React + Vite + Tailwind vs HTMX + SSR

### Status
**Accepted** — 28 Juli 2026

### Context
Perlu frontend untuk dashboard domain dengan: daftar domain (tabel + mobile card), form registrasi domain, DNS management (banyak record tipe), modal konfirmasi, pagination.

### Options Considered

| | React + Vite + Tailwind | HTMX + server-rendered HTML |
|---|---|---|
| Interaktivitas | Full SPA, state client | Terbatas, state server |
| Kompleksitas | Butuh routing + state management + build | Simpel, no JS bundle |
| Reusability | Component-based | Partial-based (less reusable) |
| DNS management UX | Tab + inline edit (bagus) | Full page reload per aksi |
| Bundle size | Vite tree-shake, ~50KB gzip | Nol JS |
| Team familiarity | Standar industri | Niche |
| Design system | Tailwind utility | Tailwind tetap bisa |
| Testability | Component test | E2E only |

### Decision
**Pilih React 18 + Vite + Tailwind CSS v3 + Lucide React**.

### Rationale
1. **Design system sudah React** — `design.md` sudah referensi React (`className`, JSX). Pilih HTMX = rewrite semua komponen design ke plain HTML.
2. **DNS management kompleks** — tab record type, inline edit, modal delete. HTMX bisa tapi UX jauh lebih buruk (page refresh tiap aksi).
3. **Domain search + suggestion** — debounce input, suggestion dropdown, loading state. Susah di HTMX tanpa JS tambahan.
4. **State client-side** — auth context, selected domain, form state. React context jauh lebih clean.
5. **Team standard** — React adalah skill paling umum di market. Kalau nanti handover ke developer lain, lebih mudah dicari.

### Consequences
- Ada build step (`vite build`). HTMX gak perlu.
- Bundle size ~50KB gzip (React + Router + Tailwind). HTMX = 0KB.
- Lebih banyak kode. HTMX + server HTML lebih sedikit file.
- Tapi: reusable components (Table, Modal, Card) bayar "biaya" kode lebih di awal, lalu hemat di development halaman selanjutnya.

---

## ADR-005: Database — MariaDB vs PostgreSQL vs SQLite

### Status
**Accepted** — 28 Juli 2026

### Context
Perlu database relasional untuk menyimpan users, customers, domains, transactions. User requirement: MariaDB.

### Decision
**Pakai MariaDB sesuai requirement user.** Tidak ada opsi lain yang dipertimbangkan karena ini constraint dari user.

### Rationale
1. **Requirement user tegas** — "saya tetap akan menggunakan database mariadb".
2. MariaDB kompatibel penuh dengan MySQL syntax — luas didukung oleh Drizzle ORM.
3. CloudPanel sudah bundled MariaDB/MySQL — gak perlu install manual.

### Consequences
- Tidak ada fitur PostgreSQL spesifik (JSONB, full-text search, window functions canggih). Tidak dibutuhkan untuk proyek ini.
- Backup/restore pakai `mysqldump` — standar, simpel.
- JSON kolom di MariaDB pakai TEXT + JSON_VALID constraint (bukan native JSONB). Cukup untuk nameservers array.

---

## ADR-006: Auth Strategy — JWT vs Session-based

### Status
**Accepted** — 28 Juli 2026

### Context
Perlu autentikasi pengguna untuk akses dashboard dan API. Pengguna sedikit (50-500).

### Options Considered

| | JWT (Stateless) | Session-based (Cookie + Redis) |
|---|---|---|
| Scalability | Trivial (no shared state) | Perlu Redis/session store |
| Complexity | Rendah | Menengah (session store) |
| Logout | Hapus token client-side | Hapus session server-side |
| Token revoke | Perlu blacklist (opsional) | Instant |
| Mobile/API friendly | Ya | Kurang (cookie dependent) |
| Security | Client simpan token rawan XSS | httpOnly cookie aman |

### Decision
**Pilih JWT stateless dengan Bearer token**, expiry 24 jam.

### Rationale
1. **Dashboard + API first** — frontend React butuh token di header `Authorization: Bearer`. Cookie-based lebih ribet untuk SPA yang beda origin (Vite dev di :5173, API di :3000).
2. **Gak perlu Redis** — JWT stateless, verifikasi tanpa DB hit. Cocok untuk VPS kecil (hemat resource).
3. **Skala kecil** — 50-500 user, gak butuh instant token revoke. Expiry 24 jam cukup.
4. **Bun native** — sign/verify JWT via `jose` atau `jsonwebtoken` — Bun compatible penuh. Gak butuh library kompleks.

### Consequences
- Tidak bisa instant revoke token (logout sebenarnya cuma hapus token di localStorage, token masih valid sampai expiry).
- Mitigasi: expiry pendek (24 jam). Kalau butuh revoke, tambah token blacklist di DB (P2).
- Risiko XSS: token di localStorage bisa dicuri kalau ada XSS. Mitigasi: CSP header, input sanitization.
- Kalau nanti butuh security lebih, upgrade ke httpOnly cookie + refresh token (P2).

---

## ADR-007: Deploy Strategy — CloudPanel Node.js Site vs Docker vs Manual

### Status
**Accepted** — 28 Juli 2026

### Context
Perlu deploy backend Bun + frontend React static ke VPS yang sudah terinstall CloudPanel.

### Decision
**CloudPanel Node.js site untuk backend + Nginx serve frontend static.**

### Rationale
1. **CloudPanel sudah ada di VPS user** — gak perlu setup ulang.
2. **Node.js site bisa jalanin Bun** — start command `bun run src/index.ts`. CloudPanel gak perlu tahu itu Bun, cukup execute command.
3. **Nginx reverse proxy otomatis** — CloudPanel handle SSL (Let's Encrypt), domain, reverse proxy ke port backend.
4. **Gak perlu Docker** — proyek kecil, satu server. Docker nambah overhead belajar + resource.
5. **Frontend static** — `vite build` → Nginx serve folder `dist/`. Gak perlu Node server untuk frontend.

### Consequences
- Gak dapet CI/CD otomatis bawaan. Perlu script deploy manual (rsync + restart).
- Gak dapet container isolation. Kalau server kena hack, satu server kena semua.
- Kalau nanti scale banyak server, wajib migrasi ke Docker.

---

## ADR-008: LIQUID API Integration Pattern — Direct vs Queue

### Status
**Accepted** — 28 Juli 2026

### Context
Setiap aksi user (register domain, renew, update DNS) harus memanggil LIQUID API. LIQUID bisa lambat (2-5 detik) atau error.

### Options

| | Direct Call | Queue-based (Async) |
|---|---|---|
| UX | User nunggu response | User lihat "processing", dapat notifikasi nanti |
| Complexity | Rendah | Menengah (perlu worker, retry, notifikasi) |
| Error handling | Error langsung ke user | Retry otomatis |
| Consistency | Response langsung | Bisa delay (user bingung) |

### Decision
**Direct call ke LIQUID API** untuk MVP. Tambah queue untuk operasi non-kritis di fase P2.

### Rationale
1. **User expectation** — saat registrasi domain, user expect instant feedback (berhasil/gagal). Queue-based bikin UX buruk untuk flow utama.
2. **LIQUID reliability** — asumsi API stabil. Kalau sering error, itu masalah LIQUID, bukan arsitektur kita.
3. **MVP speed** — direct call implementasi paling simpel. Gak butuh Redis, worker, job table.
4. **Retry di client** — frontend bisa retry 1-2x kalau error. Gak perlu queue system.

### Consequences
- Kalau LIQUID API down, user langsung error. Tidak ada graceful degradation.
- Operasi lambat (transfer domain bisa 5-10 detik) — user harus sabar. Mitigasi: loading state jelas di UI.
- Upgrade ke queue-based di P2 untuk: sync expiry date, batch renew, notifikasi.

---

## ADR-009: Monorepo vs Multi-repo

### Status
**Accepted** — 28 Juli 2026

### Context
Backend dan frontend dibangun paralel oleh satu developer (solo).

### Decision
**Monorepo dengan folder `backend/` dan `frontend/`.**

### Rationale
1. **Satu developer** — gak ada konflik merge antar tim.
2. **Satu version** — perubahan API contract langsung kelihatan di kedua sisi.
3. **Satu CI** — test backend + build frontend dalam satu pipeline.
4. **Shared types** — ke depannya bisa extract `shared/types.ts` untuk request/response.

### Consequences
- Kalau nanti ada tim terpisah (backend team, frontend team), bisa split ke multi-repo.
- Monorepo tool (`turborepo`, `nx`) tidak diperlukan untuk skala ini.

---

## ADR-010: CSS Approach — Tailwind vs CSS Modules vs Styled Components

### Status
**Accepted** — 28 Juli 2026

### Context
Design system (`design.md`) sudah ditulis dalam Tailwind classes.

### Decision
**Tailwind CSS v3, no extensions, default theme.**

### Rationale
1. **Design system sudah Tailwind-native** — `design.md` langsung copy-pasteable ke JSX tanpa rewrite.
2. **Utility-first productive** — tidak perlu bolak-balik antara `.tsx` dan `.css`.
3. **Bundle kecil** — Tailwind purge unused classes, output < 10KB gzip.
4. **No runtime** — beda dengan CSS-in-JS (styled-components) yang perlu JS runtime.

### Consequences
- HTML jadi verbose dengan class panjang. Mitigasi: extract component (button, input) — class ditulis sekali.
- Tailwind v3 (bukan v4) karena v3 paling stabil dan banyak referensi. Upgrade ke v4 nanti kalau sudah mature.

---

## Ringkasan Keputusan

| # | Keputusan | Dipilih | Alternatif Ditolak |
|---|-----------|---------|--------------------|
| 001 | Runtime backend | **Bun** | Node.js, Go |
| 002 | Framework backend | **ElysiaJS** | Hono, Fastify |
| 003 | ORM | **Drizzle** | Prisma, raw SQL |
| 004 | Frontend stack | **React + Vite + Tailwind** | HTMX + SSR |
| 005 | Database | **MariaDB** (requirement) | PostgreSQL, SQLite |
| 006 | Auth | **JWT stateless** | Session + Redis |
| 007 | Deploy | **CloudPanel Node.js site** | Docker, manual systemd |
| 008 | LIQUID integration | **Direct call** | Queue async (P2) |
| 009 | Repo structure | **Monorepo** | Multi-repo |
| 010 | CSS | **Tailwind CSS v3** | CSS Modules, Styled Components |
