import { db } from "../../db";
import { domains, users, customers, transactions } from "../../db/schema";
import { eq, and, like, inArray, or, sql, ne } from "drizzle-orm";
import { LiquidClient, formatCustomerPrices } from "../../lib/liquid";
import { AppError } from "../../lib/error";
import { resolveResellerCreds } from "../../lib/reseller-creds";
import dns from "node:dns/promises";

async function checkDnsAvailability(domain: string): Promise<boolean> {
  try {
    await Promise.any([
      dns.resolveNs(domain),
      dns.resolveSoa(domain),
      dns.resolve4(domain),
    ]);
    return false; // Records found -> Taken
  } catch (err: any) {
    return true; // No DNS records found -> Available
  }
}

// ponytail: helper used by mutators below. Single source of truth for the
// "domain-suspended → reject any user config" rule. upgrade path: when we add
// finer roles (e.g. read-only auditor), accept an `allowConfig: boolean` arg.
function assertNotSuspended(domain: { status: string | null }) {
  if (domain.status === "suspended") {
    throw new AppError(
      "Domain sedang di-suspend. Unsuspend terlebih dahulu untuk melakukan konfigurasi.",
      409,
    );
  }
}

export function cleanDateOnly(val?: any): string | null {
  if (!val) return null;
  const str = String(val).trim();
  if (!str) return null;
  const clean = str.split(" ")[0]?.split("T")[0];
  return clean || null;
}

async function getLiquid(user?: { id?: number; resellerId?: string | null; apiKey?: string | null; role?: string | null }): Promise<LiquidClient | null> {
  try {
    if (user?.id) {
      const creds = await resolveResellerCreds(user.id);
      if (!creds.resellerId || !creds.apiKey) {
        console.warn("[getLiquid] Empty credentials resolved for userId:", user.id);
        return null;
      }
      return new LiquidClient(creds.resellerId, creds.apiKey);
    }
    if (user?.resellerId && user?.apiKey) {
      return new LiquidClient(user.resellerId, user.apiKey);
    }
    const creds = await resolveResellerCreds(0);
    if (!creds.resellerId || !creds.apiKey) {
      console.warn("[getLiquid] Empty master credentials resolved");
      return null;
    }
    return new LiquidClient(creds.resellerId, creds.apiKey);
  } catch (e: any) {
    console.warn("[getLiquid] Failed to resolve credentials:", e?.message);
    return null;
  }
}

/** Non-nullable variant for operations that require API access (register, transfer, renew, etc.) */
async function getLiquidRequired(user?: { id?: number; resellerId?: string | null; apiKey?: string | null; role?: string | null }): Promise<LiquidClient> {
  const client = await getLiquid(user);
  if (!client) {
    throw new AppError("Kredensial Resellercamp tidak tersedia. Pastikan Reseller ID dan API Key telah dikonfigurasi.", 400);
  }
  return client;
}

export function parsePrivacyProtectionStatus(raw: any): boolean {
  if (raw === null || raw === undefined) return false;
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "number") return raw === 1;
  if (typeof raw === "string") {
    const s = raw.trim().toLowerCase();
    return s === "true" || s === "1" || s === "active" || s === "enabled" || s === "enable" || s === "on" || s === "purchased" || s === "success";
  }
  if (typeof raw === "object") {
    const target = raw.data ?? raw;
    if (typeof target === "boolean") return target;
    if (typeof target === "number") return target === 1;
    if (typeof raw === "string") {
      const s = raw.trim().toLowerCase();
      return s === "true" || s === "1" || s === "active" || s === "enabled" || s === "enable" || s === "on" || s === "purchased" || s === "success";
    }

    const val =
      target.privacy_protection ??
      target.privacy_protection_enabled ??
      target.purchase_privacy_protection ??
      target.privacy_protection_status ??
      target.privacy_protect ??
      target.privacy;

    if (val !== null && val !== undefined) {
      if (typeof val === "boolean") return val;
      if (typeof val === "number") return val === 1;
      if (typeof val === "string") {
        const s = val.trim().toLowerCase();
        return s === "true" || s === "1" || s === "active" || s === "enabled" || s === "enable" || s === "on" || s === "purchased" || s === "success";
      }
      if (typeof val === "object") {
        return parsePrivacyProtectionStatus(val);
      }
    }

    if ("privacy_protection" in target || "privacy_protection_status" in target || "privacy" in target) {
      return false;
    }

    if (target.status !== undefined && target.domain_name === undefined && target.name === undefined) {
      const s = String(target.status).trim().toLowerCase();
      if (s === "disabled" || s === "off" || s === "false" || s === "0" || s === "unbound" || s === "inactive") return false;
      return s === "true" || s === "1" || s === "active" || s === "enabled" || s === "enable" || s === "on" || s === "purchased" || s === "success";
    }
  }
  return false;
}

export function extractAuthCode(raw: any): string | null {
  if (!raw) return null;
  if (typeof raw === "string" && raw.trim() && raw.trim() !== "-") return raw.trim();
  if (typeof raw === "object") {
    const target = raw.data ?? raw;
    if (typeof target === "string" && target.trim() && target.trim() !== "-") return target.trim();
    if (typeof target === "object") {
      const val =
        target.auth_code ??
        target.authcode ??
        target.auth_code_secret ??
        target.epp_code ??
        target.eppCode ??
        target.code ??
        target.secret ??
        target.domain_secret ??
        target.authCode;

      if (val && typeof val === "string" && val.trim() && val.trim() !== "-") {
        return val.trim();
      }
      if (val && typeof val === "number") {
        return String(val);
      }
    }
  }
  return null;
}

export function parseDomainContact(raw: any): {
  contactId?: string | number;
  name?: string;
  company?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  zipcode?: string;
  phone?: string;
} | null {
  if (!raw) return null;
  if (typeof raw !== "object") return null;
  const c = raw.data ?? raw.contact ?? raw.details ?? raw;
  const name = c.name || c.contact_name || c.fullname || c.name_1 || c.registrant_name || c.admin_name || c.tech_name || c.billing_name || c.customer_name || "";
  const email = c.email || c.email_address || c.contact_email || c.registrant_email || c.admin_email || c.tech_email || c.billing_email || c.customer_email || "";
  const company = c.company || c.company_name || c.organization || c.org || undefined;
  if (!name && !email && !company) return null;
  return {
    contactId: c.contact_id || c.id || c.registrant_contact_id || c.admin_contact_id || c.tech_contact_id || c.billing_contact_id || undefined,
    name: name || undefined,
    company: company,
    email: email || undefined,
    address: c.address_line_1 || c.address1 || c.address || c.street || c.addr1 || undefined,
    city: c.city || undefined,
    state: c.state || c.province || undefined,
    country: c.country_code || c.country || undefined,
    zipcode: c.zipcode || c.zip || c.postal_code || undefined,
    phone: c.tel_no || c.phone || c.telephone || c.mobile || c.tel || undefined,
  };
}

export function parseRaaVerification(raw: any): { status: "verified" | "pending" | "unknown"; email?: string; canResend?: boolean } {
  if (!raw) return { status: "verified", canResend: false };
  const target = typeof raw === "object" ? (raw.data ?? raw) : raw;
  const s = String(typeof target === "string" ? target : target.status || target.raa_verification_status || target.raa_status || target.status_name || "").toLowerCase().trim();
  if (s === "pending" || s === "unverified" || s === "false" || s === "0" || s.includes("pending")) {
    return { status: "pending", email: typeof target === "object" ? target.email : undefined, canResend: true };
  }
  return { status: "verified", email: typeof target === "object" ? target.email : undefined, canResend: false };
}

export function parseNameservers(raw: any): string[] | null {
  if (raw === null || raw === undefined) return null;
  if (Array.isArray(raw)) {
    const list = raw.map((s) => String(s || "").trim()).filter(Boolean);
    return list.length > 0 ? list : null;
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsedJson = JSON.parse(trimmed);
        if (Array.isArray(parsedJson)) {
          const list = parsedJson.map((s) => String(s || "").trim()).filter(Boolean);
          return list.length > 0 ? list : null;
        }
      } catch {}
    }
    const list = trimmed.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
    return list.length > 0 ? list : null;
  }
  if (typeof raw === "object") {
    const target = raw.data ?? raw;
    if (Array.isArray(target)) {
      const list = target.map((s) => String(s || "").trim()).filter(Boolean);
      return list.length > 0 ? list : null;
    }
    if (typeof target === "string") {
      return parseNameservers(target);
    }
    const nsList: string[] = [];
    if (target.nameservers) {
      const parsed = parseNameservers(target.nameservers);
      if (parsed) return parsed;
    }
    if (target.ns) {
      const parsed = parseNameservers(target.ns);
      if (parsed) return parsed;
    }
    for (let i = 1; i <= 10; i++) {
      const val = target[`ns${i}`] || target[`ns_${i}`] || target[`nameserver${i}`] || target[String(i - 1)] || target[String(i)];
      if (val && typeof val === "string" && val.trim()) {
        nsList.push(val.trim());
      }
    }
    if (nsList.length === 0) {
      for (const key of Object.keys(target)) {
        const val = target[key];
        if (typeof val === "string" && val.includes(".")) {
          const trimmed = val.trim();
          if (trimmed && !nsList.includes(trimmed)) {
            nsList.push(trimmed);
          }
        }
      }
    }
    if (nsList.length > 0) return nsList;
  }
  return null;
}


