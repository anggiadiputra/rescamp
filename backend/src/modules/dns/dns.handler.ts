import * as svc from "./dns.service";
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

export async function list(ctx: any) {
  const user = await getUser(ctx);
  const records = await svc.listRecords(user, user.id, parseInt(ctx.params.id), ctx.params.type);
  return { data: records };
}

export async function add(ctx: any) {
  const user = await getUser(ctx);
  const record = await svc.addRecord(user, user.id, parseInt(ctx.params.id), ctx.params.type, ctx.body);
  ctx.set.status = 201;
  return { data: record };
}

export async function update(ctx: any) {
  const user = await getUser(ctx);
  const record = await svc.updateRecord(
    user, user.id, parseInt(ctx.params.id), ctx.params.type,
    ctx.params.oldHost, ctx.params.oldValue, ctx.body,
  );
  return { data: record };
}

export async function remove(ctx: any) {
  const user = await getUser(ctx);
  await svc.deleteRecord(user, user.id, parseInt(ctx.params.id), ctx.params.type, ctx.params.hostname, ctx.params.value);
  return new Response(null, { status: 204 });
}
