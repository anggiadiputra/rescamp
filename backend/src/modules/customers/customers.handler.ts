import * as svc from "./customers.service";
import { db } from "../../db";
import { users } from "../../db/schema";
import { eq } from "drizzle-orm";
import { AppError } from "../../lib/error";
import { verifyTurnstileToken } from "../../lib/turnstile";

async function getUser(ctx: any) {
  const userId = Number(ctx.store?.user?.sub);
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) throw new AppError("User not found", 404);
  return user;
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
  const { search } = ctx.query;
  const rows = await svc.listCustomers(user.id, search);
  return { data: rows, meta: { total: rows.length, page: 1, perPage: rows.length } };
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
