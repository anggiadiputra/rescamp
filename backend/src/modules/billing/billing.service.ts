import { db } from "../../db";
import { transactions, users, customers, domains } from "../../db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { LiquidClient, formatCustomerPrices } from "../../lib/liquid";
import { AppError } from "../../lib/error";

const MAX_ACTION_REQUIRED_RETRIES = 5;

function getLiquid(user: { resellerId: string | null; apiKey: string | null }): LiquidClient {
  return new LiquidClient(user.resellerId || "", user.apiKey || "");
}

async function fetchAllLiquidTransactions(liquid: LiquidClient, customerId?: string): Promise<any[]> {
  const all: any[] = [];
  let pageNo = 1;
  while (true) {
    const params = { limit: "100", page_no: String(pageNo) };
    const res = customerId
      ? await liquid.listCustomerTransactions(customerId, false, params)
      : await liquid.getTransactions(params);
    const list = Array.isArray(res) ? res : res?.data || res?.transactions || [];
    if (list.length === 0) break;
    all.push(...list);
    if (list.length < 100) break;
    pageNo++;
  }
  return all;
}

export async function getBalance(user: { resellerId: string | null; apiKey: string | null }) {
  try {
    return await getLiquid(user).getBalance();
  } catch (err: any) {
    console.warn("[billing.service] getBalance fallback triggered:", err?.message || err);
    return { balance: "0.00", currency: "IDR" };
  }
}

export async function getPrices(user: { resellerId: string | null; apiKey: string | null; role?: string }) {
  const liquid = getLiquid(user);

  // Try customer prices first (GET /customers/prices) — works for all roles
  try {
    const raw = await liquid.getCustomerPrices();
    return formatCustomerPrices(raw);
  } catch (err: any) {
    console.warn("[billing.service] getCustomerPrices failed, trying account prices:", err?.message || err);
  }

  // Fallback: try reseller account prices (GET /account/prices)
  try {
    const raw = await liquid.getPrices();
    return raw;
  } catch (err: any) {
    console.warn("[billing.service] getPrices fallback triggered:", err?.message || err);
    return {};
  }
}

async function upsertLiquidTransaction(userId: number, item: any) {
  const liquidTxnId = String(item.transaction_id || item.id || "");
  if (!liquidTxnId) return;

  const amountVal = Math.abs(Number(item.amount || item.net_amount || 0));
  const statusMap: Record<string, string> = {
    paid: "completed", completed: "completed", success: "completed",
    pending: "pending_payment", unpaid: "pending_payment",
    cancelled: "cancelled", failed: "failed", expired: "expired",
  };
  const statusVal = statusMap[String(item.status || "").toLowerCase()] || "pending_payment";
  const typeMap: Record<string, string> = {
    domain: "register", deposit: "fund", fund: "fund",
    note: "debit", privacy_protect: "privacy",
  };
  const typeVal = typeMap[String(item.transaction_type || item.type || "domain").toLowerCase()] || "register";

  // Resolve expires_at: prefer item.expiry_date, fallback created+1h, fallback now+1h
  const computeExpiresAt = () => {
    if (item.expiry_date) {
      const d = new Date(item.expiry_date);
      if (!isNaN(d.getTime())) return d;
    }
    if (item.date_created) {
      const d = new Date(item.date_created);
      if (!isNaN(d.getTime())) return new Date(d.getTime() + 60 * 60 * 1000);
    }
    return new Date(Date.now() + 60 * 60 * 1000);
  };
  const expiresAt = computeExpiresAt();

  // N14: lookup on the indexed `liquidTransactionId` column (was JSON_EXTRACT on metadata — no index)
  // and filter by userId so we don't match a row owned by a different user.
  const [existing] = await db.select({ id: transactions.id, status: transactions.status })
    .from(transactions)
    .where(and(eq(transactions.liquidTransactionId, liquidTxnId), eq(transactions.userId, userId)))
    .limit(1);

  if (existing) {
    // N14: only sync Liquid-side transitions for transactions still pending locally.
    // Never overwrite `completed`/`processing_domain`/`action_required` — those are the source of truth.
    if (existing.status === "pending_payment" && (statusVal === "cancelled" || statusVal === "expired" || statusVal === "failed")) {
      await db.update(transactions)
        .set({ status: statusVal as any, paymentStatus: statusVal as any })
        .where(and(eq(transactions.id, existing.id), eq(transactions.status, "pending_payment")));
    }
    return;
  }

  try {
    await db.insert(transactions).values({
      userId,
      type: typeVal as any,
      amount: String(amountVal),
      status: statusVal as any,
      currency: item.currency || "IDR",
      description: item.description || item.details || `Resellercamp #${liquidTxnId}`,
      liquidTransactionId: liquidTxnId,
      expiresAt,
      metadata: JSON.stringify({ liquidTransactionId: liquidTxnId, syncedFromLiquid: true, expiresAt: expiresAt.toISOString() }),
    });
  } catch (err: any) {
    // ER_DUP_ENTRY (1062): concurrent sync already inserted this liquid txn — unique index on liquid_transaction_id
    if (err?.errno === 1062 || String(err?.code || "").includes("ER_DUP_ENTRY")) return;
    throw err;
  }
}

