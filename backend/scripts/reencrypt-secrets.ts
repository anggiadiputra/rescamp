/**
 * Re-encrypt apiKeyEncrypted (users) and codeEncrypted (otp_codes) after rotating
 * ENCRYPTION_KEY. Mirrors the PBKDF2+AES-256-GCM scheme in src/lib/encryption.ts.
 *
 * Usage (must be run BEFORE switching ENCRYPTION_KEY in .env):
 *   OLD_ENCRYPTION_KEY=<old-key> ENCRYPTION_KEY=<new-key> DB_HOST=... DB_USER=... \
 *   DB_PASSWORD=... DB_NAME=... bun run scripts/reencrypt-secrets.ts
 *
 * OLD_ENCRYPTION_KEY defaults to the previously hardcoded fallback key so existing
 * deployments that never set ENCRYPTION_KEY can still migrate.
 */

const OLD_KEY = process.env.OLD_ENCRYPTION_KEY || "change-this-in-production-min-32-chars!!";
const NEW_KEY = process.env.ENCRYPTION_KEY || "";
if (!NEW_KEY || NEW_KEY.length < 32) {
  console.error("ENCRYPTION_KEY must be set (new key, min 32 chars)");
  process.exit(1);
}
if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_NAME) {
  console.error("DB_HOST, DB_USER, DB_PASSWORD, DB_NAME must be set");
  process.exit(1);
}

const SALT = new TextEncoder().encode("resellercamp-salt-v1");
const IV_LENGTH = 12;

async function getKey(keyString: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(keyString),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: SALT, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function decryptWith(keyString: string, ciphertextBase64: string): Promise<string> {
  const combined = Uint8Array.from(Buffer.from(ciphertextBase64, "base64"));
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);
  const key = await getKey(keyString);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(plaintext);
}

async function encryptWith(keyString: string, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await getKey(keyString);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext)
  );
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return Buffer.from(combined).toString("base64");
}

async function main() {
  const mysql = await import("mysql2/promise");
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  // users.apiKeyEncrypted (skip gracefully if the column doesn't exist yet)
  let usersDone = 0, usersSkipped = 0;
  try {
    const [userRows] = await conn.query(
      "SELECT id, api_key_encrypted FROM users WHERE api_key_encrypted IS NOT NULL AND api_key_encrypted != ''"
    );
    for (const row of userRows as any[]) {
      try {
        const plain = await decryptWith(OLD_KEY, row.api_key_encrypted);
        // Already encrypted with the new key? Decrypt probe tells us; skip if unchanged
        const newCipher = await encryptWith(NEW_KEY, plain);
        if (newCipher === row.api_key_encrypted) { usersSkipped++; continue; }
        await conn.query("UPDATE users SET api_key_encrypted = ? WHERE id = ?", [newCipher, row.id]);
        usersDone++;
      } catch (e: any) {
        // decrypt failure with OLD_KEY → already new-key encrypted or corrupt; try new key
        try {
          await decryptWith(NEW_KEY, row.api_key_encrypted);
          usersSkipped++;
        } catch {
          console.warn(`users.id=${row.id}: cannot decrypt with old or new key — skipping (manual fix needed)`);
          usersSkipped++;
        }
      }
    }
  } catch (e: any) {
    if (e?.code === "ER_BAD_FIELD_ERROR") {
      console.log("users.api_key_encrypted column missing — nothing to migrate");
    } else {
      throw e;
    }
  }

  // otp_codes.codeEncrypted
  let otpDone = 0, otpSkipped = 0;
  try {
    const [otpRows] = await conn.query(
      "SELECT id, code_encrypted FROM otp_codes WHERE code_encrypted IS NOT NULL AND code_encrypted != ''"
    );
    for (const row of otpRows as any[]) {
      try {
        const plain = await decryptWith(OLD_KEY, row.code_encrypted);
        const newCipher = await encryptWith(NEW_KEY, plain);
        if (newCipher === row.code_encrypted) { otpSkipped++; continue; }
        await conn.query("UPDATE otp_codes SET code_encrypted = ? WHERE id = ?", [newCipher, row.id]);
        otpDone++;
      } catch {
        try {
          await decryptWith(NEW_KEY, row.code_encrypted);
          otpSkipped++;
        } catch {
          otpSkipped++;
        }
      }
    }
  } catch (e: any) {
    if (e?.code === "ER_BAD_FIELD_ERROR") {
      console.log("otp_codes.code_encrypted column missing — nothing to migrate");
    } else {
      throw e;
    }
  }

  await conn.end();
  console.log(`Done. users re-encrypted=${usersDone} skipped=${usersSkipped}; otp_codes re-encrypted=${otpDone} skipped=${otpSkipped}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
