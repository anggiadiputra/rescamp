import { db } from "../../db";
import { transactions, users, customers } from "../../db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { LiquidClient, formatCustomerPrices } from "../../lib/liquid";
import { AppError } from "../../lib/error";

function getLiquid(user: { resellerId: string | null; apiKey: string | null }): LiquidClient {
  return new LiquidClient(user.resellerId || "", user.apiKey || "");
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

export async function listTransactions(
  userParam: number | { id: number; role?: string },
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
          const res = await liquid.listCustomerTransactions(cust.liquidCustomerId).catch(() => null);
          const list = Array.isArray(res) ? res : res?.data || res?.transactions || [];
          for (const item of list.slice(0, 10)) {
            const extId = String(item.transaction_id || item.id || "");
            if (!extId) continue;
            const existing = await db.select({ id: transactions.id }).from(transactions).where(sql`JSON_EXTRACT(${transactions.metadata}, '$.liquidTransactionId') = ${extId}`).limit(1);
            if (existing.length === 0) {
              const amountVal = Math.abs(Number(item.amount || item.net_amount || 0));
              const statusVal = item.status === "Paid" || item.status === "Completed" ? "completed" : item.status === "Cancelled" ? "failed" : "pending_payment";
              await db.insert(transactions).values({
                userId,
                type: "register",
                amount: String(amountVal),
                status: statusVal as any,
                description: item.description || item.details || `Resellercamp Txn #${extId}`,
                metadata: JSON.stringify({ liquidTransactionId: extId, liquidCustomerId: cust.liquidCustomerId, syncedFromLiquid: true }),
              });
            }
          }
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

export async function getTransaction(userParam: number | { id: number; role?: string }, txnId: number) {
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
