/**
 * Migration Script: Migrate encrypted data (apiKeyEncrypted in users, codeEncrypted in otp_codes)
 * from format v1 (static salt) to format v2 (per-record random salt).
 *
 * Usage:
 *   Dry-run mode (default, no DB changes):
 *     bun run scripts/migrate-encryption-format.ts
 *
 *   Execute mode (performs DB updates):
 *     bun run scripts/migrate-encryption-format.ts --execute
 */

import { encrypt, decrypt } from "../src/lib/encryption";

async function main() {
  const isExecute = process.argv.includes("--execute");
  console.log(`[migrate-encryption] Starting encryption format migration (Mode: ${isExecute ? "EXECUTE" : "DRY-RUN"})...`);

  const mysql = await import("mysql2/promise");
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "domain_dashboard",
  });

  const userUpdates: Array<{ id: number; current: string; next: string }> = [];
  const otpUpdates: Array<{ id: number; current: string; next: string }> = [];
  let usersUpdated = 0;
  let usersSkipped = 0;
  let usersFailed = 0;
  let otpUpdated = 0;
  let otpSkipped = 0;
  let otpFailed = 0;

  try {
    if (isExecute) await conn.beginTransaction();

    const lockClause = isExecute ? " FOR UPDATE" : "";
    const [userRows] = await conn.query(
      "SELECT id, api_key_encrypted FROM users WHERE api_key_encrypted IS NOT NULL AND api_key_encrypted != ''" + lockClause
    );

    for (const row of userRows as any[]) {
      const current = String(row.api_key_encrypted || "");
      if (current.startsWith("v2:")) {
        usersSkipped++;
        continue;
      }

      try {
        const plain = await decrypt(current);
        if (!plain || plain === current) {
          throw new Error("ciphertext could not be decrypted with ENCRYPTION_KEY or OLD_ENCRYPTION_KEY");
        }
        const next = await encrypt(plain);
        if (!next.startsWith("v2:")) throw new Error("encryption did not produce v2 ciphertext");
        userUpdates.push({ id: Number(row.id), current, next });
        usersUpdated++;
      } catch (err: any) {
        usersFailed++;
        console.error(`[migrate-encryption] User #${row.id} decryption failed:`, err?.message || err);
      }
    }

    const [otpRows] = await conn.query(
      "SELECT id, code_encrypted FROM otp_codes WHERE code_encrypted IS NOT NULL AND code_encrypted != ''" + lockClause
    );

    for (const row of otpRows as any[]) {
      const current = String(row.code_encrypted || "");
      if (current.startsWith("v2:")) {
        otpSkipped++;
        continue;
      }

      try {
        const plain = await decrypt(current);
        if (!plain || plain === current) {
          throw new Error("ciphertext could not be decrypted with ENCRYPTION_KEY or OLD_ENCRYPTION_KEY");
        }
        const next = await encrypt(plain);
        if (!next.startsWith("v2:")) throw new Error("encryption did not produce v2 ciphertext");
        otpUpdates.push({ id: Number(row.id), current, next });
        otpUpdated++;
      } catch (err: any) {
        otpFailed++;
        console.error(`[migrate-encryption] otp_codes #${row.id} decryption failed:`, err?.message || err);
      }
    }

    if (usersFailed > 0 || otpFailed > 0) {
      throw new Error("migration aborted because one or more rows could not be decrypted; no rows were changed");
    }

    if (isExecute) {
      for (const update of userUpdates) {
        const [result] = await conn.query(
          "UPDATE users SET api_key_encrypted = ? WHERE id = ? AND api_key_encrypted = ?",
          [update.next, update.id, update.current]
        );
        if ((result as any).affectedRows !== 1) throw new Error(`users.id=${update.id} changed during migration`);
      }
      for (const update of otpUpdates) {
        const [result] = await conn.query(
          "UPDATE otp_codes SET code_encrypted = ? WHERE id = ? AND code_encrypted = ?",
          [update.next, update.id, update.current]
        );
        if ((result as any).affectedRows !== 1) throw new Error(`otp_codes.id=${update.id} changed during migration`);
      }
      await conn.commit();
    }
  } catch (err) {
    if (isExecute) await conn.rollback();
    throw err;
  } finally {
    await conn.end();
  }

  console.log("\n================ MIGRATION SUMMARY ================");
  const action = isExecute ? "migrated" : "ready to migrate";
  console.log(`Users:     ${usersUpdated} ${action}, ${usersSkipped} already v2, ${usersFailed} failed`);
  console.log(`OTP Codes: ${otpUpdated} ${action}, ${otpSkipped} already v2, ${otpFailed} failed`);
  if (!isExecute) {
    console.log("\n[NOTE] Dry-run completed. Re-run with --execute to commit changes to database.");
  } else {
    console.log("\n[SUCCESS] Migration committed to database successfully.");
  }
}

main().catch((e) => {
  console.error("[migrate-encryption] Fatal error:", e);
  process.exit(1);
});
