# Rencana Implementasi: Customer Domain Dashboard

> **Backend:** Bun runtime + ElysiaJS framework + Drizzle ORM + MariaDB  
> **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS v3 + Lucide React  
> **Deploy:** CloudPanel Node.js site (VPS)

---

## 1. Struktur Proyek (Modular — Fullstack Monorepo)

```
.
├── backend/
│   ├── src/
│   │   ├── index.ts                  # Entry point — bootstrap Elysia app
│   │   ├── config/
│   │   │   └── env.ts                # Load & validate .env variables
│   │   ├── db/
│   │   │   ├── index.ts              # Drizzle connection (mysql2)
│   │   │   └── schema/
│   │   │       ├── index.ts          # Re-export semua schema
│   │   │       ├── users.ts          # Tabel users
│   │   │       ├── customers.ts      # Tabel customers (mirror LIQUID)
│   │   │       ├── domains.ts        # Tabel domain orders
│   │   │       └── transactions.ts   # Tabel transaction history
│   │   ├── lib/
│   │   │   ├── liquid.ts             # LIQUID API client (typed, semua endpoint)
│   │   │   ├── jwt.ts                # JWT sign / verify helpers
│   │   │   ├── hash.ts               # Password hashing (Bun.password)
│   │   │   └── error.ts              # Custom error class & handler
│   │   ├── middleware/
│   │   │   ├── auth.ts               # JWT guard middleware
│   │   │   └── rate-limit.ts         # Rate limiting per IP
│   │   └── modules/
│   │       ├── auth/
│   │       │   ├── auth.service.ts    # Bisnis logic: register, login
│   │       │   ├── auth.handler.ts    # HTTP handler: req → service → res
│   │       │   ├── auth.schema.ts     # DTO validation (Elysia t)
│   │       │   └── auth.route.ts      # Definisi route
│   │       ├── domains/
│   │       │   ├── domains.service.ts # Bisnis logic + LIQUID calls
│   │       │   ├── domains.handler.ts # HTTP handler
│   │       │   ├── domains.schema.ts  # DTO validation
│   │       │   └── domains.route.ts   # Route
│   │       ├── customers/
│   │       │   ├── customers.service.ts
│   │       │   ├── customers.handler.ts
│   │       │   ├── customers.schema.ts
│   │       │   └── customers.route.ts
│   │       ├── billing/
│   │       │   ├── billing.service.ts
│   │       │   ├── billing.handler.ts
│   │       │   ├── billing.schema.ts
│   │       │   └── billing.route.ts
│   │       ├── dns/
│   │       │   ├── dns.service.ts
│   │       │   ├── dns.handler.ts
│   │       │   ├── dns.schema.ts
│   │       │   └── dns.route.ts
│   │       └── forwarding/
│   │           ├── forwarding.service.ts
│   │           ├── forwarding.handler.ts
│   │           ├── forwarding.schema.ts
│   │           └── forwarding.route.ts
│   ├── drizzle/
│   │   └── migrations/               # Auto-generated migrations
│   ├── .env.example
│   ├── package.json
│   ├── tsconfig.json
│   └── drizzle.config.ts
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── main.tsx                  # Entry point React
│   │   ├── App.tsx                   # Router + auth gate
│   │   ├── index.css                 # Tailwind directives
│   │   ├── vite-env.d.ts
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx        # Auth state + provider
│   │   ├── lib/
│   │   │   ├── types.ts              # Shared TypeScript types
│   │   │   └── api.ts                # API client (fetch wrapper)
│   │   ├── pages/
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── LoginPage.tsx
│   │   │   ├── RegisterPage.tsx
│   │   │   ├── DomainsPage.tsx
│   │   │   ├── DomainDetailPage.tsx
│   │   │   ├── DomainRegisterPage.tsx
│   │   │   ├── DnsManagePage.tsx
│   │   │   ├── CustomersPage.tsx
│   │   │   ├── CustomerCreatePage.tsx
│   │   │   ├── BillingPage.tsx
│   │   │   └── SettingsPage.tsx
│   │   └── components/
│   │       ├── ui/
│   │       │   ├── Card.tsx
│   │       │   ├── StatCard.tsx
│   │       │   ├── SearchBar.tsx
│   │       │   ├── Input.tsx
│   │       │   ├── Button.tsx
│   │       │   ├── Badge.tsx
│   │       │   ├── Modal.tsx
│   │       │   ├── Table.tsx
│   │       │   ├── EmptyState.tsx
│   │       │   ├── LoadingSpinner.tsx
│   │       │   ├── InfoBanner.tsx
│   │       │   └── Pagination.tsx
│   │       ├── layout/
│   │       │   ├── PublicLayout.tsx   # Navbar + Content + Footer
│   │       │   ├── DashboardLayout.tsx # Sidebar + Header + Content
│   │       │   ├── Navbar.tsx
│   │       │   ├── Sidebar.tsx
│   │       │   └── Header.tsx
│   │       └── domain/
│   │           ├── DomainList.tsx
│   │           ├── DomainCard.tsx
│   │           ├── DnsRecordRow.tsx
│   │           └── AvailabilityCheck.tsx
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.app.json
│   ├── tsconfig.node.json
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── vite.config.ts
│
├── .gitignore
└── README.md
```

---

## 2. Tech Stack & Justifikasi

| Layer          | Pilihan                           | Alasan                                               |
|----------------|-----------------------------------|------------------------------------------------------|
| **Backend**    |                                   |                                                      |
| Runtime        | **Bun**                           | 2-3x lebih cepat dari Node, native TS, hot reload    |
| Framework      | **ElysiaJS**                      | Typed, fast, built-in validation (`t`), ergonomic     |
| ORM            | **Drizzle**                       | SQL-like, ringan, MariaDB support, migration built-in |
| Auth           | Manual JWT + Bun.password         | Gak perlu lib tambahan, Bun native                   |
| **Frontend**   |                                   |                                                      |
| Framework      | **React 18 + TypeScript**         | Component-based, ecosystem mature                    |
| Build          | **Vite**                          | Fast HMR, optimized builds                           |
| CSS            | **Tailwind CSS v3**               | Utility-first, no custom CSS needed                  |
| Icons          | **Lucide React**                  | Tree-shakeable, consistent style                     |
| Routing        | **React Router DOM v6**           | Standard SPA routing                                 |
| **Shared**     |                                   |                                                      |
| Deploy         | **CloudPanel**                    | Native Node.js site, Nginx reverse proxy otomatis    |
| Database       | **MariaDB**                       | Sesuai requirement                                   |

