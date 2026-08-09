import * as svc from "./billing.service";
import { db } from "../../db";
import { users } from "../../db/schema";
import { eq } from "drizzle-orm";
import { AppError } from "../../lib/error";
import { resolveResellerCreds } from "../../lib/reseller-creds";

async function getUser(ctx: any) {
  const userId = Number(ctx.store?.user?.sub);
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) throw new AppError("User not found", 404);
  return user;
}

async function getResellerCreds(ctx: any) {
  const u = await getUser(ctx);
  const creds = await resolveResellerCreds(u.id);
  return { id: u.id, resellerId: creds.resellerId || "", apiKey: creds.apiKey || "", role: u.role };
}

export async function balance(ctx: any) {
  try {
    const creds = await getResellerCreds(ctx);
    const result = await svc.getBalance(creds);
    return { data: result };
  } catch (err: any) {
    console.warn("[billing.handler] balance error fallback:", err?.message || err);
    return { data: { balance: "0.00", currency: "IDR" } };
  }
}

export async function prices(ctx: any) {
  try {
    const creds = await getResellerCreds(ctx);
    const result = await svc.getPrices(creds);
    return { data: result };
  } catch (err: any) {
    console.warn("[billing.handler] prices error fallback:", err?.message || err);
    return { data: {} };
  }
}

export async function transactions(ctx: any) {
  const user = await getUser(ctx);
  const result = await svc.listTransactions(user, ctx.query);
  return result;
}

export async function listTransactionsRemote(ctx: any) {
  const creds = await getResellerCreds(ctx);
  const page = Math.max(1, parseInt(String(ctx.query.page || "1"), 10) || 1);
  const perPage = Math.min(100, Math.max(1, parseInt(String(ctx.query.per_page || "50"), 10) || 50));
  const result = await svc.listTransactionsFromLiquid(creds, page, perPage);
  ctx.set.status = 200;
  return {
    data: result.items,
    meta: { total: result.total, page, perPage, reachedEnd: result.reachedEnd },
    source: "liquid",
  };
}

export async function transactionDetail(ctx: any) {
  const user = await getUser(ctx);
  const txn = await svc.getTransaction(user, parseInt(ctx.params.id));
  return { data: txn };
}

export async function sync(ctx: any) {
  const user = await getUser(ctx);
  const creds = await getResellerCreds(ctx);
  const result = await svc.syncTransactions({ id: creds.id, role: creds.role, resellerId: creds.resellerId, apiKey: creds.apiKey });
  return { data: result };
}
