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
    await db.execute(sql`ALTER TABLE users MODIFY COLUMN role ENUM('admin','reseller','customer') DEFAULT 'customer'`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version INT NOT NULL DEFAULT 0`);
    await db.execute(sql`ALTER TABLE users MODIFY COLUMN api_key_encrypted TEXT NULL`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS webhook_receipts (
        id VARCHAR(255) NOT NULL PRIMARY KEY,
        received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // One-time bootstrap: promote the most relevant master reseller to admin if no
    // admin exists yet. Deliberately non-fatal — this idempotent data migration
    // re-runs on every boot, so a failure here must never block server startup
    // (and on multi-instance boots the NOT EXISTS guard makes double-promotion
    // harmless — worst case the winner's session_version is bumped twice).
    try {
      await db.execute(sql`
        UPDATE users
        SET role = 'admin', session_version = session_version + 1
        WHERE id = (
          SELECT candidate.id FROM (
            SELECT u.id
            FROM users u
            WHERE u.role = 'reseller' AND u.parent_reseller_id IS NULL
            ORDER BY
              CASE WHEN (u.api_key IS NOT NULL AND u.api_key <> '')
                OR (u.api_key_encrypted IS NOT NULL AND u.api_key_encrypted <> '')
                THEN 1 ELSE 0 END DESC,
              (SELECT COUNT(*) FROM users child WHERE child.parent_reseller_id = u.id) DESC,
              (SELECT COUNT(*) FROM transactions txn WHERE txn.user_id = u.id) DESC,
              (SELECT COUNT(*) FROM customers customer WHERE customer.user_id = u.id) DESC,
              u.id ASC
            LIMIT 1
          ) candidate
        )
        AND NOT EXISTS (
          SELECT 1 FROM (SELECT id FROM users WHERE role = 'admin' LIMIT 1) existing_admin
        )
      `);
    } catch (promoErr: any) {
      console.warn("[db] admin bootstrap promotion skipped:", promoErr?.message || promoErr);
    }
  } catch (err: any) {
    console.warn("[db] ensureDatabaseSchema warning:", err?.message || err);
    throw err;
  }
}