/**
 * Background sweeper: retry payCustomerTransaction for action_required rows.
 * Mirrors the post-pay success path from payments.service.ts:422-465.
 * Bounded retries via metadata.retryCount (CAS-guarded). Path (a) rows —
 * where liquidTransactionId is null in metadata — are skipped (admin must
 * reconcile manually).
 */
export async function sweepActionRequiredRetries() {
  const rows: any[] = await db.select({
    id: transactions.id,
    metadata: transactions.metadata,
    userId: transactions.userId,
  }).from(transactions).where(and(
    eq(transactions.status, "action_required"),
    sql`JSON_EXTRACT(${transactions.metadata}, '$.retryCount') IS NULL OR JSON_EXTRACT(${transactions.metadata}, '$.retryCount') < ${MAX_ACTION_REQUIRED_RETRIES}`
  ));

  if (rows.length === 0) return 0;

  let processed = 0;
  for (const row of rows) {
    let meta: any = {};
    try { meta = row.metadata ? JSON.parse(row.metadata) : {}; } catch {}
    let liquidTxnId = meta.liquidTransactionId ? String(meta.liquidTransactionId) : null;
    const liquidCustomerId = meta.liquidCustomerId ? String(meta.liquidCustomerId) : null;
    if (!liquidCustomerId) continue; // skip if no customer ID

    const [tx] = await db.select().from(transactions).where(eq(transactions.id, row.id)).limit(1);
    if (!tx || tx.status !== "action_required") continue;

    const [user] = await db.select().from(users).where(eq(users.id, tx.userId));
    if (!user) continue;
    let resellerId = user.resellerId || "";
    let apiKey = user.apiKey || "";
    if (user.role === "customer" && user.parentResellerId) {
      const [reseller] = await db.select().from(users).where(eq(users.id, user.parentResellerId));
      if (reseller) { resellerId = reseller.resellerId || ""; apiKey = reseller.apiKey || ""; }
    }
    const liquid = new LiquidClient(resellerId, apiKey);

    const currentRetry = Number(meta.retryCount || 0);
    const casResult: any = await db.update(transactions)
      .set({ metadata: sql`JSON_SET(COALESCE(${transactions.metadata}, JSON_OBJECT()), '$.retryCount', ${currentRetry + 1})` })
      .where(and(
        eq(transactions.id, row.id),
        eq(transactions.status, "action_required"),
        sql`(JSON_EXTRACT(${transactions.metadata}, '$.retryCount') IS NULL OR JSON_EXTRACT(${transactions.metadata}, '$.retryCount') <= ${currentRetry})`
      ));
    const claimed = (casResult[0]?.affectedRows ?? casResult?.affectedRows ?? 0) > 0;
    if (!claimed) continue; // another sweeper/webhook got it

    try {
      if (!liquidTxnId && meta.domainName) {
        try {
          if (meta.type === "register") {
            const liquidRes = await liquid.registerDomain({
              domain_name: meta.domainName,
              years: meta.years || 1,
              ns: (meta.nameservers || []).join(","),
              customer_id: liquidCustomerId,
              privacy_protection: meta.privacyProtection || false,
              invoice_option: "keep_invoice",
            });
            liquidTxnId = String(
              liquidRes?.transaction_id || liquidRes?.invoice_id || liquidRes?.entity_id || liquidRes?.id || ""
            ) || null;
          }
        } catch {}
      }

      if (!liquidTxnId) {
        throw new Error("No liquidTransactionId found to pay");
      }

      await liquid.payCustomerTransaction(liquidCustomerId, liquidTxnId, true);

      if (meta.type === "register" || meta.type === "transfer") {
        const [existingDomain] = await db.select().from(domains).where(eq(domains.domainName, meta.domainName));
        if (!existingDomain) {
          await db.insert(domains).values({
            userId: tx.userId,
            customerId: meta.customerId || tx.customerId || null,
            domainName: meta.domainName,
            tld: meta.tld || meta.domainName.split(".").slice(1).join("."),
            years: meta.years || 1,
            status: "active",
            autoRenew: meta.autoRenew ? 1 : 0,
            privacyProtection: meta.privacyProtection ? 1 : 0,
            liquidOrderId: meta.liquidOrderId ? String(meta.liquidOrderId) : null,
            nameservers: meta.nameservers || [],
          } as any).onDuplicateKeyUpdate({ set: { domainName: sql`${domains.domainName}` } });
        }
      } else if (meta.type === "renew") {
        const domainId = meta.domainId || tx.domainId;
        if (domainId) {
          const yearsToAdd = meta.years || 1;
          if (meta.yearsRenewed !== yearsToAdd) {
            await db.update(transactions)
              .set({ metadata: sql`JSON_SET(COALESCE(${transactions.metadata}, JSON_OBJECT()), '$.yearsRenewed', ${yearsToAdd})` })
              .where(and(eq(transactions.id, tx.id), sql`JSON_EXTRACT(${transactions.metadata}, '$.yearsRenewed') IS NULL`));
            await db.update(domains)
              .set({ years: sql`${domains.years} + ${yearsToAdd}` })
              .where(eq(domains.id, domainId));
          }
        }
      }

      await db.update(transactions).set({ status: "completed" }).where(eq(transactions.id, tx.id));
      console.log(`[sweeper] retried action_required tx ${tx.id} -> completed`);
      processed++;
    } catch (err: any) {
      const updatedMeta = sql`JSON_SET(COALESCE(${transactions.metadata}, JSON_OBJECT()), '$.lastError', ${err?.message || String(err)})`;
      await db.update(transactions).set({ metadata: updatedMeta }).where(eq(transactions.id, tx.id));
      console.warn(`[sweeper] retry ${currentRetry + 1}/${MAX_ACTION_REQUIRED_RETRIES} failed for tx ${tx.id}: ${err?.message || err}`);
    }
  }
  return processed;
}