---

## 3. Design System (dari `design.md` — Copy-Pasteable)

> Seluruh komponen UI mengikuti design system ini. Setiap class Tailwind sudah ditentukan — tinggal copy-paste.

### 3a. Warna & Background

| Context | Class |
|---|---|
| Page background | `bg-[#f0f2f5]` |
| Card / Modal / Table container | `bg-white` |
| Navbar / Header | `bg-white border-b border-gray-200` |
| Sidebar | `bg-white border-r border-gray-200` |

**Primary brand color:** `black` / `gray-900` (CTA buttons, active nav, badges)

**Status colors:**
| Status | Background | Text | Border |
|---|---|---|---|
| Error / Expired | `bg-red-50` | `text-red-700` | `border-red-100` |
| Danger button | `bg-red-50` → `hover:bg-red-100` | `text-red-600` | `border-red-100` |
| Warning / Expiring | `bg-amber-50` | `text-amber-700` | `border-amber-200` |
| Success / Active | `bg-emerald-50` | `text-emerald-700` | `border-emerald-150` |
| Info | `bg-blue-50` | `text-blue-700` | `border-blue-100` |

### 3b. Typography

**Font:** System UI stack (`font-family: system-ui, -apple-system, sans-serif`) — Tailwind default.

| Element | Class |
|---|---|
| Page title | `text-xl font-bold text-gray-900` |
| Heading | `text-sm font-bold text-gray-900 uppercase tracking-wider` |
| Subtitle | `text-sm text-gray-500` |
| Body | `text-xs text-gray-700` |
| Monospace (domain, email) | `font-mono` |
| Badge / Chip | `text-[10px] font-bold uppercase` |
| Meta label | `text-[10px] uppercase font-bold text-gray-400 tracking-wider` |

### 3c. Spacing & Layout

```css
/* Page padding (main content area) */
p-5 md:p-8

/* Section gap */
space-y-6

/* Card padding */
p-5 md:p-6

/* Navbar height */
h-16 (public)
h-14 (dashboard)

/* Sidebar width */
w-64

/* Max layout width (public pages) */
max-w-7xl mx-auto px-4 sm:px-6

/* Sticky header */
sticky top-0 z-10
```

### 3d. Radius & Border

| Element | Class |
|---|---|
| Cards | `rounded-xl` |
| Dashboard stat cards | `rounded-2xl` |
| Modals | `rounded-2xl` |
| Inputs / Selects | `rounded-lg` |
| Buttons | `rounded-xl` (public), `rounded-lg` (dashboard) |
| Pills / Badges | `rounded-full` |
| Tabs / Nav items | `rounded-lg` |
| Full-bleed table section | `rounded-b-2xl -mx-6 -mb-6` |

Borders: `border border-gray-200` everywhere. Shadow: `shadow-sm` on cards, `shadow-md`/`shadow-lg` on modals.

### 3e. Icons (Lucide React)

```tsx
import { Globe, Search, Bookmark, BookmarkCheck, RefreshCw, Trash2, Edit2, Plus, X, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Users, Settings, Activity, Server, UploadCloud, LayoutDashboard, Shield, ShieldCheck, ShieldAlert, AlertCircle, CheckCircle2, Clock, Mail, MessageSquare, User, LogOut, Eye, EyeOff, Menu, Loader2, ArrowRight, Copy, Bell, Zap } from 'lucide-react';
```

| Purpose | Icon | Size |
|---|---|---|
| Brand logo fallback | `Globe` | `w-4 h-4` or `w-5.5 h-5.5` |
| Search input | `Search` | `w-4 h-4` |
| Save / Unsaved | `Bookmark` / `BookmarkCheck` | `w-3.5 h-3.5` |
| Sync / Refresh | `RefreshCw` | `w-3.5 h-3.5` (add `animate-spin` when loading) |
| Delete | `Trash2` | `w-3.5 h-3.5` |
| Edit | `Edit2` | `w-3.5 h-3.5` |
| Add | `Plus` | `w-4 h-4` |
| Close | `X` | `w-3.5 h-3.5` |
| Pagination | `ChevronLeft`, `ChevronRight` | `w-4 h-4` |
| Expand/Collapse | `ChevronDown`, `ChevronUp` | `w-3.5 h-3.5` |
| Sidebar nav | `LayoutDashboard`, `Search`, `UploadCloud`, `Server`, `Activity`, `Users`, `Settings`, `User` | `w-4 h-4` |
| Status | `CheckCircle2` (active), `AlertCircle` (expired), `Clock` (expiring) | `w-5.5 h-5.5` |
| Warning / Error | `ShieldAlert` | `w-4 h-4` |
| Email / WA | `Mail`, `MessageSquare` | `w-4 h-4` |
| Auth | `LogOut`, `Lock`, `Eye`, `EyeOff` | `w-4 h-4` |

### 3f. Transitions & Animation

```css
/* Fade-in */
animate-fade-in

/* Scale-up (modals) */
animate-scale-up

/* Slide-in from top (dropdowns) */
animate-in fade-in slide-in-from-top-2 duration-150

/* Hover transitions */
transition-colors
transition-shadow
transition-all duration-500  /* slow fills (progress bars) */

/* Active press */
active:scale-[0.98]

/* Hover lift */
hover:scale-[1.02] hover:shadow-md

/* Row highlight */
transition-colors hover:bg-gray-50/50
```

### 3g. Responsive Breakpoints

| Prefix | Width | Pattern |
|---|---|---|
| Default | All | Mobile-first, stack vertically |
| `sm:` | 640px | Side-by-side flex on cards, search + filter |
| `md:` | 768px | Show table (hidden on mobile), show card list on mobile |
| `lg:` | 1024px | Side panel, dashboard grid columns |

