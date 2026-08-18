/**
 * AES-256-GCM encryption utility for sensitive data at rest
 * Uses Web Crypto API for cryptographic operations
 * 
 * ponytail: key derivation uses PBKDF2 with fixed salt for simplicity;
 * for production, use unique salt per encryption and store alongside ciphertext
 */

// C3: fail fast — no fallback key. Without a strong ENCRYPTION_KEY every
// apiKeyEncrypted/codeEncrypted value in the DB would be decryptable by anyone.
// Rotation: run scripts/reencrypt-secrets.ts with OLD_ENCRYPTION_KEY set to the
// previous key before switching ENCRYPTION_KEY.
const ENC_KEY = process.env.ENCRYPTION_KEY || "";
if (!ENC_KEY || ENC_KEY.length < 32) {
  throw new Error("ENCRYPTION_KEY must be set in .env and at least 32 characters (rotate keys via scripts/reencrypt-secrets.ts)");
}
const LEGACY_SALT = new TextEncoder().encode("resellercamp-salt-v1");
const SALT_LENGTH = 16; // 128 bits salt for PBKDF2
const IV_LENGTH = 12; // 96 bits for GCM

/**
 * Derive a 256-bit AES key from any key string and salt
 */
async function deriveKeyFromString(keyString: string, salt: Uint8Array = LEGACY_SALT): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(keyString),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as any,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Derive a 256-bit AES key from the active ENCRYPTION_KEY with given salt
 */
async function getKey(salt: Uint8Array = LEGACY_SALT): Promise<CryptoKey> {
  return deriveKeyFromString(ENC_KEY, salt);
}

/**
 * Encrypt plaintext string to base64-encoded ciphertext with per-record random salt.
 * Format: "v2:" + base64( salt (16 bytes) + iv (12 bytes) + ciphertext + authTag (16 bytes) )
 */
export async function encrypt(plaintext: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoder = new TextEncoder();
  const key = await getKey(salt);

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext)
  );

  // Combine salt + IV + ciphertext for storage
  const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(ciphertext), salt.length + iv.length);

  // Convert to base64 with v2: prefix
  return "v2:" + btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt base64-encoded ciphertext to plaintext string.
 * Supports v2 (random salt) and v1 (legacy static salt with OLD_ENCRYPTION_KEY fallback).
 */
export async function decrypt(ciphertextBase64: string): Promise<string> {
  const isV2 = ciphertextBase64.startsWith("v2:");
  const raw = isV2 ? ciphertextBase64.slice(3) : ciphertextBase64;
  const combined = Uint8Array.from(atob(raw), c => c.charCodeAt(0));

  if (isV2) {
    // V2 format: salt (16) + iv (12) + ciphertext
    const salt = combined.slice(0, SALT_LENGTH);
    const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const ciphertext = combined.slice(SALT_LENGTH + IV_LENGTH);

    try {
      const key = await getKey(salt);
      const plaintext = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        ciphertext
      );
      return new TextDecoder().decode(plaintext);
    } catch (primaryError) {
      // Fallback to OLD_ENCRYPTION_KEY with extracted salt
      const fallbackKeys = [
        process.env.OLD_ENCRYPTION_KEY,
      ].filter((k): k is string => Boolean(k && k !== ENC_KEY));

      for (const fallbackKeyString of fallbackKeys) {
        try {
          const fallbackKey = await deriveKeyFromString(fallbackKeyString, salt);
          const plaintext = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            fallbackKey,
            ciphertext
          );
          return new TextDecoder().decode(plaintext);
        } catch {}
      }
      throw primaryError;
    }
  }

  // V1 format (legacy): iv (12) + ciphertext, static salt
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);

  // Try primary key first
  try {
    const key = await getKey(LEGACY_SALT);
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext
    );
    return new TextDecoder().decode(plaintext);
  } catch (primaryError) {
    // Attempt fallback to OLD_ENCRYPTION_KEY
    const fallbackKeys = [
      process.env.OLD_ENCRYPTION_KEY,
    ].filter((k): k is string => Boolean(k && k !== ENC_KEY));

    for (const fallbackKeyString of fallbackKeys) {
      try {
        const fallbackKey = await deriveKeyFromString(fallbackKeyString, LEGACY_SALT);
        const plaintext = await crypto.subtle.decrypt(
          { name: "AES-GCM", iv },
          fallbackKey,
          ciphertext
        );
        return new TextDecoder().decode(plaintext);
      } catch {}
    }
    throw primaryError;
  }
}

/**
 * Encrypt API key before storing in database
 */
export async function encryptApiKey(apiKey: string): Promise<string> {
  return encrypt(apiKey);
}

/**
 * Decrypt API key from database
 */
export async function decryptApiKey(encryptedApiKey: string): Promise<string> {
  return decrypt(encryptedApiKey);
}

/**
 * Encrypt OTP code before storing in database
 */
export async function encryptOtpCode(code: string): Promise<string> {
  return encrypt(code);
}

/**
 * Decrypt OTP code from database
 */
export async function decryptOtpCode(encryptedCode: string): Promise<string> {
  return decrypt(encryptedCode);
}
