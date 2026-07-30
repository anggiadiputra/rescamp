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

// For customer or public visitor: resolve the reseller's API credentials
async function getResellerCreds(ctx: any) {
  const userId = Number(ctx.store?.user?.sub);
  if (!userId || isNaN(userId)) {
    const [reseller] = await db.select().from(users).where(eq(users.role, "reseller")).limit(1);
    if (!reseller || !reseller.apiKey) throw new AppError("Reseller not configured", 500);
    return { id: 0, resellerId: reseller.resellerId || "", apiKey: reseller.apiKey, role: "visitor" };
  }
  const u = await getUser(ctx);
  if (u.role === "customer") {
    let reseller: any = null;
    if (u.parentResellerId) {
      [reseller] = await db.select().from(users).where(eq(users.id, u.parentResellerId));
    }
    if (!reseller) {
      [reseller] = await db.select().from(users).where(eq(users.role, "reseller")).limit(1);
    }
    if (!reseller || !reseller.apiKey) throw new AppError("Reseller not configured", 500);
    return { id: u.id, resellerId: reseller.resellerId || "", apiKey: reseller.apiKey, role: u.role };
  }
  if (u.role === "reseller" || u.role === "admin") {
    return { id: u.id, resellerId: u.resellerId || "", apiKey: u.apiKey || "", role: u.role };
  }
  throw new AppError("Invalid user role", 403);
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
  const domain = await svc.getDomain(user, parseInt(ctx.params.id));
  return { data: domain };
}

export async function renew(ctx: any) {
  const user = await getUser(ctx);
  const creds = user.role === "customer" ? await getResellerCreds(ctx) : user;
  const { years } = ctx.body;
  const result = await svc.orderRenewDomain(creds as any, user.id, parseInt(ctx.params.id), years);
  return { data: result };
}

export async function lock(ctx: any) {
  const user = await getUser(ctx);
  const creds = user.role === "customer" ? await getResellerCreds(ctx) : user;
  await svc.updateLock(creds as any, user.id, parseInt(ctx.params.id), true);
  return new Response(null, { status: 204 });
}
export async function unlock(ctx: any) {
  const user = await getUser(ctx);
  const creds = user.role === "customer" ? await getResellerCreds(ctx) : user;
  await svc.updateLock(creds as any, user.id, parseInt(ctx.params.id), false);
  return new Response(null, { status: 204 });
}

export async function updateNs(ctx: any) {
  const user = await getUser(ctx);
  const creds = user.role === "customer" ? await getResellerCreds(ctx) : user;
  const { nameservers } = ctx.body;
  const result = await svc.updateNameservers(creds as any, user.id, parseInt(ctx.params.id), nameservers);
  return { data: result };
}

export async function getNs(ctx: any) {
  const user = await getUser(ctx);
  const domain = await svc.getDomain(user, parseInt(ctx.params.id));
  return { data: { domain_id: domain.id, nameservers: domain.nameservers || [] } };
}

export async function getAuth(ctx: any) {
  const user = await getUser(ctx);
  const creds = user.role === "customer" ? await getResellerCreds(ctx) : user;
  const result = await svc.getAuthCode(creds as any, user.id, parseInt(ctx.params.id));
  return { data: result };
}

export async function updateAuth(ctx: any) {
  const user = await getUser(ctx);
  const creds = user.role === "customer" ? await getResellerCreds(ctx) : user;
  const { auth_code } = ctx.body;
  const result = await svc.updateAuthCode(creds as any, user.id, parseInt(ctx.params.id), auth_code);
  return { data: result };
}

export async function enableTheft(ctx: any) { const u = await getUser(ctx); await svc.toggleTheftProtection(await getResellerCreds(ctx), u.id, parseInt(ctx.params.id), true); return new Response(null, { status: 204 }); }
export async function disableTheft(ctx: any) { const u = await getUser(ctx); await svc.toggleTheftProtection(await getResellerCreds(ctx), u.id, parseInt(ctx.params.id), false); return new Response(null, { status: 204 }); }

export async function restore(ctx: any) {
  const user = await getUser(ctx);
  const creds = await getResellerCreds(ctx);
  const result = await svc.restoreDomain(creds, user.id, parseInt(ctx.params.id));
  return { data: result };
}

export async function suspend(ctx: any) { const u = await getUser(ctx); await svc.toggleSuspend(await getResellerCreds(ctx), u.id, parseInt(ctx.params.id), true); return new Response(null, { status: 204 }); }
export async function unsuspend(ctx: any) { const u = await getUser(ctx); await svc.toggleSuspend(await getResellerCreds(ctx), u.id, parseInt(ctx.params.id), false); return new Response(null, { status: 204 }); }

export async function remove(ctx: any) {
  const user = await getUser(ctx);
  await svc.deleteDomainRecord(user.id, parseInt(ctx.params.id));
  return new Response(null, { status: 204 });
}

// For customer: auto-resolve their LIQUID customer_id
async function resolveCustomerId(u: any): Promise<number | undefined> {
  if (u.role !== "customer") return undefined;
  const [cust] = await db.select({ id: customers.id, liquidCustomerId: customers.liquidCustomerId })
    .from(customers).where(eq(customers.email, u.email));
  return cust?.id;
}

export async function bulkAvailability(ctx: any) {
  const { keyword } = ctx.query;
  if (!keyword || keyword.includes(".")) return ctx.json({ data: [] });
  const creds = await getResellerCreds(ctx);
  const results = await svc.bulkAvailability(creds, keyword);
  return { data: results };
}