export async function checkAvailability(user: { id?: number; resellerId: string | null; apiKey: string | null; role?: string }, domain: string) {
  const fullDomain = domain.toLowerCase().trim();
  console.log(`[checkAvailability] Checking: ${fullDomain}`);

  // Extract TLD (e.g. "example.com" -> "com")
  const parts = fullDomain.split(".");
  const tld = parts.length > 1 ? parts.slice(1).join(".").toLowerCase() : "";

  let priceInfo: any = null;
  const liquid = await getLiquid(user);

  if (tld && liquid) {
    try {
      const rawCustPrices = await liquid.getCustomerPrices();
      const prices = formatCustomerPrices(rawCustPrices);
      priceInfo = prices[tld] || null;
    } catch {
      try {
        const fallback = await liquid.getPrices();
        priceInfo = fallback[tld] || null;
      } catch {}
    }
  }

  // Query Resellercamp API — NO DNS fallback (DNS is unreliable for availability)
  let res: any = null;
  let apiSuccess = false;
  if (liquid) {
    try {
      res = await liquid.checkAvailability(fullDomain, 8_000);
      apiSuccess = true;
      console.log(`[checkAvailability] API raw response for ${fullDomain}:`, JSON.stringify(res));
    } catch (err: any) {
      console.warn(`[checkAvailability] API call failed for ${fullDomain}:`, err?.message);
      // Return "unknown" — do NOT fallback to DNS probe
      return {
        [fullDomain]: {
          status: "unknown",
          price: priceInfo?.price_new || priceInfo?.price_register || null,
          renew_price: priceInfo?.price_renew || null,
          privacy_protect: priceInfo?.privacy_protect || "70.00",
          currency: priceInfo?.currency || "IDR",
        },
      };
    }
  } else {
    console.warn(`[checkAvailability] No Liquid client available (empty credentials) for ${fullDomain}`);
    // No API available — return "unknown", not a DNS guess
    return {
      [fullDomain]: {
        status: "unknown",
        price: priceInfo?.price_new || priceInfo?.price_register || null,
        renew_price: priceInfo?.price_renew || null,
        privacy_protect: priceInfo?.privacy_protect || "70.00",
        currency: priceInfo?.currency || "IDR",
      },
    };
  }

  // Attach price details & normalize status in availability result
  const targetObj = Array.isArray(res) ? res[0] : res;
  if (targetObj && typeof targetObj === "object") {
    const key = Object.keys(targetObj)[0];
    if (key && targetObj[key] && typeof targetObj[key] === "object") {
      const rawSt = String(targetObj[key].status || "").toLowerCase().trim();
      console.log(`[checkAvailability] ${fullDomain} → raw status from API: "${rawSt}"`);
      if (rawSt) {
        if (rawSt === "available" || rawSt === "free" || rawSt === "available_for_registration") {
          targetObj[key].status = "available";
        } else {
          // regthroughus, regthroughothers, registered, taken, unknown, etc. = unavailable
          targetObj[key].status = "unavailable";
        }
      }
      targetObj[key].price = priceInfo?.price_new || priceInfo?.price_register || null;
      targetObj[key].renew_price = priceInfo?.price_renew || null;
      targetObj[key].privacy_protect = priceInfo?.privacy_protect || "70.00";
      targetObj[key].currency = priceInfo?.currency || "IDR";
    } else if (key && typeof targetObj[key] === "string") {
      // Handle flat response format: { "domain.com": "regthroughus" }
      const rawSt = targetObj[key].toLowerCase().trim();
      console.log(`[checkAvailability] ${fullDomain} → raw flat status from API: "${rawSt}"`);
      const isAvail = rawSt === "available" || rawSt === "free" || rawSt === "available_for_registration";
      targetObj[key] = {
        status: isAvail ? "available" : "unavailable",
        price: priceInfo?.price_new || priceInfo?.price_register || null,
        renew_price: priceInfo?.price_renew || null,
        privacy_protect: priceInfo?.privacy_protect || "70.00",
        currency: priceInfo?.currency || "IDR",
      };
    }
  }

  console.log(`[checkAvailability] Final result for ${fullDomain}:`, JSON.stringify(res));
  return res;
}

import { createDomainOrderPayment } from "../payments/payments.service";

export async function getSuggestions(user: { id?: number; resellerId: string | null; apiKey: string | null }, keyword: string, tld?: string) {
  const liquid = await getLiquidRequired(user);
  return liquid.getDomainSuggestions(keyword, tld);
}

export async function orderRegisterDomain(
  user: { id: number; resellerId: string | null; apiKey: string | null },
  data: { domain_name: string; tld: string; years: number; customer_id?: number; nameservers?: string[]; auto_renew?: boolean; privacy_protection?: boolean }
) {
  const fullDomain = `${data.domain_name}.${data.tld}`.toLowerCase().trim();

  // 1. Pre-check local DB for existing active/pending domain record
  const [existingDomain] = await db
    .select({ id: domains.id, status: domains.status })
    .from(domains)
    .where(and(eq(domains.domainName, fullDomain), ne(domains.status, "cancelled")))
    .limit(1);

  if (existingDomain) {
    throw new AppError(`Domain ${fullDomain} sudah terdaftar atau dalam pengelolaan sistem.`, 400);
  }

  // 2. Pre-check transactions table for pending payment / processing domain registration
  const pendingTxns = await db
    .select({ metadata: transactions.metadata })
    .from(transactions)
    .where(
      and(
        inArray(transactions.type, ["register", "transfer"]),
        inArray(transactions.status, ["pending_payment", "processing_domain", "completed"])
      )
    );

  for (const tx of pendingTxns) {
    if (tx.metadata) {
      try {
        const meta = JSON.parse(tx.metadata);
        if (meta.domainName && meta.domainName.toLowerCase().trim() === fullDomain) {
          throw new AppError(`Domain ${fullDomain} sedang dalam proses pemesanan atau pembayaran.`, 400);
        }
      } catch (e) {
        if (e instanceof AppError) throw e;
      }
    }
  }

  const liquid = await getLiquidRequired(user);
  
  const years = data.years || 1;
  const tldKey = data.tld.toLowerCase();
  let unitPrice = 150000;
  let privacyPrice = 70000;
  let totalAmount = 0;

  try {
    const rawCustPrices = await liquid.getCustomerPrices();
    const prices = formatCustomerPrices(rawCustPrices);
    const pInfo = prices[tldKey];

    if (pInfo && pInfo.create_years && pInfo.create_years[years]) {
      totalAmount = pInfo.create_years[years];
    } else if (pInfo && (pInfo.price_new || pInfo.price_register)) {
      const p = Number(pInfo.price_new || pInfo.price_register);
      unitPrice = p < 1000 ? p * 1000 : p;
      totalAmount = unitPrice * years;
    } else {
      totalAmount = unitPrice * years;
    }

    if (pInfo && pInfo.privacy_protect) {
      const pp = Number(pInfo.privacy_protect);
      privacyPrice = pp < 1000 ? pp * 1000 : pp;
    }
  } catch (e) {
    totalAmount = unitPrice * years;
  }

  if (data.privacy_protection && !tldKey.endsWith("id")) {
    totalAmount += privacyPrice * years;
  }

  return createDomainOrderPayment({
    userId: user.id,
    type: "register",
    domainName: data.domain_name,
    tld: data.tld,
    years,
    customerId: data.customer_id,
    nameservers: data.nameservers,
    autoRenew: data.auto_renew,
    privacyProtection: data.privacy_protection,
    amount: totalAmount,
  });
}

export async function orderTransferDomain(
  user: { id: number; resellerId: string | null; apiKey: string | null },
  data: { domain_name: string; auth_code: string; customer_id?: number; nameservers?: string[] }
) {
  const liquid = await getLiquidRequired(user);
  const tld = data.domain_name.split(".").slice(1).join(".").toLowerCase();

  let unitPrice = 150000;
  try {
    const rawCustPrices = await liquid.getCustomerPrices();
    const prices = formatCustomerPrices(rawCustPrices);
    const pInfo = prices[tld];
    if (pInfo && (pInfo.price_transfer || pInfo.price_renew)) {
      const p = Number(pInfo.price_transfer || pInfo.price_renew);
      unitPrice = p < 1000 ? p * 1000 : p;
    }
  } catch (e) {}

  return createDomainOrderPayment({
    userId: user.id,
    type: "transfer",
    domainName: data.domain_name,
    tld,
    years: 1,
    customerId: data.customer_id,
    authCode: data.auth_code,
    nameservers: data.nameservers,
    amount: unitPrice,
  });
}

export async function orderRenewDomain(
  user: { id: number; resellerId: string | null; apiKey: string | null },
  userParam: any,
  domainId: string | number,
  years: number,
  options?: { purchasePrivacyProtection?: boolean }
) {
  const domain = await getDomain(userParam, domainId);
  const liquid = await getLiquidRequired(user);
  const tldKey = domain.tld.toLowerCase();
  const includePrivacy = Boolean(options?.purchasePrivacyProtection) && !tldKey.endsWith("id");

  let unitPrice = 150000;
  let privacyPrice = 70000;
  try {
    const rawCustPrices = await liquid.getCustomerPrices();
    const prices = formatCustomerPrices(rawCustPrices);
    const pInfo = prices[tldKey];
    if (pInfo && pInfo.price_renew) {
      const p = Number(pInfo.price_renew);
      unitPrice = p < 1000 ? p * 1000 : p;
    }
    if (pInfo && pInfo.privacy_protect) {
      const pp = Number(pInfo.privacy_protect);
      privacyPrice = pp < 1000 ? pp * 1000 : pp;
    }
  } catch (e) {}

  const domainTotal = unitPrice * (years || 1);
  const privacyTotal = includePrivacy ? privacyPrice * (years || 1) : 0;
  const totalAmount = domainTotal + privacyTotal;

  return createDomainOrderPayment({
    userId: typeof userParam === "object" ? userParam.id : Number(userParam),
    type: "renew",
    domainName: domain.domainName,
    tld: domain.tld,
    years: years || 1,
    domainId: domain.id,
    customerId: domain.customerId || undefined,
    privacyProtection: includePrivacy,
    amount: totalAmount,
  });
}

