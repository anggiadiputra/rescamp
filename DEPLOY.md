# 🚀 Panduan Resmi Deployment Rescamp (Backend Bun API & Frontend React)

Dokumentasi resmi alur deployment, update cepat 1-command, dan konfigurasi server VPS (CloudPanel, PM2, Nginx, MySQL, Liquid API & Payment Gateway).

---

## 🗂️ 1. Arsitektur Domain & VPS

| Komponen | Domain | User VPS | Path Git Clone Repo | Path Production Runtime / Document Root |
|---|---|---|---|---|
| **Backend API** | `https://api.ekstensi.id` | `ekstensi-api` | `/home/ekstensi-api/htdocs/rescamp/backend` | `/home/ekstensi-api/htdocs/api.ekstensi.id` |
| **Frontend Dashboard** | `https://dash.ekstensi.id` | `ekstensi-dash` | `/home/ekstensi-dash/htdocs/rescamp/frontend` | `/home/ekstensi-dash/htdocs/dash.ekstensi.id` |

---

## ⚡ 2. Perintah Update Cepat 1-Command (Quick Update)

### 🟢 A. Update & Deploy Backend API (`api.ekstensi.id`)

Jalankan perintah ini di terminal VPS sebagai `root`:

```bash
cd /home/ekstensi-api/htdocs/rescamp/backend && git pull origin main && cp /home/ekstensi-api/htdocs/api.ekstensi.id/.env ./ 2>/dev/null || true && rsync -av --delete --exclude='.env' --exclude='node_modules' ./ /home/ekstensi-api/htdocs/api.ekstensi.id/ && cd /home/ekstensi-api/htdocs/api.ekstensi.id && bun install && chown -R ekstensi-api:ekstensi-api /home/ekstensi-api/htdocs/api.ekstensi.id/ && su - ekstensi-api -c "pm2 restart rescamp-api"
```

---

### 🔵 B. Update & Deploy Frontend Dashboard (`dash.ekstensi.id`)

Jalankan perintah ini di terminal VPS sebagai `root`:

```bash
cd /home/ekstensi-dash/htdocs/rescamp/frontend && git pull origin main && npm run build && rsync -av --delete dist/ /home/ekstensi-dash/htdocs/dash.ekstensi.id/ && chown -R ekstensi-dash:ekstensi-dash /home/ekstensi-dash/htdocs/dash.ekstensi.id/
```

---

## 🛠️ 3. Panduan Langkah demi Langkah (Step-by-Step Deployment)

### 3.1 Setup Backend API (`api.ekstensi.id`)

1. **Struktur Folder Repository & Production**:
   ```bash
   cd /home/ekstensi-api/htdocs
   git clone https://github.com/anggiadiputra/rescamp.git rescamp
   ```

2. **Setup File `.env` Backend**:
   Buat file `.env` di `/home/ekstensi-api/htdocs/api.ekstensi.id/.env`:
   ```env
   PORT=3001
   APP_URL=https://api.ekstensi.id
   CORS_ORIGIN=https://dash.ekstensi.id
   
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=CrmDomainsx
   DB_PASSWORD=a0Y5h6Aaj6cPaOVaPBxX
   DB_NAME=CrmDomainsx
   
   JWT_SECRET=ganti-dengan-string-secret-acak-minimal-32-karakter
   DEFAULT_RESELLER_ID=17058
   
   SUMOPOD_API_KEY=your_sumopod_api_key
   SUMOPOD_PAYMENT_URL=https://api-pay.sumopod.com/api/v1
   ```

3. **Migrasi Database**:
   ```bash
   cd /home/ekstensi-api/htdocs/api.ekstensi.id
   bun run db:push
   ```

4. **Menjalankan PM2 sebagai User `ekstensi-api`**:
   ```bash
   su - ekstensi-api
   cd /home/ekstensi-api/htdocs/api.ekstensi.id
   pm2 start ecosystem.config.cjs
   pm2 save
   ```

---

### 3.2 Setup Frontend Dashboard (`dash.ekstensi.id`)

1. **Struktur Folder Repository**:
   ```bash
   cd /home/ekstensi-dash/htdocs
   git clone https://github.com/anggiadiputra/rescamp.git rescamp
   ```

2. **Build Asset**:
   ```bash
   cd /home/ekstensi-dash/htdocs/rescamp/frontend
   npm install
   npm run build
   ```

3. **Deploy ke Document Root Nginx**:
   ```bash
   rsync -av --delete dist/ /home/ekstensi-dash/htdocs/dash.ekstensi.id/
   chown -R ekstensi-dash:ekstensi-dash /home/ekstensi-dash/htdocs/dash.ekstensi.id/
   ```

---

## 🌐 4. Konfigurasi Nginx Vhost (CloudPanel)

### 4.1 Nginx Vhost Backend (`api.ekstensi.id`)
```nginx
server {
  listen 80;
  listen [::]:80;
  listen 443 ssl http2;
  listen [::]:443 ssl http2;
  server_name api.ekstensi.id;

  location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;

    # Prevents Nginx 502 Bad Gateway during long external API operations (Domain registration/Sumopod)
    proxy_connect_timeout 120s;
    proxy_send_timeout 120s;
    proxy_read_timeout 120s;
  }
}
```

### 4.2 Nginx Vhost Frontend (`dash.ekstensi.id`)
```nginx
server {
  listen 80;
  listen [::]:80;
  listen 443 ssl http2;
  listen [::]:443 ssl http2;
  server_name dash.ekstensi.id;

  root /home/ekstensi-dash/htdocs/dash.ekstensi.id;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }

  location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
    expires 30d;
    add_header Cache-Control "public, no-transform";
  }
}
```

---

## 🔒 5. Checklist Wajib Sebelum Go-Live Production

1. **Whitelist IP VPS di Panel Resellercamp**:
   - Buka **[Resellercamp.com](https://resellercamp.com)** ➔ **Settings ➔ API Authorizations**.
   - Tambahkan **IP Public Server VPS Anda** ke daftar *Authorized IP Addresses*.
2. **Top-Up Saldo Deposit Resellercamp**:
   - Pastikan akun Reseller Anda di Resellercamp memiliki saldo deposit aktif untuk eksekusi otomatis pembelian/renew domain.
3. **Cek Koneksi API via Endpoint Diagnostik**:
   - Panggil `GET https://api.ekstensi.id/api/settings/test-liquid` dengan Token Admin untuk memastikan koneksi ke Resellercamp Liquid API 100% Berhasil & Aktif.

---

## ❓ 6. TroubleShooting Ringkas

- **Error `405 Method Not Allowed` saat Login/Send OTP**:
  - Request terkirim ke frontend `dash.ekstensi.id` alih-alih `api.ekstensi.id`.
  - Solusi: Pastikan `api.ts` frontend menggunakan domain backend `https://api.ekstensi.id/api` dan lakukan `npm run build` ulang.
- **Error `403 Invalid user role` / `Reseller access required`**:
  - Role user belum memiliki kredensial reseller induk.
  - Solusi: Pastikan update commit terbaru sudah di-pull di VPS.
- **Error `404 Not Found` setelah Pembayaran Sumopod**:
  - Return URL dialihkan ke backend alih-alih ke frontend.
  - Solusi: Pastikan `CORS_ORIGIN=https://dash.ekstensi.id` di `.env` backend dan restart PM2.
