# Technical Implementation Plan: Domain Order, Transfer, and Renewal Flow with Sumopod Payment Gateway

Dokumen ini menjelaskan rancangan teknis dan rencana implementasi mendalam untuk alur **Order Domain (Registrasi)**, **Transfer Domain**, dan **Perpanjangan (Renew) Domain** yang terintegrasi langsung secara otomatis dengan **Sumopod Payment Gateway**, serta penyesuaian UI Design System sesuai spesifikasi `design.md` (menggunakan tema warna hitam / monochrome premium).

---

## 1. Arsitektur Alur Transaksi & Payment Gateway (Sumopod)

### 1.1 Spesifikasi Sumopod Payment Gateway (Ref: `sumopod.md`)
- **Base URL API Sandbox**: `https://api-pay-sandbox.sumopod.com/api/v1`
- **Authentication**: Header `X-Api-Key: <SUMOPOD_API_KEY>`
- **Webhook Security**: 
  - Token Header: `X-Webhook-Token` vs `SUMOPOD_WEBHOOK_TOKEN`
  - HMAC Signature: `svix-id`, `svix-timestamp`, `svix-signature` dengan raw unparsed request body.

### 1.2 Status Life Cycle Transaksi & Domain Execution

```
[User Action] (Order / Transfer / Renew)
       │
       ▼
1. Backend Validation & Price Calculation
       │
       ▼
2. Create Local Transaction Record (`status: pending_payment`, `metadata: {...}`)
       │
       ▼
3. Call Sumopod API `POST /payments` -> Get `payment_link_url` & `payment_id`
       │
       ▼
4. Return Payment Link / QRIS to Frontend Modal
       │
       ▼
5. User Performs Payment on Sumopod (QRIS / Bank / E-Wallet)
       │
       ├──────────────────────────────────────┐
       │                                      │
[Webhook: payment.completed]          [Webhook: payment.failed / expired]
       │                                      │
       ▼                                      ▼
6. Verify Webhook Signature           Mark Transaction `failed` / `expired`
       │                               (No LIQUID API Call)
       ▼
7. Mark Transaction `processing_domain`
       │
       ▼
8. Execute Action on LIQUID API:
   - Order: `registerDomain(...)`
   - Transfer: `transferDomain(...)`
   - Renew: `renewDomain(...)`
       │
       ├──────────────────────────────────────┐
       │ (Success)                            │ (Failure)
       ▼                                      ▼
9. Save/Update Local Domain DB,       Mark Transaction `manual_intervention_required`
   Mark Transaction `completed`       & Send Alert Notification
```

---

## 2. Modifikasi Data & Schema Database

### 2.1 Schema Update (`backend/src/db/schema/transactions.ts`)
Tambahkan kolom untuk menangani pembayaran eksternal via Sumopod dan snapshot data order pada `transactions`:

- `paymentGateway`: `varchar("payment_gateway", { length: 50 }).default("sumopod")`
- `paymentId`: `varchar("payment_id", { length: 100 })` (UUID dari Sumopod)
- `paymentLinkUrl`: `text("payment_link_url")` (URL pembayaran Sumopod)
- `paymentStatus`: `mysqlEnum("payment_status", ["pending", "completed", "failed", "expired"]).default("pending")`
- `metadata`: `text("metadata")` (JSON stringified snapshot data registrasi: `domainName`, `tld`, `years`, `customerId`, `nameservers`, `authCode`, `privacyProtection`, `autoRenew`)
- Update enum `status`: `mysqlEnum("status", ["pending_payment", "processing_domain", "completed", "failed", "cancelled", "expired", "action_required"])`

---

## 3. Backend Endpoints & Handler Implementation

### 3.1 New / Updated Endpoints
1. `POST /api/domains/order`
   - Input: `{ domainName, years, customerId, nameservers, privacyProtection, autoRenew }`
   - Output: `{ orderId, paymentId, paymentLinkUrl, amount, currency, status: "pending_payment" }`
2. `POST /api/domains/transfer-order`
   - Input: `{ domainName, authCode, customerId, nameservers }`
   - Output: `{ orderId, paymentId, paymentLinkUrl, amount, currency, status: "pending_payment" }`
3. `POST /api/domains/:id/renew-order`
   - Input: `{ years }`
   - Output: `{ orderId, paymentId, paymentLinkUrl, amount, currency, status: "pending_payment" }`
4. `POST /api/payments/webhook/sumopod`
   - Header validation: `svix-signature` / `x-webhook-token`
   - Webhook processing untuk event `payment.completed`, `payment.failed`, `payment.expired`.

