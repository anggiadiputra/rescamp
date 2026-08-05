import * as svc from "./customers.service";
import { db } from "../../db";
import { users } from "../../db/schema";
import { customers } from "../../db/schema/customers";
import { eq } from "drizzle-orm";
import { AppError } from "../../lib/error";
import { verifyTurnstileToken } from "../../lib/turnstile";

async function getUser(ctx: any) {
  const userId = Number(ctx.store?.user?.sub);
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) throw new AppError("User not found", 404);
  return user;
}

// Resolve Resellercamp credentials for the calling user.
async function getResellerCreds(ctx: any): Promise<{ resellerId: string; apiKey: string }> {
  const u = await getUser(ctx);
  if (u.role === "customer") {
    if (u.parentResellerId) {
      const [reseller] = await db.select().from(users).where(eq(users.id, u.parentResellerId));
      if (reseller?.apiKey && reseller.resellerId)
        return { resellerId: reseller.resellerId, apiKey: reseller.apiKey };
    }
    const [defaultReseller] = await db.select().from(users).where(eq(users.role, "reseller")).limit(1);
    if (defaultReseller?.apiKey && defaultReseller.resellerId)
      return { resellerId: defaultReseller.resellerId, apiKey: defaultReseller.apiKey };
    throw new AppError("Reseller credentials not configured", 500);
  }
  if (u.apiKey && u.resellerId) return { resellerId: u.resellerId, apiKey: u.apiKey };
  const [defaultReseller] = await db.select().from(users).where(eq(users.role, "reseller")).limit(1);
  if (defaultReseller?.apiKey && defaultReseller.resellerId)
    return { resellerId: defaultReseller.resellerId, apiKey: defaultReseller.apiKey };
  throw new AppError("Reseller credentials not configured", 500);
}

export async function create(ctx: any) {
  await verifyTurnstileToken(ctx.body?.cfTurnstileResponse || ctx.headers?.["cf-turnstile-response"]);
  const user = await getUser(ctx);
  const cust = await svc.createCustomer(user, ctx.body);
  ctx.set.status = 201;
  return { data: cust };
}

export async function list(ctx: any) {
  const user = await getUser(ctx);
  const { search, page, per_page } = ctx.query;
  return svc.listCustomers(user.id, search, Number(page) || 1, Number(per_page) || 20);
}

export async function detail(ctx: any) {
  const user = await getUser(ctx);
  const cust = await svc.getCustomer(user.id, parseInt(ctx.params.id));
  return { data: cust };
}

export async function update(ctx: any) {
  const user = await getUser(ctx);
  const creds = { resellerId: user.resellerId, apiKey: user.apiKey };
  const cust = await svc.updateCustomer(creds, user.id, parseInt(ctx.params.id), ctx.body);
  return { data: cust };
}

export async function remove(ctx: any) {
  const user = await getUser(ctx);
  const creds = { resellerId: user.resellerId, apiKey: user.apiKey };
  await svc.deleteCustomer(creds, user.id, parseInt(ctx.params.id));
  return new Response(null, { status: 204 });
}

export async function completeProfile(ctx: any) {
  const u = await getUser(ctx);
  const cust = await svc.completeProfile(u, ctx.body);
  ctx.set.status = 201;
  return { data: cust };
}

export async function sync(ctx: any) {
  const user = await getUser(ctx);
  const result = await svc.syncFromLiquid(
    { resellerId: user.resellerId, apiKey: user.apiKey },
    user.id
  );
  return { data: result };
}

export async function listRemote(ctx: any) {
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

  const page = Math.max(1, parseInt(String(ctx.query.page || "1"), 10) || 1);
  const perPage = Math.min(100, Math.max(1, parseInt(String(ctx.query.per_page || "50"), 10) || 50));

  const result = await svc.listCustomersFromLiquid(creds, customerLiquidId, page, perPage);
  ctx.set.status = 200;
  return {
    data: result.items,
    meta: { total: result.total, page, perPage, reachedEnd: result.reachedEnd },
    source: "liquid",
  };
}
