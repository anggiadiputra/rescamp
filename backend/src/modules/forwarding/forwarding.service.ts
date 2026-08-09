import { LiquidClient } from "../../lib/liquid";
import { AppError } from "../../lib/error";
import { db } from "../../db";
import { domains } from "../../db/schema";
import { eq } from "drizzle-orm";
import { getDomain } from "../domains/domains.service";

function getLiquid(creds: { resellerId?: string | null; apiKey?: string | null }): LiquidClient {
  return new LiquidClient(creds.resellerId || "", creds.apiKey || "");
}

function assertNotSuspended(domain: { status?: string | null }) {
  if (domain?.status === "suspended") {
    throw new AppError(
      "Domain sedang di-suspend. Unsuspend terlebih dahulu untuk melakukan konfigurasi.",
      409,
    );
  }
}

async function resolveDomainRef(liquid: LiquidClient, domain: any): Promise<string> {
  let ref = String(domain.liquidOrderId || domain.orderId || domain.order_id || "").trim();
  if (!ref || !/^\d+$/.test(ref)) {
    if (domain.domainName || domain.domain_name) {
      const dName = String(domain.domainName || domain.domain_name);
      try {
        const item: any = await liquid.getDomain(dName);
        const orderId = String(item?.domain_id || item?.order_id || item?.id || "");
        if (orderId) {
          ref = orderId;
          if (domain.id && domain.id > 0) {
            await db.update(domains).set({ liquidOrderId: orderId }).where(eq(domains.id, domain.id));
          }
        }
      } catch {}
    }
  }
  return ref || String(domain.liquidOrderId || domain.domainName || domain.id);
}

// Domain forwarding
export async function getDomainForwarding(user: { resellerId: string | null; apiKey: string | null }, userId: number, domainId: number | string) {
  const userParam = { id: userId, resellerId: user.resellerId, apiKey: user.apiKey };
  const domain = await getDomain(userParam, domainId);
  const liquid = getLiquid(user);
  const domainRef = await resolveDomainRef(liquid, domain);
  return liquid.getDomainForwarding(domainRef);
}

export async function updateDomainForwarding(user: { resellerId: string | null; apiKey: string | null }, userId: number, domainId: number | string, data: { destination_url: string; enabled: boolean }) {
  const userParam = { id: userId, resellerId: user.resellerId, apiKey: user.apiKey };
  const domain = await getDomain(userParam, domainId);
  assertNotSuspended(domain);
  const liquid = getLiquid(user);
  const domainRef = await resolveDomainRef(liquid, domain);
  return liquid.updateDomainForwarding(domainRef, data);
}

// Email forwarding
export async function getEmailForwarding(user: { resellerId: string | null; apiKey: string | null }, userId: number, domainId: number | string) {
  const userParam = { id: userId, resellerId: user.resellerId, apiKey: user.apiKey };
  const domain = await getDomain(userParam, domainId);
  const liquid = getLiquid(user);
  const domainRef = await resolveDomainRef(liquid, domain);
  return liquid.getEmailForwarding(domainRef);
}

export async function createEmailForwarding(user: { resellerId: string | null; apiKey: string | null }, userId: number, domainId: number | string, data: { email: string; forward_to: string }) {
  const userParam = { id: userId, resellerId: user.resellerId, apiKey: user.apiKey };
  const domain = await getDomain(userParam, domainId);
  assertNotSuspended(domain);
  const liquid = getLiquid(user);
  const domainRef = await resolveDomainRef(liquid, domain);
  return liquid.createEmailForwarding(domainRef, data);
}

export async function deleteEmailForwarding(user: { resellerId: string | null; apiKey: string | null }, userId: number, domainId: number | string, email: string) {
  const userParam = { id: userId, resellerId: user.resellerId, apiKey: user.apiKey };
  const domain = await getDomain(userParam, domainId);
  assertNotSuspended(domain);
  const liquid = getLiquid(user);
  const domainRef = await resolveDomainRef(liquid, domain);
  return liquid.deleteEmailForwarding(domainRef, email);
}

// Privacy
export async function getPrivacy(user: { resellerId: string | null; apiKey: string | null }, userId: number, domainId: number | string) {
  const userParam = { id: userId, resellerId: user.resellerId, apiKey: user.apiKey };
  const domain = await getDomain(userParam, domainId);
  const liquid = getLiquid(user);
  const domainRef = await resolveDomainRef(liquid, domain);
  return liquid.getPrivacyProtection(domainRef);
}

export async function enablePrivacy(user: { resellerId: string | null; apiKey: string | null }, userId: number, domainId: number | string) {
  const userParam = { id: userId, resellerId: user.resellerId, apiKey: user.apiKey };
  const domain = await getDomain(userParam, domainId);
  assertNotSuspended(domain);
  const liquid = getLiquid(user);
  const domainRef = await resolveDomainRef(liquid, domain);
  const res = await liquid.enablePrivacyProtection(domainRef);
  if (domain.id && domain.id > 0) {
    await db.update(domains).set({ privacyProtection: 1 }).where(eq(domains.id, domain.id));
  }
  return res;
}

export async function disablePrivacy(user: { resellerId: string | null; apiKey: string | null }, userId: number, domainId: number | string) {
  const userParam = { id: userId, resellerId: user.resellerId, apiKey: user.apiKey };
  const domain = await getDomain(userParam, domainId);
  assertNotSuspended(domain);
  const liquid = getLiquid(user);
  const domainRef = await resolveDomainRef(liquid, domain);
  const res = await liquid.disablePrivacyProtection(domainRef);
  if (domain.id && domain.id > 0) {
    await db.update(domains).set({ privacyProtection: 0 }).where(eq(domains.id, domain.id));
  }
  return res;
}

export async function buyPrivacy(user: { resellerId: string | null; apiKey: string | null }, userId: number, domainId: number | string) {
  const userParam = { id: userId, resellerId: user.resellerId, apiKey: user.apiKey };
  const domain = await getDomain(userParam, domainId);
  assertNotSuspended(domain);
  const liquid = getLiquid(user);
  const domainRef = await resolveDomainRef(liquid, domain);
  const res = await liquid.buyPrivacyProtection(domainRef);
  try {
    await liquid.enablePrivacyProtection(domainRef);
  } catch (e) {
    console.warn(`[forwarding.service] Auto-enable privacy protection after purchase warning:`, e);
  }
  if (domain.id && domain.id > 0) {
    await db.update(domains).set({ privacyProtection: 1 }).where(eq(domains.id, domain.id));
  }
  return res;
}