export async function orderBuyPrivacy(
  user: { id: number; resellerId: string | null; apiKey: string | null },
  userParam: any,
  domainId: string | number
) {
  const domain = await getDomain(userParam, domainId);
  const tldKey = domain.tld.toLowerCase();

  if (tldKey.endsWith("id")) {
    throw new AppError("WHOIS privacy tidak tersedia untuk domain .id", 400);
  }
  if (domain.privacyProtection) {
    throw new AppError("WHOIS privacy sudah aktif untuk domain ini", 409);
  }

  const liquid = await getLiquidRequired(user);

  let privacyPrice = 70000;
  try {
    const rawCustPrices = await liquid.getCustomerPrices();
    const prices = formatCustomerPrices(rawCustPrices);
    const pInfo = prices[tldKey];
    if (pInfo && pInfo.privacy_protect) {
      const pp = Number(pInfo.privacy_protect);
      privacyPrice = pp < 1000 ? pp * 1000 : pp;
    }
  } catch (e) {}

  return createDomainOrderPayment({
    userId: user.id,
    type: "privacy",
    domainName: domain.domainName,
    tld: domain.tld,
    domainId: domain.id,
    customerId: domain.customerId || undefined,
    amount: privacyPrice,
  });

}

export async function registerDomain(
  user: { id?: number; resellerId: string | null; apiKey: string | null },
  data: Record<string, any>
) {
  const liquid = await getLiquidRequired(user);
  const years = data.years || 1;
  const fullDomain = data.tld ? `${data.domain_name}.${data.tld}` : data.domain_name;

  const res = await liquid.registerDomain({
    domain_name: fullDomain,
    years,
    ns: data.nameservers?.join(",") || "",
    customer_id: String(data.customer_id),
    privacy_protection: data.privacy_protection,
  });

  const liquidOrderId = typeof res === "string" ? res : res?.order_id || res?.id || null;

  let saved: any = null;
  try {
    const [inserted] = await db.insert(domains).values({
      userId: Number(data.user_id || 1),
      customerId: data.customer_id ? Number(data.customer_id) : null,
      domainName: fullDomain,
      tld: data.tld || fullDomain.split(".").slice(1).join("."),
      years,
      status: "active",
      autoRenew: data.auto_renew ? 1 : 0,
      privacyProtection: data.privacy_protection ? 1 : 0,
      liquidOrderId: liquidOrderId ? String(liquidOrderId) : null,
      nameservers: data.nameservers || [],
    });

    const [row] = await db.select().from(domains).where(eq(domains.id, inserted.insertId));
    saved = row;
  } catch (err) {
    console.error("[domain] LIQUID register ok, local cache failed:", err);
  }
  return saved ?? { domainName: `${data.domain_name}.${data.tld}`, status: "pending" };
}

export async function listDomains(
  user: any,
  params?: { search?: string; status?: string; page?: number; per_page?: number },
) {
  const page = params?.page || 1;
  const perPage = params?.per_page || 20;
  const offset = (page - 1) * perPage;

  const conditions: any[] = [];

  if (user.role === "customer") {
    const custs = await db.select({ id: customers.id }).from(customers).where(or(eq(customers.userId, user.id), eq(customers.email, user.email || "")));
    const allowedCustomerIds = custs.map((c) => c.id);

    const accessCondition = allowedCustomerIds.length > 0
      ? or(eq(domains.userId, user.id), inArray(domains.customerId, allowedCustomerIds))
      : eq(domains.userId, user.id);
    conditions.push(accessCondition);
  }

  if (params?.search) conditions.push(like(domains.domainName, `%${params.search}%`));
  if (params?.status) conditions.push(eq(domains.status, params.status as any));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db.select().from(domains).where(where).limit(perPage).offset(offset);
  const total = await db.$count(domains, where);

  const enriched = await Promise.all(rows.map(async (d) => {
    let cust: any = null;
    let reseller: any = null;

    if (d.customerId) {
      const [c] = await db.select().from(customers).where(eq(customers.id, d.customerId));
      cust = c || null;
    }
    if (!cust && d.userId) {
      const [c] = await db.select().from(customers).where(eq(customers.userId, d.userId));
      cust = c || null;
    }

    if (d.userId) {
      const [u] = await db.select({ id: users.id, resellerId: users.resellerId, name: users.name, email: users.email }).from(users).where(eq(users.id, d.userId));
      reseller = u || null;
    }

    return {
      ...d,
      domainId: d.id,
      liquidOrderId: d.liquidOrderId || null,
      customerId: d.customerId || cust?.id || null,
      liquidCustomerId: cust?.liquidCustomerId || null,
      customerName: cust?.name || null,
      customerEmail: cust?.email || null,
      userId: d.userId,
      resellerId: reseller?.resellerId || user.resellerId || null,
    };
  }));

  return { data: enriched, meta: { total, page, perPage } };
}

