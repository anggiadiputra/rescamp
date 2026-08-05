import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { env } from "../config/env";

import { sql } from "drizzle-orm";

const pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
});

export const db = drizzle(pool);

export async function ensureDatabaseSchema() {
  try {
    await db.execute(sql`ALTER TABLE transactions MODIFY COLUMN payment_status ENUM('pending','completed','failed','expired','cancelled') DEFAULT 'pending'`);
    await db.execute(sql`ALTER TABLE transactions MODIFY COLUMN status ENUM('pending_payment','processing_domain','completed','failed','cancelled','expired','action_required') DEFAULT 'pending_payment'`);
    await db.execute(sql`ALTER TABLE domains MODIFY COLUMN status ENUM('active','pending','expired','suspended','transferred','cancelled') DEFAULT 'pending'`);
    // suspend reason fields (added for suspend reason audit trail)
    await db.execute(sql`ALTER TABLE domains ADD COLUMN IF NOT EXISTS suspend_reason VARCHAR(500) NULL`);
    await db.execute(sql`ALTER TABLE domains ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP NULL`);
  } catch (err: any) {
    console.warn("[db] ensureDatabaseSchema warning:", err?.message || err);
  }
}
