import { LiquidClient } from "../../lib/liquid";
import { AppError } from "../../lib/error";
import { db } from "../../db";
import { domains } from "../../db/schema";
import { eq, and, or } from "drizzle-orm";

function getLiquid(user: { resellerId: string | null; apiKey: string | null }): LiquidClient {
  return new LiquidClient(user.resellerId || "", user.apiKey || "");
}

async function getDomain(userId: number, domainId: number) {
  const [domain] = await db.select().from(domains).where(and(
    or(eq(domains.id, domainId), eq(domains.liquidOrderId, String(domainId))),
    eq(domains.userId, userId),
  ));
  if (!domain) throw new AppError("Domain not found", 404);
  return domain;
}

function assertNotSuspended(domain: { status: string | null }) {
  if (domain.status === "suspended") {
    throw new AppError(
      "Domain sedang di-suspend. Unsuspend terlebih dahulu untuk melakukan konfigurasi.",
      409,
    );
  }
}

// Domain forwarding
export async function getDomainForwarding(user: { resellerId: string | null; apiKey: string | null }, userId: number, domainId: number) {
  const domain = await getDomain(userId, domainId);
  return getLiquid(user).getDomainForwarding(String(domain.liquidOrderId || domain.domainName));
}

export async function updateDomainForwarding(user: { resellerId: string | null; apiKey: string | null }, userId: number, domainId: number, data: { destination_url: string; enabled: boolean }) {
  const domain = await getDomain(userId, domainId);
  assertNotSuspended(domain);
  return getLiquid(user).updateDomainForwarding(String(domain.liquidOrderId || domain.domainName), data);
}

// Email forwarding
export async function getEmailForwarding(user: { resellerId: string | null; apiKey: string | null }, userId: number, domainId: number) {
  const domain = await getDomain(userId, domainId);
  return getLiquid(user).getEmailForwarding(String(domain.liquidOrderId || domain.domainName));
}

export async function createEmailForwarding(user: { resellerId: string | null; apiKey: string | null }, userId: number, domainId: number, data: { email: string; forward_to: string }) {
  const domain = await getDomain(userId, domainId);
  assertNotSuspended(domain);
  return getLiquid(user).createEmailForwarding(String(domain.liquidOrderId || domain.domainName), data);
}

export async function deleteEmailForwarding(user: { resellerId: string | null; apiKey: string | null }, userId: number, domainId: number, email: string) {
  const domain = await getDomain(userId, domainId);
  assertNotSuspended(domain);
  return getLiquid(user).deleteEmailForwarding(String(domain.liquidOrderId || domain.domainName), email);
}

// Privacy
export async function getPrivacy(user: { resellerId: string | null; apiKey: string | null }, userId: number, domainId: number) {
  const domain = await getDomain(userId, domainId);
  return getLiquid(user).getPrivacyProtection(String(domain.liquidOrderId || domain.domainName));
}

export async function enablePrivacy(user: { resellerId: string | null; apiKey: string | null }, userId: number, domainId: number) {
  const domain = await getDomain(userId, domainId);
  assertNotSuspended(domain);
  const res = await getLiquid(user).enablePrivacyProtection(String(domain.liquidOrderId || domain.domainName));
  await db.update(domains).set({ privacyProtection: 1 }).where(eq(domains.id, domainId));
  return res;
}

export async function disablePrivacy(user: { resellerId: string | null; apiKey: string | null }, userId: number, domainId: number) {
  const domain = await getDomain(userId, domainId);
  assertNotSuspended(domain);
  const res = await getLiquid(user).disablePrivacyProtection(String(domain.liquidOrderId || domain.domainName));
  await db.update(domains).set({ privacyProtection: 0 }).where(eq(domains.id, domainId));
  return res;
}

export async function buyPrivacy(user: { resellerId: string | null; apiKey: string | null }, userId: number, domainId: number) {
  const domain = await getDomain(userId, domainId);
  assertNotSuspended(domain);
  const res = await getLiquid(user).buyPrivacyProtection(String(domain.liquidOrderId || domain.domainName));
  await db.update(domains).set({ privacyProtection: 1 }).where(eq(domains.id, domainId));
  return res;
}
