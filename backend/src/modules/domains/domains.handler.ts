import { customers } from "../../db/schema/customers";
import * as svc from "./domains.service";
import { db } from "../../db";
import { users } from "../../db/schema";
import { eq, or } from "drizzle-orm";
import { AppError } from "../../lib/error";
import { resolveOrderCustomerId } from "../../lib/tenant-access";

async function getUser(ctx: any) {
  const userId = Number(ctx.store?.user?.sub);
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) throw new AppError("User not found", 404);
  return user;
}

import { resolveResellerCreds, resolveCredsFromUser } from "../../lib/reseller-creds";

// For customer or public visitor: resolve the reseller's API credentials
async function getResellerCreds(ctx: any) {
  const userId = Number(ctx.store?.user?.sub);
  if (userId && !isNaN(userId)) {
    try {
      const u = await getUser(ctx);
      const creds = await resolveResellerCreds(u.id);
      if (creds.resellerId && creds.apiKey) {
        return { id: u.id, resellerId: creds.resellerId, apiKey: creds.apiKey, role: u.role || "customer" };
      }
    } catch (e: any) {
      console.warn("[getResellerCreds] resolveResellerCreds for logged in user failed, falling back to master:", e?.message);
    }
  }

  // Visitor or fallback to master reseller
  try {
    const creds = await resolveResellerCreds(0);
    return { id: 0, resellerId: creds.resellerId || "", apiKey: creds.apiKey || "", role: "visitor" };
  } catch (e: any) {
    console.warn("[getResellerCreds] Master creds resolution warning (using DNS/default pricing fallback):", e?.message);
    return { id: 0, resellerId: "", apiKey: "", role: "visitor" };
  }
}

export async function checkAvailability(ctx: any) {
  const domain = ctx.query.domain || ctx.query.domain_name;
  const tld = ctx.query.tld;
  const fullDomain = domain?.includes(".") ? domain : `${domain}.${tld}`;
  try {
    const creds = await getResellerCreds(ctx);
    const result = await svc.checkAvailability(creds, fullDomain);
    return { data: result };
  } catch (err: any) {
    console.warn("[checkAvailability] Handler warning/fallback:", err?.message || err);
    return { data: null, error: err?.message || "Gagal memeriksa ketersediaan domain" };
  }
}

export async function suggestions(ctx: any) {
  const { keyword, tld } = ctx.query;
  try {
    const creds = await getResellerCreds(ctx);
    const result = await svc.getSuggestions(creds, keyword, tld);
    return { data: result };
  } catch (err: any) {
    console.warn("[suggestions] Handler warning/fallback:", err?.message || err);
    return { data: [] };
  }
}

export async function register(ctx: any) {
  const creds = await getResellerCreds(ctx);
  const u = await getUser(ctx);
  const ownCustomerId = u.role === "customer" ? await resolveCustomerId(u) : undefined;
  ctx.body.customer_id = resolveOrderCustomerId(u.role, ctx.body.customer_id, ownCustomerId);
  const result = await svc.orderRegisterDomain(creds, ctx.body);
  ctx.set.status = 201;
  return { data: result };
}

export async function transfer(ctx: any) {
  const creds = await getResellerCreds(ctx);
  const u = await getUser(ctx);
  const ownCustomerId = u.role === "customer" ? await resolveCustomerId(u) : undefined;
  ctx.body.customer_id = resolveOrderCustomerId(u.role, ctx.body.customer_id, ownCustomerId);
  const result = await svc.orderTransferDomain(creds, ctx.body);
  ctx.set.status = 201;
  return { data: result };
}

export async function list(ctx: any) {
  const user = await getUser(ctx);
  const result = await svc.listDomains(user, ctx.query);
  return result;
}

export async function detail(ctx: any) {
  const user = await getUser(ctx);
  const domain = await svc.getDomain(user, ctx.params.id);
  return { data: domain };
}

export async function renew(ctx: any) {
  const user = await getUser(ctx);
  const creds = user.role === "customer" ? await getResellerCreds(ctx) : user;
  const years = Number(ctx.body?.years || 1);
  const purchasePrivacyProtection = Boolean(ctx.body?.purchase_privacy_protection ?? ctx.body?.privacy_protection);
  const result = await svc.orderRenewDomain(creds as any, user, ctx.params.id, years, { purchasePrivacyProtection });
  return { data: result };
}

export async function buyPrivacy(ctx: any) {
  const user = await getUser(ctx);
  const creds = user.role === "customer" ? await getResellerCreds(ctx) : user;
  const result = await svc.orderBuyPrivacy(creds as any, user, ctx.params.id);
  return { data: result };
}

