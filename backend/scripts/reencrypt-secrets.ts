/**
 * Re-encrypt apiKeyEncrypted (users) and codeEncrypted (otp_codes) while rotating
 * ENCRYPTION_KEY. Reads both v1 and v2 ciphertext through src/lib/encryption.ts
 * and always writes the current v2 format.
 *
 * Dry-run first, then execute while OLD_ENCRYPTION_KEY is the previous key and
 * ENCRYPTION_KEY is the new key:
 *   OLD_ENCRYPTION_KEY=<old-key> ENCRYPTION_KEY=<new-key> DB_HOST=... DB_USER=... \
 *   DB_PASSWORD=... DB_NAME=... bun run scripts/reencrypt-secrets.ts [--execute]
 *
 * V2-03: OLD_ENCRYPTION_KEY is now REQUIRED. The previously hardcoded default
 * fallback key was removed — if your old rows were encrypted with it, pass it
 * explicitly: OLD_ENCRYPTION_KEY="change-this-in-production-min-32-chars!!" ...
 * (then delete it from your shell history).
 */

const OLD_KEY = process.env.OLD_ENCRYPTION_KEY || "";
const NEW_KEY = process.env.ENCRYPTION_KEY || "";
if (!OLD_KEY || OLD_KEY.length < 16) {
  console.error("OLD_ENCRYPTION_KEY must be set (previous key, min 16 chars). If your legacy rows used the old hardcoded default, pass it explicitly.");
  process.exit(1);
}
if (!NEW_KEY || NEW_KEY.length < 32) {
  console.error("ENCRYPTION_KEY must be set to the new key (min 32 chars)");
  process.exit(1);
}
if (OLD_KEY === NEW_KEY) {
  console.error("OLD_ENCRYPTION_KEY and ENCRYPTION_KEY must be different when rotating keys");
  process.exit(1);
}
if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_NAME) {
  console.error("DB_HOST, DB_USER, and DB_NAME must be set");
  process.exit(1);
}

async function main() {
  const isExecute = process.argv.includes("--execute");
  const { decrypt, encrypt } = await import("../src/lib/encryption");
  const mysql = await import("mysql2/promise");
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const userUpdates: Array<{ id: number; current: string; next: string }> = [];
  const otpUpdates: Array<{ id: number; current: string; next: string }> = [];
  let usersFailed = 0;
  let otpFailed = 0;

  try {
    if (isExecute) await conn.beginTransaction();
    const lockClause = isExecute ? " FOR UPDATE" : "";
    const [userRows] = await conn.query(
      "SELECT id, api_key_encrypted FROM users WHERE api_key_encrypted IS NOT NULL AND api_key_encrypted != ''" + lockClause
    );
    for (const row of userRows as any[]) {
      const current = String(row.api_key_encrypted || "");
      try {
        const plain = await decrypt(current);
        if (!plain || plain === current) throw new Error("ciphertext could not be decrypted with the old or new key");
        const next = await encrypt(plain);
        if (!next.startsWith("v2:")) throw new Error("encryption did not produce v2 ciphertext");
        userUpdates.push({ id: Number(row.id), current, next });
      } catch (e: any) {
        usersFailed++;
        console.error(`users.id=${row.id}: ${e?.message || e}`);
      }
    }

    const [otpRows] = await conn.query(
      "SELECT id, code_encrypted FROM otp_codes WHERE code_encrypted IS NOT NULL AND code_encrypted != ''" + lockClause
    );
    for (const row of otpRows as any[]) {
      const current = String(row.code_encrypted || "");
      try {
        const plain = await decrypt(current);
        if (!plain || plain === current) throw new Error("ciphertext could not be decrypted with the old or new key");
        const next = await encrypt(plain);
        if (!next.startsWith("v2:")) throw new Error("encryption did not produce v2 ciphertext");
        otpUpdates.push({ id: Number(row.id), current, next });
      } catch (e: any) {
        otpFailed++;
        console.error(`otp_codes.id=${row.id}: ${e?.message || e}`);
      }
    }

    if (usersFailed > 0 || otpFailed > 0) {
      throw new Error("key rotation aborted because one or more rows could not be decrypted; no rows were changed");
    }

    if (isExecute) {
      for (const update of userUpdates) {
        const [result] = await conn.query(
          "UPDATE users SET api_key_encrypted = ? WHERE id = ? AND api_key_encrypted = ?",
          [update.next, update.id, update.current]
        );
        if ((result as any).affectedRows !== 1) throw new Error(`users.id=${update.id} changed during key rotation`);
      }
      for (const update of otpUpdates) {
        const [result] = await conn.query(
          "UPDATE otp_codes SET code_encrypted = ? WHERE id = ? AND code_encrypted = ?",
          [update.next, update.id, update.current]
        );
        if ((result as any).affectedRows !== 1) throw new Error(`otp_codes.id=${update.id} changed during key rotation`);
      }
      await conn.commit();
    }
  } catch (err) {
    if (isExecute) await conn.rollback();
    throw err;
  } finally {
    await conn.end();
  }

  const action = isExecute ? "re-encrypted" : "ready to re-encrypt";
  console.log(`Done (${isExecute ? "EXECUTE" : "DRY-RUN"}). users ${action}=${userUpdates.length}; otp_codes ${action}=${otpUpdates.length}`);
  if (!isExecute) console.log("No rows changed. Re-run with --execute after reviewing this output.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
