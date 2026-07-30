import { db } from "../../db";
import { domains, users } from "../../db/schema";
import { eq, and, like, inArray } from "drizzle-orm";
import { LiquidClient, formatCustomerPrices } from "../../lib/liquid";
import { AppError } from "../../lib/error";

function getLiquid(user: { resellerId: string | null; apiKey: string | null }): LiquidClient {
  return new LiquidClient(user.resellerId || "", user.apiKey || "");
}

export async function checkAvailability(user: { resellerId: string | null; apiKey: string | null; role?: string }, domain: string) {
  const liquid = getLiquid(user);
  const res = await liquid.checkAvailability(domain);

  // Extract TLD (e.g. "example.com" -> "com")
  const parts = domain.split(".");
  const tld = parts.length > 1 ? parts.slice(1).join(".").toLowerCase() : "";

  let priceInfo: any = null;
  if (tld) {
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

  // Attach price details to availability result
  if (Array.isArray(res) && res[0]) {
    const key = Object.keys(res[0])[0];
    if (key && res[0][key]) {
      res[0][key].price = priceInfo?.price_new || priceInfo?.price_register || null;
      res[0][key].renew_price = priceInfo?.price_renew || null;
      res[0][key].privacy_protect = priceInfo?.privacy_protect || "70.00";
      res[0][key].currency = priceInfo?.currency || "IDR";
    }
  }

  return res;
}

import { createDomainOrderPayment } from "../payments/payments.service";

export async function getSuggestions(user: { resellerId: string | null; apiKey: string | null }, keyword: string, tld?: string) {
  return getLiquid(user).getDomainSuggestions(keyword, tld);
}

export async function orderRegisterDomain(
  user: { id: number; resellerId: string | null; apiKey: string | null },
  data: { domain_name: string; tld: string; years: number; customer_id?: number; nameservers?: string[]; auto_renew?: boolean; privacy_protection?: boolean }
) {
  const liquid = getLiquid(user);
  const fullDomain = `${data.domain_name}.${data.tld}`;
  
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
  const liquid = getLiquid(user);
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
  userId: number,
  domainId: number,
  years: number
) {
  const domain = await getDomain(userId, domainId);
  const liquid = getLiquid(user);

  let unitPrice = 150000;
  try {
    const rawCustPrices = await liquid.getCustomerPrices();
    const prices = formatCustomerPrices(rawCustPrices);
    const pInfo = prices[domain.tld.toLowerCase()];
    if (pInfo && pInfo.price_renew) {
      const p = Number(pInfo.price_renew);
      unitPrice = p < 1000 ? p * 1000 : p;
    }
  } catch (e) {}

  const totalAmount = unitPrice * (years || 1);

  return createDomainOrderPayment({
    userId,
    type: "renew",
    domainName: domain.domainName,
    tld: domain.tld,
    years: years || 1,
    domainId: domain.id,
    customerId: domain.customerId || undefined,
    amount: totalAmount,
  });
}

export async function registerDomain(
  user: { id: number; resellerId: string | null; apiKey: string | null },
  data: { domain_name: string; tld: string; years: number; customer_id?: number; nameservers?: string[]; auto_renew?: boolean; privacy_protection?: boolean },
) {
  const liquidRes = await getLiquid(user).registerDomain({
    domain_name: `${data.domain_name}.${data.tld}`,
    years: data.years,
    ns: data.nameservers?.join(",") || "",
    customer_id: data.customer_id,
    privacy_protection: data.privacy_protection,
  });

  let saved: any;
  try {
    const result: any = await db.insert(domains).values({
      userId: user.id,
      customerId: data.customer_id ?? null,
      domainName: `${data.domain_name}.${data.tld}`,
      tld: data.tld,
      years: data.years,
      status: "pending",
      autoRenew: data.auto_renew ? 1 : 0,
      privacyProtection: data.privacy_protection ? 1 : 0,
      liquidOrderId: typeof liquidRes === "string" ? liquidRes : liquidRes?.order_id || liquidRes?.id,
      nameservers: data.nameservers ?? [],
    });
    const id = Number(result[0]?.insertId || result.insertId);
    [saved] = await db.select().from(domains).where(eq(domains.id, id));
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

  let allowedUserIds = [user.id];
  if (user.role === "reseller") {
    const { users } = await import("../../db/schema");
    const childUsers = await db.select({ id: users.id }).from(users).where(eq(users.parentResellerId, user.id));
    allowedUserIds = [user.id, ...childUsers.map((c) => c.id)];
  }

  const conditions: any[] = [inArray(domains.userId, allowedUserIds)];
  if (params?.search) conditions.push(like(domains.domainName, `%${params.search}%`));
  if (params?.status) conditions.push(eq(domains.status, params.status as any));

  const where = and(...conditions);

  const rows = await db.select().from(domains).where(where).limit(perPage).offset(offset);
  const total = await db.$count(domains, where);

  return { data: rows, meta: { total, page, perPage } };
}

export async function getDomain(userParam: any, domainId: number) {
  const userId = typeof userParam === "object" ? userParam.id : Number(userParam);
  const userRole = typeof userParam === "object" ? userParam.role : "reseller";

  let allowedUserIds = [userId];
  if (userRole === "reseller") {
    const { users } = await import("../../db/schema");
    const childUsers = await db.select({ id: users.id }).from(users).where(eq(users.parentResellerId, userId));
    allowedUserIds = [userId, ...childUsers.map((c) => c.id)];
  }

  const [domain] = await db.select().from(domains).where(and(eq(domains.id, domainId), inArray(domains.userId, allowedUserIds)));
  if (!domain) throw new AppError("Domain not found", 404);
  return domain;
}

export async function renewDomain(user: { resellerId: string | null; apiKey: string | null }, userId: number, domainId: number, years: number) {
  const domain = await getDomain({id: userId, role: "customer"}, domainId);
  const liquidRes = await getLiquid(user).renewDomain(String(domain.liquidOrderId || domain.domainName), years);
  await db.update(domains).set({ years: (domain.years || 1) + years }).where(eq(domains.id, domainId));
  return { domain_id: domain.id, domain_name: domain.domainName, years_added: years, previous_expiry: domain.expiryDate, new_expiry: liquidRes?.expiry_date || null };
}

export async function updateLock(user: { resellerId: string | null; apiKey: string | null }, userId: number, domainId: number, lock: boolean) {
  const domain = await getDomain(userId, domainId);
  if (lock) await getLiquid(user).lockDomain(String(domain.liquidOrderId || domain.domainName));
  else await getLiquid(user).unlockDomain(String(domain.liquidOrderId || domain.domainName));
  await db.update(domains).set({ locked: lock ? 1 : 0 }).where(eq(domains.id, domainId));
}

export async function updateNameservers(user: { resellerId: string | null; apiKey: string | null }, userId: number, domainId: number, ns: string[]) {
  const domain = await getDomain(userId, domainId);
  await getLiquid(user).updateNameservers(String(domain.liquidOrderId || domain.domainName), ns);
  await db.update(domains).set({ nameservers: ns }).where(eq(domains.id, domainId));
  return { domain_id: domainId, nameservers: ns };
}

export async function getAuthCode(user: { resellerId: string | null; apiKey: string | null }, userId: number, domainId: number) {
  const domain = await getDomain(userId, domainId);
  return getLiquid(user).getAuthCode(String(domain.liquidOrderId || domain.domainName));
}

export async function updateAuthCode(user: { resellerId: string | null; apiKey: string | null }, userId: number, domainId: number, authCode: string) {
  const domain = await getDomain(userId, domainId);
  return getLiquid(user).updateAuthCode(String(domain.liquidOrderId || domain.domainName), authCode);
}

export async function toggleTheftProtection(user: { resellerId: string | null; apiKey: string | null }, userId: number, domainId: number, enable: boolean) {
  const domain = await getDomain(userId, domainId);
  if (enable) await getLiquid(user).enableTheftProtection(String(domain.liquidOrderId || domain.domainName));
  else await getLiquid(user).disableTheftProtection(String(domain.liquidOrderId || domain.domainName));
  await db.update(domains).set({ theftProtection: enable ? 1 : 0 }).where(eq(domains.id, domainId));
}

export async function restoreDomain(user: { resellerId: string | null; apiKey: string | null }, userId: number, domainId: number) {
  const domain = await getDomain(userId, domainId);
  const res = await getLiquid(user).restoreDomain(String(domain.liquidOrderId || domain.domainName));
  await db.update(domains).set({ status: "active" }).where(eq(domains.id, domainId));
  return res;
}

export async function toggleSuspend(user: { resellerId: string | null; apiKey: string | null }, userId: number, domainId: number, suspend: boolean) {
  const domain = await getDomain(userId, domainId);
  if (suspend) await getLiquid(user).suspendDomain(String(domain.liquidOrderId || domain.domainName));
  else await getLiquid(user).unsuspendDomain(String(domain.liquidOrderId || domain.domainName));
  await db.update(domains).set({ status: suspend ? "suspended" : "active" }).where(eq(domains.id, domainId));
}

export async function deleteDomainRecord(userId: number, domainId: number) {
  const domain = await getDomain(userId, domainId);
  if (domain.status === "active") throw new AppError("Cannot delete active domain. Suspend first.", 400);
  await db.delete(domains).where(eq(domains.id, domainId));
}

export async function bulkAvailability(user: { resellerId: string; apiKey: string; role?: string }, keyword: string) {
  const liquid = getLiquid(user);
  const defaultTlds = ["com", "xyz", "id", "co.id", "web.id", "or.id", "ac.id", "sch.id", "biz.id", "my.id", "ponpes.id"];
  let prices: any = {};
  try {
    const rawCustPrices = await liquid.getCustomerPrices();
    prices = formatCustomerPrices(rawCustPrices);
  } catch {
    try {
      prices = await liquid.getPrices();
    } catch {}
  }

  let tldsToQuery = defaultTlds;
  if (prices && typeof prices === "object") {
    const custKeys = Object.keys(prices).filter(k => k !== "addons");
    if (custKeys.length > 0) {
      tldsToQuery = custKeys;
    }
  }

  const results = await Promise.all(
    tldsToQuery.map(async (tld) => {
      try {
        const res = await liquid.checkAvailability(`${keyword}.${tld}`);
        const arr = Array.isArray(res) ? res : [];
        const first = arr[0];
        const status = first ? (Object.values(first)[0] as any)?.status : "error";
        const tldPrice = prices[tld] || {};
        return {
          domain: `${keyword}.${tld}`,
          tld,
          available: status === "available",
          status,
          price: tldPrice.price_new || tldPrice.price_register || null,
          renew_price: tldPrice.price_renew || null,
          transfer_price: tldPrice.price_transfer || tldPrice.price_renew || null,
          create_years: tldPrice.create_years || null,
          renew_years: tldPrice.renew_years || null,
          privacy_protect: tldPrice.privacy_protect || "70.00",
          currency: tldPrice.currency || "IDR",
        };
      } catch {
        return { domain: `${keyword}.${tld}`, tld, available: false, status: "error", price: null, renew_price: null, transfer_price: null, privacy_protect: "70.00", currency: "IDR" };
      }
    })
  );

  return results;
}

export async function syncDomainsFromLiquid(userParam: { id: number; role?: string | null; resellerId?: string | null; apiKey?: string | null }) {
  const userId = typeof userParam === "object" ? userParam.id : userParam;
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u) throw new AppError("User not found", 404);

  let resellerId = u.resellerId || "";
  let apiKey = u.apiKey || "";

  if (u.role === "customer" && u.parentResellerId) {
    const [reseller] = await db.select().from(users).where(eq(users.id, u.parentResellerId));
    if (reseller) {
      resellerId = reseller.resellerId || "";
      apiKey = reseller.apiKey || "";
    }
  }

  if (!resellerId || !apiKey) {
    const [defaultReseller] = await db.select().from(users).where(eq(users.role, "reseller")).limit(1);
    if (defaultReseller) {
      resellerId = defaultReseller.resellerId || "";
      apiKey = defaultReseller.apiKey || "";
    }
  }

  if (!resellerId || !apiKey) {
    throw new AppError("Resellercamp credentials not configured", 400);
  }

  const liquid = new LiquidClient(resellerId, apiKey);
  const rawDomains = await liquid.listDomains({ limit: "100" });
  const domainList = Array.isArray(rawDomains) ? rawDomains : rawDomains?.data || rawDomains?.domains || [];

  let syncedCount = 0;
  let newAddedCount = 0;

  for (const item of domainList) {
    const fullDomainName = (item.domain_name || item.name || item.domain || "").toLowerCase().trim();
    if (!fullDomainName) continue;

    const orderIdStr = String(item.domain_id || item.order_id || item.id || "");
    const parts = fullDomainName.split(".");
    const tld = parts.slice(1).join(".");

    let status = "active";
    const rawStatus = (item.status || "").toLowerCase();
    if (rawStatus.includes("expir")) status = "expired";
    else if (rawStatus.includes("pend")) status = "pending";
    else if (rawStatus.includes("cancel")) status = "cancelled";

    const [existing] = await db.select().from(domains).where(eq(domains.domainName, fullDomainName)).limit(1);

    if (existing) {
      await db.update(domains).set({
        liquidOrderId: orderIdStr || existing.liquidOrderId,
        status: status as any,
      }).where(eq(domains.id, existing.id));
      syncedCount++;
    } else {
      await db.insert(domains).values({
        userId: u.id,
        domainName: fullDomainName,
        tld,
        years: 1,
        status: status as any,
        liquidOrderId: orderIdStr || null,
      });
      newAddedCount++;
      syncedCount++;
    }
  }

  return { syncedCount, newAddedCount, total: domainList.length };
}
