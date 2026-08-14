/**
 * Centralized Reseller Credential Resolver
 * 
 * Single source of truth for resolving Resellercamp API credentials.
 * Handles:
 * - Decrypting `api_key_encrypted` (AES-256-GCM) with fallback to plaintext `api_key`
 * - Resolving parent reseller for customer accounts
 * - Falling back to the first reseller in the DB if no credentials found
 * - In-memory caching of decrypted credentials (5-minute TTL) to avoid
 *   repeated DB queries + PBKDF2 key derivation on every request
 */

import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { decryptApiKey } from "./encryption";
import { env } from "../config/env";
import { AppError } from "./error";

export interface ResellerCreds {
  resellerId: string;
  apiKey: string;
}

// In-memory cache: userId → { creds, expiresAt }
interface CachedCreds {
  creds: ResellerCreds;
  expiresAt: number;
}
const credsCache = new Map<number, CachedCreds>();
const CACHE_TTL_MS = 5 * 60_000; // 5 minutes

/**
 * Resolve Resellercamp credentials for a given user ID.
 * 
 * Resolution order:
 * 1. Check in-memory cache (5-min TTL)
 * 2. Load user from DB
 * 3. If user is a customer with parentResellerId → load parent reseller
 * 4. Decrypt `apiKeyEncrypted` if available, fallback to `apiKey` plaintext
 * 5. If still no credentials → fallback to first reseller in DB
 * 6. Cache the resolved credentials
 */
export async function resolveResellerCreds(userId?: number): Promise<ResellerCreds> {
  const targetId = Number(userId || 0);

  // Check cache first
  if (targetId > 0) {
    const cached = credsCache.get(targetId);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.creds;
    }
  }

  let resellerId = "";
  let apiKey = "";

  if (targetId > 0) {
    const [user] = await db.select().from(users).where(eq(users.id, targetId));
    if (user) {
      let targetUser: any = user;

      // If customer, resolve parent reseller
      if (user.role === "customer") {
        let parentUser: any = null;
        if (user.parentResellerId) {
          // 1. Try lookup by users.id
          const [p1] = await db.select().from(users).where(eq(users.id, user.parentResellerId));
          if (p1?.resellerId && (p1.apiKey || p1.apiKeyEncrypted)) {
            parentUser = p1;
          } else {
            // 2. Try lookup by users.resellerId
            const [p2] = await db.select().from(users).where(eq(users.resellerId, String(user.parentResellerId)));
            if (p2?.resellerId && (p2.apiKey || p2.apiKeyEncrypted)) {
              parentUser = p2;
            }
          }
        }
        // 3. Fallback to any reseller/admin in DB with credentials
        if (!parentUser) {
          const [master] = await db.select().from(users).where(
            and(
              sql`${users.role} IN ('reseller', 'admin')`,
              sql`(${users.apiKey} IS NOT NULL OR ${users.apiKeyEncrypted} IS NOT NULL)`
            )
          ).limit(1);
          if (master) parentUser = master;
        }

        if (parentUser) targetUser = parentUser;
      }

      // Try to get credentials from target user
      resellerId = targetUser.resellerId || "";

      // Decrypt apiKeyEncrypted first, fallback to plaintext apiKey
      if (targetUser.apiKeyEncrypted) {
        try {
          apiKey = await decryptApiKey(targetUser.apiKeyEncrypted);
        } catch (e) {
          console.error("[resolveResellerCreds] decryptApiKey failed, trying plaintext:", e);
          apiKey = targetUser.apiKey || "";
        }
      } else {
        apiKey = targetUser.apiKey || "";
      }
    }
  }

  // Fallback: app_settings table in database (explicit operator configuration)
  if (!resellerId || !apiKey) {
    const dbSettings = await resolveFromAppSettings();
    if (!resellerId) resellerId = dbSettings.resellerId;
    if (!apiKey) apiKey = dbSettings.apiKey;
  }

  // Fallback: process.env / .env variables (explicit operator configuration)
  if (!resellerId) resellerId = env.DEFAULT_RESELLER_ID || "";
  if (!apiKey) apiKey = env.RESELLER_API_KEY || "";

  const creds: ResellerCreds = { resellerId, apiKey };

  if (!creds.resellerId || !creds.apiKey) {
    throw new AppError("Kredensial reseller tidak ditemukan. Hubungi penyedia layanan.", 502);
  }

  // Cache the resolved credentials
  if (targetId > 0 && resellerId && apiKey) {
    credsCache.set(targetId, { creds, expiresAt: Date.now() + CACHE_TTL_MS });
  }

  return creds;
}

