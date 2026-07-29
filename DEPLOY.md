# 🚀 Panduan Deploy di CloudPanel VPS

Panduan lengkap untuk mendeploy project **Rescamp** (backend Bun/Elysia + frontend React/Vite) di VPS menggunakan **CloudPanel**.

---

## 📋 Persyaratan Sistem

| Komponen | Versi Minimum |
|---|---|
| OS | Ubuntu 22.04 / Debian 12 |
| CloudPanel | v2.x |
| Bun | v1.1+ |
| Node.js | v20+ (untuk build frontend) |
| MySQL | v8.0+ (tersedia di CloudPanel) |
| RAM | 1 GB (rekomendasi 2 GB+) |

---

## 🗂️ Arsitektur Deploy

```
Internet
   │
   ▼
CloudPanel Nginx (Reverse Proxy)
   ├── app.domain.com       → /htdocs/app.domain.com (static files Vite)
   └── app.domain.com/api/  → localhost:3000 (Bun/Elysia backend)
```

---

## 📦 Bagian 1 — Persiapan VPS

### 1.1 Install Bun

```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
bun --version
```

### 1.2 Install Node.js (untuk build frontend)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version
npm --version
```

### 1.3 Install PM2 (process manager untuk backend)

```bash
sudo npm install -g pm2
pm2 --version
```

---

## 🗄️ Bagian 2 — Setup Database MySQL di CloudPanel

### 2.1 Buat Database

1. Login ke **CloudPanel** → **Databases** → **Add Database**
2. Isi:
   - **Database Name**: `domain_dashboard`
   - **Username**: `rescamp_user`
   - **Password**: *(generate password kuat)*
3. Klik **Add Database**

### 2.2 Catat Kredensial Database

```
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=domain_dashboard
DB_USER=rescamp_user
DB_PASSWORD=<password-yang-dibuat>
```

---

## 🌐 Bagian 3 — Setup Domain di CloudPanel

### 3.1 Buat Site

1. CloudPanel → **Sites** → **Add Site**
2. Isi:
   - **Domain**: `app.domain.com`
   - **Site User**: *(buat user baru atau pilih existing)*
   - **Document Root**: `/home/<user>/htdocs/app.domain.com`
3. Aktifkan **SSL** → Let's Encrypt

---

## 📁 Bagian 4 — Clone Repository & Setup Project

### 4.1 SSH ke VPS

```bash
ssh root@<ip-vps>
su - <username-cloudpanel>
```

### 4.2 Clone Repository

```bash
cd /home/<user>/htdocs/
git clone https://github.com/anggiadiputra/rescamp.git rescamp
cd rescamp
```

---

## ⚙️ Bagian 5 — Konfigurasi Backend

### 5.1 Buat File `.env` Backend

```bash
cd /home/<user>/htdocs/rescamp/backend
nano .env
```

Isi lengkap `.env` backend:

```env
# ── Server ─────────────────────────────────────
PORT=3000
APP_URL=https://app.domain.com

# CORS — harus sama persis dengan URL frontend
CORS_ORIGIN=https://app.domain.com

# ── Database ────────────────────────────────────
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=rescamp_user
DB_PASSWORD=<password-database>
DB_NAME=domain_dashboard

# ── JWT ─────────────────────────────────────────
# WAJIB diganti! Generate dengan: openssl rand -hex 32
JWT_SECRET=ganti-ini-dengan-string-acak-minimal-32-karakter
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

### 5.2 Install Dependensi Backend

```bash
cd /home/<user>/htdocs/rescamp/backend
bun install
```

### 5.3 Jalankan Migrasi Database

```bash
bun run db:push
```

---

## 🏗️ Bagian 6 — Build & Deploy Frontend

### 6.1 Install Dependensi & Build

```bash
cd /home/<user>/htdocs/rescamp/frontend
npm install
npm run build
```

Output: folder `dist/` berisi file statis siap deploy.

### 6.2 Copy Build ke Document Root

```bash
rsync -av --delete dist/ /home/<user>/htdocs/app.domain.com/
```

---

## 🔁 Bagian 7 — Setup PM2 untuk Backend

### 7.1 Buat File Konfigurasi PM2

```bash
cd /home/<user>/htdocs/rescamp/backend
nano ecosystem.config.cjs
```

```javascript
module.exports = {
  apps: [
    {
      name: "rescamp-api",
      script: "bun",
      args: "run src/index.ts",
      cwd: "/home/<user>/htdocs/rescamp/backend",
      interpreter: "none",
      env: {
        NODE_ENV: "production",
      },
      watch: false,
      max_memory_restart: "512M",
      restart_delay: 3000,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};
```