/**
 * Background sweeper: mark pending_payment transactions as expired once their
 * expires_at passes. Runs every 15 minutes from backend/src/index.ts.
 *
 * CAS guards against a concurrent webhook that has just promoted the row to
 * processing_domain — we only flip rows still pending_payment AND with
 * expires_at at least 1 minute in the past (grace window).
 */
export async function sweepExpiredTransactions() {
  const oneMinAgo = new Date(Date.now() - 60 * 1000);
  const result: any = await db.update(transactions)
    .set({ status: "expired", paymentStatus: "expired" })
    .where(and(
      eq(transactions.status, "pending_payment"),
      sql`${transactions.expiresAt} IS NOT NULL AND ${transactions.expiresAt} < ${oneMinAgo}`
    ));
  const changed = result[0]?.affectedRows ?? result?.affectedRows ?? 0;
  if (changed > 0) {
    console.log(`[sweeper] expired ${changed} pending transaction(s)`);
  }
  return changed;
}

export async function listTransactions(
  userParam: number | { id: number; role?: string | null },
  params?: { type?: string; status?: string; category?: string; page?: number; per_page?: number },
) {
  const userId = typeof userParam === "object" ? userParam.id : userParam;
  const userRole = typeof userParam === "object" ? userParam.role : "reseller";

  const page = params?.page || 1;
  const perPage = params?.per_page || 20;
  const offset = (page - 1) * perPage;

  let allowedUserIds = [userId];
  if (userRole === "reseller") {
    const childUsers = await db.select({ id: users.id }).from(users).where(eq(users.parentResellerId, userId));
    allowedUserIds = [userId, ...childUsers.map((c) => c.id)];
  }

  // Auto-expire pending_payment transactions created more than 1 hour ago
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    await db.update(transactions)
      .set({ status: "expired" })
      .where(and(
        inArray(transactions.userId, allowedUserIds),
        eq(transactions.status, "pending_payment"),
        sql`${transactions.createdAt} < ${oneHourAgo}`
      ));
  } catch (e) {
    console.warn("[billing] auto-expire check failed:", e);
  }

  // Auto-sync transactions from Resellercamp for customer/reseller if available
  try {
    const [userRecord] = await db.select().from(users).where(eq(users.id, userId));
    if (userRecord && userRecord.resellerId && userRecord.apiKey) {
      const liquid = getLiquid(userRecord);
      if (userRecord.role === "customer") {
        const [cust] = await db.select({ liquidCustomerId: customers.liquidCustomerId }).from(customers).where(eq(customers.userId, userId));
        if (cust?.liquidCustomerId) {
          const list = await fetchAllLiquidTransactions(liquid, cust.liquidCustomerId).catch(() => []);
          for (const item of list) {
            await upsertLiquidTransaction(userId, item);
          }
        }
      } else {
        // Reseller: sync from account/transactions
        const list = await fetchAllLiquidTransactions(liquid).catch(() => []);
        for (const item of list) {
          await upsertLiquidTransaction(userId, item);
        }
      }
    }
  } catch (e) {
    console.warn("[billing] sync from Liquid warning:", e);
  }

  let where = inArray(transactions.userId, allowedUserIds);
  if (params?.type) where = and(where, eq(transactions.type, params.type as any)) as any;
  if (params?.status) where = and(where, eq(transactions.status, params.status as any)) as any;
  if (params?.category === "retail") {
    where = and(where, sql`(${transactions.metadata} IS NULL OR ${transactions.metadata} NOT LIKE '%"syncedFromLiquid":true%')`) as any;
  } else if (params?.category === "wholesale") {
    where = and(where, sql`${transactions.metadata} LIKE '%"syncedFromLiquid":true%'`) as any;
  }

  const [rows, countResult] = await Promise.all([
    db.select().from(transactions).where(where).orderBy(sql`${transactions.createdAt} desc`).limit(perPage).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(transactions).where(where),
  ]);
  const total = Number(countResult?.[0]?.count || 0);

  return { data: rows, meta: { total, page, perPage } };
}

