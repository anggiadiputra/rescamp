# API Contract — Customer Domain Dashboard

> **Base URL:** `http://localhost:3000/api` (dev) / `https://<domain>/api` (prod)  
> **Format:** JSON (`Content-Type: application/json`)  
> **Auth:** Bearer JWT token di header `Authorization: Bearer <token>`  
> **Dokumen terkait:** `prd.md`, `dashboard-plan.md`, `luquid.md`

---

## 1. Konvensi

| Aturan | Detail |
|--------|--------|
| **Success response** | `{ data: T }` — data selalu dibungkus dalam key `data` |
| **List response** | `{ data: T[], meta: { total: number, page: number, perPage: number } }` |
| **Error response** | `{ error: string, statusCode: number }` |
| **Validation error** | `{ error: string, details: { field: string, message: string }[] }` |
| **Date format** | `YYYY-MM-DD` (string) |
| **Null vs undefined** | Kolom opsional pakai `null`, bukan dihilangkan |
| **Naming** | camelCase untuk JSON keys |

---

## 2. Auth

### `POST /api/auth/register`

Registrasi pengguna baru.

```
Body:
{
  "email": "user@example.com",
  "password": "rahasia123",
  "name": "John Doe",
  "reseller_id": "RES-12345",
  "api_key": "sk_live_xxxxxxxxxxxx"
}
```

