import { db } from "../../db";
import { domains, users, customers } from "../../db/schema";
import { eq, and, like, inArray, or } from "drizzle-orm";
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
  user: { resellerId: string | null; apiKey: string | null },
  data: Record<string, any>
) {
  const liquid = getLiquid(user);
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

  // Support lookup by local id or liquidOrderId
  const lookupNum = parseInt(String(lookup), 10);
  const domainCond = isNaN(lookupNum)
    ? eq(domains.liquidOrderId, String(lookup))
    : or(eq(domains.id, lookupNum), eq(domains.liquidOrderId, String(lookupNum)));

  conditions.push(domainCond);

  const [domain] = await db.select().from(domains).where(and(...conditions));
  if (!domain) throw new AppError("Domain not found", 404);

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

  return {
    ...domain,
    domainId: domain.id,
    liquidOrderId: domain.liquidOrderId || null,
    customerId: domain.customerId || cust?.id || null,
    liquidCustomerId: cust?.liquidCustomerId || null,
    customerName: cust?.name || null,
    customerEmail: cust?.email || null,
    userId: domain.userId,
    resellerId: reseller?.resellerId || user.resellerId || null,
  };
}

export async function renewDomain(user: { resellerId: string | null; apiKey: string | null }, userId: number, domainId: number, years: number) {
  const domain = await getDomain({ id: userId, role: "customer" }, domainId);
  const liquidRes = await getLiquid(user).renewDomain(String(domain.liquidOrderId || domain.domainName), years);
  await db.update(domains).set({ years: (domain.years || 1) + years }).where(eq(domains.id, domainId));
  return { domain_id: domain.id, domain_name: domain.domainName, years_added: years, previous_expiry: domain.expiryDate, new_expiry: liquidRes?.expiry_date || null };
}

export async function updateLock(user: { resellerId: string | null; apiKey: string | null }, userId: number, domainId: number, lock: boolean) {
  const domain = await getDomain(userId, domainId);
  try {
    if (lock) await getLiquid(user).lockDomain(String(domain.liquidOrderId || domain.domainName));
    else await getLiquid(user).unlockDomain(String(domain.liquidOrderId || domain.domainName));
  } catch (err: any) {
    const msg = String(err?.message || "").toLowerCase();
    if (msg.includes("already locked")) {
      await db.update(domains).set({ locked: 1 }).where(eq(domains.id, domainId));
      return { locked: true, message: "Domain already locked" };
    }
    if (msg.includes("already unlocked") || msg.includes("not locked")) {
      await db.update(domains).set({ locked: 0 }).where(eq(domains.id, domainId));
      return { locked: false, message: "Domain already unlocked" };
    }
    throw err;
  }
  await db.update(domains).set({ locked: lock ? 1 : 0 }).where(eq(domains.id, domainId));
  return { locked: lock };
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
  try {
    if (enable) await getLiquid(user).enableTheftProtection(String(domain.liquidOrderId || domain.domainName));
    else await getLiquid(user).disableTheftProtection(String(domain.liquidOrderId || domain.domainName));
  } catch (err: any) {
    const msg = String(err?.message || "").toLowerCase();
    if (msg.includes("already enabled") || msg.includes("already active")) {
      await db.update(domains).set({ theftProtection: 1 }).where(eq(domains.id, domainId));
      return { theftProtection: true, message: "Theft protection is already enabled" };
    }
    if (msg.includes("already disabled") || msg.includes("not enabled")) {
      await db.update(domains).set({ theftProtection: 0 }).where(eq(domains.id, domainId));
      return { theftProtection: false, message: "Theft protection is already disabled" };
    }
    throw err;
  }
  await db.update(domains).set({ theftProtection: enable ? 1 : 0 }).where(eq(domains.id, domainId));
  return { theftProtection: enable };
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
    const raw = await liquid.getCustomerPrices();
    prices = formatCustomerPrices(raw);
  } catch {
    prices = {};
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
    const rawDomains = await liquid.listDomains({ limit: "100", page_no: String(pageNo) });
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
        const status = statusMap[rawStatus] || "active";

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

        const [existing] = await db.select().from(domains).where(eq(domains.domainName, fullDomainName)).limit(1);

        if (existing) {
          await db.update(domains).set({
            liquidOrderId: orderIdStr || existing.liquidOrderId,
            customerId: matchedCustomerId || existing.customerId,
            status: status as any,
            registrationDate: regDate || existing.registrationDate || null,
            expiryDate: expDate || existing.expiryDate || null,
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
          });
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
