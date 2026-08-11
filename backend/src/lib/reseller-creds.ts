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
      let targetUser = user;

      // If customer, resolve parent reseller
      if (user.role === "customer" && user.parentResellerId) {
        const [parent] = await db.select().from(users).where(eq(users.id, user.parentResellerId));
        if (parent?.resellerId) {
          targetUser = parent;
        }
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

  // Fallback: first reseller in DB
  if (!resellerId || !apiKey) {
    const [defaultReseller] = await db.select().from(users).where(eq(users.role, "reseller")).limit(1);
    if (defaultReseller) {
      if (!resellerId) resellerId = defaultReseller.resellerId || "";
      if (!apiKey) {
        if (defaultReseller.apiKeyEncrypted) {
          try {
            apiKey = await decryptApiKey(defaultReseller.apiKeyEncrypted);
          } catch (e) {
            console.error("[resolveResellerCreds] decryptApiKey fallback failed:", e);
            apiKey = defaultReseller.apiKey || "";
          }
        } else {
          apiKey = defaultReseller.apiKey || "";
        }
      }
    }
  }

  // Fallback: app_settings table in database
  if (!resellerId || !apiKey) {
    const dbSettings = await resolveFromAppSettings();
    if (!resellerId) resellerId = dbSettings.resellerId;
    if (!apiKey) apiKey = dbSettings.apiKey;
  }

  // Fallback: process.env / .env variables
  if (!resellerId) resellerId = env.DEFAULT_RESELLER_ID || "";
  if (!apiKey) apiKey = env.RESELLER_API_KEY || "";

  const creds: ResellerCreds = { resellerId, apiKey };

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
  if (user.role === "customer" && user.parentResellerId) {
    const [parent] = await db.select().from(users).where(eq(users.id, user.parentResellerId));
    if (parent?.resellerId) {
      resellerId = parent.resellerId;
      if (parent.apiKeyEncrypted) {
        try {
          apiKey = await decryptApiKey(parent.apiKeyEncrypted);
        } catch (e) {
          apiKey = parent.apiKey || "";
        }
      } else {
        apiKey = parent.apiKey || "";
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

  // Fallback: first reseller in DB
  if (!resellerId || !apiKey) {
    const [defaultReseller] = await db.select().from(users).where(eq(users.role, "reseller")).limit(1);
    if (defaultReseller) {
      if (!resellerId) resellerId = defaultReseller.resellerId || "";
      if (!apiKey) {
        if (defaultReseller.apiKeyEncrypted) {
          try {
            apiKey = await decryptApiKey(defaultReseller.apiKeyEncrypted);
          } catch (e) {
            apiKey = defaultReseller.apiKey || "";
          }
        } else {
          apiKey = defaultReseller.apiKey || "";
        }
      }
    }
  }

  // Fallback: app_settings table in database
  if (!resellerId || !apiKey) {
    const dbSettings = await resolveFromAppSettings();
    if (!resellerId) resellerId = dbSettings.resellerId;
    if (!apiKey) apiKey = dbSettings.apiKey;
  }

  // Fallback: process.env / .env variables
  if (!resellerId) resellerId = env.DEFAULT_RESELLER_ID || "";
  if (!apiKey) apiKey = env.RESELLER_API_KEY || "";

  const creds: ResellerCreds = { resellerId, apiKey };

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