export async function getDomain(userParam: any, lookup: string | number) {
  const user = typeof userParam === "object" ? userParam : { id: Number(userParam), role: "reseller", email: "" };
  const userId = user.id;
  const userRole = user.role || "reseller";

  const conditions: any[] = [];

  if (userRole === "customer") {
    const custs = await db.select({ id: customers.id }).from(customers).where(or(eq(customers.userId, userId), eq(customers.email, user.email || "")));
    const allowedCustomerIds = custs.map((c) => c.id);

    const accessCondition = allowedCustomerIds.length > 0
      ? or(eq(domains.userId, userId), inArray(domains.customerId, allowedCustomerIds))
      : eq(domains.userId, userId);
    conditions.push(accessCondition);
  }

  // Support lookup by local id, liquidOrderId, or domainName
  const lookupStr = String(lookup || "").trim();
  const lookupNum = parseInt(lookupStr, 10);
  const isNumericOnly = !isNaN(lookupNum) && /^\d+$/.test(lookupStr);

  const domainCond = isNumericOnly
    ? or(eq(domains.id, lookupNum), eq(domains.liquidOrderId, lookupStr), eq(domains.domainName, lookupStr.toLowerCase()))
    : or(eq(domains.liquidOrderId, lookupStr), eq(domains.domainName, lookupStr.toLowerCase()));

  conditions.push(domainCond);

  const [domain] = await db.select().from(domains).where(and(...conditions));

  if (domain) {
    let cust: any = null;
    let reseller: any = null;

    if (domain.customerId) {
      const [c] = await db.select().from(customers).where(eq(customers.id, domain.customerId));
      cust = c || null;
    }
    if (!cust && domain.userId) {
      const [c] = await db.select().from(customers).where(eq(customers.userId, domain.userId));
      cust = c || null;
    }

    if (domain.userId) {
      const [u] = await db.select({ id: users.id, resellerId: users.resellerId, name: users.name, email: users.email }).from(users).where(eq(users.id, domain.userId));
      reseller = u || null;
    }

    // Probe live WHOIS privacy status & resolve liquidOrderId if missing
    const ref = String(domain.liquidOrderId || domain.domainName || "").trim();
    if (ref && ref !== "null" && ref !== "undefined") {
      try {
        const liquid = await getLiquid(userParam);
        if (liquid) {
          if (!domain.liquidOrderId && domain.domainName) {
            try {
              const item: any = await liquid.getDomain(domain.domainName);
              const orderId = String(item?.domain_id || item?.order_id || item?.id || "");
              if (orderId) {
                await db.update(domains).set({ liquidOrderId: orderId }).where(eq(domains.id, domain.id));
                domain.liquidOrderId = orderId;
              }
            } catch {}
          }
          const domainRef = String(domain.liquidOrderId || domain.domainName);
          const isDotId = domain.domainName.toLowerCase().endsWith(".id");
          let liveFlag = false;
          if (!isDotId) {
            try {
              const live: any = await liquid.getPrivacyProtection(domainRef);
              liveFlag = parsePrivacyProtectionStatus(live);
            } catch {}
          }
          const dbFlag = domain.privacyProtection === 1;

          if (liveFlag !== dbFlag) {
            await db.update(domains).set({ privacyProtection: liveFlag ? 1 : 0 }).where(eq(domains.id, domain.id));
            domain.privacyProtection = liveFlag ? 1 : 0;
          }

          try {
            const liveNsRaw = await liquid.getNameservers(domainRef);
            const liveNs = parseNameservers(liveNsRaw);
            if (liveNs && liveNs.length > 0) {
              const currentNs = Array.isArray(domain.nameservers) ? domain.nameservers : [];
              if (JSON.stringify(liveNs) !== JSON.stringify(currentNs)) {
                await db.update(domains).set({ nameservers: liveNs }).where(eq(domains.id, domain.id));
                domain.nameservers = liveNs;
              }
            }
          } catch {}

          // Fetch complete domain details (fields=All) for contacts, RAA verification, DNSSEC, glue records
          let extraDetails: any = null;
          if (/^\d+$/.test(domainRef)) {
            try {
              extraDetails = await liquid.getDomain(domainRef);
            } catch {}
          }
          const ext = (extraDetails && typeof extraDetails === "object") ? (extraDetails.data ?? extraDetails) : {};

          const ownerContact = {
            name: cust?.name || reseller?.name || (userParam as any)?.name || (userParam as any)?.email?.split("@")[0] || undefined,
            company: cust?.company || undefined,
            email: cust?.email || reseller?.email || (userParam as any)?.email || undefined,
            address: cust?.address || undefined,
            city: cust?.city || undefined,
            state: cust?.state || undefined,
            country: cust?.country || "ID",
            zipcode: cust?.zipcode || undefined,
            phone: cust?.phone || undefined,
          };

          const registrantContact = parseDomainContact(ext.registrant_contact ?? ext.registrant ?? ext.registrant_contact_details ?? ext.registrantcontact ?? ext.contacts?.registrant) || ownerContact;
          const adminContact = parseDomainContact(ext.admin_contact ?? ext.admin ?? ext.admin_contact_details ?? ext.admincontact ?? ext.contacts?.admin) || registrantContact;
          const techContact = parseDomainContact(ext.tech_contact ?? ext.tech ?? ext.technical_contact ?? ext.tech_contact_details ?? ext.techcontact ?? ext.contacts?.tech) || registrantContact;
          const billingContact = parseDomainContact(ext.billing_contact ?? ext.billing ?? ext.billing_contact_details ?? ext.billingcontact ?? ext.contacts?.billing) || registrantContact;
          const raaVerification = parseRaaVerification(ext.raa_verification ?? ext.raa_status ?? ext.raa_verification_status);

          const nsFormatted = parseNameservers(domain.nameservers);

          return {
            ...domain,
            nameservers: nsFormatted,
            registrantContact,
            adminContact,
            techContact,
            billingContact,
            raaVerification,
            _local: true,
            domainId: domain.id,
            liquidOrderId: domain.liquidOrderId || null,
            customerId: domain.customerId || cust?.id || null,
            liquidCustomerId: cust?.liquidCustomerId || null,
            customerName: cust?.name || reseller?.name || (userParam as any)?.name || (userParam as any)?.email || null,
            customerEmail: cust?.email || reseller?.email || (userParam as any)?.email || null,
            userId: domain.userId,
            resellerId: reseller?.resellerId || user.resellerId || null,
          };
        }
      } catch {
        // ignore — fall back to local column
      }
    }

    const ownerContactFallback = {
      name: cust?.name || reseller?.name || (userParam as any)?.name || (userParam as any)?.email?.split("@")[0] || undefined,
      company: cust?.company || undefined,
      email: cust?.email || reseller?.email || (userParam as any)?.email || undefined,
      address: cust?.address || undefined,
      city: cust?.city || undefined,
      state: cust?.state || undefined,
      country: cust?.country || "ID",
      zipcode: cust?.zipcode || undefined,
      phone: cust?.phone || undefined,
    };

    const nsFormatted = parseNameservers(domain.nameservers);

    return {
      ...domain,
      nameservers: nsFormatted,
      registrantContact: ownerContactFallback,
      adminContact: ownerContactFallback,
      techContact: ownerContactFallback,
      billingContact: ownerContactFallback,
      raaVerification: { status: "verified", canResend: false },
      _local: true,
      domainId: domain.id,
      liquidOrderId: domain.liquidOrderId || null,
      customerId: domain.customerId || cust?.id || null,
      liquidCustomerId: cust?.liquidCustomerId || null,
      customerName: cust?.name || reseller?.name || (userParam as any)?.name || (userParam as any)?.email || null,
      customerEmail: cust?.email || reseller?.email || (userParam as any)?.email || null,
      userId: domain.userId,
      resellerId: reseller?.resellerId || user.resellerId || null,
    };
  }

  // Live-only fallback: probe Resellercamp so client-side links to liquidOrderId still resolve.
  // Used when the domain listing is served live (no DB cache) but the row was never synced locally.
  const liquid = await getLiquid(userParam);
  if (!liquid) throw new AppError("Domain not found", 404);
  let liquidItem: any = null;
  try {
    liquidItem = await liquid.getDomain(lookupStr);
  } catch (e: any) {
    // Bubble 404 verbatim if the API call itself fails (e.g. invalid id)
    if (e?.status === 404 || /not\s*found/i.test(String(e?.message || ""))) {
      throw new AppError("Domain not found", 404);
    }
  }
  if (!liquidItem) {
    throw new AppError("Domain not found", 404);
  }

  // H11: ownership check on the live-only fallback — a customer must only reach
  // domains belonging to their own Liquid customer id (resellers see all their own).
  if (userRole === "customer") {
    const custs = await db.select({ id: customers.id, liquidCustomerId: customers.liquidCustomerId }).from(customers)
      .where(or(eq(customers.userId, userId), eq(customers.email, user.email || "")));
    const liquidCustId = String(liquidItem.customer_id || liquidItem.customerid || liquidItem.customerId || "").trim();
    const owned = liquidCustId && custs.some((c) => c.liquidCustomerId && String(c.liquidCustomerId) === liquidCustId);
    // ponytail: fail closed when the API response lacks customer_id; add field
    // mapping here if a Liquid domain response shape without customer_id appears.
    if (!owned) {
      throw new AppError("Domain not found", 404);
    }
  }

  const statusMap: Record<string, string> = {
    live: "active",
    active: "active",
    unpaid: "pending",
    pending: "pending",
    expired: "expired",
    "pending delete restorable": "expired",
    "pending transfer": "transferred",
    "pending restore": "suspended",
    suspended: "suspended",
    cancelled: "expired",
  };
  const domainName = (liquidItem.domain_name || liquidItem.name || liquidItem.domain || "").toLowerCase().trim();
  if (!domainName) throw new AppError("Domain not found", 404);
  const liquidStatus = String(liquidItem.status || "").toLowerCase().trim();
  const liquidFlagSuspended = liquidItem.suspended === true || String(liquidItem.suspended).toLowerCase() === "true";
  const mappedStatus = (liquidFlagSuspended || statusMap[liquidStatus] === "suspended") ? "suspended" : (statusMap[liquidStatus] || "active");

  const liquidDomainId = String(liquidItem.domain_id || liquidItem.order_id || liquidItem.id || lookupStr);
  let suspendReason: string | null = null;
  let suspendedAt: string | null = null;
  let mappedStatusFinal = mappedStatus;

  // Overlay suspend from any local row matching this liquidOrderId — covers the case
  // where the lookup hit the live fallback (no local row for this user) but a reseller-
  // owned local row still records the suspend. Resellercamp's /domains list/dashboard
  // lookup doesn't always reflect suspension immediately.
  try {
    const [localRow] = await db
      .select({ status: domains.status, suspendReason: domains.suspendReason, suspendedAt: domains.suspendedAt })
      .from(domains)
      .where(eq(domains.liquidOrderId, liquidDomainId))
      .limit(1);
    if (localRow?.status === "suspended") {
      mappedStatusFinal = "suspended";
      suspendReason = localRow.suspendReason ?? null;
      suspendedAt = localRow.suspendedAt ? new Date(localRow.suspendedAt).toISOString() : null;
    }
  } catch {
    // ignore
  }

  if (mappedStatusFinal === "suspended" && !suspendReason) {
    try {
      const s = await liquid.getSuspendStatus(liquidDomainId);
      const payload = (s && typeof s === "object" && (s as any).data) ? (s as any).data : s;
      const reason = (payload && (payload.reason ?? payload.suspend_reason ?? payload.message)) ?? null;
      const at = (payload && (payload.suspended_at ?? payload.suspend_at ?? payload.timestamp ?? payload.created_at)) ?? null;
      suspendReason = reason ? String(reason) : null;
      suspendedAt = at ? String(at) : null;
    } catch {
      // ignore
    }
  }

  const isDotIdDomain = domainName.toLowerCase().endsWith(".id");
  let livePrivacyFlag = parsePrivacyProtectionStatus(liquidItem);
  if (liquidDomainId && !isDotIdDomain) {
    try {
      const livePriv = await liquid.getPrivacyProtection(liquidDomainId);
      const privFlag = parsePrivacyProtectionStatus(livePriv);
      if (privFlag) {
        livePrivacyFlag = true;
      }
    } catch {}
  }

  let liveNs = parseNameservers(liquidItem.nameservers) || parseNameservers(liquidItem.ns) || parseNameservers(liquidItem);
  if ((!liveNs || liveNs.length === 0) && liquidDomainId) {
    try {
      const liveNsRaw = await liquid.getNameservers(liquidDomainId);
      liveNs = parseNameservers(liveNsRaw);
    } catch {}
  }

  const defaultRemoteOwner = {
    name: liquidItem.customer_name || (userParam as any)?.name || (userParam as any)?.email?.split("@")[0] || undefined,
    company: liquidItem.company_name || undefined,
    email: liquidItem.customer_email || (userParam as any)?.email || undefined,
    address: liquidItem.address || undefined,
    city: liquidItem.city || undefined,
    state: liquidItem.state || undefined,
    country: liquidItem.country || "ID",
    zipcode: liquidItem.zipcode || undefined,
    phone: liquidItem.phone || undefined,
  };

  const registrantContact = parseDomainContact(liquidItem.registrant_contact ?? liquidItem.registrant ?? liquidItem.registrant_contact_details ?? liquidItem.registrantcontact ?? liquidItem.contacts?.registrant) || defaultRemoteOwner;
  const adminContact = parseDomainContact(liquidItem.admin_contact ?? liquidItem.admin ?? liquidItem.admin_contact_details ?? liquidItem.admincontact ?? liquidItem.contacts?.admin) || registrantContact;
  const techContact = parseDomainContact(liquidItem.tech_contact ?? liquidItem.tech ?? liquidItem.technical_contact ?? liquidItem.tech_contact_details ?? liquidItem.techcontact ?? liquidItem.contacts?.tech) || registrantContact;
  const billingContact = parseDomainContact(liquidItem.billing_contact ?? liquidItem.billing ?? liquidItem.billing_contact_details ?? liquidItem.billingcontact ?? liquidItem.contacts?.billing) || registrantContact;
  const raaVerification = parseRaaVerification(liquidItem.raa_verification ?? liquidItem.raa_status ?? liquidItem.raa_verification_status);



  return {
    _local: false,
    id: Number(liquidItem.domain_id || liquidItem.order_id || liquidItem.id || lookupNum) || 0,
    domainId: Number(liquidItem.domain_id || liquidItem.order_id || liquidItem.id || lookupNum) || 0,
    domainName,
    tld: domainName.split(".").slice(1).join("."),
    registrationDate: cleanDateOnly(liquidItem.creation_time || liquidItem.creation_date),
    expiryDate: cleanDateOnly(liquidItem.expiry_date),
    years: Number(liquidItem.no_of_years || 1),
    status: mappedStatusFinal,
    suspendReason,
    suspendedAt,
    autoRenew: liquidItem.renewal_mode === "auto" || liquidItem.renewal_mode === "auto_renew" ? 1 : 0,
    locked: liquidItem.status === "transferlock" || liquidItem.locked === "true" || liquidItem.locked === true ? 1 : 0,
    theftProtection: liquidItem.theft_protection === "true" || liquidItem.theft_protection === true ? 1 : 0,
    privacyProtection: livePrivacyFlag ? 1 : 0,
    liquidOrderId: liquidDomainId,
    nameservers: liveNs || null,
    registrantContact,
    adminContact,
    techContact,
    billingContact,
    raaVerification,
    customerId: liquidItem.customer_id ? Number(liquidItem.customer_id) : null,
    customerName: liquidItem.customer_name || null,
    customerEmail: liquidItem.customer_email || null,
    userId: userId,
    resellerId: user.resellerId || null,
    createdAt: liquidItem.creation_time || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function renewDomain(user: { id?: number; resellerId: string | null; apiKey: string | null }, userParam: any, domainId: string | number, years: number) {
  const domain = await getDomain(userParam, domainId);
  const liquid = await getLiquidRequired(user);
  const liquidRes = await liquid.renewDomain(String(domain.liquidOrderId || domain.domainName), years);
  await db.update(domains).set({ years: (domain.years || 1) + years }).where(eq(domains.id, domain.id));
  return { domain_id: domain.id, domain_name: domain.domainName, years_added: years, previous_expiry: domain.expiryDate, new_expiry: liquidRes?.expiry_date || null };
}

export async function updateLock(user: { id?: number; resellerId: string | null; apiKey: string | null }, userParam: any, domainId: string | number, lock: boolean) {
  const domain = await getDomain(userParam, domainId);
  assertNotSuspended(domain);
  // N5: short-circuit if already in desired state (concurrent tab toggle)
  if (Boolean(domain.locked) === lock) {
    return { locked: lock, alreadyInState: true };
  }
  const liquid = await getLiquidRequired(user);
  try {
    if (lock) await liquid.lockDomain(String(domain.liquidOrderId || domain.domainName));
    else await liquid.unlockDomain(String(domain.liquidOrderId || domain.domainName));
  } catch (err: any) {
    const msg = String(err?.message || "").toLowerCase();
    if (msg.includes("already locked")) {
      await db.update(domains).set({ locked: 1 }).where(eq(domains.id, domain.id));
      return { locked: true, message: "Domain already locked" };
    }
    if (msg.includes("already unlocked") || msg.includes("not locked")) {
      await db.update(domains).set({ locked: 0 }).where(eq(domains.id, domain.id));
      return { locked: false, message: "Domain already unlocked" };
    }
    throw err;
  }
  // N5: CAS — only write if local state still matches the expected pre-state
  const res: any = await db.update(domains)
    .set({ locked: lock ? 1 : 0 })
    .where(and(eq(domains.id, domain.id), eq(domains.locked, lock ? 0 : 1)));
  if ((res[0]?.affectedRows ?? 0) === 0) {
    return { locked: Boolean(domain.locked), alreadyInState: true };
  }
  return { locked: lock };
}

export async function updateNameservers(user: { id?: number; resellerId: string | null; apiKey: string | null }, userParam: any, domainId: string | number, ns: string[]) {
  const domain = await getDomain(userParam, domainId);
  assertNotSuspended(domain);
  const liquid = await getLiquidRequired(user);

  let domainRef = String(domain.liquidOrderId || "").trim();
  if (!domainRef || !/^\d+$/.test(domainRef)) {
    if (domain.domainName) {
      try {
        const item: any = await liquid.getDomain(domain.domainName);
        const orderId = String(item?.domain_id || item?.order_id || item?.id || "");
        if (orderId) {
          domainRef = orderId;
          if (domain._local && domain.id) {
            await db.update(domains).set({ liquidOrderId: orderId }).where(eq(domains.id, domain.id));
          }
        }
      } catch {}
    }
  }
  if (!domainRef) domainRef = String(domain.domainName || domainId);

  const cleanNs = ns.map((s) => s.trim()).filter(Boolean);

  await liquid.updateNameservers(domainRef, cleanNs);

  let verifiedNs = cleanNs;
  try {
    const liveNsRaw = await liquid.getNameservers(domainRef);
    const parsed = parseNameservers(liveNsRaw);
    if (parsed && parsed.length > 0) {
      verifiedNs = parsed;
    }
  } catch {}

  const targetUserId = typeof userParam === "object" ? userParam.id : Number(userParam);
  if (domain._local && domain.id) {
    await db.update(domains).set({ nameservers: verifiedNs }).where(eq(domains.id, domain.id));
  } else if (domain.domainName) {
    try {
      await db.insert(domains).values({
        userId: targetUserId || user.id,
        customerId: domain.customerId || null,
        domainName: domain.domainName,
        tld: domain.tld || domain.domainName.split(".").slice(1).join("."),
        years: domain.years || 1,
        status: (domain.status as any) || "active",
        liquidOrderId: domain.liquidOrderId || null,
        nameservers: verifiedNs,
      }).onDuplicateKeyUpdate({ set: { nameservers: verifiedNs } });
    } catch (e) {
      console.warn(`[updateNameservers] Failed to upsert local domain for ${domain.domainName}:`, e);
    }
  }

  return { domain_id: domainId, nameservers: verifiedNs };
}

export async function getAuthCode(user: { id?: number; resellerId: string | null; apiKey: string | null }, userParam: any, domainId: string | number) {
  const domain = await getDomain(userParam, domainId);
  const liquid = await getLiquidRequired(user);

  let ref = String(domain.liquidOrderId || "").trim();
  if (!ref && domain.domainName) {
    try {
      const item: any = await liquid.getDomain(domain.domainName);
      const orderId = String(item?.domain_id || item?.order_id || item?.id || "");
      if (orderId) {
        ref = orderId;
        await db.update(domains).set({ liquidOrderId: orderId }).where(eq(domains.id, domain.id));
      }
    } catch {}
  }
  if (!ref) ref = String(domain.domainName || domainId);

  // Strategy 1: Call GET /domains/{ref}/auth_code
  try {
    const raw = await liquid.getAuthCode(ref);
    const code = extractAuthCode(raw);
    if (code) return { auth_code: code };
  } catch (err: any) {
    console.warn(`[getAuthCode] liquid.getAuthCode failed for ref=${ref}:`, err?.message);
  }

  // Strategy 2: Try domainName if ref was numeric or vice versa
  if (domain.domainName && ref !== domain.domainName) {
    try {
      const raw = await liquid.getAuthCode(domain.domainName);
      const code = extractAuthCode(raw);
      if (code) return { auth_code: code };
    } catch {}
  }

  // Strategy 3: Try GET /domains/{ref} details
  try {
    const item: any = await liquid.getDomain(ref);
    const code = extractAuthCode(item);
    if (code) return { auth_code: code };
  } catch {}

  return { auth_code: "-" };
}


export async function updateAuthCode(user: { id?: number; resellerId: string | null; apiKey: string | null }, userParam: any, domainId: string | number, authCode: string) {
  const domain = await getDomain(userParam, domainId);
  assertNotSuspended(domain);
  const liquid = await getLiquidRequired(user);
  return liquid.updateAuthCode(String(domain.liquidOrderId || domain.domainName || domainId), authCode);
}

export async function toggleTheftProtection(user: { id?: number; resellerId: string | null; apiKey: string | null }, userParam: any, domainId: string | number, enable: boolean) {
  const domain = await getDomain(userParam, domainId);
  assertNotSuspended(domain);
  // N5: short-circuit if already in desired state
  if (Boolean(domain.theftProtection) === enable) {
    return { theftProtection: enable, alreadyInState: true };
  }
  const liquid = await getLiquidRequired(user);
  try {
    if (enable) await liquid.enableTheftProtection(String(domain.liquidOrderId || domain.domainName));
    else await liquid.disableTheftProtection(String(domain.liquidOrderId || domain.domainName));
  } catch (err: any) {
    const msg = String(err?.message || "").toLowerCase();
    if (msg.includes("already enabled") || msg.includes("already active")) {
      await db.update(domains).set({ theftProtection: 1 }).where(eq(domains.id, domain.id));
      return { theftProtection: true, message: "Theft protection is already enabled" };
    }
    if (msg.includes("already disabled") || msg.includes("not enabled")) {
      await db.update(domains).set({ theftProtection: 0 }).where(eq(domains.id, domain.id));
      return { theftProtection: false, message: "Theft protection is already disabled" };
    }
    throw err;
  }
  // N5: CAS
  const res: any = await db.update(domains)
    .set({ theftProtection: enable ? 1 : 0 })
    .where(and(eq(domains.id, domain.id), eq(domains.theftProtection, enable ? 0 : 1)));
  if ((res[0]?.affectedRows ?? 0) === 0) {
    return { theftProtection: Boolean(domain.theftProtection), alreadyInState: true };
  }
  return { theftProtection: enable };
}

export async function restoreDomain(user: { id?: number; resellerId: string | null; apiKey: string | null }, userParam: any, domainId: string | number) {
  const domain = await getDomain(userParam, domainId);
  const liquid = await getLiquidRequired(user);
  const res = await liquid.restoreDomain(String(domain.liquidOrderId || domain.domainName));
  await db.update(domains).set({ status: "active" }).where(eq(domains.id, domain.id));
  return res;
}

export async function toggleSuspend(user: { id?: number; resellerId: string | null; apiKey: string | null }, userParam: any, domainId: string | number, suspend: boolean, reason?: string) {
  let domain = await getDomain(userParam, domainId) as any;
  const liquid = await getLiquidRequired(user);
  const ref = String(domain.liquidOrderId || domain.domainName);
  // Root-cause fix: Resellercamp's /domains LIST endpoint reports `suspended: false` even
  // for domains that are actually suspended (the `/domains/{id}` DETAIL and `/domains/{id}/suspended`
  // endpoints do reflect it correctly). The `domains/remote` overlay that list/dashboard rely on
  // can only re-flip status from local DB; if the local row never existed (reseller never synced),
  // the list shows "active" and the suspend banner vanishes after the next refresh.
  // Solution: ensure a local row exists BEFORE the short-circuit so the overlay has data to consult,
  // and skip the short-circuit when the status came from the live fallback (untrusted source).
  const targetUserId = user.id || domain.userId || (typeof userParam === "object" ? userParam.id : Number(userParam)) || 0;
  if (!domain._local && ref) {
    try {
      const liquidItem = await liquid.getDomain(ref);
      if (liquidItem) {
        const fullDomainName = (liquidItem.domain_name || liquidItem.name || "").toLowerCase().trim();
        const orderIdStr = String(liquidItem.domain_id || liquidItem.order_id || liquidItem.id || "");
        if (fullDomainName) {
          const tld = fullDomainName.split(".").slice(1).join(".");
          await db.insert(domains).values({
            userId: targetUserId,
            customerId: liquidItem.customer_id ? Number(liquidItem.customer_id) : null,
            domainName: fullDomainName,
            tld,
            years: Number(liquidItem.no_of_years || 1),
            status: "active",
            locked: liquidItem.locked === "true" || liquidItem.locked === true ? 1 : 0,
            liquidOrderId: orderIdStr || null,
            registrationDate: cleanDateOnly(liquidItem.creation_time),
            expiryDate: cleanDateOnly(liquidItem.expiry_date),
          } as any).onDuplicateKeyUpdate({ set: { domainName: sql`${domains.domainName}` } });
          domain = await getDomain(userParam, domainId);
        }
      }
    } catch (e: any) {
      // Fall through — best-effort; the list overlay won't have a local row, but the suspend
      // call against Resellercamp still goes through.
    }
  }

  // N5: short-circuit only when sourced from a real local row. Live-fallback status is
  // Resellercamp's list endpoint, which is unreliable for suspend — always proceed.
  const desiredStatus = suspend ? "suspended" : "active";
  if (domain._local && domain.status === desiredStatus) {
    return { status: domain.status, alreadyInState: true };
  }
  if (suspend) await liquid.suspendDomain(ref, reason);
  else await liquid.unsuspendDomain(ref);

  // Build update payload — persist reason and timestamp on suspend, clear on unsuspend.
  const updatePayload: any = { status: desiredStatus };
  if (suspend) {
    updatePayload.suspendReason = reason || null;
    updatePayload.suspendedAt = new Date();
  } else {
    updatePayload.suspendReason = null;
    updatePayload.suspendedAt = null;
  }

  // N5: CAS
  const res: any = await db.update(domains)
    .set(updatePayload)
    .where(and(eq(domains.id, domain.id), eq(domains.status, domain.status as any)));
  if ((res[0]?.affectedRows ?? 0) === 0) {
    return { status: domain.status, alreadyInState: true };
  }

  // After suspend, probe Resellercamp to canonicalize reason + suspendedAt (Liquid may adjust both).
  // Non-fatal: if the probe fails we keep the local values we just wrote.
  if (suspend) {
    try {
      const status = await liquid.getSuspendStatus(ref);
      const canonicalReason = status?.reason || status?.data?.reason || reason || null;
      const canonicalTs = status?.suspended_at || status?.data?.suspended_at || status?.data?.created_at || null;
      const canonicalDate = canonicalTs ? new Date(canonicalTs) : null;
      const finalUpdate: any = {};
      if (canonicalReason) finalUpdate.suspendReason = canonicalReason;
      if (canonicalDate && !isNaN(canonicalDate.getTime())) finalUpdate.suspendedAt = canonicalDate;
      if (Object.keys(finalUpdate).length > 0) {
        await db.update(domains).set(finalUpdate).where(eq(domains.id, domain.id));
      }
    } catch (e: any) {
      console.warn(`[toggleSuspend] Resellercamp suspend status probe failed for domain ${domain.id}:`, e?.message || e);
    }
  }

  return { status: desiredStatus, reason: suspend ? (reason || null) : null };
}

export async function deleteDomainRecord(user: { id: number; resellerId: string | null; apiKey: string | null; role?: string | null; email?: string | null }, domainId: string | number) {
  const domain = await getDomain(user, domainId);
  // Per LIQUID docs (DELETE /v1/domains/{domain_id}), deletion is allowed regardless of status.
  // We delete the wholesale order first; only then purge the local cache row.
  const liquid = await getLiquidRequired(user);
  await liquid.deleteDomain(String(domain.liquidOrderId || domain.domainName));
  await db.delete(domains).where(eq(domains.id, domain.id));
}

// Short-TTL search result cache (60 seconds) to provide instant 0ms responses for repeated keyword lookups
interface CachedSearchResult {
  results: any[];
  expiresAt: number;
}
const searchResultCache = new Map<string, CachedSearchResult>();
const SEARCH_CACHE_TTL_MS = 60_000;

const DEFAULT_TLD_PRICES: Record<string, any> = {
  "com": { price_new: 180000, price_renew: 209000, price_transfer: 209000 },
  "id": { price_new: 241500, price_renew: 241500, price_transfer: 241500 },
  "co.id": { price_new: 310500, price_renew: 310500, price_transfer: 310500 },
  "my.id": { price_new: 5000, price_renew: 15000, price_transfer: 15000 },
  "web.id": { price_new: 5000, price_renew: 60000, price_transfer: 60000 },
  "biz.id": { price_new: 5000, price_renew: 15000, price_transfer: 15000 },
  "xyz": { price_new: 68890, price_renew: 194350, price_transfer: 194350 },
  "or.id": { price_new: 56930, price_renew: 56930, price_transfer: 56930 },
  "ac.id": { price_new: 56930, price_renew: 56930, price_transfer: 56930 },
  "sch.id": { price_new: 56930, price_renew: 56930, price_transfer: 56930 },
  "ponpes.id": { price_new: 50490, price_renew: 50490, price_transfer: 50490 },
  "net": { price_new: 209000, price_renew: 209000, price_transfer: 209000 },
  "org": { price_new: 209000, price_renew: 209000, price_transfer: 209000 },
  "info": { price_new: 209000, price_renew: 209000, price_transfer: 209000 },
  "biz": { price_new: 209000, price_renew: 209000, price_transfer: 209000 },
};

export async function bulkAvailability(user: { id?: number; resellerId: string | null; apiKey: string | null; role?: string }, keyword: string) {
  // 1. Strict Input Sanitization & Validation
  if (!keyword || typeof keyword !== "string") return [];
  
  // Strip protocols, spaces, and invalid control/injection characters
  let cleanInput = keyword.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/[^\w\.\-]/g, "");
  const parts = cleanInput.split(".").filter(Boolean);
  if (parts.length === 0) return [];
  
  let baseKeyword = parts[0] || "";
  if (!baseKeyword) return [];
  // Limit max label length per RFC 1035 (63 chars)
  if (baseKeyword.length > 63) baseKeyword = baseKeyword.slice(0, 63);
  const requestedTld = parts.length > 1 ? parts.slice(1).join(".") : null;

  console.log(`[bulkAvailability] keyword="${keyword}" → base="${baseKeyword}", requestedTld=${requestedTld || "all"}`);

  const cacheKey = `search:${baseKeyword}:${requestedTld || "all"}`;
  const cached = searchResultCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    console.log(`[bulkAvailability] Returning cached results for "${cacheKey}"`);
    return cached.results;
  }

  const liquid = await getLiquid(user);
  console.log(`[bulkAvailability] Liquid client: ${liquid ? "OK" : "NULL (no credentials)"}`);

  let prices: any = {};
  const tldSet = new Set<string>();

  // 2. Fetch active customer prices from Resellercamp (uses 15-min in-memory cache)
  if (liquid) {
    try {
      const raw = await liquid.getCustomerPrices();
      prices = formatCustomerPrices(raw);
      for (const k of Object.keys(prices)) {
        if (k && k !== "addons") tldSet.add(k.toLowerCase());
      }
    } catch (e: any) {
      console.warn("[bulkAvailability] getCustomerPrices warning:", e?.message);
    }

    // Fallback: liquid.getPrices() if getCustomerPrices returned empty
    if (tldSet.size === 0) {
      try {
        const raw = await liquid.getPrices();
        prices = formatCustomerPrices(raw);
        for (const k of Object.keys(prices)) {
          if (k && k !== "addons") tldSet.add(k.toLowerCase());
        }
      } catch {}
    }
  }

  // Fallback default supported Resellercamp TLDs if still empty
  if (tldSet.size === 0) {
    const defaultTlds = ["com", "id", "co.id", "my.id", "or.id", "web.id", "biz.id", "ac.id", "sch.id", "ponpes.id", "biz", "info", "xyz", "net", "org"];
    for (const t of defaultTlds) tldSet.add(t);
  }

  let tldsToQuery = Array.from(tldSet);

  // If user searched for a specific TLD (e.g. "web.id"), ensure it is placed first if supported
  if (requestedTld) {
    if (tldSet.has(requestedTld)) {
      tldsToQuery = [requestedTld, ...tldsToQuery.filter(t => t !== requestedTld)];
    } else {
      // If user specifically searched a supported/valid TLD not in prices, include it as primary
      tldsToQuery.unshift(requestedTld);
    }
  }

  // Helper to extract status from Resellercamp response shape
  function extractDomainStatus(res: any, fullDomain: string): string | null {
    if (!res) return null;
    const targetDomain = fullDomain.trim().toLowerCase();

    // If response is wrapped in { data: ... } or { result: ... }
    const data = res.data ?? res.result ?? res;

    // 1. If data is an Array: loop each element
    if (Array.isArray(data)) {
      for (const item of data) {
        if (!item || typeof item !== "object") continue;
        for (const [k, v] of Object.entries(item)) {
          if (k.toLowerCase() === targetDomain) {
            if (typeof v === "string") return v.toLowerCase();
            if (v && typeof v === "object") return String((v as any).status || (v as any).classkey || "").toLowerCase() || null;
          }
        }
        const itemDomain = String(item.domain || item.domain_name || item.name || "").toLowerCase();
        if (itemDomain === targetDomain && item.status) {
          return String(item.status).toLowerCase();
        }
      }
      if (data.length === 1 && data[0] && typeof data[0] === "object" && typeof data[0].status === "string" && !data[0].domain) {
        return data[0].status.toLowerCase();
      }
    }

    // 2. If data is an Object:
    if (typeof data === "object") {
      for (const [k, v] of Object.entries(data)) {
        if (k.toLowerCase() === targetDomain) {
          if (typeof v === "string") return v.toLowerCase();
          if (v && typeof v === "object") return String((v as any).status || (v as any).classkey || "").toLowerCase() || null;
        }
      }
      if (typeof data.status === "string" && !data.domain && Object.keys(data).length <= 3) {
        return data.status.toLowerCase();
      }
    }

    return null;
  }

  const allFullDomains = tldsToQuery.map(t => `${baseKeyword}.${t}`.toLowerCase());

  // 3. Query Resellercamp API for all target domains concurrently
  let apiData: any = null;
  let apiSucceeded = false;

  if (liquid) {
    try {
      apiData = await liquid.checkBulkAvailability(allFullDomains, 8_000);
      apiSucceeded = Boolean(apiData && typeof apiData === "object" && Object.keys(apiData).length > 0);
      console.log(`[bulkAvailability] API response keys:`, apiData ? Object.keys(apiData) : "null");
    } catch (e: any) {
      console.warn("[bulkAvailability] API batch check failed:", e?.message);
    }
  } else {
    console.warn("[bulkAvailability] No Liquid client — all domains will be marked 'unknown'");
  }

  // 4. Resolve each TLD status directly from Resellercamp API response
  const results = tldsToQuery.map((tld) => {
    const fullDomain = `${baseKeyword}.${tld}`.toLowerCase();
    let isAvailable = false;
    let statusResolved = false;
    let finalStatus = "unknown";

    if (apiData) {
      const rawStatus = extractDomainStatus(apiData, fullDomain);
      if (rawStatus) {
        const st = rawStatus.toLowerCase().trim();
        if (st === "available" || st === "free" || st === "available_for_registration") {
          isAvailable = true;
          statusResolved = true;
          finalStatus = "available";
        } else {
          // regthroughus, regthroughothers, registered, taken, active, pending, unknown, etc.
          isAvailable = false;
          statusResolved = true;
          finalStatus = "unavailable";
        }
        console.log(`[bulkAvailability] ${fullDomain} → API status: "${rawStatus}" → ${finalStatus}`);
      }
    }

    if (!statusResolved) {
      isAvailable = false;
      finalStatus = "unknown";
      console.log(`[bulkAvailability] ${fullDomain} → no API data, marked as "unknown"`);
    }

    const tldPrice = prices[tld] || DEFAULT_TLD_PRICES[tld] || {};

    return {
      domain: fullDomain,
      tld,
      available: isAvailable,
      status: finalStatus,
      price: tldPrice.price_new || tldPrice.price_register || DEFAULT_TLD_PRICES[tld]?.price_new || null,
      renew_price: tldPrice.price_renew || DEFAULT_TLD_PRICES[tld]?.price_renew || null,
      transfer_price: tldPrice.price_transfer || tldPrice.price_renew || DEFAULT_TLD_PRICES[tld]?.price_transfer || null,
      create_years: tldPrice.create_years || null,
      renew_years: tldPrice.renew_years || null,
      privacy_protect: tldPrice.privacy_protect || "70.00",
      currency: tldPrice.currency || "IDR",
    };
  });

  // Only cache results if API actually succeeded (don't cache fallback/failure results)
  if (results.length > 0 && apiSucceeded) {
    searchResultCache.set(cacheKey, { results, expiresAt: Date.now() + SEARCH_CACHE_TTL_MS });
  }

  return results;
}

