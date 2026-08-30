// Baseline migrasi drizzle: tandai migrasi yang sudah terpasang sebagai "applied"
// di tabel __drizzle_migrations, TANPA menjalankan ulang SQL-nya.
//
// Latar belakang: DB production/lokal ini dibangun lewat ensureDatabaseSchema()
// (DDL idempotent saat boot), sehingga tabel-tabel sudah ada padahal
// __drizzle_migrations kosong. Kalau `bun run db:migrate` dijalankan dalam
// kondisi itu, drizzle akan mencoba menerapkan 0000-0007 dari awal → konflik
// CREATE TABLE. Script ini mengisi tracking table dengan hash + folderMillis
// (created_at) yang persis seperti yang ditulis migrator drizzle-orm 0.45.x,
// sehingga db:migrate berikutnya hanya menjalankan migrasi yang benar-benar baru.
//
// Jalankan dari folder backend (bun auto-load .env):
//   bun run scripts/migrate-baseline.ts
// Idempotent — aman dijalankan ulang.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

const MIGRATIONS_DIR = path.resolve(process.cwd(), "drizzle/migrations");
const JOURNAL_PATH = path.join(MIGRATIONS_DIR, "meta/_journal.json");

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || "127.0.0.1",
  port: parseInt(process.env.DB_PORT || "3306"),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || undefined,
  database: process.env.DB_NAME || "domain_dashboard",
});

// Struktur tabel tracking identik dengan yang dibuat drizzle-orm mysql2 migrator
await conn.query(`
  CREATE TABLE IF NOT EXISTS __drizzle_migrations (
    id serial primary key,
    hash text not null,
    created_at bigint
  )
`);

// Guard: baseline hanya valid kalau tabel aplikasi SUDAH ada (DB yang dibangun
// lewat ensureDatabaseSchema/migrasi manual). Kalau DB masih fresh, operator
// harus menjalankan `bun run db:migrate` normal — bukan baseline.
const [appTables] = await conn.query(
  "SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN ('users', 'transactions', 'domains')"
);
if ((appTables as any)[0].c < 3) {
  console.error("DB ini masih kosong/fresh (tabel users/transactions/domains belum lengkap).");
  console.error("Jangan pakai baseline — jalankan `bun run db:migrate` normal dari awal.");
  await conn.end();
  process.exit(1);
}

const journal = JSON.parse(fs.readFileSync(JOURNAL_PATH, "utf8"));
let inserted = 0;
let skipped = 0;

for (const entry of journal.entries) {
  const sqlPath = path.join(MIGRATIONS_DIR, `${entry.tag}.sql`);
  const content = fs.readFileSync(sqlPath, "utf8");
  const hash = crypto.createHash("sha256").update(content).digest("hex");
  const created_at = entry.when;

  const [existing] = await conn.query(
    "SELECT id FROM __drizzle_migrations WHERE created_at = ?",
    [created_at]
  );
  if ((existing as any).length > 0) {
    skipped++;
    continue;
  }
  await conn.query(
    "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
    [hash, created_at]
  );
  inserted++;
  console.log(`baseline: ${entry.tag} -> ${hash.slice(0, 12)}… (created_at ${created_at})`);
}

console.log(`Selesai: ${inserted} migrasi di-baseline, ${skipped} sudah ada.`);

const [verify] = await conn.query(
  "SELECT COUNT(*) AS total, MAX(created_at) AS last FROM __drizzle_migrations"
);
console.log("Tracking sekarang:", JSON.stringify((verify as any)[0]));

await conn.end();
