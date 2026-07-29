import { db } from "../../db";
import { domains } from "../../db/schema";
import { eq, and } from "drizzle-orm";
import { LiquidClient } from "../../lib/liquid";
import { AppError } from "../../lib/error";

function getLiquid(user: { resellerId: string | null; apiKey: string | null }): LiquidClient {
  return new LiquidClient(user.resellerId || "", user.apiKey || "");
}

async function getDomain(userId: number, domainId: number) {
  const [domain] = await db.select().from(domains).where(and(eq(domains.id, domainId), eq(domains.userId, userId)));
  if (!domain) throw new AppError("Domain not found", 404);
  return domain;
}

export async function listRecords(user: { resellerId: string | null; apiKey: string | null }, userId: number, domainId: number, type: string) {
  const domain = await getDomain(userId, domainId);
  const res = await getLiquid(user).getDnsRecords(String(domain.liquidOrderId || domain.domainName), type);
  return Array.isArray(res) ? res : res?.records || res?.data || [];
}

export async function addRecord(
  user: { resellerId: string | null; apiKey: string | null }, userId: number, domainId: number,
  type: string, data: { hostname: string; value: string; ttl?: number },
) {
  const domain = await getDomain(userId, domainId);
  return getLiquid(user).addDnsRecord(String(domain.liquidOrderId || domain.domainName), type, data);
}

export async function updateRecord(
  user: { resellerId: string | null; apiKey: string | null }, userId: number, domainId: number,
  type: string, oldHost: string, oldValue: string, data: { hostname: string; value: string; ttl?: number },
) {
  const domain = await getDomain(userId, domainId);
  return getLiquid(user).updateDnsRecord(String(domain.liquidOrderId || domain.domainName), type, oldHost, oldValue, data);
}

export async function deleteRecord(
  user: { resellerId: string | null; apiKey: string | null }, userId: number, domainId: number,
  type: string, hostname: string, value: string,
) {
  const domain = await getDomain(userId, domainId);
  return getLiquid(user).deleteDnsRecord(String(domain.liquidOrderId || domain.domainName), type, hostname, value);
}
