import { Elysia, t } from "elysia";
import { buildWebhookReceiptId, isDuplicateKeyError, sumopodClient } from "../../lib/sumopod";
import { processWebhookPayload } from "./payments.service";
import { db } from "../../db";
import { transactions, domains, customers, webhookReceipts } from "../../db/schema";
import { eq, and, or } from "drizzle-orm";
import { authGuard } from "../../middleware/auth";
import { webhookRateLimiter, paymentStatusRateLimiter, rateLimit } from "../../lib/rate-limit";

export const paymentRoutes = new Elysia({ prefix: "/payments" })
  // Webhook Receiver (Public - called by Sumopod Payment Gateway)
  .post(
    "/webhook/sumopod",
    async ({ headers, body, set }) => {
      const svixId = headers["svix-id"] as string;
      const svixTimestamp = headers["svix-timestamp"] as string;
      const svixSignature = headers["svix-signature"] as string;
      const tokenHeader = headers["x-webhook-token"] as string;
      const rawBody = typeof body === "string" ? body : JSON.stringify(body);

      // Verify authentication via token header or Svix HMAC signature
      const isTokenValid = await sumopodClient.verifyWebhookToken(tokenHeader);
      let isSigValid = false;

      // Read HMAC secret fresh from DB/env (not from a cached singleton)
      const { getSystemSettings } = await import("../../modules/settings/settings.service");
      const settings = await getSystemSettings().catch(() => ({} as Record<string, string>));
      const webhookSecret = settings.sumopod_webhook_secret || process.env.SUMOPOD_WEBHOOK_SECRET || "";

      if (webhookSecret && svixId && svixTimestamp && svixSignature) {
        isSigValid = sumopodClient.verifyWebhookSignature(
          webhookSecret,
          svixId,
          svixTimestamp,
          svixSignature,
          rawBody
        );
      }
      // C2: fail closed — no signature/token configured means every webhook is rejected

      if (!isTokenValid && !isSigValid) {
        console.warn("[sumopod webhook] Unauthorized webhook attempt (invalid token/signature)");
        set.status = 401;
        return { error: "Invalid webhook token or signature" };
      }

      const payload = typeof body === "string" ? JSON.parse(body) : body;
      const receiptId = buildWebhookReceiptId(svixId, rawBody);
      try {
        await db.insert(webhookReceipts).values({ id: receiptId });
      } catch (error: any) {
        if (!isDuplicateKeyError(error)) throw error;
        // Duplicate receipt: either a concurrent delivery is processing this event,
        // or a previous attempt crashed after inserting its receipt but before
        // finishing. Do NOT blind-ACK — a blind 200 would permanently skip an event
        // whose processing never ran (crash window). Fall through and let the CAS
        // status transition inside processWebhookPayload admit exactly one winner;
        // any losing attempt bails as a no-op, so falling through is safe.
      }

      try {
        const result = await processWebhookPayload(payload);
        return { received: true, result };
      } catch (error) {
        await db.delete(webhookReceipts).where(eq(webhookReceipts.id, receiptId)).catch(() => {});
        throw error;
      }
    },
    {
      beforeHandle: rateLimit(webhookRateLimiter, "Terlalu banyak request webhook."),
      detail: { tags: ["Payments"], summary: "Sumopod payment gateway webhook callback listener" },
    }
  )

  // Status check for frontend & payment link status polling
  .get(
    "/status/:orderId",
    async ({ params, store, set }) => {
      const userId = Number((store as any)?.user?.sub || 0);
      const role = String((store as any)?.user?.role || "");
      const { orderId } = params;

        const cleanOrderId = String(orderId || "").trim();

        const conditions: any[] = [
          eq(transactions.orderId, cleanOrderId),
          eq(transactions.paymentId, cleanOrderId),
          eq(transactions.liquidTransactionId, cleanOrderId),
        ];

        // Direct DB lookup for the specific transaction
        const foundRows = await db
          .select()
          .from(transactions)
          .where(or(...conditions))
          .limit(1);

        let tx = foundRows[0] || null;

        // Fallback: in-memory scan of requesting user's own transactions (legacy path)
        if (!tx) {
          const userTxList = await db
            .select()
            .from(transactions)
            .where(eq(transactions.userId, userId))
            .limit(200);

          tx = userTxList.find((t) => {
            if (t.description && t.description.toLowerCase().includes(cleanOrderId.toLowerCase())) return true;
            if (t.metadata) {
              const str = typeof t.metadata === "string" ? t.metadata : JSON.stringify(t.metadata);
              if (str.includes(cleanOrderId)) return true;
            }
            return false;
          }) || null;
        }

        if (!tx) {
          set.status = 404;
          return { error: "Transaction not found" };
        }

        // H10: ownership check — a user may only read their own transaction.
        // Operators (admin, the normalized reseller role) may read transactions
        // of their own customers. B-6: legacy "reseller" role no longer exists.
        if (tx.userId !== userId) {
          let ownedByCustomer = role === "admin";
          if (role === "admin" && tx.customerId) {
            const [childCust] = await db.select({ id: customers.id }).from(customers)
              .where(and(eq(customers.id, tx.customerId), eq(customers.userId, userId)))
              .limit(1);
            ownedByCustomer = !!childCust;
          }
          if (!ownedByCustomer) {
            set.status = 404;
            return { error: "Transaction not found" };
          }
        }

        let metaObj: any = {};
        if (tx.metadata) {
          try { metaObj = JSON.parse(tx.metadata); } catch (e) {}
        }

        const createdAtTime = tx.createdAt ? new Date(tx.createdAt).getTime() : Date.now();
        // Prefer the indexed `expires_at` column; fallback to metadata, fallback to createdAt+1h
        const expiresAt = (tx as any).expiresAt
          ? new Date((tx as any).expiresAt).toISOString()
          : metaObj.expiresAt || new Date(createdAtTime + 60 * 60 * 1000).toISOString();
        const isPastExpiry = Date.now() > new Date(expiresAt).getTime();

        let currentStatus = tx.status;
        let currentPaymentStatus = tx.paymentStatus;

        if (tx.paymentId && (currentStatus === "pending_payment" || currentStatus === "expired" || currentStatus === "failed")) {
          try {
            const sumopodDetail = await sumopodClient.getPayment(tx.paymentId);
            const statusUpper = String(sumopodDetail?.status || "").toUpperCase();
            if (statusUpper === "COMPLETED" || statusUpper === "PAID" || statusUpper === "SUCCESS") {
              await processWebhookPayload({
                event_type: "payment.completed",
                data: { order_id: orderId, payment_id: tx.paymentId },
              });
              const [refreshed] = await db.select().from(transactions).where(eq(transactions.id, tx.id));
              if (refreshed) {
                currentStatus = refreshed.status;
                currentPaymentStatus = refreshed.paymentStatus;
              }
            } else if (statusUpper === "CANCELLED" || statusUpper === "CANCELED") {
              await db.update(transactions)
                .set({ status: "cancelled", paymentStatus: "cancelled" })
                .where(eq(transactions.id, tx.id));
              if (tx.domainId) {
                await db.update(domains).set({ status: "cancelled" }).where(eq(domains.id, tx.domainId));
              }
              currentStatus = "cancelled";
              currentPaymentStatus = "cancelled";
            } else if (statusUpper === "EXPIRED" || statusUpper === "TIMEOUT") {
              await db.update(transactions)
                .set({ status: "expired", paymentStatus: "expired" })
                .where(eq(transactions.id, tx.id));
              if (tx.domainId) {
                await db.update(domains).set({ status: "expired" }).where(eq(domains.id, tx.domainId));
              }
              currentStatus = "expired";
              currentPaymentStatus = "expired";
            } else if (statusUpper === "FAILED" || statusUpper === "REJECTED") {
              await db.update(transactions)
                .set({ status: "failed", paymentStatus: "failed" })
                .where(eq(transactions.id, tx.id));
              if (tx.domainId) {
                await db.update(domains).set({ status: "cancelled" }).where(eq(domains.id, tx.domainId));
              }
              currentStatus = "failed";
              currentPaymentStatus = "failed";
            }
          } catch (e) {
            console.warn("[payments/status] Proactive status check failed:", e);
          }
        }

        const isSyncedFromLiquid = metaObj?.syncedFromLiquid === true;
        if (!isSyncedFromLiquid && isPastExpiry && (currentStatus === "pending_payment" || currentPaymentStatus === "pending")) {
          // CAS: only expire if still pending — a concurrent webhook may have just completed it
          const res: any = await db.update(transactions)
            .set({ status: "expired", paymentStatus: "expired" })
            .where(and(eq(transactions.id, tx.id), eq(transactions.status, "pending_payment")));
          const changed = res[0]?.affectedRows ?? res?.affectedRows ?? 0;
          if (changed > 0) {
            currentStatus = "expired";
            currentPaymentStatus = "expired";
          }
        }

        let parsedMeta: any = {};
        if (tx.metadata) {
          try { parsedMeta = JSON.parse(tx.metadata as string); } catch {}
        }

        return {
          data: {
            id: tx.id,
            orderId: tx.orderId || parsedMeta?.orderId || cleanOrderId,
            status: currentStatus,
            paymentStatus: currentPaymentStatus,
            paymentId: tx.paymentId,
            paymentLinkUrl: tx.paymentLinkUrl || parsedMeta?.paymentLinkUrl,
            amount: tx.amount,
            currency: tx.currency,
            createdAt: tx.createdAt,
            expiresAt,
            description: tx.description,
            metadata: parsedMeta,
          },
        };
      },
      {
        beforeHandle: [authGuard, rateLimit(paymentStatusRateLimiter, "Terlalu banyak permintaan status payment.")],
        detail: { tags: ["Payments"], summary: "Get order & payment status by order ID" },
      }
    )
  ;
