// Verifikasi status migrasi DB — `bun run scripts/check-migration-status.ts` dari folder backend
import mysql from "mysql2/promise";

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || "127.0.0.1",
  port: parseInt(process.env.DB_PORT || "3306"),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || undefined,
  database: process.env.DB_NAME || "domain_dashboard",
});

const [dbName] = await conn.query("SELECT DATABASE() AS db");
console.log("Database:", (dbName as any)[0].db);

const [tracked] = await conn.query("SELECT tag_count, last FROM (SELECT COUNT(*) AS tag_count, MAX(created_at) AS last FROM __drizzle_migrations) t");
console.log("Migrasi tercatat:", JSON.stringify((tracked as any)[0]));

const files = await Bun.file("./drizzle/migrations/meta/_journal.json").json();
console.log("Migrasi di folder :", files.entries.length, "entry (terakhir:", files.entries[files.entries.length - 1].tag + ")");

const [wb] = await conn.query(
  "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'webhook_receipts'"
);
console.log("webhook_receipts:", (wb as any).length ? "ADA" : "TIDAK ADA");

const [cols] = await conn.query(
  "SELECT column_name, column_type, column_default FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name IN ('role', 'session_version', 'api_key_encrypted') ORDER BY column_name"
);
console.log("Kolom users:", JSON.stringify(cols));

const [adminCount] = await conn.query("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'");
console.log("Jumlah user role admin:", (adminCount as any)[0].c);

await conn.end();
