# Product Requirement Document (PRD)
## Customer Domain Dashboard

> **Produk:** Self-service dashboard untuk pelanggan reseller domain  
> **Status:** Draft v1.0  
> **Tanggal:** 28 Juli 2026  
> **Dokumen Terkait:** `luquid.md` (API docs), `design.md` (design system), `dashboard-plan.md` (technical plan)

---

## 1. Executive Summary

### 1.1. Masalah

Saat ini reseller LIQUID tidak memiliki dashboard self-service untuk pelanggan akhir (end-customer). Semua proses — registrasi domain, perpanjangan, kelola DNS, cek status — harus dilakukan manual oleh reseller melalui panel LIQUID. Ini menyebabkan:

- **Reseller bottleneck:** setiap request pelanggan harus dikerjakan manual
- **Customer experience buruk:** pelanggan tidak bisa cek status domain sendiri, lambat
- **Tidak scalable:** semakin banyak pelanggan, semakin berat beban reseller
- **Tidak transparan:** pelanggan tidak bisa lihat riwayat transaksi, expiry date, dll

### 1.2. Solusi

**Customer Domain Dashboard** — platform web self-service di mana pelanggan reseller bisa:

1. **Order domain sendiri** — cek ketersediaan, registrasi, transfer
2. **Kelola domain** — lihat status, perpanjang, lock/unlock, ganti nameserver
3. **Atur DNS** — tambah/edit/hapus A, AAAA, CNAME, MX, TXT, NS, SRV records
4. **Lihat riwayat billing** — transaksi, saldo, invoice
5. **Kelola kontak** — data registrant, admin, billing, tech contact

Semua terhubung real-time ke **LIQUID API** (`api.domainsas.com`).

### 1.3. Value Proposition

| Untuk | Value |
|-------|-------|
| **Reseller** | Zero manual work, scalable, fokus ke akuisisi pelanggan baru |
| **End-Customer** | Self-service 24/7, instant, transparan, kontrol penuh |
| **Bisnis** | Revenue growth via self-service upsell (privacy, renewals) |

---

## 2. Target Pengguna (Personas)

### Persona 1 — Pemilik Bisnis Kecil (Primary)
> "Saya beli domain untuk website toko saya. Gak ngerti teknis DNS. Mau yang simpel."

- **Kebutuhan:** beli domain, lihat status, perpanjang otomatis
- **Skill teknis:** rendah
- **Frekuensi:** 1-2x setahun
- **Device:** mobile & desktop

### Persona 2 — Freelancer / Developer (Secondary)
> "Saya kelola domain klien. Perlu ganti DNS record sering, cek expiry."

- **Kebutuhan:** kelola banyak domain, DNS advanced, multi-customer
- **Skill teknis:** tinggi
- **Frekuensi:** mingguan
- **Device:** desktop

### Persona 3 — Reseller Admin (Tertiary)
> "Saya perlu kelola semua customer saya dan pantau transaksi mereka."

- **Kebutuhan:** lihat semua customer, transaksi, top-up saldo, atur harga
- **Skill teknis:** menengah
- **Device:** desktop

---

## 3. User Stories

### Epic 1 — Autentikasi & Onboarding

| ID | Story | Priority |
|----|-------|----------|
| A-01 | Sebagai pengguna baru, saya bisa daftar akun dengan email, password, nama, Reseller ID, dan API Key | P0 |
| A-02 | Sebagai pengguna terdaftar, saya bisa login dengan email dan password | P0 |
| A-03 | Sebagai pengguna, saya bisa logout dari dashboard | P0 |
| A-04 | Sebagai pengguna, sesi saya tetap aman dengan token JWT yang expire otomatis | P1 |
| A-05 | Sebagai pengguna, saya bisa melihat profil saya (nama, email) | P2 |

### Epic 2 — Domain Management