export async function lock(ctx: any) {
  const user = await getUser(ctx);
  const creds = user.role === "customer" ? await getResellerCreds(ctx) : user;
  const result = await svc.updateLock(creds as any, user, ctx.params.id, true);
  return { success: true, locked: 1, message: "Domain locked successfully", data: result };
}
export async function unlock(ctx: any) {
  const user = await getUser(ctx);
  const creds = user.role === "customer" ? await getResellerCreds(ctx) : user;
  const result = await svc.updateLock(creds as any, user, ctx.params.id, false);
  return { success: true, locked: 0, message: "Domain unlocked successfully", data: result };
}

export async function updateNs(ctx: any) {
  const user = await getUser(ctx);
  const creds = user.role === "customer" ? await getResellerCreds(ctx) : user;
  const { nameservers } = ctx.body;
  const result = await svc.updateNameservers(creds as any, user, ctx.params.id, nameservers);
  return { data: result };
}

export async function getNs(ctx: any) {
  const user = await getUser(ctx);
  const domain = await svc.getDomain(user, ctx.params.id);
  return { data: { domain_id: domain.id, nameservers: domain.nameservers || [] } };
}

export async function getAuth(ctx: any) {
  const user = await getUser(ctx);
  const creds = user.role === "customer" ? await getResellerCreds(ctx) : user;
  const result = await svc.getAuthCode(creds as any, user, ctx.params.id);
  return { data: result };
}

export async function updateAuth(ctx: any) {
  const user = await getUser(ctx);
  const creds = user.role === "customer" ? await getResellerCreds(ctx) : user;
  const { auth_code } = ctx.body;
  const result = await svc.updateAuthCode(creds as any, user, ctx.params.id, auth_code);
  return { data: result };
}

export async function enableTheft(ctx: any) {
  const u = await getUser(ctx);
  const result = await svc.toggleTheftProtection(await getResellerCreds(ctx), u, ctx.params.id, true);
  return { success: true, theftProtection: 1, message: "Theft protection enabled successfully", data: result };
}
export async function disableTheft(ctx: any) {
  const u = await getUser(ctx);
  const result = await svc.toggleTheftProtection(await getResellerCreds(ctx), u, ctx.params.id, false);
  return { success: true, theftProtection: 0, message: "Theft protection disabled successfully", data: result };
}

export async function restore(ctx: any) {
  const user = await getUser(ctx);
  const creds = await getResellerCreds(ctx);
  const result = await svc.restoreDomain(creds, user, ctx.params.id);
  return { data: result };
}

export async function suspend(ctx: any) {
  const u = await getUser(ctx);
  const reason = String(ctx.body?.reason || "").trim();
  if (reason.length < 5) {
    throw new AppError("Reason is required (min 5 chars)", 400);
  }
  const result = await svc.toggleSuspend(await getResellerCreds(ctx), u, ctx.params.id, true, reason);
  ctx.set.status = 200;
  return { data: result };
}
export async function unsuspend(ctx: any) {
  const u = await getUser(ctx);
  await svc.toggleSuspend(await getResellerCreds(ctx), u, ctx.params.id, false);
  ctx.set.status = 204;
  return;
}

export async function remove(ctx: any) {
  const user = await getUser(ctx);
  await svc.deleteDomainRecord(user, ctx.params.id);
  ctx.set.status = 204;
  return;
}

export async function resendRaa(ctx: any) {
  const user = await getUser(ctx);
  const creds = user.role === "customer" ? await getResellerCreds(ctx) : user;
  const result = await svc.resendRaaVerification(creds as any, user, ctx.params.id);
  return { message: "Email verifikasi RAA berhasil dikirim ulang", data: result };
}

// For customer: auto-resolve or auto-create their LIQUID customer_id
async function resolveCustomerId(u: any): Promise<number | undefined> {
  if (u.role !== "customer") return undefined;
  let [cust] = await db.select({
    id: customers.id,
    liquidCustomerId: customers.liquidCustomerId,
    company: customers.company,
    address: customers.address,
    city: customers.city,
    state: customers.state,
    zipcode: customers.zipcode,
    phone: customers.phone,
  }).from(customers).where(eq(customers.email, u.email));

  if (!cust) {
    // Auto-create local customer profile if missing — but require complete profile first
    const [res] = await db.insert(customers).values({
      userId: u.id,
      name: u.name || u.email.split("@")[0],
      email: u.email,
      country: "ID",
    });
    const newId = Number(res.insertId);
    // Redirect user to complete profile before allowing domain orders
    throw new AppError("Profile belum lengkap. Harap lengkapi profil Anda terlebih dahulu.", 400);
  }
  
  // Check if profile is complete (company, address, city, state, zipcode, phone must be filled)
  if (!cust.company || !cust.address || !cust.city || !cust.state || !cust.zipcode || !cust.phone) {
    throw new AppError("Profile belum lengkap. Harap lengkapi profil Anda terlebih dahulu.", 400);
  }
  
  return cust.id;
}

