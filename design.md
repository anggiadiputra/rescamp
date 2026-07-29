# DomainWhois Design System

> Build a new project with this look and feel. Copy-pasteable.

---

## 1. Stack Minimal

```
React 18 + TypeScript + Vite
Tailwind CSS v3 (default theme, no extensions)
Lucide React (icons)
```

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
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'], // tree-shake per ikon
  },
});
```

---

## 2. Warna & Background

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

---

## 3. Typography

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

---

## 4. Spacing & Layout

```css
/* Page padding (main content area) */
.p-5 md:p-8

/* Section gap */
.space-y-6

/* Card padding */
.p-5 md:p-6

/* Navbar height */
.h-16 (public)
.h-14 (dashboard)

/* Sidebar width */
.w-64

/* Max layout width (public pages) */
.max-w-7xl mx-auto px-4 sm:px-6

/* Sticky header */
.sticky top-0 z-10
```

---

## 5. Radius & Border

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

---

## 6. Components

### 6a. Card

```tsx
<div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 md:p-6">
  {/* content */}
</div>
```

### 6b. Stat Card (dashboard)

```tsx
<div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
  <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center shrink-0">
    <Globe className="w-5.5 h-5.5 text-white" />
  </div>
  <div>
    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Label</p>
    <p className="text-2xl font-black text-gray-900 mt-0.5">42</p>
  </div>
</div>
```

### 6c. Search / Filter Bar

```tsx
<div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col sm:flex-row items-center gap-3">
  <div className="relative w-full sm:w-64 shrink-0">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
    <input
      className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-black text-gray-800"
      placeholder="Cari..."
    />
  </div>
</div>
```

### 6d. Input Field

```tsx
{/* With icon */}
<div className="relative">
  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
  <input
    type="text"
    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent font-mono"
    placeholder="example.com"
  />
</div>

{/* Without icon */}
<input
  type="email"
  className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black text-gray-800"
  placeholder="nama@domain.com"
/>
```

### 6e. Buttons

```tsx
{/* Primary (CTA, Submit) */}
<button className="px-4 py-2 bg-black text-white text-sm font-semibold rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50">
  Submit
</button>

{/* Secondary (Outline) */}
<button className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-sm font-semibold rounded-lg text-gray-700 transition-colors">
  Batal
</button>

{/* Danger */}
<button className="px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 text-sm font-semibold rounded-lg transition-colors">
  Hapus
</button>

{/* Icon-only table action */}
<button className="p-1.5 text-gray-400 hover:text-black hover:bg-gray-100 rounded-lg transition-colors">
  <RefreshCw className="w-3.5 h-3.5" />
</button>
```

### 6f. Table

```tsx
<div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
  <div className="hidden md:block overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-gray-50 border-b border-gray-100">
          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Column</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
        <tr className="hover:bg-gray-50/50">
          <td className="px-4 py-3 text-xs text-gray-800">Data</td>
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

### 6g. Modal

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

### 6h. Badge (Status / Role)

```tsx
{/* Status pill */}
<span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-red-100 text-red-800 border-red-200">
  Expired
</span>

{/* Role admin */}
<span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border bg-black text-white border-black">
  admin
</span>

{/* Role user */}
<span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border bg-gray-50 text-gray-600 border-gray-200">
  user
</span>
```

### 6i. Info Banner (Alerts)

```tsx
{/* Error */}
<div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-800 text-sm">
  <AlertCircle className="w-5 h-5 shrink-0" />
  <span>Error message here</span>
</div>

{/* Success with copy action */}
<div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex flex-col gap-2.5 text-emerald-800 text-sm font-medium">
  <div className="flex items-center gap-2">
    <ShieldCheck className="w-4 h-4 shrink-0" />
    <span>Success message</span>
  </div>
</div>
```

### 6j. Empty State

```tsx
<div className="text-center py-16 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
  <Bookmark className="w-12 h-12 mx-auto mb-3 text-gray-300" />
  <p className="text-sm font-medium text-gray-500">No saved domains yet</p>
  <p className="text-xs text-gray-400 mt-1">Search for a domain and click "Save" to add it here</p>
  <button className="mt-4 px-4 py-2 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors">
    Start searching
  </button>
</div>
```

### 6k. Loading Spinner

```tsx
{/* Full page / inline center */}
<div className="flex items-center justify-center py-16">
  <svg className="animate-spin w-6 h-6 text-gray-800" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
  </svg>
</div>

{/* Small inline */}
<div className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-black rounded-full" />

{/* Button */}
<RefreshCw className="w-4 h-4 animate-spin" />
```

---

## 7. Layout Patterns

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
  {count > 0 && <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600">{count}</span>}
</button>
```

**Mobile sidebar:** Overlay + slide-in, `fixed inset-0 z-30`, backdrop `bg-black/40`, `translate-x` toggle.

---

## 8. Icons (Lucide React)

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

---

## 9. Transitions & Animation

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

---

## 10. Responsive Breakpoints

| Prefix | Width | Pattern |
|---|---|---|
| Default | All | Mobile-first, stack vertically |
| `sm:` | 640px | Side-by-side flex on cards, search + filter |
| `md:` | 768px | Show table (hidden on mobile), show card list on mobile |
| `lg:` | 1024px | Side panel, dashboard grid columns |

```tsx
{/* Common responsive patterns */}
className="flex flex-col sm:flex-row"
className="hidden md:block"  // show desktop table
className="block md:hidden"  // show mobile cards
className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
className="grid grid-cols-1 lg:grid-cols-12 gap-6"
className="w-full sm:w-64"  // input width
```

---

## 11. Zustand / State Pattern (Optional)

Proyek ini pakai React Context (`AuthContext`). Untuk state global yang lebih kompleks, bisa upgrade ke Zustand:

```ts
// Lazy pattern — untested
// zustand store for UI state
interface UIStore {
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
}
```

---

## 12. File Structure (scaffold)

```
src/
├── main.tsx
├── App.tsx              # Router + auth gate
├── index.css            # Tailwind directives
├── vite-env.d.ts
├── contexts/
│   └── AuthContext.tsx   # Auth state + provider
├── lib/
│   └── types.ts         # Shared TypeScript types
└── pages/
    ├── DashboardPage.tsx
    ├── LoginPage.tsx
    ├── SettingsPage.tsx
    └── ...
```

---

## Quickstart for New Project

```bash
npm create vite@latest my-app -- --template react-ts
cd my-app
npm install react-router-dom lucide-react
npm install -D tailwindcss@3 postcss autoprefixer
npx tailwindcss init -p
```

Then copy:
1. `design.md` → reference for CSS classes
2. `tailwind.config.js` (content paths only, no theme extensions)
3. `src/index.css` (Tailwind directives only)
4. `vite.config.ts` (React plugin + lucide-react exclude)