| ID | Story | Priority |
|----|-------|----------|
| D-01 | Sebagai pengguna, saya bisa mencari dan mengecek ketersediaan domain name | P0 |
| D-02 | Sebagai pengguna, saya bisa melihat saran domain alternatif jika nama yang saya mau tidak tersedia | P1 |
| D-03 | Sebagai pengguna, saya bisa registrasi domain baru (pilih TLD, tahun, customer) | P0 |
| D-04 | Sebagai pengguna, saya bisa melihat daftar semua domain saya lengkap dengan status, expiry date | P0 |
| D-05 | Sebagai pengguna, saya bisa melihat detail satu domain (status, expiry, nameserver, auth code) | P0 |
| D-06 | Sebagai pengguna, saya bisa memperpanjang (renew) domain | P0 |
| D-07 | Sebagai pengguna, saya bisa mentransfer domain dari registrar lain | P1 |
| D-08 | Sebagai pengguna, saya bisa lock/unlock domain untuk mencegah transfer tidak sah | P1 |
| D-09 | Sebagai pengguna, saya bisa enable/disable theft protection | P2 |
| D-10 | Sebagai pengguna, saya bisa suspend/unsuspend domain | P2 |
| D-11 | Sebagai pengguna, saya bisa mendapatkan auth/EPP code untuk transfer keluar | P1 |
| D-12 | Sebagai pengguna, saya bisa mengganti nameserver domain (default/custom) | P1 |
| D-13 | Sebagai pengguna, saya bisa menghapus domain | P2 |

### Epic 3 — DNS Management

| ID | Story | Priority |
|----|-------|----------|
| DNS-01 | Sebagai pengguna, saya bisa melihat semua DNS record untuk satu domain | P0 |
| DNS-02 | Sebagai pengguna, saya bisa menambah DNS record (A, AAAA, CNAME, MX, TXT, NS, SRV) | P0 |
| DNS-03 | Sebagai pengguna, saya bisa mengedit DNS record yang sudah ada | P0 |
| DNS-04 | Sebagai pengguna, saya bisa menghapus DNS record | P0 |
| DNS-05 | Sebagai pengguna, saya bisa melihat record type dengan label yang mudah dipahami (bukan kode teknis) | P1 |

### Epic 4 — Forwarding

| ID | Story | Priority |
|----|-------|----------|
| FWD-01 | Sebagai pengguna, saya bisa mengatur domain forwarding (redirect) | P2 |
| FWD-02 | Sebagai pengguna, saya bisa mengatur email forwarding | P2 |

### Epic 5 — Privacy Protection

| ID | Story | Priority |
|----|-------|----------|
| PRV-01 | Sebagai pengguna, saya bisa melihat status privacy protection domain | P1 |
| PRV-02 | Sebagai pengguna, saya bisa mengaktifkan privacy protection (whois guard) | P1 |
| PRV-03 | Sebagai pengguna, saya bisa menonaktifkan privacy protection | P2 |
| PRV-04 | Sebagai pengguna, saya bisa membeli privacy protection untuk domain yang belum punya | P1 |

### Epic 6 — Customer Management

| ID | Story | Priority |
|----|-------|----------|
| C-01 | Sebagai pengguna, saya bisa menambah kontak customer (registrant, admin, billing, tech) | P1 |
| C-02 | Sebagai pengguna, saya bisa melihat daftar kontak customer saya | P1 |
| C-03 | Sebagai pengguna, saya bisa mengedit kontak customer | P2 |
| C-04 | Sebagai pengguna, saya bisa menghapus kontak customer | P2 |
| C-05 | Sebagai pengguna, saya bisa memilih kontak default saat order domain baru | P1 |

### Epic 7 — Billing & Transaksi

| ID | Story | Priority |
|----|-------|----------|
| B-01 | Sebagai pengguna, saya bisa melihat saldo akun saya (balance) | P0 |
| B-02 | Sebagai pengguna, saya bisa melihat riwayat transaksi saya (register, renew, transfer, fund) | P0 |
| B-03 | Sebagai pengguna, saya bisa melihat detail satu transaksi | P1 |
| B-04 | Sebagai pengguna, saya bisa melihat daftar harga domain (price list) | P1 |
| B-05 | Sebagai pengguna, saya bisa mendapat notifikasi ketika domain mau expired | P2 |

### Epic 8 — Dashboard & Overview

| ID | Story | Priority |
|----|-------|----------|
| DASH-01 | Sebagai pengguna, saya melihat overview di dashboard: total domain, domain aktif, expired, saldo | P0 |
| DASH-02 | Sebagai pengguna, saya melihat daftar domain yang akan expired dalam 30/60/90 hari | P1 |
| DASH-03 | Sebagai pengguna, saya bisa mencari domain saya dengan cepat (search bar) | P1 |

