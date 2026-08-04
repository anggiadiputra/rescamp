import { db } from "../../db";
import { domains } from "../../db/schema";
import { eq, and } from "drizzle-orm";
import { LiquidClient } from "../../lib/liquid";
import { AppError } from "../../lib/error";
import { getDomain } from "../domains/domains.service";

function getLiquid(user: { resellerId: string | null; apiKey: string | null }): LiquidClient {
  return new LiquidClient(user.resellerId || "", user.apiKey || "");
}

function mapDnsType(type: string): string {
  const t = type.toLowerCase();
  if (t === "a") return "ip";
  if (t === "aaaa") return "ipv6";
  return t;
}

export async function listRecords(user: { resellerId: string | null; apiKey: string | null }, userParam: any, domainLookup: string | number, type: string) {
  const domain = await getDomain(userParam, domainLookup);
  const liquidType = mapDnsType(type);
  const res = await getLiquid(user).getDnsRecords(String(domain.liquidOrderId || domain.domainName), liquidType);
  return Array.isArray(res) ? res : res?.records || res?.data || [];
}

export async function addRecord(
  user: { resellerId: string | null; apiKey: string | null }, userParam: any, domainLookup: string | number,
  type: string, data: { hostname: string; value: string; ttl?: number },
) {
  const domain = await getDomain(userParam, domainLookup);
  return getLiquid(user).addDnsRecord(String(domain.liquidOrderId || domain.domainName), mapDnsType(type), data);
}

export async function updateRecord(
  user: { resellerId: string | null; apiKey: string | null }, userParam: any, domainLookup: string | number,
  type: string, oldHost: string, oldValue: string, data: { hostname: string; value: string; ttl?: number },
) {
  const domain = await getDomain(userParam, domainLookup);
  return getLiquid(user).updateDnsRecord(String(domain.liquidOrderId || domain.domainName), mapDnsType(type), oldHost, oldValue, data);
}

export async function deleteRecord(
  user: { resellerId: string | null; apiKey: string | null }, userParam: any, domainLookup: string | number,
  type: string, hostname: string, value: string,
) {
  const domain = await getDomain(userParam, domainLookup);
  return getLiquid(user).deleteDnsRecord(String(domain.liquidOrderId || domain.domainName), mapDnsType(type), hostname, value);
}