export async function getTransaction(userParam: number | { id: number; role?: string | null }, txnId: number) {
  const userId = typeof userParam === "object" ? userParam.id : userParam;
  const userRole = typeof userParam === "object" ? userParam.role : "reseller";

  const { users, customers } = await import("../../db/schema");

  let allowedUserIds = [userId];
  if (userRole === "reseller") {
    const childUsers = await db.select({ id: users.id }).from(users).where(eq(users.parentResellerId, userId));
    allowedUserIds = [userId, ...childUsers.map((c) => c.id)];
  }

  const [txn] = await db.select().from(transactions).where(and(eq(transactions.id, txnId), inArray(transactions.userId, allowedUserIds)));
  if (!txn) throw new AppError("Transaction not found", 404);

  // 1. Resolve Customer Info
  let customer: any = null;
  const meta: any = typeof txn.metadata === "string" ? (JSON.parse(txn.metadata || "{}") as any) : txn.metadata || {};

  if (txn.customerId) {
    const [c] = await db.select().from(customers).where(eq(customers.id, txn.customerId));
    customer = c || null;
  }
  if (!customer && meta?.customerId) {
    const [c] = await db.select().from(customers).where(eq(customers.id, Number(meta.customerId)));
    customer = c || null;
  }
  let targetDomainName = meta?.domainName ? String(meta.domainName) : null;
  if (!targetDomainName && txn.description) {
    const match = txn.description.match(/\b([a-zA-Z0-9-]+\.[a-zA-Z]{2,})\b/);
    if (match?.[1]) targetDomainName = match[1];
  }

  if (!customer && targetDomainName) {
    const { domains } = await import("../../db/schema");
    const [dom] = await db.select().from(domains).where(eq(domains.domainName, targetDomainName));
    if (dom?.customerId) {
      const [c] = await db.select().from(customers).where(eq(customers.id, dom.customerId));
      customer = c || null;
    }
    if (!customer && dom?.userId) {
      const [c] = await db.select().from(customers).where(eq(customers.userId, dom.userId));
      customer = c || null;
      if (!customer) {
        const [u] = await db.select().from(users).where(eq(users.id, dom.userId));
        if (u && u.role === "customer") {
          customer = { name: u.name, email: u.email };
        }
      }
    }
  }
  if (!customer && (meta?.customerName || meta?.customerEmail)) {
    customer = {
      name: meta.customerName || null,
      email: meta.customerEmail || null,
      company: meta.customerCompany || null,
      address: meta.customerAddress || null,
    };
  }
  if (!customer && txn.userId) {
    const [c] = await db.select().from(customers).where(eq(customers.userId, txn.userId));
    customer = c || null;
  }
  if (!customer && txn.userId) {
    const [u] = await db.select().from(users).where(eq(users.id, txn.userId));
    if (u && u.role === "customer") {
      customer = { name: u.name, email: u.email };
    }
  }

  if (customer) {
    const addrParts = [
      customer.address,
      customer.city,
      customer.state,
      customer.zipcode,
      customer.country,
    ].filter(Boolean);
    customer.formattedAddress = addrParts.length > 0 ? addrParts.join(", ") : null;
  }

  // 2. Resolve Reseller / Registrar Provider Info (from Liquid API or local user DB)
  let resellerInfo: any = null;
  const [txnUser] = await db.select().from(users).where(eq(users.id, txn.userId));

  let resellerUser: any = txnUser;
  if (txnUser?.role === "customer") {
    if (txnUser.parentResellerId) {
      const [parentReseller] = await db.select().from(users).where(eq(users.id, txnUser.parentResellerId));
      if (parentReseller) resellerUser = parentReseller;
    }
    if (!resellerUser || resellerUser.role === "customer") {
      const [primaryReseller] = await db.select().from(users).where(eq(users.role, "reseller")).limit(1);
      if (primaryReseller) resellerUser = primaryReseller;
    }
  }

  // Get brand_name setting as fallback for provider name
  const { appSettings } = await import("../../db/schema");
  const [brandSetting] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, "brand_name"));
  const defaultBrand = brandSetting?.value || "Ekstensi ID";

  if (resellerUser?.resellerId && resellerUser?.apiKey) {
    try {
      const liquid = getLiquid(resellerUser);
      const liqReseller = await liquid.getReseller(resellerUser.resellerId);
      if (liqReseller) {
        const addrParts = [
          liqReseller.address_line_1,
          liqReseller.address_line_2,
          liqReseller.city,
          liqReseller.state,
          liqReseller.country_name || liqReseller.country_code,
          liqReseller.zipcode,
        ].filter(Boolean);

        resellerInfo = {
          name: liqReseller.name || resellerUser.name || defaultBrand,
          brandName: liqReseller.brand_name || defaultBrand,
          company: liqReseller.company || liqReseller.brand_name || defaultBrand,
          email: liqReseller.email || resellerUser.email,
          resellerId: liqReseller.reseller_id || resellerUser.resellerId,
          address: addrParts.join(", "),
          phone: liqReseller.tel_no ? `+${liqReseller.tel_cc_no || "62"}${liqReseller.tel_no}` : null,
        };
      }
    } catch (e) {
      console.warn("[billing] Fetch liquid reseller info failed, falling back to local user:", e);
    }
  }

  if (!resellerInfo) {
    resellerInfo = {
      name: resellerUser?.name || defaultBrand,
      brandName: defaultBrand,
      company: defaultBrand,
      email: resellerUser?.email || null,
      resellerId: resellerUser?.resellerId || null,
      address: null,
      phone: null,
    };
  }

  // Format customer address
  if (customer) {
    const custAddrParts = [
      customer.address,
      customer.city,
      customer.state,
      customer.country,
      customer.zipcode,
    ].filter(Boolean);
    customer.formattedAddress = custAddrParts.join(", ");
  }

  const isWholesale = Boolean(meta?.syncedFromLiquid || txn.type === "fund" || txn.type === "debit");
  const invoiceType = isWholesale ? "wholesale" : "retail";

  return { ...txn, invoiceType, isWholesale, customer, resellerInfo };
}

