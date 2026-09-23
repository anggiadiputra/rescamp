import { Elysia, t } from "elysia";
import { buildWebhookReceiptId, isDuplicateKeyError, sumopodClient } from "../../lib/sumopod";
import { processWebhookPayload } from "./payments.service";
import { db } from "../../db";
import { transactions, domains, customers, webhookReceipts } from "../../db/schema";
import { eq, and, or } from "drizzle-orm";
import { authGuard, adminGuard } from "../../middleware/auth";
import { webhookRateLimiter, paymentStatusRateLimiter, settingsRateLimiter, rateLimit } from "../../lib/rate-limit";

export const paymentRoutes = new Elysia({ prefix: "/payments" })
  // ── Checkout config (auth, untuk frontend) ──
  .get(
    "/config",
    async () => {
      const { getSystemSettings, getActiveDuitkuChannels } = await import(
        "../../modules/settings/settings.service"
      );
      const { isDuitkuConfigured } = await import("../../lib/duitku");
      const settings = await getSystemSettings();
      const duitkuEnabled = settings.duitku_enabled === "true" && (await isDuitkuConfigured());
      return {
        data: {
          gateways: {
            sumopod: { enabled: true, default: true },
            duitku: {
              enabled: duitkuEnabled,
              default: false, // A4: Sumopod selalu default
            },
          },
          default_gateway: "sumopod",
          // Channel Duitku aktif (urut sesuai admin) — hanya relevan jika duitku enabled
          duitku_channels: duitkuEnabled ? await getActiveDuitkuChannels() : [],
        },
      };
    },
    {
      beforeHandle: [authGuard],
      detail: { tags: ["Payments"], summary: "Checkout gateway configuration (enabled + channels)" },
    }
  )
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
        const result = await processWebhookPayload(payload, "sumopod");
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

  // ── Duitku webhook callback (Public — dipanggil server Duitku) ──
  // Content-Type: application/x-www-form-urlencoded; parameter flat.
  // Verifikasi HMAC-SHA256 timing-safe + merchantCode + amount match (S1/S2).
  .post(
    "/callback/duitku",
    async ({ body, set }) => {
      const cb = body as any;
      const {
        merchantCode,
        amount,
        merchantOrderId,
        signature,
        resultCode,
        reference,
      } = cb || {};

      if (!merchantOrderId) {
        set.status = 400;
        return "Bad Parameter";
      }

      const { verifyDuitkuCallback } = await import("../../lib/duitku");
      const isValid = await verifyDuitkuCallback({
        merchantCode: String(merchantCode || ""),
        amount: String(amount ?? ""),
        merchantOrderId: String(merchantOrderId),
        signature: String(signature || ""),
      });
      if (!isValid) {
        console.warn("[duitku callback] Bad signature/merchantCode", { merchantOrderId });
        set.status = 400;
        return "Bad Signature";
      }

      // Amount harus persis sama dengan yang tersimpan (duitku.md §12 best practice)
      const [tx] = await db
        .select()
        .from(transactions)
        .where(and(eq(transactions.paymentGateway, "duitku"), eq(transactions.orderId, String(merchantOrderId))))
        .limit(1);
      if (!tx) {
        console.warn(`[duitku callback] Transaction not found: ${merchantOrderId}`);
        // Tetap 200 agar Duitku berhenti retry untuk order yang tidak kita kenal
        set.status = 200;
        return "OK";
      }
      const txAmount = Number(tx.amount);
      const cbAmount = Number(amount);
      if (!Number.isFinite(cbAmount) || Math.round(cbAmount) !== Math.round(txAmount)) {
        console.warn(
          `[duitku callback] Amount mismatch for ${merchantOrderId}: callback=${cbAmount} db=${txAmount}`,
        );
        set.status = 400;
        return "Amount Mismatch";
      }

      // Normalisasi ke bentuk event internal yang sama dengan Sumopod
      const eventType =
        resultCode === "00" ? "payment.completed"
        : resultCode === "01" ? "payment.failed"
        : "payment.cancelled";

      const payload = {
        event_type: eventType,
        data: {
          order_id: String(merchantOrderId),
          payment_id: String(reference || tx.paymentId || ""),
          amount: Math.round(cbAmount),
          channel: String(cb.paymentCode || ""),
          issuer_code: String(cb.issuerCode || ""),
          settlement_date: String(cb.settlementDate || ""),
        },
      };

      const result = await processWebhookPayload(payload, "duitku");
      // Wajib HTTP 200 + body OK (duitku.md §4.3) — Duitku retry 5x jika bukan 200
      set.status = 200;
      return { status: "OK", result };
    },
    {
      beforeHandle: rateLimit(webhookRateLimiter, "Terlalu banyak request webhook."),
      detail: { tags: ["Payments"], summary: "Duitku payment gateway callback listener" },
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
              // CAS: only cancel if still pending_payment to avoid overriding completed/processing_domain
              const res: any = await db.update(transactions)
                .set({ status: "cancelled", paymentStatus: "cancelled" })
                .where(and(eq(transactions.id, tx.id), eq(transactions.status, "pending_payment")));
              const changed = res[0]?.affectedRows ?? res?.affectedRows ?? 0;
              if (changed > 0) {
                if (tx.domainId) {
                  await db.update(domains).set({ status: "cancelled" }).where(eq(domains.id, tx.domainId));
                }
                currentStatus = "cancelled";
                currentPaymentStatus = "cancelled";
              } else {
                const [refreshed] = await db.select().from(transactions).where(eq(transactions.id, tx.id));
                if (refreshed) {
                  currentStatus = refreshed.status;
                  currentPaymentStatus = refreshed.paymentStatus;
                  tx = refreshed;
                }
              }
            } else if (statusUpper === "EXPIRED" || statusUpper === "TIMEOUT") {
              // CAS: only expire if still pending_payment to avoid overriding completed/processing_domain
              const res: any = await db.update(transactions)
                .set({ status: "expired", paymentStatus: "expired" })
                .where(and(eq(transactions.id, tx.id), eq(transactions.status, "pending_payment")));
              const changed = res[0]?.affectedRows ?? res?.affectedRows ?? 0;
              if (changed > 0) {
                if (tx.domainId) {
                  await db.update(domains).set({ status: "expired" }).where(eq(domains.id, tx.domainId));
                }
                currentStatus = "expired";
                currentPaymentStatus = "expired";
              } else {
                const [refreshed] = await db.select().from(transactions).where(eq(transactions.id, tx.id));
                if (refreshed) {
                  currentStatus = refreshed.status;
                  currentPaymentStatus = refreshed.paymentStatus;
                  tx = refreshed;
                }
              }
            } else if (statusUpper === "FAILED" || statusUpper === "REJECTED") {
              // CAS: only fail if still pending_payment to avoid overriding completed/processing_domain
              const res: any = await db.update(transactions)
                .set({ status: "failed", paymentStatus: "failed" })
                .where(and(eq(transactions.id, tx.id), eq(transactions.status, "pending_payment")));
              const changed = res[0]?.affectedRows ?? res?.affectedRows ?? 0;
              if (changed > 0) {
                if (tx.domainId) {
                  await db.update(domains).set({ status: "cancelled" }).where(eq(domains.id, tx.domainId));
                }
                currentStatus = "failed";
                currentPaymentStatus = "failed";
              } else {
                const [refreshed] = await db.select().from(transactions).where(eq(transactions.id, tx.id));
                if (refreshed) {
                  currentStatus = refreshed.status;
                  currentPaymentStatus = refreshed.paymentStatus;
                  tx = refreshed;
                }
              }
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
  // ── Admin: payment monitoring (event log + stats + manual replay) ──
  .guard(
    { beforeHandle: [authGuard, adminGuard, rateLimit(settingsRateLimiter, "Terlalu banyak permintaan monitoring.")] },
    (app) =>
      app
        .get(
          "/admin/events",
          async ({ query }) => {
            const { listPaymentEvents } = await import("../../lib/payment-observability");
            return await listPaymentEvents({
              page: Number((query as any)?.page) || 1,
              perPage: Number((query as any)?.perPage) || 20,
              onlyIssues: String((query as any)?.onlyIssues || "") === "true",
              orderId: String((query as any)?.orderId || "") || undefined,
            });
          },
          {
            detail: { tags: ["Payments"], summary: "Paginated payment event log (admin)" },
          }
        )
        .get(
          "/admin/stats",
          async () => {
            const { getPaymentEventStats } = await import("../../lib/payment-observability");
            return { data: await getPaymentEventStats() };
          },
          {
            detail: { tags: ["Payments"], summary: "Payment monitoring headline counters (admin)" },
          }
        )
        .post(
          "/admin/replay/:orderId",
          async ({ params, set }) => {
            const { replayOrderForAdmin } = await import("../../lib/payment-observability");
            const result = await replayOrderForAdmin(String(params.orderId));
            if (!result.ok) set.status = 400;
            return { data: result };
          },
          {
            detail: { tags: ["Payments"], summary: "Replay a paid-but-unprocessed order (admin)" },
          }
        )
  )
  ;
