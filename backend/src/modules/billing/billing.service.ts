import { db } from "../../db";
import { transactions, users, customers, domains } from "../../db/schema";
import { eq, and, sql, inArray, or, isNotNull } from "drizzle-orm";
import { LiquidClient, formatCustomerPrices } from "../../lib/liquid";
import { AppError } from "../../lib/error";
import { resolveResellerCreds, resolveCredsFromUser } from "../../lib/reseller-creds";

const MAX_ACTION_REQUIRED_RETRIES = 5;

function getLiquid(creds: { resellerId: string; apiKey: string }): LiquidClient {
  return new LiquidClient(creds.resellerId || "", creds.apiKey || "");
}

function parseLiquidTransactionList(raw: any): any[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "object") {
    if (Array.isArray(raw.data)) return raw.data;
    if (Array.isArray(raw.transactions)) return raw.transactions;
    if (Array.isArray(raw.items)) return raw.items;
    // Resellercamp / LogicBoxes API returns { "1": { transaction_id: "...", ... }, "2": { ... }, "rec_count": 2 }
    return Object.entries(raw)
      .filter(([k]) => k !== "rec_count" && !isNaN(Number(k)))
      .map(([_, v]) => v);
  }
  return [];
}

async function fetchAllLiquidTransactions(liquid: LiquidClient, customerId?: string): Promise<any[]> {
  const all: any[] = [];
  let pageNo = 1;
  while (true) {
    const params = { limit: "100", page_no: String(pageNo) };
    const res = customerId
      ? await liquid.listCustomerTransactions(customerId, false, params).catch(() => null)
      : await liquid.getTransactions(params).catch(() => null);
    const list = parseLiquidTransactionList(res);
    if (list.length === 0) break;
    all.push(...list);
    if (list.length < 100) break;
    pageNo++;
  }
  return all;
}

export async function getBalance(user: { id?: number; resellerId: string | null; apiKey: string | null }) {
  try {
    const creds = user.id ? await resolveResellerCreds(user.id) : { resellerId: user.resellerId || "", apiKey: user.apiKey || "" };
    return await getLiquid(creds).getBalance();
  } catch (err: any) {
    console.warn("[billing.service] getBalance fallback triggered:", err?.message || err);
    return { balance: "0.00", currency: "IDR" };
  }
}

