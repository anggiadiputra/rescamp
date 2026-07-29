# 🚀 Panduan Deploy di CloudPanel VPS (Bun Backend)

Panduan resmi mendeploy project **Rescamp** dengan backend murni berbasis **Bun / ElysiaJS** dan frontend **React / Vite** di VPS menggunakan **CloudPanel**.

---

## 📋 Persyaratan Sistem

| Komponen | Versi Minimum | Keterangan |
|---|---|---|
| **OS** | Ubuntu 22.04 / Debian 12 | Sistem operasi VPS |
| **CloudPanel** | v2.x | Panel Manajemen Server |
| **Bun** | v1.1+ | **Runtime utama backend** |
| **Node.js** | v20+ | Hanya untuk build asset frontend (`npm run build`) |
| **MySQL** | v8.0+ | Database (tersedia di CloudPanel) |
| **RAM** | 1 GB | Rekomendasi 2 GB+ |

---

## 🗂️ Arsitektur Deploy

```
Internet
   │
   ├── api.domain.com  ──(Nginx Proxy)──> http://127.0.0.1:3000 (Bun/Elysia Backend)
   └── app.domain.com  ──(Nginx Static)─> /htdocs/app.domain.com (Vite/React Static Files)
```

---

## 📦 Bagian 1 — Persiapan VPS

### 1.1 Install Bun Runtime (Wajib)

```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
bun --version
```

### 1.2 Install Node.js (untuk Build Frontend)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version
npm --version
```

---

## 🗄️ Bagian 2 — Setup Database MySQL di CloudPanel

### 2.1 Buat Database Baru

1. Login ke **CloudPanel** → **Databases** → **Add Database**
2. Isi data berikut:
   - **Database Name**: `domain_dashboard`
   - **Username**: `rescamp_user`
   - **Password**: *(gunakan password kuat)*
3. Klik **Add Database**

### 2.2 Kredensial Database

```
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=domain_dashboard
DB_USER=rescamp_user
DB_PASSWORD=<password-database>
```

---

## 🌐 Bagian 3 — Setup Domain di CloudPanel

### 3.1 Domain Backend API (`api.domain.com`)

1. CloudPanel → **Sites** → **Add Site**
2. Pilih type: **Node.js** (atau Python/Generic)
3. Domain Name: `api.domain.com`
4. Aktifkan **SSL** → Let's Encrypt

### 3.2 Domain Frontend App (`app.domain.com`)

1. CloudPanel → **Sites** → **Add Site**
2. Domain Name: `app.domain.com`
3. Aktifkan **SSL** → Let's Encrypt

---

## 📁 Bagian 4 — Clone Repository & Setup Project

### 4.1 SSH ke VPS (sebagai root)

```bash
ssh root@<ip-vps>
```

### 4.2 Clone Repository ke Folder Site

```bash
cd /home/<user>/htdocs/api.domain.com/
git clone https://github.com/anggiadiputra/rescamp.git .
```

---

## ⚙️ Bagian 5 — Konfigurasi & Migrasi Backend Bun

### 5.1 Buat File `.env` Backend

```bash
cd /home/<user>/htdocs/api.domain.com/backend
nano .env
```

Isi konfigurasi `.env`:

```env
# ── Server ─────────────────────────────────────
PORT=3000
APP_URL=https://app.domain.com

# CORS — URL frontend React
CORS_ORIGIN=https://app.domain.com

# ── Database ────────────────────────────────────
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=rescamp_user
DB_PASSWORD=<password-database>
DB_NAME=domain_dashboard

# ── JWT ─────────────────────────────────────────
# Generate dengan: openssl rand -hex 32
JWT_SECRET=ganti-dengan-string-acak-minimal-32-karakter
JWT_EXPIRY=24h

# ── Resellercamp (Liquid API) ───────────────────
DEFAULT_RESELLER_ID=<reseller-id-anda>

