import * as svc from "./forwarding.service";
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

export async function getDomainFwd(ctx: any) {
  const user = await getUser(ctx);
  const result = await svc.getDomainForwarding(user, user.id, parseInt(ctx.params.id));
  return { data: result };
}

export async function updateDomainFwd(ctx: any) {
  const user = await getUser(ctx);
  const result = await svc.updateDomainForwarding(user, user.id, parseInt(ctx.params.id), ctx.body);
  return { data: result };
}

export async function getEmailFwd(ctx: any) {
  const user = await getUser(ctx);
  const result = await svc.getEmailForwarding(user, user.id, parseInt(ctx.params.id));
  return { data: Array.isArray(result) ? result : [] };
}

export async function createEmailFwd(ctx: any) {
  const user = await getUser(ctx);
  const result = await svc.createEmailForwarding(user, user.id, parseInt(ctx.params.id), ctx.body);
  ctx.set.status = 201;
  return { data: result };
}

export async function deleteEmailFwd(ctx: any) {
  const user = await getUser(ctx);
  await svc.deleteEmailForwarding(user, user.id, parseInt(ctx.params.id), ctx.params.email);
  return new Response(null, { status: 204 });
}

export async function getPrivacy(ctx: any) {
  const user = await getUser(ctx);
  const result = await svc.getPrivacy(user, user.id, parseInt(ctx.params.id));
  return { data: result };
}

export async function enablePrivacy(ctx: any) {
  const user = await getUser(ctx);
  const result = await svc.enablePrivacy(user, user.id, parseInt(ctx.params.id));
  return { data: result };
}

export async function disablePrivacy(ctx: any) {
  const user = await getUser(ctx);
  await svc.disablePrivacy(user, user.id, parseInt(ctx.params.id));
  return new Response(null, { status: 204 });
}

export async function buyPrivacy(ctx: any) {
  const user = await getUser(ctx);
  const result = await svc.buyPrivacy(user, user.id, parseInt(ctx.params.id));
  return { data: result };
}