Common responsive patterns:
```tsx
className="flex flex-col sm:flex-row"
className="hidden md:block"          // show desktop table
className="block md:hidden"           // show mobile cards
className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
className="grid grid-cols-1 lg:grid-cols-12 gap-6"
className="w-full sm:w-64"            // input width
```

---

## 4. UI Components Library

### 4a. Card

```tsx
<div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 md:p-6">
  {/* content */}
</div>
```

### 4b. Stat Card (Dashboard)

```tsx
<div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
  <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center shrink-0">
    <Globe className="w-5.5 h-5.5 text-white" />
  </div>
  <div>
    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Total Domains</p>
    <p className="text-2xl font-black text-gray-900 mt-0.5">42</p>
  </div>
</div>
```

### 4c. Search / Filter Bar

```tsx
<div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col sm:flex-row items-center gap-3">
  <div className="relative w-full sm:w-64 shrink-0">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
    <input
      className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-black text-gray-800"
      placeholder="Cari domain..."
    />
  </div>
</div>
```

### 4d. Input Field

```tsx
// With icon
<div className="relative">
  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
  <input
    type="text"
    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent font-mono"
    placeholder="example.com"
  />
</div>

// Without icon
<input
  type="email"
  className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black text-gray-800"
  placeholder="nama@domain.com"
/>
```

### 4e. Buttons

```tsx
// Primary (CTA, Submit)
<button className="px-4 py-2 bg-black text-white text-sm font-semibold rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50">
  Submit
</button>

// Secondary (Outline)
<button className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-sm font-semibold rounded-lg text-gray-700 transition-colors">
  Batal
</button>

// Danger
<button className="px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 text-sm font-semibold rounded-lg transition-colors">
  Hapus
</button>

// Icon-only table action
<button className="p-1.5 text-gray-400 hover:text-black hover:bg-gray-100 rounded-lg transition-colors">
  <RefreshCw className="w-3.5 h-3.5" />
</button>
```

### 4f. Table

```tsx
<div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
  <div className="hidden md:block overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-gray-50 border-b border-gray-100">
          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Domain</th>
          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Expiry</th>
          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
          <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
        <tr className="hover:bg-gray-50/50 transition-colors">
          <td className="px-4 py-3 text-xs text-gray-800 font-mono">example.com</td>
          <td className="px-4 py-3 text-xs text-gray-600">2027-07-01</td>
          <td className="px-4 py-3">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-50 text-emerald-700 border-emerald-150">
              Active
            </span>
          </td>
          <td className="px-4 py-3 text-right flex justify-end gap-1.5">
            <button className="p-1.5 text-gray-400 hover:text-black hover:bg-gray-100 rounded-lg transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
            <button className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  {/* Mobile: card list */}
  <div className="block md:hidden divide-y divide-gray-100 p-4 space-y-4">
    <div className="rounded-xl p-4 shadow-sm border bg-white">
      {/* Mobile card content */}
    </div>
  </div>

  {/* Pagination footer */}
  <div className="bg-gray-50 px-5 py-3 flex items-center justify-between border-t border-gray-100">
    <span className="text-xs text-gray-500 font-medium">Showing 1 to 10 of 50</span>
    <div className="flex items-center gap-1.5">
      <button className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-white transition-colors disabled:opacity-40">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <button className="w-8 h-8 rounded-lg bg-black text-white text-xs font-semibold">1</button>
      <button className="w-8 h-8 rounded-lg border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-white">2</button>
      <button className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-white transition-colors disabled:opacity-40">
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  </div>
</div>
```

### 4g. Modal

```tsx
<div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
  <div className="bg-white rounded-2xl border border-gray-200 shadow-xl max-w-md w-full overflow-hidden">
    {/* Header */}
    <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-b border-gray-100">
      <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
        <Shield className="w-4 h-4 text-gray-700" />
        Modal Title
      </h2>
      <button className="p-1 hover:bg-gray-200 rounded-lg text-gray-400 hover:text-gray-600 transition-colors">
        <X className="w-4 h-4" />
      </button>
    </div>
    {/* Body */}
    <div className="p-6 space-y-4">
      {/* form fields */}
    </div>
    {/* Footer */}
    <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
      <button className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-sm font-semibold rounded-lg text-gray-700 transition-colors">Batal</button>
      <button className="px-5 py-2 bg-black hover:bg-gray-800 disabled:opacity-50 text-sm font-semibold rounded-lg text-white transition-colors">Simpan</button>
    </div>
  </div>
</div>
```

### 4h. Badge (Status / Role)

```tsx
// Status pill
<span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-red-100 text-red-800 border-red-200">
  Expired
</span>

<span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-50 text-emerald-700 border-emerald-150">
  Active
</span>

// Role badge
<span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border bg-black text-white border-black">
  admin
</span>
```

### 4i. Info Banner (Alerts)

```tsx
// Error
<div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-800 text-sm">
  <AlertCircle className="w-5 h-5 shrink-0" />
  <span>Error message here</span>
</div>

// Success
<div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex flex-col gap-2.5 text-emerald-800 text-sm font-medium">
  <div className="flex items-center gap-2">
    <ShieldCheck className="w-4 h-4 shrink-0" />
    <span>Domain registered successfully!</span>
  </div>
</div>
```

### 4j. Empty State

```tsx
<div className="text-center py-16 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
  <Bookmark className="w-12 h-12 mx-auto mb-3 text-gray-300" />
  <p className="text-sm font-medium text-gray-500">No domains yet</p>
  <p className="text-xs text-gray-400 mt-1">Register your first domain to get started</p>
  <button className="mt-4 px-4 py-2 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors">
    Register Domain
  </button>
</div>
```

### 4k. Loading Spinner

```tsx
// Full page / inline center
<div className="flex items-center justify-center py-16">
  <svg className="animate-spin w-6 h-6 text-gray-800" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
  </svg>
</div>

// Small inline
<div className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-black rounded-full" />

// Button loading
<RefreshCw className="w-4 h-4 animate-spin" />
```

---

## 5. Layout Patterns