# ── Sumopod Payment Gateway ─────────────────────
SUMOPOD_API_KEY=<api-key-sumopod-produksi>
SUMOPOD_PAYMENT_URL=https://api-pay.sumopod.com/api/v1
SUMOPOD_WEBHOOK_TOKEN=<webhook-token>
SUMOPOD_WEBHOOK_SECRET=<webhook-secret>
```

> **Generate JWT_SECRET:**
> ```bash
> openssl rand -hex 32
> ```

### 5.2 Install Dependensi Backend dengan Bun

```bash
cd /home/<user>/htdocs/api.domain.com/backend
bun install
```

### 5.3 Jalankan Migrasi Database

```bash
export $(grep -v '^#' .env | xargs) && bun run db:push
```

---

## 🔁 Bagian 6 — Pengelolaan Service Backend (Bun)

### Cara 1: Menggunakan Systemd Service (Sangat Direkomendasikan 🌟)

Systemd adalah pengelola service bawaan Linux. **Paling efisien, 0 MB overhead RAM tambahan**, dan tidak memerlukan instalasi PM2/Node.js di backend.

#### 1. Buat file service systemd:
```bash
nano /etc/systemd/system/rescamp-api.service
```

#### 2. Tempelkan isi berikut:
```ini
[Unit]
Description=Rescamp Backend API (Bun Runtime)
After=network.target mysql.service

[Service]
Type=simple
User=root
WorkingDirectory=/home/<user>/htdocs/api.domain.com/backend
ExecStart=/root/.bun/bin/bun run src/index.ts
Restart=always
RestartSec=3
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```
*(Catatan: Cek lokasi binary Bun dengan `which bun`. Jika outputnya `/usr/local/bin/bun`, gantilah `ExecStart` di atas).*

#### 3. Aktifkan & Jalankan Service:
```bash
systemctl daemon-reload
systemctl enable rescamp-api
systemctl start rescamp-api
```

#### 4. Cek Status Service:
```bash
systemctl status rescamp-api
```

Output sukses:
```
● rescamp-api.service - Rescamp Backend API (Bun Runtime)
     Active: active (running)
     Main PID: 182722 (bun)
     Memory: 46.4M
     bun[182722]: 🚀 Server running on http://localhost:3000
```

---

### Cara 2: Menggunakan PM2 (Opsional)

Jika Anda lebih memilih PM2 untuk manajemen proses:

```bash
# Install PM2 via Bun
bun install -g pm2

# Jalankan backend Bun
cd /home/<user>/htdocs/api.domain.com/backend
pm2 start "bun run src/index.ts" --name rescamp-api
pm2 save
pm2 startup
```

---

## 🏗️ Bagian 7 — Build & Deploy Frontend React

### 7.1 Build Asset Frontend

```bash
cd /home/<user>/htdocs/api.domain.com/frontend
npm install
npm run build
```

### 7.2 Copy Build ke Document Root Frontend Site

```bash
rsync -av --delete dist/ /home/<user>/htdocs/app.domain.com/
```

---

## 🌍 Bagian 8 — Konfigurasi Nginx di CloudPanel

### 8.1 Nginx Vhost untuk Domain API (`api.domain.com`)

CloudPanel → **Sites** → pilih `api.domain.com` → **Vhost** → Edit dan ganti dengan:

```nginx
server {
  listen 80;
  listen [::]:80;
  listen 443 quic;
  listen 443 ssl;
  listen [::]:443 quic;
  listen [::]:443 ssl;
  http2 on;
  http3 off;
  {{ssl_certificate_key}}
  {{ssl_certificate}}
  server_name api.domain.com;
  {{root}}

  {{nginx_access_log}}
  {{nginx_error_log}}

  if ($scheme != "https") {
    rewrite ^ https://$host$request_uri permanent;
  }

  location ~ /.well-known {
    auth_basic off;
    allow all;
  }

  {{settings}}

  include /etc/nginx/global_settings;

  # PROXY SEMUA REQUEST KE BACKEND BUN (PORT 3000)
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Server $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Host $host;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
    proxy_pass_request_headers on;
    proxy_read_timeout 900;
  }
}
```

> **Catatan Penting:** Penggunaan `proxy_pass http://127.0.0.1:3000;` pada `location /` di atas mencegah terjadinya error **403 Forbidden** saat mengakses domain backend di browser.