export async function syncDomainsFromLiquid(userParam: { id: number; role?: string | null; resellerId?: string | null; apiKey?: string | null }) {
  const userId = typeof userParam === "object" ? userParam.id : userParam;
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u) throw new AppError("User not found", 404);

  const syncCreds = await resolveResellerCreds(userId);
  if (!syncCreds.resellerId || !syncCreds.apiKey) {
    throw new AppError("Resellercamp credentials not configured", 400);
  }

  const liquid = new LiquidClient(syncCreds.resellerId, syncCreds.apiKey);

  const statusMap: Record<string, string> = {
    live: "active",
    active: "active",
    unpaid: "pending",
    pending: "pending",
    expired: "expired",
    "pending delete restorable": "expired",
    "pending transfer": "transferred",
    "pending restore": "suspended",
    suspended: "suspended",
    cancelled: "expired",
  };

  let syncedCount = 0;
  let newAddedCount = 0;
  let total = 0;
  let pageNo = 1;

  while (true) {
    const rawDomains = await liquid.listDomains({ limit: "100", page_no: String(pageNo) }).catch(() => null);
    if (!rawDomains) break;
    const domainList = Array.isArray(rawDomains) ? rawDomains : rawDomains?.data || rawDomains?.domains || [];
    if (domainList.length === 0) break;

    for (const item of domainList) {
      try {
        const fullDomainName = (item.domain_name || item.name || item.domain || "").toLowerCase().trim();
        if (!fullDomainName) continue;

        const orderIdStr = String(item.domain_id || item.order_id || item.id || "");
        const parts = fullDomainName.split(".");
        const tld = parts.slice(1).join(".");

        const rawStatus = (item.status || "").toLowerCase().trim();
        let status = statusMap[rawStatus] || "active";

        let matchedCustomerId: number | null = null;
        let matchedUserId: number = u.id;

        if (item.customer_id) {
          const [c] = await db.select().from(customers).where(eq(customers.liquidCustomerId, String(item.customer_id)));
          if (c) {
            matchedCustomerId = c.id;
            if (c.userId) matchedUserId = c.userId;
          }
        }
        if (!matchedCustomerId && item.customer_email) {
          const [c] = await db.select().from(customers).where(eq(customers.email, String(item.customer_email)));
          if (c) {
            matchedCustomerId = c.id;
            if (c.userId) matchedUserId = c.userId;
          }
        }
        if (!matchedCustomerId && (item.customer_id || item.customer_email)) {
          try {
            const [newCust] = await db.insert(customers).values({
              liquidCustomerId: item.customer_id ? String(item.customer_id) : null,
              name: item.customer_name || item.customer_email?.split("@")[0] || "Customer",
              email: item.customer_email || `customer-${item.customer_id}@ekstensi.id`,
              company: "Personal",
              address: "Indonesia",
              city: "Jakarta",
              state: "DKI Jakarta",
              country: "ID",
              zipcode: "10110",
              phone: "8123456789",
            } as any);
            const newCustId = Number((newCust as any).insertId);
            if (newCustId > 0) matchedCustomerId = newCustId;
          } catch {}
        }

        const regDate = ((item.creation_time || item.creation_date) ? new Date(item.creation_time || item.creation_date).toISOString().split("T")[0] : null) as string | null;
        const expDate = (item.expiry_date ? new Date(item.expiry_date).toISOString().split("T")[0] : null) as string | null;

        const preExisting = await db.select().from(domains).where(eq(domains.domainName, fullDomainName)).limit(1);
        const existing = preExisting[0] || null;

        // N7: skip downgrade — if local row is active/pending and a completed transaction
        // exists for this domain, the user has paid; don't let a Liquid-side lag or
        // transitional status (e.g. "pending delete restorable") downgrade to expired.
        if (existing && (existing.status === "active" || existing.status === "pending")) {
          if (status === "expired" || status === "suspended") {
            const [paidTx] = await db.select({ id: transactions.id })
              .from(transactions)
              .where(and(
                eq(transactions.domainId, existing.id),
                eq(transactions.status, "completed"),
              ))
              .limit(1);
            if (paidTx) status = existing.status;
          }
        }

        const privacyFlag = parsePrivacyProtectionStatus(item);
        const isLocked = item.status === "transferlock" || item.locked === "true" || item.locked === true;
        const isTheft = item.theft_protection === "true" || item.theft_protection === true;

        if (existing) {
          await db.update(domains).set({
            liquidOrderId: orderIdStr || existing.liquidOrderId,
            customerId: matchedCustomerId || existing.customerId,
            status: status as any,
            registrationDate: regDate || existing.registrationDate || null,
            expiryDate: expDate || existing.expiryDate || null,
            privacyProtection: privacyFlag ? 1 : existing.privacyProtection,
            locked: isLocked ? 1 : existing.locked,
            theftProtection: isTheft ? 1 : existing.theftProtection,
          }).where(eq(domains.id, existing.id));
          syncedCount++;
        } else {
          await db.insert(domains).values({
            userId: matchedUserId,
            customerId: matchedCustomerId,
            domainName: fullDomainName,
            tld,
            years: 1,
            status: status as any,
            liquidOrderId: orderIdStr || null,
            registrationDate: regDate,
            expiryDate: expDate,
            privacyProtection: privacyFlag ? 1 : 0,
            locked: isLocked ? 1 : 0,
            theftProtection: isTheft ? 1 : 0,
          }).onDuplicateKeyUpdate({ set: { domainName: sql`${domains.domainName}` } });
          newAddedCount++;
          syncedCount++;
        }

      } catch (err) {
        console.error(`[syncDomains] skip ${item?.domain_name || item?.name || item?.id}:`, err);
      }
    }

    total += domainList.length;
    if (domainList.length < 100) break;
    pageNo++;
  }

  return { syncedCount, newAddedCount, total };
}

