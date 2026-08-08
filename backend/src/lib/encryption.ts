/**
 * AES-256-GCM encryption utility for sensitive data at rest
 * Uses Web Crypto API for cryptographic operations
 * 
 * ponytail: key derivation uses PBKDF2 with fixed salt for simplicity;
 * for production, use unique salt per encryption and store alongside ciphertext
 */

const ENC_KEY = process.env.ENCRYPTION_KEY || "change-this-in-production-min-32-chars!!";
const SALT = new TextEncoder().encode("resellercamp-salt-v1");
const IV_LENGTH = 12; // 96 bits for GCM

/**
 * Derive a 256-bit AES key from the encryption key string
 */
async function getKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(ENC_KEY),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: SALT,
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
 * Encrypt plaintext string to base64-encoded ciphertext
 * Format: iv (12 bytes) + ciphertext + authTag (16 bytes)
 */
export async function encrypt(plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoder = new TextEncoder();
  const key = await getKey();

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext)
  );

  // Combine IV + ciphertext for storage
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  // Convert to base64
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt base64-encoded ciphertext to plaintext string
 */
export async function decrypt(ciphertextBase64: string): Promise<string> {
  // Decode from base64
  const combined = Uint8Array.from(atob(ciphertextBase64), c => c.charCodeAt(0));

  // Extract IV and ciphertext
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);

  const key = await getKey();

  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(plaintext);
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
