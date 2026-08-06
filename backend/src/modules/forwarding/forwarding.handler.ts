import * as svc from "./forwarding.service";
import * as domainsSvc from "../domains/domains.service";
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
    if (u.parentResellerId) [r] = await db.select().from(users).where(eq(users.id, u.parentResellerId));
    if (!r) [r] = await db.select().from(users).where(eq(users.role, "reseller")).limit(1);
    if (!r || !r.apiKey) throw new AppError("Reseller not configured", 500);
    return { user: u, creds: { resellerId: r.resellerId || "", apiKey: r.apiKey } };
  }
  return { user: u, creds: { resellerId: u.resellerId || "", apiKey: u.apiKey || "" } };
}

export async function getDomainFwd(ctx: any) {
  const { user, creds } = await getResellerCreds(ctx);
  const result = await svc.getDomainForwarding(creds, user.id, parseInt(ctx.params.id));
  return { data: result };
}

export async function updateDomainFwd(ctx: any) {
  const { user, creds } = await getResellerCreds(ctx);
  const result = await svc.updateDomainForwarding(creds, user.id, parseInt(ctx.params.id), ctx.body);
  return { data: result };
}

export async function getEmailFwd(ctx: any) {
  const { user, creds } = await getResellerCreds(ctx);
  const result = await svc.getEmailForwarding(creds, user.id, parseInt(ctx.params.id));
  return { data: Array.isArray(result) ? result : [] };
}

export async function createEmailFwd(ctx: any) {
  const { user, creds } = await getResellerCreds(ctx);
  const result = await svc.createEmailForwarding(creds, user.id, parseInt(ctx.params.id), ctx.body);
  ctx.set.status = 201;
  return { data: result };
}

export async function deleteEmailFwd(ctx: any) {
  const { user, creds } = await getResellerCreds(ctx);
  await svc.deleteEmailForwarding(creds, user.id, parseInt(ctx.params.id), ctx.params.email);
  return new Response(null, { status: 204 });
}

export async function getPrivacy(ctx: any) {
  const { user, creds } = await getResellerCreds(ctx);
  const result = await svc.getPrivacy(creds, user.id, parseInt(ctx.params.id));
  return { data: result };
}

export async function enablePrivacy(ctx: any) {
  const { user, creds } = await getResellerCreds(ctx);
  const result = await svc.enablePrivacy(creds, user.id, parseInt(ctx.params.id));
  return { data: result };
}

export async function disablePrivacy(ctx: any) {
  const { user, creds } = await getResellerCreds(ctx);
  await svc.disablePrivacy(creds, user.id, parseInt(ctx.params.id));
  return new Response(null, { status: 204 });
}

export async function buyPrivacy(ctx: any) {
  const { user, creds } = await getResellerCreds(ctx);
  // Create a Sumopod payment link instead of charging reseller balance directly.
  // On payment completion (webhook), svc.buyPrivacy is invoked to actually
  // purchase privacy on Resellercamp and flip the local flag.
  const result = await domainsSvc.orderBuyPrivacy(creds as any, user.id, parseInt(ctx.params.id));
  return { data: result };
}