### 7.2 Jalankan Backend

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup   # ikuti instruksi yang muncul
```

### 7.3 Verifikasi

```bash
pm2 status
curl http://localhost:3000/api/settings
```

---

## 🌍 Bagian 8 — Konfigurasi Nginx di CloudPanel

### 8.1 Edit Vhost

CloudPanel → **Sites** → pilih `app.domain.com` → **Vhost** → Edit dan ganti seluruh isi dengan:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name app.domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name app.domain.com;

    ssl_certificate /etc/letsencrypt/live/app.domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    root /home/<user>/htdocs/app.domain.com;
    index index.html;

    # ── Proxy /api ke Bun backend ─────────────────
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 120s;
        proxy_connect_timeout 10s;
    }

    # ── SPA React — semua route → index.html ──────
    location / {
        try_files $uri $uri/ /index.html;
    }

    # ── Cache asset statis ─────────────────────────
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2|woff|ttf|map)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # ── Security Headers ───────────────────────────
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

### 8.2 Reload Nginx

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 🔄 Bagian 9 — Script Deploy Otomatis

Buat file `deploy.sh` di root project:

```bash
nano /home/<user>/htdocs/rescamp/deploy.sh
```

```bash
#!/bin/bash
set -e

SITE_USER="<user>"
FRONTEND_ROOT="/home/$SITE_USER/htdocs/app.domain.com"
PROJECT_ROOT="/home/$SITE_USER/htdocs/rescamp"

echo "🔄 [1/5] Pulling latest changes from GitHub..."
cd $PROJECT_ROOT
git pull origin main

echo "📦 [2/5] Installing backend dependencies..."
cd $PROJECT_ROOT/backend
bun install

echo "🗄️  [3/5] Running database migrations..."
bun run db:push

echo "♻️  [4/5] Restarting backend..."
pm2 restart rescamp-api

echo "🏗️  [5/5] Building & deploying frontend..."
cd $PROJECT_ROOT/frontend
npm run build
rsync -av --delete dist/ $FRONTEND_ROOT/

echo ""
echo "✅ Deploy berhasil! App tersedia di https://app.domain.com"
```

```bash
chmod +x /home/<user>/htdocs/rescamp/deploy.sh
```

Jalankan update dengan satu perintah:
```bash
/home/<user>/htdocs/rescamp/deploy.sh
```

---

## 🔒 Bagian 10 — Keamanan

### 10.1 Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
# Jangan buka port 3000 ke publik!
sudo ufw enable
sudo ufw status
```

### 10.2 Konfigurasi Webhook Sumopod

Di dashboard Sumopod, set URL webhook ke:
```
https://app.domain.com/api/payments/webhook
```

---

## 🩺 Bagian 11 — Troubleshooting

### Backend tidak berjalan

```bash
pm2 logs rescamp-api --lines 100
pm2 restart rescamp-api
```

### Cek koneksi database

```bash
mysql -u rescamp_user -p domain_dashboard -e "SHOW TABLES;"
```

### Frontend 404 saat refresh

Pastikan Nginx punya:
```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

### CORS error di browser

Pastikan `CORS_ORIGIN` di `.env` backend tepat sama dengan URL frontend (termasuk `https://`):
```env
CORS_ORIGIN=https://app.domain.com
```

### Monitoring real-time

```bash
pm2 logs rescamp-api          # log backend
pm2 monit                     # resource monitor
sudo tail -f /var/log/nginx/error.log  # error nginx
```

---

## ✅ Checklist Deploy

- [ ] Bun & Node.js terinstall di VPS
- [ ] PM2 terinstall global (`npm install -g pm2`)
- [ ] Database MySQL dibuat di CloudPanel
- [ ] Repository di-clone: `git clone https://github.com/anggiadiputra/rescamp.git`
- [ ] File `backend/.env` dikonfigurasi lengkap
- [ ] `JWT_SECRET` diganti dengan string acak kuat (`openssl rand -hex 32`)
- [ ] `bun install` berhasil di folder `backend/`
- [ ] `bun run db:push` berhasil (tabel terbuat di MySQL)
- [ ] Backend berjalan via PM2 (`pm2 status`)
- [ ] Frontend di-build (`npm run build`) & di-copy ke document root
- [ ] Nginx vhost dikonfigurasi dengan proxy `/api/` dan `try_files`
- [ ] SSL Let's Encrypt aktif
- [ ] Firewall hanya membuka port 22, 80, 443
- [ ] Webhook Sumopod mengarah ke URL produksi
- [ ] Test login dari browser berhasil
- [ ] Test buat transaksi/invoice berhasil