---

### 8.2 Nginx Vhost untuk Domain Frontend (`app.domain.com`)

CloudPanel → **Sites** → pilih `app.domain.com` → **Vhost** → Edit:

```nginx
server {
  listen 80;
  listen [::]:80;
  listen 443 ssl http2;
  server_name app.domain.com;

  {{ssl_certificate_key}}
  {{ssl_certificate}}

  root /home/<user>/htdocs/app.domain.com;
  index index.html;

  # SPA Routing React
  location / {
    try_files $uri $uri/ /index.html;
  }

  location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2|woff|ttf)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }
}
```

---

## 🔄 Bagian 9 — Script Deploy Otomatis (`deploy.sh`)

Buat file `deploy.sh` di folder backend untuk mempermudah update di masa depan:

```bash
nano /home/<user>/htdocs/api.domain.com/deploy.sh
```

```bash
#!/bin/bash
set -e

PROJECT_ROOT="/home/<user>/htdocs/api.domain.com"
FRONTEND_ROOT="/home/<user>/htdocs/app.domain.com"

echo "🔄 [1/5] Pulling latest code..."
cd $PROJECT_ROOT
git pull origin main

echo "📦 [2/5] Installing backend dependencies with Bun..."
cd $PROJECT_ROOT/backend
bun install

echo "🗄️  [3/5] Running database migrations..."
export $(grep -v '^#' .env | xargs) && bun run db:push

echo "♻️  [4/5] Restarting Bun backend service..."
systemctl restart rescamp-api

echo "🏗️  [5/5] Building & deploying frontend..."
cd $PROJECT_ROOT/frontend
npm run build
rsync -av --delete dist/ $FRONTEND_ROOT/

echo "✅ Deploy selesai! Backend & Frontend up-to-date."
```

```bash
chmod +x /home/<user>/htdocs/api.domain.com/deploy.sh
```

---

## 🩺 Bagian 10 — Troubleshooting Umum

### 1. Error `403 Forbidden` di Domain API
- **Sebab:** Vhost Nginx menggunakan `try_files $uri $uri/ /index.html;` padahal folder domain API tidak memiliki file `index.html`.
- **Solusi:** Ganti `location /` di Vhost CloudPanel domain API menjadi:
  `proxy_pass http://127.0.0.1:3000;`

### 2. Error `Access denied for user 'root'@'localhost'` saat `db:push`
- **Sebab:** `drizzle-kit` CLI tidak otomatis membaca file `.env`.
- **Solusi:** Jalankan dengan meng-export variabel `.env` secara eksplisit:
  `export $(grep -v '^#' .env | xargs) && bun run db:push`

### 3. Cek Log Backend Bun (Systemd)
```bash
journalctl -u rescamp-api -f --lines 50
```

---

## ✅ Checklist Akhir Deploy

- [ ] Bun runtime terinstall (`bun --version`)
- [ ] Database MySQL terbuat di CloudPanel
- [ ] File `backend/.env` dikonfigurasi lengkap
- [ ] `bun run db:push` sukses membuat tabel
- [ ] Service Systemd `rescamp-api` aktif (`active (running)`)
- [ ] Vhost `api.domain.com` proxy ke `http://127.0.0.1:3000` pada `location /`
- [ ] SSL Let's Encrypt aktif di CloudPanel
- [ ] `curl https://api.domain.com/` mengembalikan respon JSON `{"message":"Domain Dashboard API"}`
