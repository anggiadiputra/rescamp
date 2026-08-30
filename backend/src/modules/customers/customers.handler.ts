import * as svc from "./customers.service";
import { db } from "../../db";
import { users } from "../../db/schema";
import { customers } from "../../db/schema/customers";
import { eq } from "drizzle-orm";
import { AppError } from "../../lib/error";
import { verifyTurnstileToken } from "../../lib/turnstile";
import { resolveResellerCreds } from "../../lib/reseller-creds";

async function getUser(ctx: any) {
  const userId = Number(ctx.store?.user?.sub);
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) throw new AppError("User not found", 404);
  return user;
}

// Resolve Resellercamp credentials for the calling user.
async function getResellerCreds(ctx: any): Promise<{ resellerId: string; apiKey: string }> {
  const u = await getUser(ctx);
  const creds = await resolveResellerCreds(u.id);
  if (!creds.resellerId || !creds.apiKey) throw new AppError("Reseller credentials not configured", 500);
  return creds;
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
  return svc.listCustomers(user, search, Number(page) || 1, Number(per_page) || 20);
}

export async function detail(ctx: any) {
  const user = await getUser(ctx);
  const cust = await svc.getCustomer(user, parseInt(ctx.params.id));
  return { data: cust };
}

export async function update(ctx: any) {
  const user = await getUser(ctx);
  const creds = await getResellerCreds(ctx);
  const cust = await svc.updateCustomer(creds, user, parseInt(ctx.params.id), ctx.body);
  return { data: cust };
}

export async function remove(ctx: any) {
  const user = await getUser(ctx);
  const creds = await getResellerCreds(ctx);
  await svc.deleteCustomer(creds, user, parseInt(ctx.params.id));
  return new Response(null, { status: 204 });
}

export async function completeProfile(ctx: any) {
  const u = await getUser(ctx);
  const cust = await svc.completeProfile(u, ctx.body);
  ctx.set.status = 201;
  return { data: cust };
}

export async function listRemote(ctx: any) {
  const u = await getUser(ctx);
  const creds = await getResellerCreds(ctx);

  let customerLiquidId: string | null = null;
  if (u.role === "customer") {
    ctx.set.status = 200;
    return {
      data: [],
      meta: { total: 0, page: 1, perPage: 20, reachedEnd: true },
      source: "liquid",
    };
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

export async function sync(ctx: any) {
  try {
    const userId = Number(ctx.store?.user?.sub);
    console.log(`[customers.handler] 🚀 Starting customer sync for userId=${userId}...`);
    const result = await svc.syncCustomersFromLiquid(userId);
    console.log(`[customers.handler] ✅ Customer sync completed:`, result);
    const message = `Berhasil sinkronisasi ${result.syncedCount} customer (${result.newAddedCount} baru) dari Resellercamp`;
    ctx.set.status = 200;
    return {
      message,
      data: { ...result, message },
    };
  } catch (err: any) {
    console.error("[customers.handler] ❌ Sync error:", err?.message || err);
    ctx.set.status = err?.statusCode || 400;
    const message = err?.message || "Gagal sinkronisasi data customer dari Resellercamp";
    return {
      message,
      data: { syncedCount: 0, newAddedCount: 0, total: 0, message, error: message },
    };
  }
}
