import { Elysia, t } from "elysia";
import { sumopodClient } from "../../lib/sumopod";
import { processWebhookPayload } from "./payments.service";
import { db } from "../../db";
import { transactions } from "../../db/schema";
import { eq, and, or } from "drizzle-orm";
import { authGuard } from "../../middleware/auth";

export const paymentRoutes = new Elysia({ prefix: "/payments" })
  // Webhook Receiver (Public - called by Sumopod Payment Gateway)
  .post(
    "/webhook/sumopod",
    async ({ headers, body, set }) => {
      const svixId = headers["svix-id"] as string;
      const svixTimestamp = headers["svix-timestamp"] as string;
      const svixSignature = headers["svix-signature"] as string;
      const tokenHeader = headers["x-webhook-token"] as string;

      // Verify authentication via token header or Svix HMAC signature
      const isTokenValid = sumopodClient.verifyWebhookToken(tokenHeader);
      let isSigValid = false;

      if (process.env.SUMOPOD_WEBHOOK_SECRET && svixId && svixTimestamp && svixSignature) {
        const rawBody = typeof body === "string" ? body : JSON.stringify(body);
        isSigValid = sumopodClient.verifyWebhookSignature(
          process.env.SUMOPOD_WEBHOOK_SECRET,
          svixId,
          svixTimestamp,
          svixSignature,
          rawBody
        );
      } else {
        isSigValid = true; // Fallback if HMAC secret is not configured
      }

      if (!isTokenValid && !isSigValid) {
        console.warn("[sumopod webhook] Unauthorized webhook attempt headers:", headers);
        set.status = 401;
        return { error: "Invalid webhook token or signature" };
      }

      const payload = typeof body === "string" ? JSON.parse(body) : body;
      const result = await processWebhookPayload(payload);
      return { received: true, result };
    },
    {
      detail: { tags: ["Payments"], summary: "Sumopod payment gateway webhook callback listener" },
    }
  )

  // Protected status check for frontend polling
  .guard({ beforeHandle: authGuard }, (app) =>
    app.get(
      "/status/:orderId",
      async ({ params, store, set }) => {
        const userId = Number((store as any)?.user?.sub);
        const { orderId } = params;

        const cleanOrderId = String(orderId || "").trim();
        const numericMatch = cleanOrderId.replace(/^INV-0*/i, "").replace(/^0+/, "");
        const parsedNumericId = numericMatch ? parseInt(numericMatch, 10) : NaN;

        const conditions: any[] = [
          eq(transactions.orderId, cleanOrderId),
          eq(transactions.paymentId, cleanOrderId),
          eq(transactions.liquidTransactionId, cleanOrderId),
        ];
        if (!isNaN(parsedNumericId)) {
          conditions.push(eq(transactions.id, parsedNumericId));
        }

        // Direct DB lookup for the specific transaction
        const foundRows = await db
          .select()
          .from(transactions)
          .where(or(...conditions))
          .limit(1);

        let tx = foundRows[0] || null;

        // Fallback: search by user's transactions if direct lookup missed
        if (!tx) {
          const userTxList = await db
            .select()
            .from(transactions)
            .where(eq(transactions.userId, userId))
            .limit(100);

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

        if (currentStatus === "pending_payment" && tx.paymentId) {
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
                await db.update(domains).set({ status: "failed" }).where(eq(domains.id, tx.domainId));
              }
              currentStatus = "failed";
              currentPaymentStatus = "failed";
            }
          } catch (e) {
            console.warn("[payments/status] Proactive status check failed:", e);
          }
        }

        if (isPastExpiry && (currentStatus === "pending_payment" || currentPaymentStatus === "pending")) {
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

        return {
          data: {
            id: tx.id,
            status: currentStatus,
            paymentStatus: currentPaymentStatus,
            paymentId: tx.paymentId,
            paymentLinkUrl: tx.paymentLinkUrl,
            amount: tx.amount,
            currency: tx.currency,
            createdAt: tx.createdAt,
            expiresAt,
          },
        };
      },
      {
        detail: { tags: ["Payments"], summary: "Get order & payment status by order ID" },
      }
    )
  );
