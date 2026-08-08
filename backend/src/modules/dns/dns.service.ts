import { db } from "../../db";
import { domains } from "../../db/schema";
import { eq, and } from "drizzle-orm";
import { LiquidClient } from "../../lib/liquid";
import { AppError } from "../../lib/error";
import { getDomain } from "../domains/domains.service";
import { resolveCredsFromUser } from "../../lib/reseller-creds";

function getLiquid(creds: { resellerId?: string | null; apiKey?: string | null }): LiquidClient {
  return new LiquidClient(creds.resellerId || "", creds.apiKey || "");
}

function mapDnsType(type: string): string {
  const t = type.toLowerCase();
  if (t === "a") return "ip";
  if (t === "aaaa") return "ipv6";
  return t;
}

// Resellercamp returns per-type field names (e.g. "ip" for A records, "ipv6" for AAAA).
// Normalize to { hostname, value, ttl } for the frontend.
function normalizeRecord(record: any, type: string): { hostname: string; value: string; ttl: number } {
  const hostname = record.hostname ?? record.host ?? "@";
  const ttl = Number(record.ttl) || 3600;
  // value field varies by record type
  const value = record.val       // Resellercamp actual field name
    ?? record.value
    ?? record.ip        // A (fallback)
    ?? record.ipv6      // AAAA (fallback)
    ?? record.target    // CNAME, MX, NS, SRV (fallback)
    ?? record.text      // TXT (fallback)
    ?? record.rdata
    ?? record.content
    ?? "";
  return { hostname, value, ttl };
}

export async function listRecords(user: { resellerId: string | null; apiKey: string | null }, userParam: any, domainLookup: string | number, type: string) {
  const domain = await getDomain(userParam, domainLookup);
  const liquidType = mapDnsType(type);
  const res = await getLiquid(user).getDnsRecords(String(domain.liquidOrderId || domain.domainName), liquidType);
  const raw: any[] = Array.isArray(res) ? res : res?.records || res?.data || [];
  return raw.map((r) => normalizeRecord(r, type));
}

export async function addRecord(
  user: { resellerId: string | null; apiKey: string | null }, userParam: any, domainLookup: string | number,
  type: string, data: { hostname: string; value: string; ttl?: number },
) {
  const domain = await getDomain(userParam, domainLookup);
  if (domain.status === "suspended") {
    throw new AppError(
      "Domain sedang di-suspend. Unsuspend terlebih dahulu untuk melakukan konfigurasi.",
      409,
    );
  }
  return getLiquid(user).addDnsRecord(String(domain.liquidOrderId || domain.domainName), mapDnsType(type), data);
}

export async function updateRecord(
  user: { resellerId: string | null; apiKey: string | null }, userParam: any, domainLookup: string | number,
  type: string, oldHost: string, oldValue: string, data: { hostname: string; value: string; ttl?: number },
) {
  const domain = await getDomain(userParam, domainLookup);
  if (domain.status === "suspended") {
    throw new AppError(
      "Domain sedang di-suspend. Unsuspend terlebih dahulu untuk melakukan konfigurasi.",
      409,
    );
  }
  return getLiquid(user).updateDnsRecord(String(domain.liquidOrderId || domain.domainName), mapDnsType(type), oldHost, oldValue, data);
}

export async function deleteRecord(
  user: { resellerId: string | null; apiKey: string | null }, userParam: any, domainLookup: string | number,
  type: string, hostname: string, value: string,
) {
  const domain = await getDomain(userParam, domainLookup);
  if (domain.status === "suspended") {
    throw new AppError(
      "Domain sedang di-suspend. Unsuspend terlebih dahulu untuk melakukan konfigurasi.",
      409,
    );
  }
  return getLiquid(user).deleteDnsRecord(String(domain.liquidOrderId || domain.domainName), mapDnsType(type), hostname, value);
}
