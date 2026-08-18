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

  let usersUpdated = 0;
  let usersSkipped = 0;
  let usersFailed = 0;

  try {
    const [userRows] = await conn.query(
      "SELECT id, email, api_key_encrypted FROM users WHERE api_key_encrypted IS NOT NULL AND api_key_encrypted != ''"
    );

    for (const row of userRows as any[]) {
      const current = String(row.api_key_encrypted || "");
      if (current.startsWith("v2:")) {
        usersSkipped++;
        continue;
      }

      try {
        const plain = await decrypt(current);
        const v2Cipher = await encrypt(plain);

        if (isExecute) {
          await conn.query("UPDATE users SET api_key_encrypted = ? WHERE id = ?", [v2Cipher, row.id]);
        }
        usersUpdated++;
        console.log(`[migrate-encryption] User #${row.id} (${row.email}): v1 -> v2 successfully prepared`);
      } catch (err: any) {
        usersFailed++;
        console.error(`[migrate-encryption] User #${row.id} (${row.email}) decryption failed:`, err?.message || err);
      }
    }
  } catch (err: any) {
    console.warn("[migrate-encryption] users table query failed:", err?.message || err);
  }

  let otpUpdated = 0;
  let otpSkipped = 0;
  let otpFailed = 0;

  try {
    const [otpRows] = await conn.query(
      "SELECT id, email, code_encrypted FROM otp_codes WHERE code_encrypted IS NOT NULL AND code_encrypted != '' AND used = false"
    );

    for (const row of otpRows as any[]) {
      const current = String(row.code_encrypted || "");
      if (current.startsWith("v2:")) {
        otpSkipped++;
        continue;
      }

      try {
        const plain = await decrypt(current);
        const v2Cipher = await encrypt(plain);

        if (isExecute) {
          await conn.query("UPDATE otp_codes SET code_encrypted = ? WHERE id = ?", [v2Cipher, row.id]);
        }
        otpUpdated++;
      } catch (err: any) {
        otpFailed++;
        console.error(`[migrate-encryption] otp_codes #${row.id} decryption failed:`, err?.message || err);
      }
    }
  } catch (err: any) {
    console.warn("[migrate-encryption] otp_codes table query failed:", err?.message || err);
  }

  await conn.end();

  console.log("\n================ MIGRATION SUMMARY ================");
  console.log(`Users:     ${usersUpdated} migrated to v2, ${usersSkipped} already v2, ${usersFailed} failed`);
  console.log(`OTP Codes: ${otpUpdated} migrated to v2, ${otpSkipped} already v2, ${otpFailed} failed`);
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
