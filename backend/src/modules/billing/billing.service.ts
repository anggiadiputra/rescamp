import { db } from "../../db";
import { transactions, users, customers } from "../../db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { LiquidClient, formatCustomerPrices } from "../../lib/liquid";
import { AppError } from "../../lib/error";

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
  return getLiquid(user).getBalance();
}

export async function getPrices(user: { resellerId: string | null; apiKey: string | null; role?: string }) {
  const liquid = getLiquid(user);
  if (user.role === "customer") {
    try {
      const raw = await liquid.getCustomerPrices();
      return formatCustomerPrices(raw);
    } catch {
      return liquid.getPrices();
    }
  }
  return liquid.getPrices();
}

async function upsertLiquidTransaction(userId: number, item: any) {
  const liquidTxnId = String(item.transaction_id || item.id || "");
  if (!liquidTxnId) return;

  const existing = await db.select({ id: transactions.id }).from(transactions)
    .where(sql`JSON_EXTRACT(${transactions.metadata}, '$.liquidTransactionId') = ${liquidTxnId}`)
    .limit(1);
  if (existing.length > 0) return;

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

  await db.insert(transactions).values({
    userId,
    type: typeVal as any,
    amount: String(amountVal),
    status: statusVal as any,
    currency: item.currency || "IDR",
    description: item.description || item.details || `Resellercamp #${liquidTxnId}`,
    metadata: JSON.stringify({ liquidTransactionId: liquidTxnId, syncedFromLiquid: true }),
  });
}

export async function listTransactions(
  userParam: number | { id: number; role?: string | null },
  params?: { type?: string; status?: string; page?: number; per_page?: number },
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
  if (txn.customerId) {
    const [c] = await db.select().from(customers).where(eq(customers.id, txn.customerId));
    customer = c || null;
  }
  if (!customer && txn.userId) {
    const [c] = await db.select().from(customers).where(eq(customers.userId, txn.userId));
    customer = c || null;
  }
  if (!customer && txn.userId) {
    const [u] = await db.select().from(users).where(eq(users.id, txn.userId));
    if (u) {
      customer = { name: u.name, email: u.email };
    }
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

  return { ...txn, customer, resellerInfo };
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