### 3.2 Sumopod Integration Client (`backend/src/lib/sumopod.ts`)
Fungsi helper untuk berkomunikasi dengan Sumopod API:
- `createPayment({ orderId, amount, currency, successReturnUrl, cancelReturnUrl })`
- `verifyWebhookToken(headerToken)`
- `verifyWebhookSignature(svixId, svixTimestamp, svixSignature, rawBody)`

---

## 4. Frontend User Experience (UX) Alur Pembayaran

### 4.1 Order & Transfer Form Step-by-Step
1. **Pencarian / Inisiasi**: User mencari ketersediaan domain atau memasukkan domain transfer + Auth Code.
2. **Kalkulasi & Opsi**: User memilih durasi tahun (1-10 tahun), Customer ID / Contact ID, Nameservers, dan Add-on Privacy Protection.
3. **Tombol Checkout (CTA Black)**: User menekan tombol **"Lanjutkan Pembayaran"** (`bg-black text-white hover:bg-gray-800`).
4. **Payment Modal / Drawer**: 
   - Menampilkan ringkasan tagihan & rincian domain.
   - Tombol **"Bayar via QRIS / Sumopod"** yang membuka `payment_link_url` atau menyajikan iframe / QRIS.
   - Real-time polling / WebSocket status check hingga webhook mengubah status transaksi menjadi `completed`.
5. **Redirect & Konfirmasi**: Setelah sukses, user diarahkan ke Halaman Detail Domain / Billing dengan status **Active** / **Processing**.

---

## 5. Penyesuaian Design System (Warna & Tombol) Sesuai `design.md`

Sesuai instruksi dan dokumen `design.md`, seluruh elemen UI yang sebelumnya menggunakan warna biru (`blue-600`) atau warna aksen sekunder disesuaikan menjadi **Monochrome / Black Primary Design System**:

### 5.1 Palette & Rules
- **Primary Brand Color**: `black` (`#000000`) & `gray-900` (`#111827`) untuk tombol CTA utama, tab navigasi aktif, dan elemen branding.
- **Background Halaman**: `bg-[#f0f2f5]`
- **Card & Container**: `bg-white border border-gray-200 rounded-xl shadow-sm`
- **Stat Cards**: `rounded-2xl` dengan kotak ikon `bg-black text-white`
- **Tombol Primary (CTA & Submit)**:
  `px-4 py-2 bg-black text-white text-sm font-semibold rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50`
- **Tombol Secondary (Outline)**:
  `px-4 py-2 border border-gray-200 hover:bg-gray-50 text-sm font-semibold rounded-lg text-gray-700 transition-colors`
- **Tombol Danger**:
  `px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 text-sm font-semibold rounded-lg transition-colors`
- **Focus Rings pada Input & Form**:
  `focus:ring-2 focus:ring-black focus:border-transparent` atau `focus:ring-1 focus:ring-black`
- **Status Colors**:
  - Active / Completed: `bg-emerald-50 text-emerald-700 border-emerald-150`
  - Pending / Expiring: `bg-amber-50 text-amber-700 border-amber-200`
  - Expired / Failed: `bg-red-50 text-red-700 border-red-100`

### 5.2 Komponen Frontend yang Diupdate Warna Tombolnya
1. `LandingPage.tsx`: Mengubah semua tombol `bg-blue-600` / `bg-indigo-600` menjadi `bg-black hover:bg-gray-800`, hero gradient dari indigo/blue ke black/gray modern.
2. `DomainRegisterPage.tsx`: Mengubah tombol cari domain, pendaftaran, selector pilihan, dan checkout dari biru (`blue-600`) menjadi `bg-black hover:bg-gray-800`.
3. `DomainTransferPage.tsx`: Mengubah tombol submit transfer ke `bg-black`.
4. `DashboardPage.tsx`: Mengubah card hero & quick action buttons ke `bg-black`.
5. `DomainDetailPage.tsx`: Mengubah tombol renew modal, lock/unlock, dan update nameserver ke tombol standar `design.md`.
6. `BillingPage.tsx`: Mengubah invoice link & action buttons ke hitam/monokrom.

---

## 6. Verifikasi & pengujian

### 6.1 Testing Steps
1. **Backend Integration Tests**:
   - Mock call Sumopod Payment API endpoint.
   - Simulation Webhook `payment.completed` payload test signature verification.
   - Verify LIQUID API trigger after payment completion.
2. **Frontend UI Smoke Test**:
   - Pastikan tidak ada lagi tombol `blue-600` atau aksen non-design.md di alur order, transfer, renew.
   - Test respon modal payment gateway Sumopod.