// Proxy list directly from Resellercamp (no DB cache). Returns paginated + total reached-end flag.
export async function listDomainsFromLiquid(
  creds: { resellerId: string; apiKey: string },
  customerLiquidId: string | null,
  page: number,
  perPage: number,
) {
  if (!creds?.resellerId || !creds?.apiKey) {
    throw new AppError("Resellercamp credentials not configured", 400);
  }
  const liquid = new LiquidClient(creds.resellerId, creds.apiKey);
  const params: Record<string, string> = {
    limit: String(perPage),
    page_no: String(page),
  };
  if (customerLiquidId) params.customer_id = String(customerLiquidId);

  const raw = await liquid.listDomains(params);
  const list: any[] = Array.isArray(raw) ? raw : raw?.data || raw?.domains || [];

  const statusMap: Record<string, string> = {
    live: "active",
    active: "active",
    unpaid: "pending",
    pending: "pending",
    expired: "expired",
    "pending delete restorable": "expired",
    "pending transfer": "transferred",
    "pending restore": "suspended",
    suspended: "suspended",
    cancelled: "expired",
  };

  const mapped = await Promise.all(
    list.map(async (item: any) => {
      const name = (item.domain_name || item.name || item.domain || "").toLowerCase().trim();
      if (!name) return null;
      const domainId = String(item.domain_id || item.order_id || item.id || "");
      // Resellercamp's /domains list reports order_status="live" even when suspended;
      // the boolean `suspended: true` is the source of truth for live suspensions.
      const liquidFlagSuspended = item.suspended === true || String(item.suspended).toLowerCase() === "true";
      const status = (liquidFlagSuspended || statusMap[(item.status || "").toLowerCase().trim()] === "suspended")
        ? "suspended"
        : (statusMap[(item.status || "").toLowerCase().trim()] || "active");

      let suspendReason: string | null = null;
      let suspendedAt: string | null = null;
      if (status === "suspended" && domainId) {
        try {
          const s = await liquid.getSuspendStatus(domainId);
          const payload = (s && typeof s === "object" && (s as any).data) ? (s as any).data : s;
          const reason = (payload && (payload.reason ?? payload.suspend_reason ?? payload.message)) ?? null;
          const at = (payload && (payload.suspended_at ?? payload.suspend_at ?? payload.timestamp ?? payload.created_at)) ?? null;
          suspendReason = reason ? String(reason) : null;
          suspendedAt = at ? String(at) : null;
        } catch {
          // ignore — surface as unsuspended-detail; status still "suspended"
        }
      }

      return {
        liquidOrderId: domainId,
        domainName: name,
        tld: name.split(".").slice(1).join(""),
        status,
        suspendReason,
        suspendedAt,
        registrationDate: cleanDateOnly(item.creation_time || item.creation_date),
        expiryDate: cleanDateOnly(item.expiry_date),
        autoRenew: item.renewal_mode === "auto" || item.renewal_mode === "auto_renew" ? 1 : 0,
        locked: item.status === "transferlock" || item.locked === "true" || item.locked === true ? 1 : 0,
        theftProtection: item.theft_protection === "true" || item.theft_protection === true ? 1 : 0,
        privacyProtection: parsePrivacyProtectionStatus(item) ? 1 : 0,
        customerId: item.customer_id ? String(item.customer_id) : null,
        customerName: item.customer_name || null,
        customerEmail: item.customer_email || null,
        nameservers: item.nameservers || null,
      };
    }),
  );
  const items = mapped.filter(Boolean);

  // Overlay local DB suspend state — Resellercamp's /domains list does not always
  // reflect suspension immediately, so trust our local writes (suspend/unsuspend).
  const liquidIds = items.map((it: any) => it.liquidOrderId).filter(Boolean);
  if (liquidIds.length > 0) {
    const localRows: any[] = await db
      .select({
        liquidOrderId: domains.liquidOrderId,
        status: domains.status,
        suspendReason: domains.suspendReason,
        suspendedAt: domains.suspendedAt,
        privacyProtection: domains.privacyProtection,
      })
      .from(domains)
      .where(inArray(domains.liquidOrderId, liquidIds));
    const byId = new Map(localRows.map((r) => [String(r.liquidOrderId), r]));
    for (const it of items as any[]) {
      const local = byId.get(String(it.liquidOrderId));
      if (!local) continue;
      if (local.privacyProtection === 1) {
        it.privacyProtection = 1;
      }
      if (local.status === "suspended") {
        it.status = "suspended";
        if (local.suspendReason) it.suspendReason = local.suspendReason;
        if (local.suspendedAt) it.suspendedAt = new Date(local.suspendedAt).toISOString();
      } else if (local.status === "active" && it.status === "suspended") {
        // Local was unsuspended — Resellercamp still reports suspended. Trust local.
        it.status = "active";
        it.suspendReason = null;
        it.suspendedAt = null;
      }
    }
  }

  // Total estimate: if page returned less than perPage, we reached the end.
  const reachedEnd = list.length < perPage;
  const total = reachedEnd ? (page - 1) * perPage + list.length : page * perPage + 1;

  return { items, total, reachedEnd };
}