export async function getPrices(user: { id?: number; resellerId: string | null; apiKey: string | null; role?: string }) {
  const creds = user.id ? await resolveResellerCreds(user.id) : { resellerId: user.resellerId || "", apiKey: user.apiKey || "" };
  const liquid = getLiquid(creds);

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

function resolveTransactionType(item: any): string {
  const rawType = String(item.transaction_type || item.type || "").toLowerCase();
  const desc = String(item.description || item.details || "").toLowerCase();

  if (desc.includes("renew") || desc.includes("perpanjangan")) return "renew";
  if (desc.includes("transfer")) return "transfer";
  if (desc.includes("restore") || desc.includes("restoration")) return "restore";
  if (desc.includes("privacy") || rawType === "privacy_protect") return "privacy";
  if (rawType === "deposit" || rawType === "fund" || desc.includes("fund") || desc.includes("topup")) return "fund";
  if (rawType === "note" || rawType === "debit" || desc.includes("debit")) return "debit";

  return "register";
}

async function upsertLiquidTransaction(userId: number, item: any) {
  const liquidTxnId = String(item.transaction_id || item.id || "");
  if (!liquidTxnId) return;

  const amountVal = Math.abs(Number(item.amount || item.net_amount || 0));
  const statusMap: Record<string, string> = {
    paid: "completed", completed: "completed", success: "completed", done: "completed", approved: "completed",
    pending: "pending_payment", unpaid: "pending_payment", processing: "pending_payment",
    cancelled: "cancelled", cancel: "cancelled", refunded: "cancelled", refund: "cancelled",
    expired: "expired", timeout: "expired",
    failed: "failed", rejected: "failed",
  };
  const statusVal = statusMap[String(item.status || "").toLowerCase()] || "pending_payment";
  const typeVal = resolveTransactionType(item);

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
    // Update local status if Resellercamp status differs
    if (existing.status !== statusVal) {
      await db.update(transactions)
        .set({ status: statusVal as any, paymentStatus: statusVal as any })
        .where(eq(transactions.id, existing.id));
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
    const sweeperCreds = await resolveCredsFromUser(user);
    if (!sweeperCreds.resellerId || !sweeperCreds.apiKey) continue; // no creds at all — skip
    const liquid = new LiquidClient(sweeperCreds.resellerId, sweeperCreds.apiKey);

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
 * GUARDS:
 *  - Only flips rows still pending_payment AND with expires_at at least 1 minute in the past (grace window).
 *  - Skips rows with a Sumopod paymentId — those are reclaimed via /payments/status/:orderId proactive
 *    Sumopod check (which can pull a `completed` even if our local row had flipped to `expired`).
 *  - Skips Resellercamp-synced rows (wholesale) — those are managed by Resellercamp.
 */
export async function sweepExpiredTransactions() {
  const oneMinAgo = new Date(Date.now() - 60 * 1000);
  const result: any = await db.update(transactions)
    .set({ status: "expired", paymentStatus: "expired" })
    .where(and(
      eq(transactions.status, "pending_payment"),
      sql`${transactions.expiresAt} IS NOT NULL AND ${transactions.expiresAt} < ${oneMinAgo}`,
      sql`(${transactions.paymentId} IS NULL OR ${transactions.paymentId} = '')`,
      sql`(${transactions.metadata} IS NULL OR ${transactions.metadata} NOT LIKE '%"syncedFromLiquid":true%')`
    ));
  const changed = result[0]?.affectedRows ?? result?.affectedRows ?? 0;
  if (changed > 0) {
    console.log(`[sweeper] expired ${changed} pending transaction(s)`);
  }
  return changed;
}

export async function listTransactions(
  userParam: number | { id: number; role?: string | null },
  params?: { type?: string; status?: string; category?: string; search?: string; page?: number | string; per_page?: number | string },
) {
  const userId = typeof userParam === "object" ? userParam.id : userParam;
  const userRole = typeof userParam === "object" ? userParam.role : "reseller";

  const page = Number(params?.page) || 1;
  const perPage = Number(params?.per_page) || 20;
  const offset = (page - 1) * perPage;

  let allowedUserIds = [userId];
  if (userRole === "reseller") {
    const childUsers = await db.select({ id: users.id }).from(users).where(
      or(
        eq(users.parentResellerId, userId),
        eq(users.role, "customer")
      )
    );
    allowedUserIds = Array.from(new Set([userId, ...childUsers.map((c) => c.id)]));
  }

  // Auto-expire retail pending_payment transactions whose expires_at has passed (excluding Resellercamp synced rows
  // and rows with a Sumopod paymentId — those are reclaimed via /payments/status/:orderId proactive check).
  // Use expiresAt column (truth source) — NOT createdAt — so a Sumopod payment arriving just after our TTL window
  // but before Sumopod webhook still resolves to "completed" via the standard CAS path.
  try {
    const oneMinAgo = new Date(Date.now() - 60 * 1000);
    await db.update(transactions)
      .set({ status: "expired" })
      .where(and(
        inArray(transactions.userId, allowedUserIds),
        eq(transactions.status, "pending_payment"),
        sql`${transactions.expiresAt} IS NOT NULL AND ${transactions.expiresAt} < ${oneMinAgo}`,
        sql`(${transactions.paymentId} IS NULL OR ${transactions.paymentId} = '')`,
        sql`(${transactions.metadata} IS NULL OR ${transactions.metadata} NOT LIKE '%"syncedFromLiquid":true%')`
      ));
  } catch (e) {
    console.warn("[billing] auto-expire check failed:", e);
  }

  // Auto-expire retail pending_payment transactions whose expires_at has passed (excluding Resellercamp synced rows
  // and rows with a Sumopod paymentId — those are reclaimed via /payments/status/:orderId proactive check).
  // Use expiresAt column (truth source) — NOT createdAt — so a Sumopod payment arriving just after our TTL window
  // but before Sumopod webhook still resolves to "completed" via the standard CAS path.
  try {
    const oneMinAgo = new Date(Date.now() - 60 * 1000);
    await db.update(transactions)
      .set({ status: "expired" })
      .where(and(
        inArray(transactions.userId, allowedUserIds),
        eq(transactions.status, "pending_payment"),
        sql`${transactions.expiresAt} IS NOT NULL AND ${transactions.expiresAt} < ${oneMinAgo}`,
        sql`(${transactions.paymentId} IS NULL OR ${transactions.paymentId} = '')`,
        sql`(${transactions.metadata} IS NULL OR ${transactions.metadata} NOT LIKE '%"syncedFromLiquid":true%')`
      ));
  } catch (e) {
    console.warn("[billing] auto-expire check failed:", e);
  }

  let userCondition = inArray(transactions.userId, allowedUserIds);
  if (userRole === "customer") {
    // Customer ONLY sees local retail invoices created between customer & reseller in DB
    userCondition = and(
      inArray(transactions.userId, allowedUserIds),
      sql`(${transactions.metadata} IS NULL OR ${transactions.metadata} NOT LIKE '%"syncedFromLiquid":true%')`
    ) as any;
  } else if (userRole === "reseller" && params?.category === "retail") {
    userCondition = or(
      inArray(transactions.userId, allowedUserIds),
      isNotNull(transactions.customerId)
    ) as any;
  }
  let where = userCondition;
  if (params?.type) where = and(where, eq(transactions.type, params.type as any)) as any;
  if (params?.status) where = and(where, eq(transactions.status, params.status as any)) as any;
  if (userRole === "reseller" && params?.category === "retail") {
    where = and(where, sql`(${transactions.metadata} IS NULL OR ${transactions.metadata} NOT LIKE '%"syncedFromLiquid":true%')`) as any;
  } else if (userRole === "reseller" && params?.category === "wholesale") {
    where = and(where, sql`${transactions.metadata} LIKE '%"syncedFromLiquid":true%'`) as any;
  }
  if (params?.search && String(params.search).trim()) {
    const q = `%${String(params.search).trim()}%`;
    where = and(
      where,
      sql`(${transactions.description} LIKE ${q} OR ${transactions.orderId} LIKE ${q} OR ${transactions.paymentId} LIKE ${q} OR ${transactions.liquidTransactionId} LIKE ${q})`
    ) as any;
  }

  const [rows, countResult] = await Promise.all([
    db.select().from(transactions).where(where).orderBy(sql`${transactions.createdAt} desc`).limit(perPage).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(transactions).where(where),
  ]);
  const total = Number(countResult?.[0]?.count || 0);

  return { data: rows, meta: { total, page, perPage } };
}

// Proxy list reseller account transactions directly from Resellercamp (no DB cache).
export async function listTransactionsFromLiquid(
  creds: { resellerId: string; apiKey: string },
  queryOpts?: {
    page?: number | string;
    perPage?: number | string;
    transaction_type?: string;
    search?: string;
    status?: string;
    date_start?: string;
    date_end?: string;
    amount_range_start?: number | string;
    amount_range_end?: number | string;
    description?: string;
  },
) {
  if (!creds?.resellerId || !creds?.apiKey) {
    throw new AppError("Resellercamp credentials not configured", 400);
  }
  const page = Math.max(1, Number(queryOpts?.page) || 1);
  const perPage = Math.min(100, Math.max(1, Number(queryOpts?.perPage) || 20));

  const apiParams: Record<string, string> = {
    limit: String(perPage),
    page_no: String(page),
  };
  if (queryOpts?.transaction_type) apiParams.transaction_type = String(queryOpts.transaction_type);
  if (queryOpts?.date_start) apiParams.date_start = String(queryOpts.date_start);
  if (queryOpts?.date_end) apiParams.date_end = String(queryOpts.date_end);
  if (queryOpts?.amount_range_start) apiParams.amount_range_start = String(queryOpts.amount_range_start);
  if (queryOpts?.amount_range_end) apiParams.amount_range_end = String(queryOpts.amount_range_end);
  if (queryOpts?.description) apiParams.description = String(queryOpts.description);

  const liquid = new LiquidClient(creds.resellerId, creds.apiKey);
  const raw = await liquid.getTransactions(apiParams).catch(() => null);
  const list = parseLiquidTransactionList(raw);

  const statusMap: Record<string, string> = {
    paid: "completed", completed: "completed", success: "completed", done: "completed", approved: "completed",
    pending: "pending_payment", unpaid: "pending_payment", processing: "pending_payment",
    cancelled: "cancelled", cancel: "cancelled", refunded: "cancelled", refund: "cancelled",
    expired: "expired", timeout: "expired",
    failed: "failed", rejected: "failed",
  };

  let items = list
    .map((item: any) => {
      const txnId = String(item.transaction_id || item.transactionid || item.id || item.invoice_id || "").trim();
      if (!txnId) return null;
      const amountVal = Math.abs(Number(item.amount || item.net_amount || item.total || 0));
      const statusVal = statusMap[String(item.status || "").toLowerCase()] || "pending_payment";
      const typeVal = resolveTransactionType(item);

      let expiresAt: Date | null = null;
      if (item.expiry_date) {
        const d = new Date(item.expiry_date);
        if (!isNaN(d.getTime())) expiresAt = d;
      }
      if (!expiresAt && item.date_created) {
        const d = new Date(item.date_created);
        if (!isNaN(d.getTime())) expiresAt = new Date(d.getTime() + 60 * 60 * 1000);
      }
      const expiresAtIso = expiresAt ? expiresAt.toISOString() : new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const createdAtIso = item.date_created || item.creation_time || new Date().toISOString();

      return {
        id: txnId,
        liquidTransactionId: txnId,
        type: typeVal,
        status: statusVal,
        amount: String(amountVal),
        currency: item.currency || "IDR",
        description: item.description || item.details || `Resellercamp #${txnId}`,
        paymentId: null,
        orderId: `INV-${txnId}`,
        domainId: null,
        customerId: null,
        metadata: JSON.stringify({
          syncedFromLiquid: true,
          transaction_type: item.transaction_type,
          expiresAt: expiresAtIso,
        }),
        createdAt: createdAtIso,
        expiresAt: expiresAtIso,
        isWholesale: true,
        invoiceType: item.transaction_type || "wholesale",
      };
    })
    .filter(Boolean);

  if (queryOpts?.status && queryOpts.status.trim()) {
    const st = queryOpts.status.trim().toLowerCase();
    items = items.filter((it: any) => {
      if (st === "pending" || st === "pending_payment") return it.status === "pending_payment";
      return it.status === st;
    });
  }

  if (queryOpts?.search && queryOpts.search.trim()) {
    const q = queryOpts.search.trim().toLowerCase();
    items = items.filter((it: any) =>
      String(it.description || "").toLowerCase().includes(q) ||
      String(it.orderId || "").toLowerCase().includes(q) ||
      String(it.liquidTransactionId || "").toLowerCase().includes(q)
    );
  }

  const reachedEnd = list.length < perPage;
  const total = reachedEnd ? (page - 1) * perPage + items.length : page * perPage + 1;

  return { items, total, reachedEnd };
}

export async function getTransaction(userParam: number | { id: number; role?: string | null }, txnId: number | string) {
  const userId = typeof userParam === "object" ? userParam.id : userParam;
  const userRole = typeof userParam === "object" ? userParam.role : "reseller";

  const { users, customers } = await import("../../db/schema");

  let allowedUserIds = [userId];
  if (userRole === "reseller") {
    const childUsers = await db.select({ id: users.id }).from(users).where(eq(users.parentResellerId, userId));
    allowedUserIds = [userId, ...childUsers.map((c) => c.id)];
  }

  const strTxnId = String(txnId).trim();
  const numTxnId = Number(strTxnId);

  // 1. Try finding in local DB by integer id or liquidTransactionId
  let [txn] = await db.select().from(transactions).where(
    and(
      or(
        !isNaN(numTxnId) && numTxnId > 0 ? eq(transactions.id, numTxnId) : undefined,
        eq(transactions.liquidTransactionId, strTxnId)
      ),
      inArray(transactions.userId, allowedUserIds)
    )
  );

  // 2. If not found in DB and user is a reseller, try live fetch from Resellercamp API
  if (!txn && userRole === "reseller") {
    try {
      const syncCreds = await resolveResellerCreds(userId);
      if (syncCreds.resellerId && syncCreds.apiKey) {
        const liquid = getLiquid(syncCreds);
        const item = await liquid.getTransaction(strTxnId).catch(() => null);
        if (item && (item.transaction_id || item.id)) {
          const statusMap: Record<string, string> = {
            paid: "completed", completed: "completed", success: "completed", done: "completed", approved: "completed",
            pending: "pending_payment", unpaid: "pending_payment", processing: "pending_payment",
            cancelled: "cancelled", cancel: "cancelled", refunded: "cancelled", refund: "cancelled",
            expired: "expired", timeout: "expired",
            failed: "failed", rejected: "failed",
          };
          const tId = String(item.transaction_id || item.id);
          const statusVal = statusMap[String(item.status || "").toLowerCase()] || "pending_payment";
          const typeVal = resolveTransactionType(item);
          const amountVal = Math.abs(Number(item.amount || item.net_amount || item.total || 0));
          const expiresAtIso = item.expiry_date || item.date_created || new Date().toISOString();

          txn = {
            id: tId as any,
            userId,
            customerId: null,
            domainId: null,
            type: typeVal as any,
            amount: String(amountVal),
            status: statusVal as any,
            currency: item.currency || "IDR",
            description: item.description || item.details || `Resellercamp #${tId}`,
            paymentId: null,
            liquidTransactionId: tId,
            orderId: `INV-${tId}`,
            expiresAt: new Date(expiresAtIso),
            createdAt: item.date_created ? new Date(item.date_created) : new Date(),
            updatedAt: new Date(),
            metadata: JSON.stringify({
              syncedFromLiquid: true,
              transaction_type: item.transaction_type,
              expiresAt: expiresAtIso,
            }),
          } as any;
        }
      }
    } catch (e) {
      console.warn("[billing] Live transaction fetch fallback failed:", e);
    }
  }
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

  const invoiceCreds = resellerUser ? await resolveCredsFromUser(resellerUser) : { resellerId: "", apiKey: "" };
  if (invoiceCreds.resellerId && invoiceCreds.apiKey) {
    try {
      const liquid = getLiquid(invoiceCreds);
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

export async function syncBalanceToLocal(user: { resellerId: string | null; apiKey: string | null; id?: number }, userId: number) {
  const creds = user.id ? await resolveResellerCreds(user.id) : { resellerId: user.resellerId || "", apiKey: user.apiKey || "" };
  return getLiquid(creds).getBalance();
}

export async function syncTransactions(user: { id: number; role: string | null; resellerId?: string | null; apiKey?: string | null }) {
  const syncCreds = await resolveResellerCreds(user.id);
  if (!syncCreds.resellerId || !syncCreds.apiKey) throw new AppError("Reseller credentials not configured", 400);
  const liquid = getLiquid(syncCreds);
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
