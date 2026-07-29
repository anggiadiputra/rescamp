import { Elysia, t } from "elysia";
import { sumopodClient } from "../../lib/sumopod";
import { processWebhookPayload } from "./payments.service";
import { db } from "../../db";
import { transactions } from "../../db/schema";
import { eq } from "drizzle-orm";
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

        const tx = allTx.find(
          (t) => t.description?.includes(orderId) || (t.metadata && t.metadata.includes(orderId))
        );

        if (!tx) {
          set.status = 404;
          return { error: "Transaction not found" };
        }

        return {
          data: {
            id: tx.id,
            status: tx.status,
            paymentStatus: tx.paymentStatus,
            paymentId: tx.paymentId,
            paymentLinkUrl: tx.paymentLinkUrl,
            amount: tx.amount,
            currency: tx.currency,
            createdAt: tx.createdAt,
          },
        };
      },
      {
        detail: { tags: ["Payments"], summary: "Get order & payment status by order ID" },
      }
    )
  );