---

## 4. Functional Requirements

### 4.1. Prioritas (MoSCoW)

#### Must Have (P0) — MVP wajib

| # | Fitur |
|---|-------|
| 1 | Register & login pengguna |
| 2 | Check domain availability |
| 3 | Register domain baru |
| 4 | List semua domain user + status + expiry |
| 5 | Detail domain (status, expiry, nameserver) |
| 6 | Renew domain |
| 7 | Manage DNS records (CRUD: A, AAAA, CNAME, MX, TXT, NS, SRV) |
| 8 | Dashboard overview (total domain, saldo) |
| 9 | Lihat saldo akun |
| 10 | Lihat riwayat transaksi |

#### Should Have (P1) — MVP+1

| # | Fitur |
|---|-------|
| 11 | Transfer domain |
| 12 | Lock/unlock domain |
| 13 | Ganti nameserver |
| 14 | Auth/EPP code |
| 15 | Privacy protection on/off/buy |
| 16 | Domain suggestion |
| 17 | Customer contact management |
| 18 | Price list |
| 19 | Domain search bar |
| 20 | Expiry warning (30/60/90 hari) |

#### Could Have (P2)

| # | Fitur |
|---|-------|
| 21 | Suspend/unsuspend domain |
| 22 | Theft protection |
| 23 | Domain forwarding |
| 24 | Email forwarding |
| 25 | Hapus domain |
| 26 | Notifikasi email expiry |
| 27 | Edit kontak customer |
| 28 | Hapus kontak customer |
| 29 | Profil pengguna |

#### Won't Have (Out of Scope — MVP)

| # | Fitur |
|---|-------|
| 1 | Reseller management (CRUD sub-reseller) |
| 2 | Multi-tenant reseller admin panel |
| 3 | Payment gateway integration (top-up via bank/VA/QRIS) |
| 4 | Invoice generation PDF |
| 5 | Two-factor authentication (2FA) |
| 6 | Domain backorder |
| 7 | Marketplace / aftermarket domain |
| 8 | SSL certificate management |
| 9 | Hosting management |
| 10 | Email hosting management |
| 11 | Multi-language (i18n) |
| 12 | White-label custom domain untuk dashboard |

---

## 5. Non-Functional Requirements

| # | Requirement | Target |
|---|-------------|--------|
| NFR-01 | **Performance** — page load pertama (dashboard) | < 2 detik |
| NFR-02 | **Performance** — API response time (p95) | < 500ms untuk operasi baca, < 2s untuk operasi tulis via LIQUID |
| NFR-03 | **Availability** — uptime dashboard | 99.5% (gak perlu 99.9%, ini internal tool) |
| NFR-04 | **Security** — autentikasi | JWT dengan expiry 24 jam |
| NFR-05 | **Security** — penyimpanan API Key LIQUID | Encrypted at rest (AES-256) |
| NFR-06 | **Security** — komunikasi ke LIQUID API | HTTPS only |
| NFR-07 | **Security** — password hashing | Bun.password (bcrypt) |
| NFR-08 | **Reliability** — kegagalan LIQUID API | Error handling + retry dengan exponential backoff |
| NFR-09 | **Usability** — mobile responsive | Semua halaman harus usable di layar 375px |
| NFR-10 | **Usability** — loading states | Setiap async action harus ada loading indicator |
| NFR-11 | **Usability** — error states | Setiap error harus ada pesan yang jelas, bukan crash |
| NFR-12 | **Usability** — empty states | Setiap daftar kosong harus ada empty state dengan CTA |
| NFR-13 | **Maintainability** — modular code | Backend: 4 file per modul (schema, service, handler, route), Frontend: UI/Layout/Domain separation |
| NFR-14 | **Observability** — logging | Semua error + LIQUID API call di-log ke console/file |

---

## 6. User Flows

### 6.1. Flow Utama — Registrasi Domain Baru

```
┌──────────┐    ┌──────────────┐    ┌───────────────┐    ┌────────────┐
│ Search   │───▶│ Availability │───▶│ Register Form │───▶│ Confirmed  │
│ Domain   │    │ Result       │    │ (Pilih TLD,   │    │ Success +  │
│ Name     │    │ (✔ / ✘)     │    │  tahun,       │    │ redirect   │
│          │    │              │    │  customer)    │    │ to detail  │
└──────────┘    └──────────────┘    └───────────────┘    └────────────┘
```

