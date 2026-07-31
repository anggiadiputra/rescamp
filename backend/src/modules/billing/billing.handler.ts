import * as svc from "./billing.service";
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

async function getResellerCreds(ctx: any) {
  const u = await getUser(ctx);
  if (u.role === "customer") {
    let r: any = null;
    if (u.parentResellerId) {
      [r] = await db.select().from(users).where(eq(users.id, u.parentResellerId));
    }
    if (!r) {
      [r] = await db.select().from(users).where(eq(users.role, "reseller")).limit(1);
    }
    if (!r || !r.apiKey) throw new AppError("Reseller not configured", 500);
    return { id: u.id, resellerId: r.resellerId || "", apiKey: r.apiKey, role: u.role };
  }
  if (u.role === "reseller" || u.role === "admin") return { id: u.id, resellerId: u.resellerId || "", apiKey: u.apiKey || "", role: u.role };
  throw new AppError("Invalid user role", 403);
}

export async function balance(ctx: any) {
  const creds = await getResellerCreds(ctx);
  const result = await svc.getBalance(creds);
  return { data: result };
}

export async function prices(ctx: any) {
  const creds = await getResellerCreds(ctx);
  const result = await svc.getPrices(creds);
  return { data: result };
}

export async function transactions(ctx: any) {
  const user = await getUser(ctx);
  const result = await svc.listTransactions(user, ctx.query);
  return result;
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
