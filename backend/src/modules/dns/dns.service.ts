import { db } from "../../db";
import { domains } from "../../db/schema";
import { eq } from "drizzle-orm";
import { LiquidClient } from "../../lib/liquid";
import { AppError } from "../../lib/error";
import { getDomain } from "../domains/domains.service";
import { resolveResellerCreds } from "../../lib/reseller-creds";

async function getLiquid(user: { id?: number; resellerId?: string | null; apiKey?: string | null }): Promise<LiquidClient> {
  if (user?.id) {
    const creds = await resolveResellerCreds(user.id);
    if (creds.resellerId && creds.apiKey) {
      return new LiquidClient(creds.resellerId, creds.apiKey);
    }
  }
  return new LiquidClient(user?.resellerId || "", user?.apiKey || "");
}

async function resolveDomainRef(liquid: LiquidClient, domain: any): Promise<string> {
  let ref = String(domain.liquidOrderId || "").trim();
  if (!ref || !/^\d+$/.test(ref)) {
    if (domain.domainName) {
      try {
        const item: any = await liquid.getDomain(domain.domainName);
        const orderId = String(item?.domain_id || item?.order_id || item?.id || "");
        if (orderId) {
          ref = orderId;
          if (domain._local && domain.id) {
            await db.update(domains).set({ liquidOrderId: orderId }).where(eq(domains.id, domain.id));
          }
        }
      } catch {}
    }
  }
  return ref || String(domain.domainName || domain.id);
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
  const liquid = await getLiquid(userParam);
  const domainRef = await resolveDomainRef(liquid, domain);
  const liquidType = mapDnsType(type);
  const res = await liquid.getDnsRecords(domainRef, liquidType);
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
  const liquid = await getLiquid(userParam);
  const domainRef = await resolveDomainRef(liquid, domain);
  return liquid.addDnsRecord(domainRef, mapDnsType(type), data);
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
  const liquid = await getLiquid(userParam);
  const domainRef = await resolveDomainRef(liquid, domain);
  return liquid.updateDnsRecord(domainRef, mapDnsType(type), oldHost, oldValue, data);
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
  const liquid = await getLiquid(userParam);
  const domainRef = await resolveDomainRef(liquid, domain);
  return liquid.deleteDnsRecord(domainRef, mapDnsType(type), hostname, value);
}