### 6.2. Flow — Perpanjang Domain

```
┌──────────┐    ┌──────────────┐    ┌───────────────┐    ┌────────────┐
│ Domain   │───▶│ Klik Renew   │───▶│ Konfirmasi    │───▶│ Renewed    │
│ Detail   │    │ (tampil      │    │ (tahun,       │    │ Success    │
│ Page     │    │  biaya)      │    │  total biaya) │    │            │
└──────────┘    └──────────────┘    └───────────────┘    └────────────┘
```

### 6.3. Flow — Tambah DNS Record

```
┌──────────┐    ┌──────────────┐    ┌───────────────┐    ┌────────────┐
│ DNS      │───▶│ Klik "Add    │───▶│ Isi Form:     │───▶│ Record     │
│ Manage   │    │ Record"      │    │ type, host,   │    │ Added to   │
│ Page     │    │              │    │ value, TTL    │    │ List       │
└──────────┘    └──────────────┘    └───────────────┘    └────────────┘
```

---

## 7. Halaman / Screen List

| # | Halaman | Komponen Utama |
|---|---------|----------------|
| 1 | **Login** | Form email + password, link ke register |
| 2 | **Register** | Form email, password, nama, reseller ID, API key |
| 3 | **Dashboard** | Stat cards (total domain, active, expired, saldo), domain expiring soon |
| 4 | **Domain List** | Search bar, table domain (nama, TLD, expiry, status), pagination |
| 5 | **Domain Register** | Search input, availability result, suggestion list, register form (TLD, tahun, customer) |
| 6 | **Domain Detail** | Info domain (nama, status, expiry, registrar), action buttons (renew, manage DNS, lock, etc.) |
| 7 | **DNS Management** | Tabel DNS record per type (A, AAAA, CNAME, MX, TXT, NS, SRV), add/edit/delete record |
| 8 | **Customer List** | Daftar kontak customer, nama, email, company |
| 9 | **Customer Create** | Form registrant (nama, email, alamat, negara, telp, company) |
| 10 | **Billing** | Saldo, tabel transaksi (tanggal, tipe, jumlah, status), detail transaksi |

---

## 8. Data & Integrasi

### 8.1. Database (MariaDB)

4 tabel utama: `users`, `customers`, `domains`, `transactions`  
→ Detail schema: lihat `dashboard-plan.md` Section 7.

### 8.2. Integrasi Eksternal

| Service | Purpose | Protocol |
|---------|---------|----------|
| **LIQUID API** (`api.domainsas.com/v1`) | Semua operasi domain, DNS, customer, billing | HTTPS + Basic Auth |
| *(Future)* Email SMTP | Kirim notifikasi expiry, reset password | SMTP |
| *(Future)* Payment Gateway | Top-up saldo | REST API |

### 8.3. LIQUID API Endpoints Used

Seluruh endpoint yang terdokumentasi di `luquid.md` digunakan. Rincian lengkap: `dashboard-plan.md` Section 9.

---

## 9. Success Metrics / KPI

| Metric | Target (3 bulan) |
|--------|------------------|
| Jumlah pengguna terdaftar | 50+ aktif |
| Domain diregister via dashboard | ≥ 80% dari total order reseller |
| Renew rate | ≥ 70% domain diperpanjang via dashboard |
| Time-to-register domain | < 3 menit (dari search sampai confirmed) |
| Support ticket terkait domain | Turun 50% dari sebelum dashboard ada |
| Dashboard uptime | 99.5% |
| Customer satisfaction (NPS) | ≥ 40 |

---

## 10. Risiko & Asumsi

### Risiko

| Risiko | Dampak | Mitigasi |
|--------|--------|----------|
| LIQUID API down / rate limit | User tidak bisa order/kelola domain | Queue system + retry, tampilkan status "LIQUID sedang sibuk" |
| API Key LIQUID bocor | Penyalahgunaan akun reseller | Encrypt at rest, environment variable, rotate key berkala |
| Reseller ID / API Key invalid | User tidak bisa pakai dashboard | Validasi koneksi saat register, error handling jelas |
| Breaking change di LIQUID API | Fitur broken | Version pin di base URL (`/v1`), monitoring log error |
| Server VPS overload | Dashboard lambat/down | Rate limiting, bun performa tinggi, scaling horizontal mudah (JWT stateless) |
| User bingung istilah teknis (DNS, NS, A record) | Abandonment | UX writing friendly, tooltip bantuan, persona 1 friendly |

