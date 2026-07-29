import { db } from "../../db";
import { transactions } from "../../db/schema";
import { eq, and, sql } from "drizzle-orm";
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
  userId: number,
  params?: { type?: string; status?: string; page?: number; per_page?: number },
) {
  const page = params?.page || 1;
  const perPage = params?.per_page || 20;
  const offset = (page - 1) * perPage;

  let where = eq(transactions.userId, userId);
  if (params?.type) where = and(where, eq(transactions.type, params.type as any)) as any;
  if (params?.status) where = and(where, eq(transactions.status, params.status as any)) as any;

  const [rows, countResult] = await Promise.all([
    db.select().from(transactions).where(where).orderBy(sql`${transactions.createdAt} desc`).limit(perPage).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(transactions).where(where),
  ]);
  const total = Number(countResult?.[0]?.count || 0);

  return { data: rows, meta: { total, page, perPage } };
}

export async function getTransaction(userId: number, txnId: number) {
  const [txn] = await db.select().from(transactions).where(and(eq(transactions.id, txnId), eq(transactions.userId, userId)));
  if (!txn) throw new AppError("Transaction not found", 404);
  return txn;
}

export async function syncBalanceToLocal(user: { resellerId: string | null; apiKey: string | null }, userId: number) {
  return getLiquid(user).getBalance();
}