### Public Layout (Navbar + Content + Footer)

```
┌─────────────────────────────────────────────┐
│  Navbar (h-16, sticky, white bg)            │
│  Logo | Nav links            Login | CTA    │
├─────────────────────────────────────────────┤
│                                             │
│  Content (flex-1, max-w-2xl, mx-auto)       │
│                                             │
├─────────────────────────────────────────────┤
│  Footer (gray text, copyright)              │
└─────────────────────────────────────────────┘
```

**Navbar nav links active state:**
```tsx
currentPath === '/target'
  ? 'text-gray-900 font-bold border-b-2 border-black pb-0.5'
  : 'text-gray-500 hover:text-black'
```

### Dashboard Layout (Sidebar + Header + Content)

```
┌───────────┬──────────────────────────────────┐
│ Sidebar   │  Header (h-14, sticky, right)    │
│           │  Avatar ▼  (name + role + logout)│
│ w-64      ├──────────────────────────────────┤
│ Logo      │                                  │
│ Nav items │  Main Content                    │
│           │  p-5 md:p-8                      │
│           │                                  │
│           │                                  │
│           │                                  │
└───────────┴──────────────────────────────────┘
```

**Sidebar nav item:**
```tsx
<button className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
  isActive
    ? 'bg-black text-white shadow-sm'
    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
}`}>
  <Icon className="w-4 h-4" />
  Label
  {count > 0 && (
    <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600">
      {count}
    </span>
  )}
</button>
```

**Mobile sidebar:** Overlay + slide-in, `fixed inset-0 z-30`, backdrop `bg-black/40`, `translate-x` toggle.

---

## 6. Frontend Initial Setup

### `tailwind.config.js`
```js
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: { extend: {} },
  plugins: [],
};
```

### `src/index.css`
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### `vite.config.ts` — optimasi Lucide
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'], // tree-shake per ikon
  },
});
```

### Quickstart Frontend
```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install react-router-dom lucide-react
npm install -D tailwindcss@3 postcss autoprefixer
npx tailwindcss init -p
```

---

## 7. Database (MariaDB)