### Asumsi

- Setiap pengguna sudah punya LIQUID Reseller ID dan API Key yang valid
- LIQUID API stabil dan selalu tersedia (SLA dari LIQUID)
- Target pengguna paham dasar-dasar domain (apa itu domain, TLD)
- VPS dengan CloudPanel sudah tersedia dan terkoneksi internet stabil
- MariaDB sudah terinstall di VPS yang sama

---

## 11. Milestone & Timeline

| Fase | Deliverable | Estimasi | Tanggal Target |
|------|-------------|----------|----------------|
| **Phase 1 — Backend Core** | Auth, Domain CRUD, LIQUID client, DB migration | 1.5 minggu | - |
| **Phase 2 — Backend Extended** | DNS, Customer, Billing, Forwarding, Privacy | 1.5 minggu | - |
| **Phase 3 — Frontend Foundation** | Scaffold, auth pages, dashboard layout, UI components | 1.5 minggu | - |
| **Phase 4 — Frontend Features** | Domain pages, DNS page, customer pages, billing page | 2 minggu | - |
| **Phase 5 — Integration & Polish** | Frontend-backend integration, error handling, loading states, empty states | 1 minggu | - |
| **Phase 6 — Deploy & UAT** | Deploy CloudPanel, testing, bug fixing | 0.5 minggu | - |
| **TOTAL** | | **~8 minggu** | |

---

## 12. Referensi Dokumen

| Dokumen | Isi |
|---------|-----|
| `luquid.md` | Dokumentasi API LIQUID (`api.domainsas.com`): base URL, auth, semua endpoint & HTTP method |
| `design.md` | Design system lengkap: warna, typography, spacing, radius, komponen UI copy-pasteable, layout, ikon, responsive |
| `dashboard-plan.md` | Rencana teknis: struktur proyek, tech stack, arsitektur modular, schema DB, kode contoh, deploy guide |

---

## 13. Glossary

| Istilah | Arti |
|---------|------|
| **LIQUID** | Platform reseller domain — `api.domainsas.com` |
| **Reseller** | Pihak yang menjual kembali layanan domain LIQUID ke end-customer |
| **End-Customer** | Pembeli akhir domain, pengguna dashboard ini |
| **TLD** | Top-Level Domain (.com, .net, .id, .org, dll) |
| **Auth/EPP Code** | Kode otorisasi untuk transfer domain keluar dari registrar |
| **Nameserver (NS)** | Server yang menerjemahkan domain ke IP address |
| **DNS Record** | Konfigurasi yang mengarahkan domain (A, CNAME, MX, TXT, dll) |
| **Privacy Protection** | Layanan menyembunyikan data pemilik domain dari WHOIS publik (WHOIS guard) |
| **Theft Protection** | Pengamanan ekstra — domain tidak bisa ditransfer tanpa unlock |
| **IRTP** | Inter-Registrar Transfer Policy — proses transfer domain antar registrar |
| **RAA** | Registrar Accreditation Agreement — verifikasi data kontak domain |

---

## 14. Appendix — Screen Mockup Notes

> Mockup detail mengacu ke design system (`design.md`). Notes singkat untuk developer:

1. **Dashboard**: grid 4 kolom stat cards di atas (`grid-cols-1 sm:2 lg:4`), tabel "Expiring Soon" di bawah
2. **Domain List**: search bar sticky di atas, tabel responsive (desktop table, mobile card list), pagination di footer
3. **Domain Register**: layout 2-tahap (search dulu, baru register form). Availability pakai badge hijau/merah
4. **DNS Manage**: tabs per record type (atau vertical list), tabel per type dengan kolom hostname | value | TTL | actions
5. **Login/Register**: layout centered card (`max-w-md mx-auto`), background `bg-[#f0f2f5]`

Semua mengikuti `design.md` komponen: Card, Button, Input, Badge, Modal, Table, EmptyState, Loading, InfoBanner.