export async function syncBalanceToLocal(user: { resellerId: string | null; apiKey: string | null }, userId: number) {
  return getLiquid(user).getBalance();
}

export async function syncTransactions(user: { id: number; role: string | null; resellerId?: string | null; apiKey?: string | null }) {
  if (!user.resellerId || !user.apiKey) throw new AppError("Reseller credentials not configured", 500);
  const liquid = getLiquid({ resellerId: user.resellerId || "", apiKey: user.apiKey || "" });
  let list: any[] = [];
  let count = 0;

  if (user.role === "customer") {
    const [cust] = await db.select({ liquidCustomerId: customers.liquidCustomerId })
      .from(customers).where(eq(customers.userId, user.id));
    if (!cust?.liquidCustomerId) return { synced: 0 };
    list = await fetchAllLiquidTransactions(liquid, cust.liquidCustomerId);
  } else {
    list = await fetchAllLiquidTransactions(liquid);
  }

  for (const item of list) {
    const liquidTxnId = String(item.transaction_id || item.id || "");
    if (!liquidTxnId) continue;
    const existing = await db.select({ id: transactions.id }).from(transactions)
      .where(sql`JSON_EXTRACT(${transactions.metadata}, '$.liquidTransactionId') = ${liquidTxnId}`)
      .limit(1);
    if (existing.length === 0) {
      await upsertLiquidTransaction(user.id, item);
      count++;
    }
  }

  return { synced: count, total: list.length };
}
