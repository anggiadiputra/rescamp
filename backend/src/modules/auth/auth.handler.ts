import * as svc from "./auth.service";
import type { JwtPayload } from "../../lib/jwt";

export async function register(ctx: any) {
  const result = await svc.register(ctx.body);
  ctx.set.status = 201;
  return { data: result };
}

export async function registerCustomer(ctx: any) {
  const result = await svc.register({ ...ctx.body, api_key: undefined });
  ctx.set.status = 201;
  return { data: result };
}

export async function login(ctx: any) {
  const result = await svc.login(ctx.body);
  return { data: result };
}

export async function me(ctx: any) {
  const result = await svc.me(Number(ctx.store.user?.sub));
  return { data: result };
}

export async function getProfile(ctx: any) {
  const userId = Number(ctx.store.user?.sub);
  const result = await svc.getProfile(userId);
  return { data: result };
}

export async function updateProfile(ctx: any) {
  const userId = Number(ctx.store.user?.sub);
  const result = await svc.updateProfile(userId, ctx.body);
  return { data: result, message: "Profile updated successfully" };
}
