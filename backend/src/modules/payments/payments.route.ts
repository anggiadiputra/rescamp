import { Elysia, t } from "elysia";
import { sumopodClient } from "../../lib/sumopod";
import { processWebhookPayload } from "./payments.service";
import { db } from "../../db";
import { transactions } from "../../db/schema";
import { eq, and } from "drizzle-orm";
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

        const allTx = await db
          .select()
          .from(transactions)
          .where(eq(transactions.userId, userId));

        const tx = allTx.find((t) => {
          if (t.paymentId && t.paymentId === orderId) return true;
          if (String(t.id) === String(orderId)) return true;
          if (t.description?.includes(orderId)) return true;
          if (t.metadata) {
            const str = typeof t.metadata === "string" ? t.metadata : JSON.stringify(t.metadata);
            if (str.includes(orderId)) return true;
          }
          return false;
        });

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