```
201 Created
{
  "data": {
    "user": {
      "id": 1,
      "email": "user@example.com",
      "name": "John Doe"
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

```
409 Conflict
{ "error": "Email already registered", "statusCode": 409 }
```

```
422 Unprocessable
{
  "error": "Validation failed",
  "details": [
    { "field": "email", "message": "Invalid email format" },
    { "field": "password", "message": "Password must be at least 6 characters" }
  ]
}
```

---

### `POST /api/auth/login`

```
Body:
{
  "email": "user@example.com",
  "password": "rahasia123"
}
```

```
200 OK
{
  "data": {
    "user": { "id": 1, "email": "user@example.com", "name": "John Doe" },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

```
401 Unauthorized
{ "error": "Invalid credentials", "statusCode": 401 }
```

---

### `GET /api/auth/me`

Butuh header `Authorization: Bearer <token>`.

```
200 OK
{
  "data": {
    "user": { "id": 1, "email": "user@example.com", "name": "John Doe" }
  }
}
```

---

## 3. Domains

### `POST /api/domains` — Register domain baru

```
Body:
{
  "domain_name": "example.com",
  "tld": "com",
  "years": 1,
  "customer_id": 1,
  "nameservers": ["ns1.liquid.net", "ns2.liquid.net"],
  "auto_renew": false,
  "privacy_protection": true
}
```

```
201 Created
{
  "data": {
    "id": 10,
    "domain_name": "example.com",
    "tld": "com",
    "registration_date": "2026-07-28",
    "expiry_date": "2027-07-28",
    "years": 1,
    "status": "active",
    "liquid_order_id": "ORD-998877",
    "nameservers": ["ns1.liquid.net", "ns2.liquid.net"],
    "auto_renew": false,
    "privacy_protection": true,
    "locked": false,
    "theft_protection": false,
    "created_at": "2026-07-28T10:30:00Z"
  }
}
```

```
400 Bad Request
{ "error": "Domain not available", "statusCode": 400 }
```

```
402 Payment Required
{ "error": "Insufficient balance", "statusCode": 402 }
```

---

### `GET /api/domains` — List semua domain

```
Query params:
  ?search=example     (opsional, search by domain_name)
  ?status=active      (opsional, filter: active|pending|expired|suspended)
  ?page=1             (default 1)
  ?per_page=20        (default 20, max 100)
  ?sort=expiry_date   (opsional, default created_at desc)
```

```
200 OK
{
  "data": [
    {
      "id": 10,
      "domain_name": "example.com",
      "tld": "com",
      "expiry_date": "2027-07-28",
      "status": "active",
      "auto_renew": false,
      "locked": true,
      "created_at": "2026-07-28T10:30:00Z"
    }
  ],
  "meta": { "total": 42, "page": 1, "perPage": 20 }
}
```

---

### `GET /api/domains/availability` — Cek ketersediaan

```
Query: ?domain_name=example&tld=com
```

```
200 OK
{
  "data": {
    "domain_name": "example.com",
    "available": true,
    "premium": false,
    "price": { "register": 14.99, "renew": 14.99, "transfer": 14.99, "currency": "USD" }
  }
}
```

```
200 OK (not available)
{
  "data": {
    "domain_name": "example.com",
    "available": false
  }
}
```

---

### `GET /api/domains/suggestion` — Saran domain alternatif

```
Query: ?keyword=example&tld=com
```

```
200 OK
{
  "data": {
    "keyword": "example",
    "suggestions": [
      { "domain": "myexample.com", "available": true, "price": 14.99 },
      { "domain": "theexample.com", "available": true, "price": 14.99 },
      { "domain": "examplepro.com", "available": false },
      { "domain": "example.id", "available": true, "price": 9.99 }
    ]
  }
}
```

---

### `GET /api/domains/:id` — Detail satu domain

```
200 OK
{
  "data": {
    "id": 10,
    "domain_name": "example.com",
    "tld": "com",
    "registration_date": "2026-07-28",
    "expiry_date": "2027-07-28",
    "years": 1,
    "status": "active",
    "locked": true,
    "theft_protection": false,
    "privacy_protection": true,
    "auto_renew": false,
    "liquid_order_id": "ORD-998877",
    "nameservers": ["ns1.liquid.net", "ns2.liquid.net"],
    "auth_code": null,
    "customer": {
      "id": 1,
      "name": "John Doe",
      "email": "user@example.com"
    },
    "created_at": "2026-07-28T10:30:00Z",
    "updated_at": "2026-07-28T10:30:00Z"
  }
}
```

---

### `POST /api/domains/:id/renew` — Perpanjang domain

```
Body:
{
  "years": 1
}
```

```
200 OK
{
  "data": {
    "domain_id": 10,
    "domain_name": "example.com",
    "previous_expiry": "2027-07-28",
    "new_expiry": "2028-07-28",
    "years_added": 1,
    "transaction_id": 55
  }
}
```

---

### `PUT /api/domains/:id/transfer` — Transfer domain

```
Body:
{
  "auth_code": "EPP-XXXXX"
}
```

```
200 OK
{
  "data": {
    "domain_id": 10,
    "domain_name": "example.com",
    "status": "pending_transfer",
    "message": "Transfer initiated. Awaiting approval.",
    "transaction_id": 56
  }
}
```

---

### `PUT /api/domains/:id/locked` — Lock domain

```
204 No Content
```

### `DELETE /api/domains/:id/locked` — Unlock domain

```
204 No Content
```

### `GET /api/domains/:id/locked` — Cek status lock

```
200 OK
{ "data": { "domain_id": 10, "locked": true } }
```

---

### `PUT /api/domains/:id/theft-protection` — Enable theft protection

```
204 No Content
```

### `DELETE /api/domains/:id/theft-protection` — Disable theft protection

```
204 No Content
```

---

### `GET /api/domains/:id/ns` — Get nameservers

```
200 OK
{
  "data": {
    "domain_id": 10,
    "nameservers": ["ns1.liquid.net", "ns2.liquid.net"]
  }
}
```

### `PUT /api/domains/:id/ns` — Update nameservers

```
Body:
{
  "nameservers": ["ns1.custom.com", "ns2.custom.com"]
}
```

```
200 OK
{
  "data": {
    "domain_id": 10,
    "nameservers": ["ns1.custom.com", "ns2.custom.com"]
  }
}
```

---

### `GET /api/domains/:id/auth-code` — Get auth code

```
200 OK
{
  "data": {
    "domain_id": 10,
    "auth_code": "EPP-XXXXXXXX"
  }
}
```

### `PUT /api/domains/:id/auth-code` — Update auth code

```
Body:
{
  "auth_code": "EPP-NEWCODE"
}
```

```
200 OK
{
  "data": {
    "domain_id": 10,
    "auth_code": "EPP-NEWCODE"
  }
}
```

---

### `POST /api/domains/:id/restore` — Restore domain

```
Body:
{ }
```

```
200 OK
{
  "data": {
    "domain_id": 10,
    "domain_name": "example.com",
    "status": "active",
    "transaction_id": 57
  }
}
```

---

### `DELETE /api/domains/:id` — Hapus domain

```
204 No Content
```

```
400 Bad Request
{ "error": "Cannot delete active domain. Suspend first.", "statusCode": 400 }
```

---

### `PUT /api/domains/:id/suspended` — Suspend domain

```
204 No Content
```

### `DELETE /api/domains/:id/suspended` — Unsuspend domain

```
204 No Content
```

---

## 4. DNS

### `GET /api/domains/:id/dns/:type` — List DNS records

`type`: `a`, `aaaa`, `cname`, `mx`, `txt`, `ns`, `srv`

```
200 OK
{
  "data": [
    { "hostname": "@", "value": "192.168.1.1", "ttl": 3600 },
    { "hostname": "www", "value": "192.168.1.2", "ttl": 3600 }
  ]
}
```

---

### `POST /api/domains/:id/dns/:type` — Add DNS record

```
Body:
{
  "hostname": "blog",
  "value": "192.168.1.10",
  "ttl": 3600
}
```

```
201 Created
{
  "data": { "hostname": "blog", "value": "192.168.1.10", "ttl": 3600 }
}
```

---

### `PUT /api/domains/:id/dns/:type/:oldHostname/:oldValue` — Update DNS record

```
Body:
{
  "hostname": "blog",
  "value": "192.168.1.20",
  "ttl": 7200
}
```

```
200 OK
{
  "data": { "hostname": "blog", "value": "192.168.1.20", "ttl": 7200 }
}
```

---

### `DELETE /api/domains/:id/dns/:type/:hostname/:value` — Delete DNS record

```
204 No Content
```

---

## 5. Privacy Protection

### `GET /api/domains/:id/privacy` — Status

```
200 OK
{ "data": { "domain_id": 10, "enabled": true } }
```

### `PUT /api/domains/:id/privacy` — Enable

```
200 OK
{ "data": { "domain_id": 10, "enabled": true, "transaction_id": 58 } }
```

### `DELETE /api/domains/:id/privacy` — Disable

```
204 No Content
```

### `POST /api/domains/:id/privacy/buy` — Beli privacy protection

```
200 OK
{ "data": { "domain_id": 10, "enabled": true, "transaction_id": 59 } }
```

---

## 6. Forwarding

### `GET /api/domains/:id/domain-forwarding` — Get domain forwarding

```
200 OK
{
  "data": {
    "domain_id": 10,
    "enabled": false,
    "destination_url": null
  }
}
```

### `PUT /api/domains/:id/domain-forwarding` — Set domain forwarding

```
Body:
{
  "destination_url": "https://example.com",
  "enabled": true
}
```

```
200 OK
{
  "data": { "domain_id": 10, "enabled": true, "destination_url": "https://example.com" }
}
```

---

### `GET /api/domains/:id/email-forwarding` — List email forwarding

```
200 OK
{
  "data": [
    { "email": "admin@example.com", "forward_to": "john@gmail.com" },
    { "email": "info@example.com", "forward_to": "jane@gmail.com" }
  ]
}
```

### `POST /api/domains/:id/email-forwarding` — Create email forwarding

```
Body:
{
  "email": "support@example.com",
  "forward_to": "team@gmail.com"
}
```

```
201 Created
{
  "data": { "email": "support@example.com", "forward_to": "team@gmail.com" }
}
```

### `DELETE /api/domains/:id/email-forwarding/:email` — Delete email forwarding

```
204 No Content
```

---

## 7. Customers

### `GET /api/customers` — List customers

```
Query params:
  ?search=john       (opsional)
  ?page=1            (default 1)
  ?per_page=20       (default 20)
```

```
200 OK
{
  "data": [
    {
      "id": 1,
      "liquid_customer_id": "CUST-123",
      "name": "John Doe",
      "email": "john@example.com",
      "company": "Acme Inc",
      "country": "ID",
      "created_at": "2026-07-01T08:00:00Z"
    }
  ],
  "meta": { "total": 10, "page": 1, "perPage": 20 }
}
```

---

### `POST /api/customers` — Create customer

```
Body:
{
  "name": "John Doe",
  "email": "john@example.com",
  "company": "Acme Inc",
  "address": "Jl. Sudirman No. 1",
  "city": "Jakarta",
  "state": "DKI Jakarta",
  "country": "ID",
  "zipcode": "12345",
  "phone": "+62812345678"
}
```

```
201 Created
{
  "data": {
    "id": 1,
    "liquid_customer_id": "CUST-123",
    "name": "John Doe",
    "email": "john@example.com",
    "company": "Acme Inc",
    "country": "ID",
    "created_at": "2026-07-28T10:30:00Z"
  }
}
```

---

### `GET /api/customers/:id` — Detail customer

```
200 OK
{
  "data": {
    "id": 1,
    "liquid_customer_id": "CUST-123",
    "name": "John Doe",
    "email": "john@example.com",
    "company": "Acme Inc",
    "address": "Jl. Sudirman No. 1",
    "city": "Jakarta",
    "state": "DKI Jakarta",
    "country": "ID",
    "zipcode": "12345",
    "phone": "+62812345678",
    "domain_count": 5,
    "created_at": "2026-07-01T08:00:00Z"
  }
}
```

---

### `PUT /api/customers/:id` — Update customer

```
Body:
{
  "name": "John Updated",
  "phone": "+62899999999"
}
```

```
200 OK
{
  "data": {
    "id": 1,
    "name": "John Updated",
    "email": "john@example.com",
    "phone": "+62899999999"
  }
}
```

---

### `DELETE /api/customers/:id` — Delete customer

```
204 No Content
```

```
409 Conflict
{ "error": "Customer has active domains. Transfer or delete domains first.", "statusCode": 409 }
```

---

## 8. Billing

### `GET /api/billing/balance` — Saldo akun

```
200 OK
{
  "data": {
    "balance": 250.00,
    "currency": "USD"
  }
}
```

---

### `GET /api/billing/prices` — Daftar harga

```
200 OK
{
  "data": {
    "tlds": [
      { "tld": "com", "register": 14.99, "renew": 14.99, "transfer": 14.99, "restore": 79.99 },
      { "tld": "net", "register": 12.99, "renew": 12.99, "transfer": 12.99, "restore": 69.99 },
      { "tld": "id",  "register": 9.99,  "renew": 9.99,  "transfer": 9.99,  "restore": 49.99 }
    ],
    "addons": {
      "privacy_protection": 3.99,
      "theft_protection": 5.99
    }
  }
}
```

---

### `GET /api/billing/transactions` — Riwayat transaksi

```
Query params:
  ?type=register      (opsional: register|renew|transfer|restore|privacy)
  ?status=completed   (opsional: pending|completed|failed)
  ?from=2026-01-01    (opsional)
  ?to=2026-07-28      (opsional)
  ?customer_id=1      (opsional)
  ?page=1
  ?per_page=20
```

```
200 OK
{
  "data": [
    {
      "id": 55,
      "type": "register",
      "amount": 14.99,
      "currency": "USD",
      "status": "completed",
      "description": "Registration: example.com",
      "domain_name": "example.com",
      "customer_name": "John Doe",
      "liquid_transaction_id": "LIQ-TXN-12345",
      "created_at": "2026-07-28T10:30:00Z"
    }
  ],
  "meta": { "total": 120, "page": 1, "perPage": 20 }
}
```

---

### `GET /api/billing/transactions/:id` — Detail transaksi

```
200 OK
{
  "data": {
    "id": 55,
    "type": "register",
    "amount": 14.99,
    "currency": "USD",
    "status": "completed",
    "description": "Registration: example.com",
    "domain_id": 10,
    "domain_name": "example.com",
    "customer_id": 1,
    "customer_name": "John Doe",
    "liquid_transaction_id": "LIQ-TXN-12345",
    "created_at": "2026-07-28T10:30:00Z",
    "updated_at": "2026-07-28T10:30:00Z"
  }
}
```

---

## 9. Common / Utilities

### `GET /api/common/tlds` — List semua TLD

```
200 OK
{
  "data": [
    { "name": "com", "label": ".com", "register": 14.99, "renew": 14.99 },
    { "name": "id",  "label": ".id",  "register": 9.99,  "renew": 9.99 }
  ]
}
```

### `GET /api/common/countries` — List negara

```
200 OK
{
  "data": [
    { "code": "ID", "name": "Indonesia" },
    { "code": "US", "name": "United States" }
  ]
}
```

---

## 10. Error Codes

| HTTP Status | Makna | Contoh |
|-------------|-------|--------|
| `400` | Bad Request — input tidak valid | Domain tidak tersedia, format salah |
| `401` | Unauthorized — token missing/invalid/expired | JWT expired, tidak ada Authorization header |
| `402` | Payment Required — saldo tidak cukup | Balance $10, register butuh $14.99 |
| `404` | Not Found — resource tidak ditemukan | Domain ID tidak ada |
| `409` | Conflict — status tidak memungkinkan aksi | Hapus customer yang masih punya domain |
| `422` | Unprocessable — validasi gagal | Email format salah, field required kosong |
| `429` | Too Many Requests — rate limit | > 60 request per menit |
| `500` | Internal Server Error — error tak terduga | LIQUID API down, DB connection lost |

---

## 11. Testing Endpoint (curl examples)

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"rahasia123","name":"Test User","reseller_id":"RES-123","api_key":"sk_test_xxx"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"rahasia123"}'

# Check domain availability
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/domains/availability?domain_name=mynewdomain&tld=com"

# List domains
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/domains?page=1&per_page=10"

# List DNS
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/domains/1/dns/a"

# Check balance
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/billing/balance"
```
