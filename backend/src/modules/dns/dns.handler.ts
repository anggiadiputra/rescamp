import * as svc from "./dns.service";
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
  if (!creds.resellerId || !creds.apiKey) throw new AppError("Reseller not configured", 500);
  return { user: u, creds };
}

export async function list(ctx: any) {
  const { user, creds } = await getResellerCreds(ctx);
  const records = await svc.listRecords(creds, user, ctx.params.id, ctx.params.type);
  return { data: records };
}

export async function add(ctx: any) {
  const { user, creds } = await getResellerCreds(ctx);
  const record = await svc.addRecord(creds, user, ctx.params.id, ctx.params.type, ctx.body);
  ctx.set.status = 201;
  return { data: record };
}

export async function update(ctx: any) {
  const { user, creds } = await getResellerCreds(ctx);
  const record = await svc.updateRecord(
    creds, user, ctx.params.id, ctx.params.type,
    ctx.params.oldHost, ctx.params.oldValue, ctx.body,
  );
  return { data: record };
}

export async function remove(ctx: any) {
  const { user, creds } = await getResellerCreds(ctx);
  await svc.deleteRecord(creds, user, ctx.params.id, ctx.params.type, ctx.params.hostname, ctx.params.value);
  return new Response(null, { status: 204 });
}

