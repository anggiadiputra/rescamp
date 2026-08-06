# Rescamp

Domain registration & management platform (customer + reseller).

## Struktur

```
.
├── backend/   Bun + Elysia + Drizzle (PostgreSQL). API server, Liquid Resellercamp client, billing.
└── frontend/  Vite + React + TypeScript. Customer & reseller dashboard.
```

## Quick start

### Backend

```sh
cd backend
cp .env.example .env       # then edit
bun install
bun run dev
```

### Frontend

```sh
cd frontend
npm install
npm run dev
```

## Docs (root)

- `DEPLOY.md` — deployment guide
- `api-spec.md` — internal API spec
- `architecture-decisions.md` — ADR
- `dashboard-plan.md` — dashboard implementation plan
- `design.md` — UI/UX design notes
- `kirisan.md` — internal notes
- `luquid.md` — upstream Liquid/Resellercamp API reference
- `orderdomain.md` — domain ordering flow notes
- `prd.md` — product requirements
- `sumopod.md` — upstream Sumopod API reference
- `swagger.json` — OpenAPI spec
- `testing.md` — testing guide