export async function resendRaaVerification(user: { id?: number; resellerId: string | null; apiKey: string | null }, userParam: any, domainId: string | number) {
  const domain = await getDomain(userParam, domainId);
  const liquid = await getLiquidRequired(user);
  let domainRef = String(domain.liquidOrderId || "").trim();
  if (!domainRef || !/^\d+$/.test(domainRef)) {
    if (domain.domainName) {
      try {
        const item: any = await liquid.getDomain(domain.domainName);
        const orderId = String(item?.domain_id || item?.order_id || item?.id || "");
        if (orderId) domainRef = orderId;
      } catch {}
    }
  }
  if (!domainRef) domainRef = String(domain.domainName || domainId);
  return liquid.resendRaaVerification(domainRef);
}

export async function verifyContactPublicService(params: { customerId: string; contactId: string; email: string; rawParams: any }) {
  console.log(`[domains.service] Executing public contact verification:`, params);
  
  try {
    const creds = await resolveResellerCreds(1);
    if (creds.resellerId && creds.apiKey && params.customerId) {
      const liquid = await getLiquid(creds);
      if (liquid && params.contactId) {
        await liquid.getContactDetails(params.customerId, params.contactId).catch(() => null);
      }
    }
  } catch (e) {
    console.warn("[domains.service] liquid verify probe warning:", e);
  }

  return {
    verifiedAt: new Date().toISOString(),
    status: "verified",
    email: params.email || undefined,
  };
}