export async function bulkAvailability(ctx: any) {
  const { keyword } = ctx.query;
  if (!keyword || typeof keyword !== "string" || !keyword.trim()) return { data: [] };
  try {
    const creds = await getResellerCreds(ctx);
    const results = await svc.bulkAvailability(creds, keyword.trim());
    return { data: results };
  } catch (err: any) {
    console.warn("[bulkAvailability] Handler warning/fallback:", err?.message || err);
    return { data: [], error: err?.message || "Gagal memeriksa ketersediaan domain" };
  }
}

export async function sync(ctx: any) {
  try {
    const user = await getUser(ctx);
    console.log(`[domains.handler] 🚀 Starting domain sync for userId=${user?.id}...`);
    const result = await svc.syncDomainsFromLiquid(user);
    console.log(`[domains.handler] ✅ Domain sync completed:`, result);
    const message = `Berhasil sinkronisasi ${result.syncedCount} domain (${result.newAddedCount} baru) dari Resellercamp`;
    return {
      message,
      data: { ...result, message },
    };
  } catch (err: any) {
    console.error("[domains.handler] ❌ Sync error:", err?.message || err);
    ctx.set.status = err?.statusCode || 400;
    const message = err?.message || "Gagal sinkronisasi data domain dari Resellercamp";
    return {
      message,
      data: { syncedCount: 0, newAddedCount: 0, total: 0, message, error: message },
    };
  }
}

export async function listRemote(ctx: any) {
  const page = Math.max(1, parseInt(String(ctx.query.page || "1"), 10) || 1);
  const perPage = Math.min(100, Math.max(1, parseInt(String(ctx.query.per_page || "50"), 10) || 50));

  try {
    const u = await getUser(ctx);
    const creds = await getResellerCreds(ctx);

    let customerLiquidId: string | null = null;
    if (u.role === "customer") {
      const cleanEmail = (u.email || "").trim().toLowerCase();
      const [c] = await db
        .select({ liquidCustomerId: customers.liquidCustomerId })
        .from(customers)
        .where(
          or(
            eq(customers.userId, u.id),
            eq(customers.email, u.email),
            eq(customers.email, cleanEmail)
          )
        );
      customerLiquidId = c?.liquidCustomerId || null;
      if (!customerLiquidId) {
        ctx.set.status = 200;
        return {
          data: [],
          meta: { total: 0, page, perPage, reachedEnd: true },
          source: "liquid",
        };
      }
    }

    const result = await svc.listDomainsFromLiquid(creds, customerLiquidId, page, perPage);
    ctx.set.status = 200;
    return {
      data: result.items || [],
      meta: { total: result.total || 0, page, perPage, reachedEnd: result.reachedEnd ?? true },
      source: "liquid",
    };
  } catch (err: any) {
    console.warn("[domains.handler] listRemote error fallback:", err?.message || err);
    ctx.set.status = 200;
    return {
      data: [],
      meta: { total: 0, page, perPage, reachedEnd: true },
      source: "liquid",
      error: err?.message || "Gagal memuat domain dari Resellercamp API",
    };
  }
}

export async function verifyContactPublic(ctx: any) {
  const body = ctx.body || {};
  const { param1, param2, param3 } = body;

  function safeDecode(str: string): string {
    if (!str) return "";
    try {
      const decoded = Buffer.from(str, "base64").toString("utf-8");
      if (/^[\w\.\-@+]+$/.test(decoded)) {
        return decoded;
      }
    } catch {}
    return str;
  }

  const dec1 = safeDecode(param1 || "");
  const dec2 = safeDecode(param2 || "");
  const dec3 = safeDecode(param3 || "");

  let customerId = "";
  let contactId = "";
  let email = "";

  for (const item of [dec1, dec2, dec3]) {
    if (item.includes("@")) {
      email = item;
    } else if (!customerId && /^\d+$/.test(item)) {
      customerId = item;
    } else if (!contactId && /^\d+$/.test(item)) {
      contactId = item;
    }
  }

  const result = await svc.verifyContactPublicService({ customerId, contactId, email, rawParams: { param1, param2, param3 } });
  ctx.set.status = 200;
  return {
    message: "Verifikasi email kontak berhasil dikonfirmasi",
    data: {
      success: true,
      customerId,
      contactId,
      ...result,
    },
  };
}