/**
 * Resolve credentials from a user record directly (without userId lookup).
 * Useful when you already have the user object from a prior DB query.
 * Still decrypts apiKeyEncrypted and falls back to first reseller if needed.
 */
export async function resolveCredsFromUser(user: {
  id: number;
  role?: string | null;
  resellerId?: string | null;
  apiKey?: string | null;
  apiKeyEncrypted?: string | null;
  parentResellerId?: number | null;
}): Promise<ResellerCreds> {
  // Check cache first
  const cached = credsCache.get(user.id);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.creds;
  }

  let resellerId = user.resellerId || "";
  let apiKey = "";

  // If customer, resolve parent
  if (user.role === "customer") {
    let parentUser: any = null;
    if (user.parentResellerId) {
      const [p1] = await db.select().from(users).where(eq(users.id, user.parentResellerId));
      if (p1?.resellerId && (p1.apiKey || p1.apiKeyEncrypted)) {
        parentUser = p1;
      } else {
        const [p2] = await db.select().from(users).where(eq(users.resellerId, String(user.parentResellerId)));
        if (p2?.resellerId && (p2.apiKey || p2.apiKeyEncrypted)) {
          parentUser = p2;
        }
      }
    }
    if (!parentUser) {
      const [master] = await db.select().from(users).where(
        and(
          sql`${users.role} IN ('reseller', 'admin')`,
          sql`(${users.apiKey} IS NOT NULL OR ${users.apiKeyEncrypted} IS NOT NULL)`
        )
      ).limit(1);
      if (master) parentUser = master;
    }

    if (parentUser) {
      resellerId = parentUser.resellerId || "";
      if (parentUser.apiKeyEncrypted) {
        try {
          apiKey = await decryptApiKey(parentUser.apiKeyEncrypted);
        } catch (e) {
          apiKey = parentUser.apiKey || "";
        }
      } else {
        apiKey = parentUser.apiKey || "";
      }
    }
  }

  // Try own credentials if not resolved from parent
  if (!apiKey) {
    if (user.apiKeyEncrypted) {
      try {
        apiKey = await decryptApiKey(user.apiKeyEncrypted);
      } catch (e) {
        apiKey = user.apiKey || "";
      }
    } else {
      apiKey = user.apiKey || "";
    }
  }

  // H2: no fallback to an arbitrary "first reseller" in the DB
  // Fallback: app_settings table in database (explicit operator configuration)
  if (!resellerId || !apiKey) {
    const dbSettings = await resolveFromAppSettings();
    if (!resellerId) resellerId = dbSettings.resellerId;
    if (!apiKey) apiKey = dbSettings.apiKey;
  }

  // Fallback: process.env / .env variables (explicit operator configuration)
  if (!resellerId) resellerId = env.DEFAULT_RESELLER_ID || "";
  if (!apiKey) apiKey = env.RESELLER_API_KEY || "";

  const creds: ResellerCreds = { resellerId, apiKey };

  if (!creds.resellerId || !creds.apiKey) {
    throw new AppError("Kredensial reseller tidak ditemukan. Hubungi penyedia layanan.", 502);
  }

  if (resellerId && apiKey) {
    credsCache.set(user.id, { creds, expiresAt: Date.now() + CACHE_TTL_MS });
  }

  return creds;
}

/**
 * Helper to check app_settings table for reseller credentials
 */
async function resolveFromAppSettings(): Promise<{ resellerId: string; apiKey: string }> {
  try {
    const { appSettings } = await import("../db/schema");
    const settingsRows = await db.select().from(appSettings);
    const settingsMap: Record<string, string> = {};
    for (const r of settingsRows) {
      if (r.key && r.value) settingsMap[r.key] = r.value;
    }
    const resellerId = settingsMap["reseller_id"] || settingsMap["liquid_reseller_id"] || settingsMap["resellercamp_reseller_id"] || settingsMap["default_reseller_id"] || "";
    const apiKey = settingsMap["api_key"] || settingsMap["liquid_api_key"] || settingsMap["resellercamp_api_key"] || settingsMap["reseller_api_key"] || "";
    return { resellerId, apiKey };
  } catch (e) {
    return { resellerId: "", apiKey: "" };
  }
}

/**
 * Invalidate cached credentials for a specific user.
 * Call this when a user's API key is changed.
 */
export function invalidateCredsCache(userId: number): void {
  credsCache.delete(userId);
}

/**
 * Clear the entire credentials cache.
 */
export function clearCredsCache(): void {
  credsCache.clear();
}