### Tabel `users`
```sql
CREATE TABLE users (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name          VARCHAR(255) NOT NULL,
    reseller_id   VARCHAR(100) NOT NULL,        -- LIQUID Reseller ID
    api_key       VARCHAR(255) NOT NULL,         -- LIQUID API Key (encrypted)
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Tabel `customers`
```sql
CREATE TABLE customers (
    id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id            INT UNSIGNED NOT NULL,
    liquid_customer_id VARCHAR(100),           -- ID dari LIQUID
    name               VARCHAR(255) NOT NULL,
    email              VARCHAR(255) NOT NULL,
    company            VARCHAR(255),
    address            TEXT,
    city               VARCHAR(100),
    state              VARCHAR(100),
    country            CHAR(2) NOT NULL,
    zipcode            VARCHAR(20),
    phone              VARCHAR(30),
    created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### Tabel `domains`
```sql
CREATE TABLE domains (
    id                   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id              INT UNSIGNED NOT NULL,
    customer_id          INT UNSIGNED,
    domain_name          VARCHAR(255) NOT NULL,
    tld                  VARCHAR(20) NOT NULL,
    registration_date    DATE,
    expiry_date          DATE,
    years                TINYINT UNSIGNED DEFAULT 1,
    status               ENUM('active','pending','expired','suspended','transferred') DEFAULT 'pending',
    auto_renew           TINYINT(1) DEFAULT 0,
    locked               TINYINT(1) DEFAULT 0,
    theft_protection     TINYINT(1) DEFAULT 0,
    privacy_protection   TINYINT(1) DEFAULT 0,
    liquid_order_id      VARCHAR(100),
    nameservers          JSON,
    created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)     REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
);
```

### Tabel `transactions`
```sql
CREATE TABLE transactions (
    id                      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id                 INT UNSIGNED NOT NULL,
    customer_id             INT UNSIGNED,
    domain_id               INT UNSIGNED,
    type                    ENUM('register','renew','transfer','restore','privacy','fund','debit') NOT NULL,
    amount                  DECIMAL(10,2) NOT NULL,
    currency                CHAR(3) DEFAULT 'USD',
    status                  ENUM('pending','completed','failed','cancelled') DEFAULT 'pending',
    liquid_transaction_id   VARCHAR(100),
    description             TEXT,
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)     REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    FOREIGN KEY (domain_id)   REFERENCES domains(id) ON DELETE SET NULL
);
```

### 7a. Diagram Relasi

```
┌──────────┐       ┌──────────────┐       ┌──────────┐
│  users   │──1:N──│  customers   │──1:N──│ domains  │
│          │       │              │       │          │───┬───
│  id (PK) │       │  id (PK)     │       │  id (PK) │   │
│  email   │       │  user_id(FK) │       │  user_id  │   │
│  name    │       │  name        │       │  cust_id  │   │
│  reseller│       │  email       │       │  domain   │   │
│  api_key │       │  country     │       │  status   │   │
└──────────┘       └──────────────┘       └──────────┘   │
                                                          │
                                            ┌──────────────┘
                                            ▼
                                      ┌──────────────┐
                                      │ transactions │
                                      │              │
                                      │  id (PK)     │
                                      │  user_id(FK) │
                                      │  cust_id(FK) │
                                      │  domain_id   │
                                      │  type        │
                                      │  amount      │
                                      │  status      │
                                      └──────────────┘
```

### 7b. Hubungan dengan LIQUID API

```
┌──────────────────────┐       ┌──────────────────────┐
│   Local MariaDB      │       │   LIQUID API          │
│                      │       │   (source of truth)   │
├──────────────────────┤       ├──────────────────────┤
│ users                │──────▶│ Reseller ID + API Key │
│ (kredensial)         │ auth  │ (Basic Auth)          │
│                      │       │                       │
│ customers            │◀─────▶│ /customers/*           │
│ (sync dua arah)      │ sync  │                       │
│                      │       │                       │
│ domains              │◀─────▶│ /domains/*             │
│ (cache dari LIQUID)  │ sync  │                       │
│                      │       │                       │
│ transactions         │◀─────▶│ /account/transactions  │
│ (cache dari LIQUID)  │ sync  │                       │
└──────────────────────┘       └──────────────────────┘

DNS records      → selalu live fetch  → /domains/:id/dns/*      (NO cache)
Prices           → selalu live fetch  → /account/prices          (NO cache)
Balance          → selalu live fetch  → /account/balance         (NO cache)
Availability     → selalu live fetch  → /domains/availability    (NO cache)
```

### 7c. Kenapa Hanya 4 Tabel? (Lean Schema Rationale)

| Tidak Ada | Karena | Alternatif |
|-----------|--------|------------|
| Tabel `dns_records` | DNS sering berubah, harus real-time. Gak ada nilai bisnis untuk cache. | Live fetch dari `GET /domains/:id/dns/:type` |
| Tabel `prices` | Harga bisa berubah kapan aja dari LIQUID. Cache bisa stale. | Live fetch dari `GET /account/prices` |
| Tabel `balance` | Saldo harus akurat real-time. Gak boleh discrepancy. | Live fetch dari `GET /account/balance` |
| Tabel `contacts` terpisah | Dalam konteks LIQUID, "customer" = kontak registrant. MVP gak perlu pisah admin/billing/tech. | Cukup tabel `customers` |
| Tabel `nameservers` | Jarang berubah, cukup quick read. | JSON di kolom `domains.nameservers` |

### 7d. Strategi Sinkronisasi

**Write-through cache** — setiap user melakukan aksi:

```
User Action → Backend panggil LIQUID API → dapat response → update row lokal
```

| Aksi | LIQUID Call | Update Lokal |
|------|-------------|--------------|
| Registrasi domain | `POST /domains` | INSERT ke `domains` + INSERT ke `transactions` |
| Renew | `POST /domains/:id/renew` | UPDATE `domains.expiry_date` + INSERT `transactions` |
| Lock/unlock | `PUT/DELETE /domains/:id/locked` | UPDATE `domains.locked` |
| Privacy on/off | `PUT/DELETE /domains/:id/privacy_protection` | UPDATE `domains.privacy_protection` |
| Ganti NS | `PUT /domains/:id/ns` | UPDATE `domains.nameservers` |
| Tambah customer | `POST /customers` | INSERT ke `customers` (isi `liquid_customer_id`) |

**Background sync (opsional, P2):** nightly cron tarik semua domain dari LIQUID → update `expiry_date` dan `status` lokal.

---

## 8. Arsitektur Modul Backend (Pattern Konsisten)

Setiap modul backend terdiri dari 4 file:

```
modules/{nama}/
├── {nama}.schema.ts    # DTO / validasi request body (Elysia t)
├── {nama}.service.ts   # Pure bisnis logic, no HTTP coupling
├── {nama}.handler.ts   # Terima req → panggil service → return res
└── {nama}.route.ts     # Definisi route, attach schema + handler
```

### Contoh: Modul Auth

**`auth.schema.ts`** — Validasi request body:
```ts
import { t } from "elysia";

export const loginSchema = t.Object({
  email: t.String({ format: "email" }),
  password: t.String({ minLength: 6 }),
});

export const registerSchema = t.Object({
  email: t.String({ format: "email" }),
  password: t.String({ minLength: 6 }),
  name: t.String({ minLength: 1 }),
  reseller_id: t.String({ minLength: 1 }),
  api_key: t.String({ minLength: 1 }),
});
```

**`auth.service.ts`** — Bisnis logic (tanpa HTTP):
```ts
import { db } from "../../db";
import { users } from "../../db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword } from "../../lib/hash";
import { signToken } from "../../lib/jwt";
import { AppError } from "../../lib/error";

export async function register(data: { email: string; password: string; name: string; reseller_id: string; api_key: string }) {
  const exists = await db.select().from(users).where(eq(users.email, data.email));
  if (exists.length > 0) throw new AppError("Email already registered", 409);

  const passwordHash = await hashPassword(data.password);
  const [user] = await db.insert(users).values({
    email: data.email,
    password_hash: passwordHash,
    name: data.name,
    reseller_id: data.reseller_id,
    api_key: data.api_key,
  }).returning();

  const token = await signToken({ sub: user.id, email: user.email });
  return { user: { id: user.id, email: user.email, name: user.name }, token };
}

export async function login(data: { email: string; password: string }) {
  const [user] = await db.select().from(users).where(eq(users.email, data.email));
  if (!user) throw new AppError("Invalid credentials", 401);

  const valid = await verifyPassword(data.password, user.password_hash);
  if (!valid) throw new AppError("Invalid credentials", 401);

  const token = await signToken({ sub: user.id, email: user.email });
  return { user: { id: user.id, email: user.email, name: user.name }, token };
}
```

**`auth.handler.ts`** — HTTP layer tipis:
```ts
import type { Context } from "elysia";
import * as authService from "./auth.service";

export async function register(ctx: Context) {
  const result = await authService.register(ctx.body as any);
  return ctx.json(result, 201);
}

export async function login(ctx: Context) {
  const result = await authService.login(ctx.body as any);
  return ctx.json(result);
}
```

**`auth.route.ts`** — Definisi route:
```ts
import { Elysia } from "elysia";
import { loginSchema, registerSchema } from "./auth.schema";
import * as handler from "./auth.handler";

export const authRoutes = new Elysia({ prefix: "/auth" })
  .post("/register", handler.register, {
    body: registerSchema,
    detail: { tags: ["Auth"], summary: "Register new user" },
  })
  .post("/login", handler.login, {
    body: loginSchema,
    detail: { tags: ["Auth"], summary: "Login" },
  });
```

---

## 9. LIQUID API Client (`lib/liquid.ts`)

Single typed class — semua call ke LIQUID dari sini. Service layer tidak menyentuh HTTP langsung.

```ts
export class LiquidClient {
  private baseURL = "https://api.domainsas.com/v1";
  private authHeader: string;

  constructor(resellerId: string, apiKey: string) {
    this.authHeader = "Basic " + btoa(`${resellerId}:${apiKey}`);
  }

  private async request<T>(method: string, path: string, body?: Record<string, any>): Promise<T> {
    const url = this.baseURL + path;
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body ? new URLSearchParams(body).toString() : undefined,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new AppError(err.message || "LIQUID API error", res.status);
    }
    return res.json();
  }

  // --- Domain ---
  checkAvailability(domain: string) {
    return this.request<any>("GET", `/domains/availability?domain_name=${domain}`);
  }
  registerDomain(data: Record<string, any>) {
    return this.request<any>("POST", "/domains", data);
  }
  getDomain(domainId: string) {
    return this.request<any>("GET", `/domains/${domainId}`);
  }
  renewDomain(domainId: string, data: Record<string, any>) {
    return this.request<any>("POST", `/domains/${domainId}/renew`, data);
  }
  transferDomain(data: Record<string, any>) {
    return this.request<any>("POST", "/domains/transfer", data);
  }
  deleteDomain(domainId: string) {
    return this.request<any>("DELETE", `/domains/${domainId}`);
  }
  suspendDomain(domainId: string) {
    return this.request<any>("PUT", `/domains/${domainId}/suspended`);
  }
  unsuspendDomain(domainId: string) {
    return this.request<any>("DELETE", `/domains/${domainId}/suspended`);
  }
  getAuthCode(domainId: string) {
    return this.request<any>("GET", `/domains/${domainId}/auth_code`);
  }
  updateAuthCode(domainId: string, data: Record<string, any>) {
    return this.request<any>("PUT", `/domains/${domainId}/auth_code`, data);
  }
  updateNameservers(domainId: string, data: Record<string, any>) {
    return this.request<any>("PUT", `/domains/${domainId}/ns`, data);
  }
  getNameservers(domainId: string) {
    return this.request<any>("GET", `/domains/${domainId}/ns`);
  }
  lockDomain(domainId: string) {
    return this.request<any>("PUT", `/domains/${domainId}/locked`);
  }
  unlockDomain(domainId: string) {
    return this.request<any>("DELETE", `/domains/${domainId}/locked`);
  }
  toggleTheftProtection(domainId: string, enable: boolean) {
    return this.request<any>(enable ? "PUT" : "DELETE", `/domains/${domainId}/theft_protection`);
  }
  getDomainSuggestions(keyword: string) {
    return this.request<any>("GET", `/domains/suggestion?keyword=${keyword}`);
  }

  // --- DNS ---
  getDnsRecords(domainId: string, type: string) {
    return this.request<any>("GET", `/domains/${domainId}/dns/${type}`);
  }
  addDnsRecord(domainId: string, type: string, data: Record<string, any>) {
    return this.request<any>("POST", `/domains/${domainId}/dns/${type}`, data);
  }
  updateDnsRecord(domainId: string, type: string, oldHost: string, oldValue: string, data: Record<string, any>) {
    return this.request<any>("PUT", `/domains/${domainId}/dns/${type}/${oldHost}/${oldValue}`, data);
  }
  deleteDnsRecord(domainId: string, type: string, hostname: string, value: string) {
    return this.request<any>("DELETE", `/domains/${domainId}/dns/${type}/${hostname}/${value}`);
  }

  // --- Forwarding ---
  getDomainForwarding(domainId: string) {
    return this.request<any>("GET", `/domains/${domainId}/domain_forwarding`);
  }
  updateDomainForwarding(domainId: string, data: Record<string, any>) {
    return this.request<any>("PUT", `/domains/${domainId}/domain_forwarding`, data);
  }
  getEmailForwarding(domainId: string) {
    return this.request<any>("GET", `/domains/${domainId}/email_forwarding`);
  }
  createEmailForwarding(domainId: string, data: Record<string, any>) {
    return this.request<any>("POST", `/domains/${domainId}/email_forwarding`, data);
  }

  // --- Privacy ---
  getPrivacyProtection(domainId: string) {
    return this.request<any>("GET", `/domains/${domainId}/privacy_protection`);
  }
  enablePrivacyProtection(domainId: string) {
    return this.request<any>("PUT", `/domains/${domainId}/privacy_protection`);
  }
  disablePrivacyProtection(domainId: string) {
    return this.request<any>("DELETE", `/domains/${domainId}/privacy_protection`);
  }
  buyPrivacyProtection(domainId: string) {
    return this.request<any>("POST", `/domains/${domainId}/privacy_protection/buy`);
  }

  // --- Customers ---
  createCustomer(data: Record<string, any>) {
    return this.request<any>("POST", "/customers", data);
  }
  getCustomers() {
    return this.request<any>("GET", "/customers");
  }
  getCustomer(customerId: string) {
    return this.request<any>("GET", `/customers/${customerId}`);
  }
  updateCustomer(customerId: string, data: Record<string, any>) {
    return this.request<any>("PUT", `/customers/${customerId}`, data);
  }
  deleteCustomer(customerId: string) {
    return this.request<any>("DELETE", `/customers/${customerId}`);
  }

  // --- Account ---
  getBalance() {
    return this.request<any>("GET", "/account/balance");
  }
  getPrices() {
    return this.request<any>("GET", "/account/prices");
  }
  getTransactions() {
    return this.request<any>("GET", "/account/transactions");
  }
  getTransaction(transactionId: string) {
    return this.request<any>("GET", `/account/transactions/${transactionId}`);
  }
}
```

---

## 10. Backend Middleware

### Auth Guard (`middleware/auth.ts`)
```ts
import { verifyToken } from "../lib/jwt";

export async function authGuard(ctx: any) {
  const header = ctx.headers["authorization"];
  if (!header?.startsWith("Bearer ")) {
    return ctx.json({ error: "Missing token" }, 401);
  }
  const token = header.slice(7);
  try {
    const payload = await verifyToken(token);
    ctx.store = { user: payload }; // attach user ke context
  } catch {
    return ctx.json({ error: "Invalid token" }, 401);
  }
}
```

### Rate Limiter (`middleware/rate-limit.ts`)
```ts
const store = new Map<string, { count: number; reset: number }>();

export function rateLimit(max: number, windowMs: number) {
  return (ctx: any) => {
    const ip = ctx.headers["x-forwarded-for"] || "unknown";
    const now = Date.now();
    const entry = store.get(ip);
    if (!entry || now > entry.reset) {
      store.set(ip, { count: 1, reset: now + windowMs });
      return;
    }
    if (entry.count >= max) {
      return ctx.json({ error: "Too many requests" }, 429);
    }
    entry.count++;
  };
}
```

---

## 11. Backend Entry Point (`src/index.ts`)

```ts
import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { authRoutes } from "./modules/auth/auth.route";
import { domainRoutes } from "./modules/domains/domains.route";
import { customerRoutes } from "./modules/customers/customers.route";
import { billingRoutes } from "./modules/billing/billing.route";
import { dnsRoutes } from "./modules/dns/dns.route";
import { forwardingRoutes } from "./modules/forwarding/forwarding.route";
import { env } from "./config/env";

const app = new Elysia()
  .use(cors({ origin: env.CORS_ORIGIN || "http://localhost:5173" }))
  .group("/api", (app) =>
    app
      .use(authRoutes)
      .use(domainRoutes)
      .use(customerRoutes)
      .use(billingRoutes)
      .use(dnsRoutes)
      .use(forwardingRoutes)
  )
  .listen(env.PORT);

console.log(`🚀 Server running on http://localhost:${env.PORT}`);
```

---

## 12. Frontend API Client (`lib/api.ts`)

```ts
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

async function request<T>(method: string, path: string, body?: any): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const token = localStorage.getItem("token");
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    localStorage.removeItem("token");
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || err.message || "Request failed");
  }

  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: any) => request<T>("POST", path, body),
  put: <T>(path: string, body?: any) => request<T>("PUT", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};
