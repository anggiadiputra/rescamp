import { customers } from "../../db/schema/customers";
import * as svc from "./domains.service";
import { db } from "../../db";
import { users } from "../../db/schema";
import { eq } from "drizzle-orm";
import { AppError } from "../../lib/error";

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
  if (!userId || isNaN(userId)) {
    const [reseller] = await db.select().from(users).where(eq(users.role, "reseller")).limit(1);
    if (!reseller) throw new AppError("Reseller not configured", 500);
    const creds = await resolveCredsFromUser(reseller);
    if (!creds.apiKey) throw new AppError("Reseller not configured", 500);
    return { id: 0, resellerId: creds.resellerId, apiKey: creds.apiKey, role: "visitor" };
  }
  const u = await getUser(ctx);
  const creds = await resolveResellerCreds(u.id);
  if (!creds.resellerId || !creds.apiKey) throw new AppError("Reseller not configured", 500);
  return { id: u.id, resellerId: creds.resellerId, apiKey: creds.apiKey, role: u.role || "customer" };
}

export async function checkAvailability(ctx: any) {
  const domain = ctx.query.domain || ctx.query.domain_name;
  const tld = ctx.query.tld;
  const fullDomain = domain?.includes(".") ? domain : `${domain}.${tld}`;
  const creds = await getResellerCreds(ctx);
  const result = await svc.checkAvailability(creds, fullDomain);
  return { data: result };
}

export async function suggestions(ctx: any) {
  const { keyword, tld } = ctx.query;
  const creds = await getResellerCreds(ctx);
  const result = await svc.getSuggestions(creds, keyword, tld);
  return { data: result };
}

export async function register(ctx: any) {
  const creds = await getResellerCreds(ctx);
  const u = await getUser(ctx);
  // For customer: auto-resolve their LIQUID customer_id
  if (u.role === "customer" && !ctx.body.customer_id) {
    const cid = await resolveCustomerId(u);
    if (!cid) throw new AppError("Complete your profile first: /complete-profile", 400);
    ctx.body.customer_id = cid;
  }
  const result = await svc.orderRegisterDomain(creds, ctx.body);
  ctx.set.status = 201;
  return { data: result };
}

export async function transfer(ctx: any) {
  const creds = await getResellerCreds(ctx);
  const u = await getUser(ctx);
  if (u.role === "customer" && !ctx.body.customer_id) {
    const cid = await resolveCustomerId(u);
    if (!cid) throw new AppError("Complete your profile first: /complete-profile", 400);
    ctx.body.customer_id = cid;
  }
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
  const { years } = ctx.body;
  const result = await svc.orderRenewDomain(creds as any, user, ctx.params.id, years);
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
  if (!keyword || keyword.includes(".")) return { data: [] };
  const creds = await getResellerCreds(ctx);
  const results = await svc.bulkAvailability(creds, keyword);
  return { data: results };
}

export async function sync(ctx: any) {
  const user = await getUser(ctx);
  const result = await svc.syncDomainsFromLiquid(user);
  return { message: "Berhasil sinkronisasi domain dari Resellercamp", data: result };
}

export async function listRemote(ctx: any) {
  const page = Math.max(1, parseInt(String(ctx.query.page || "1"), 10) || 1);
  const perPage = Math.min(100, Math.max(1, parseInt(String(ctx.query.per_page || "50"), 10) || 50));

  try {
    const u = await getUser(ctx);
    const creds = await getResellerCreds(ctx);

    let customerLiquidId: string | null = null;
    if (u.role === "customer") {
      const [c] = await db
        .select({ liquidCustomerId: customers.liquidCustomerId })
        .from(customers)
        .where(eq(customers.email, u.email));
      customerLiquidId = c?.liquidCustomerId || null;
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