```

---

## 13. Frontend Auth Context (`contexts/AuthContext.tsx`)

```tsx
import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { api } from "../lib/api";

interface User {
  id: number;
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; name: string; reseller_id: string; api_key: string }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { setLoading(false); return; }
    api.get<{ user: User }>("/auth/me")
      .then((res) => setUser(res.user))
      .catch(() => localStorage.removeItem("token"))
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const res = await api.post<{ user: User; token: string }>("/auth/login", { email, password });
    localStorage.setItem("token", res.token);
    setUser(res.user);
  }

  async function register(data: { email: string; password: string; name: string; reseller_id: string; api_key: string }) {
    const res = await api.post<{ user: User; token: string }>("/auth/register", data);
    localStorage.setItem("token", res.token);
    setUser(res.user);
  }

  function logout() {
    localStorage.removeItem("token");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
```

---

## 14. Route Map Lengkap

### Backend API Routes (`/api`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| **Auth** | | | |
| POST | `/api/auth/register` | No | Register user baru |
| POST | `/api/auth/login` | No | Login, return JWT |
| GET | `/api/auth/me` | Yes | Get current user |
| **Domains** | | | |
| GET | `/api/domains` | Yes | List semua domain user |
| POST | `/api/domains` | Yes | Register domain baru |
| GET | `/api/domains/availability?domain=xxx` | Yes | Cek ketersediaan domain |
| GET | `/api/domains/suggestion?keyword=xxx` | Yes | Saran domain |
| GET | `/api/domains/:id` | Yes | Detail domain |
| DELETE | `/api/domains/:id` | Yes | Hapus domain |
| POST | `/api/domains/:id/renew` | Yes | Perpanjang domain |
| PUT | `/api/domains/:id/transfer` | Yes | Transfer domain |
| POST | `/api/domains/:id/restore` | Yes | Restore domain |
| PUT | `/api/domains/:id/locked` | Yes | Lock domain |
| DELETE | `/api/domains/:id/locked` | Yes | Unlock domain |
| PUT | `/api/domains/:id/theft-protection` | Yes | Toggle theft protection |
| PUT | `/api/domains/:id/ns` | Yes | Update nameservers |
| GET | `/api/domains/:id/ns` | Yes | Get nameservers |
| GET | `/api/domains/:id/auth-code` | Yes | Get auth code |
| PUT | `/api/domains/:id/auth-code` | Yes | Update auth code |
| **DNS** | | | |
| GET | `/api/domains/:id/dns/:type` | Yes | List DNS records |
| POST | `/api/domains/:id/dns/:type` | Yes | Add record |
| PUT | `/api/domains/:id/dns/:type/:oldHost/:oldValue` | Yes | Update record |
| DELETE | `/api/domains/:id/dns/:type/:hostname/:value` | Yes | Delete record |
| **Forwarding** | | | |
| GET | `/api/domains/:id/domain-forwarding` | Yes | Get domain forwarding |
| PUT | `/api/domains/:id/domain-forwarding` | Yes | Update domain forwarding |
| GET | `/api/domains/:id/email-forwarding` | Yes | List email forwarding |
| POST | `/api/domains/:id/email-forwarding` | Yes | Create email forwarding |
| **Privacy** | | | |
| GET | `/api/domains/:id/privacy` | Yes | Get privacy status |
| PUT | `/api/domains/:id/privacy` | Yes | Enable privacy |
| DELETE | `/api/domains/:id/privacy` | Yes | Disable privacy |
| **Customers** | | | |
| GET | `/api/customers` | Yes | List customers |
| POST | `/api/customers` | Yes | Create customer |
| GET | `/api/customers/:id` | Yes | Get customer detail |
| PUT | `/api/customers/:id` | Yes | Update customer |
| DELETE | `/api/customers/:id` | Yes | Delete customer |
| **Billing** | | | |
| GET | `/api/billing/balance` | Yes | Get balance |
| GET | `/api/billing/transactions` | Yes | List transactions |
| GET | `/api/billing/transactions/:id` | Yes | Transaction detail |
| GET | `/api/billing/prices` | Yes | List prices |

### Frontend Routes (React Router)

| Path | Component | Layout | Auth |
|------|-----------|--------|------|
| `/login` | `LoginPage` | Public | No |
| `/register` | `RegisterPage` | Public | No |
| `/` | `DashboardPage` | Dashboard | Yes |
| `/dashboard` | `DashboardPage` | Dashboard | Yes |
| `/domains` | `DomainsPage` | Dashboard | Yes |
| `/domains/register` | `DomainRegisterPage` | Dashboard | Yes |
| `/domains/:id` | `DomainDetailPage` | Dashboard | Yes |
| `/domains/:id/dns` | `DnsManagePage` | Dashboard | Yes |
| `/customers` | `CustomersPage` | Dashboard | Yes |
| `/customers/new` | `CustomerCreatePage` | Dashboard | Yes |
| `/billing` | `BillingPage` | Dashboard | Yes |
| `/settings` | `SettingsPage` | Dashboard | Yes |

---

## 15. Sequence: Registrasi Domain (Flow Lengkap)

```
User (React) → [POST /api/domains] → Elysia handler → service
  │
  ├─ 1. service cek availability via LiquidClient.checkAvailability()
  ├─ 2. service cek/validasi customer exists via LiquidClient
  ├─ 3. service panggil LiquidClient.registerDomain()
  ├─ 4. service simpan ke tabel `domains` lokal (Drizzle)
  ├─ 5. service catat transaksi ke tabel `transactions`
  └─ 6. handler return { domain_id, order_id, status } → React update UI
```

---

## 16. Environment Variables

### Backend `.env.example`
```env
PORT=3000
CORS_ORIGIN=http://localhost:5173

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=domain_dashboard

JWT_SECRET=your-secret-key-min-32-chars
JWT_EXPIRY=24h

# Opsional
APP_URL=http://localhost:3000
```

### Frontend `.env`
```env
VITE_API_URL=http://localhost:3000/api
```

---

## 17. Deploy ke CloudPanel

1. **Install Bun di VPS:**
   ```bash
   curl -fsSL https://bun.sh/install | bash
   source ~/.bashrc
   ```

2. **Setup MariaDB** di CloudPanel (UI).

3. **Build frontend:**
   ```bash
   cd frontend
   npm install
   npm run build    # output ke dist/
   ```

4. **Buat Node.js Site** di CloudPanel untuk backend:
   - App Port: `3000`
   - Start Command: `bun run src/index.ts`
   - Serve frontend static dari `frontend/dist` via Nginx

5. **Nginx config** (di-edit via CloudPanel):
   ```nginx
   # Frontend static
   location / {
     root /home/user/htdocs/frontend/dist;
     try_files $uri /index.html;
   }

   # Backend API proxy
   location /api {
     proxy_pass http://127.0.0.1:3000;
     proxy_set_header Host $host;
     proxy_set_header X-Forwarded-For $remote_addr;
   }
   ```

6. **Upload project:**
   ```bash
   rsync -avz ./ user@vps:/home/user/htdocs/site.com/
   cd /home/user/htdocs/site.com/backend
   bun install
   ```

7. **Generate & run migration:**
   ```bash
   bun drizzle-kit push
   ```

8. **Restart site** via CloudPanel UI.

---

## 18. Backend `package.json`

```json
{
  "name": "domain-dashboard-backend",
  "version": "1.0.0",
  "scripts": {
    "dev": "bun run --watch src/index.ts",
    "start": "bun run src/index.ts",
    "db:generate": "drizzle-kit generate",
    "db:push": "drizzle-kit push",
    "db:migrate": "drizzle-kit migrate"
  },
  "dependencies": {
    "elysia": "^1.1.0",
    "@elysiajs/cors": "^1.1.0",
    "drizzle-orm": "^0.33.0",
    "mysql2": "^3.11.0"
  },
  "devDependencies": {
    "drizzle-kit": "^0.24.0",
    "@types/bun": "latest"
  }
}
```

---

## 19. Frontend `package.json`

```json
{
  "name": "domain-dashboard-frontend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.0",
    "lucide-react": "^0.441.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.45",
    "tailwindcss": "^3.4.10",
    "typescript": "^5.5.4",
    "vite": "^5.4.3"
  }
}
```

---

## 20. Estimasi Pengerjaan (1 Orang)

| Komponen | Estimasi |
|----------|----------|
| Project scaffold + config + DB setup backend | 0.5 hari |
| DB schema + Drizzle setup + migration | 1 hari |
| LIQUID API client (semua endpoint) | 2-3 hari |
| Auth module backend (register, login, JWT, middleware) | 1 hari |
| Domain module backend (CRUD + LIQUID integration) | 2 hari |
| DNS module backend | 1.5 hari |
| Customer module backend | 1 hari |
| Billing module backend | 1 hari |
| Forwarding + Privacy module backend | 0.5 hari |
| Frontend scaffold (Vite + Tailwind + Router) | 0.5 hari |
| Auth pages (Login, Register) + AuthContext | 1 hari |
| Dashboard layout (Sidebar, Header, responsive) | 1.5 hari |
| Domain pages (list, register, detail) | 3 hari |
| DNS management page | 1.5 hari |
| Customer pages | 1 hari |
| Billing page | 1 hari |
| UI components (Card, Table, Modal, Badge, etc.) | 2 hari |
| Integration testing frontend ↔ backend | 2 hari |
| Deploy ke CloudPanel | 0.5 hari |
| **Total** | **~4-5 minggu** |

---

## 21. Prinsip Desain

1. **Module separation backend**: service / handler / schema / route — gak saling coupling, gampang di-test dan di-replace
2. **Component separation frontend**: UI primitives (`components/ui/`) vs layout (`components/layout/`) vs domain-specific (`components/domain/`) vs pages (`pages/`)
3. **Single LIQUID client**: semua komunikasi ke API eksternal lewat satu class typed — kalau API berubah, ganti di satu tempat
4. **Design system consistent**: seluruh UI mengikuti `design.md` — warna, typography, spacing, radius, component, semua copy-pasteable
5. **Elysia built-in types**: validation pakai `t` object bawaan, gak perlu Zod / library tambahan
6. **Bun native**: password hashing (`Bun.password`), hot reload (`--watch`) — semua built-in
7. **Stateless JWT**: gak perlu session store, cocok untuk horizontal scaling nanti
8. **Mobile-first responsive**: table di desktop, card list di mobile
