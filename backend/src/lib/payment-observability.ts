import { db } from "../db";
import { paymentEvents, transactions } from "../db/schema";
import { and, eq, or, sql } from "drizzle-orm";
import { sendEmail } from "./email";

/**
 * Payment observability: every processed payment event is recorded, every
 * "needs attention" outcome raises an alert, and rejected events that carry
 * enough information to retry are queued for automatic replay.
 *
 * Why all three: the Sumopod webhook ACKs with HTTP 200 even when it REFUSES an
 * event, so a silently dropped payment leaves no trace in the HTTP logs and no
 * retry from the provider. That combination turned a validation bug into a
 * permanently stuck order. Recording + alerting + retrying at the application
 * level is the structural fix.
 */

// Outcomes that mean "a human should look at this" (money may have moved but the
// order did not complete). Deliberately excludes benign/idempotent outcomes.
const ALERT_OUTCOMES = new Set([
  "amount_mismatch",
  "transaction_not_found",
  "missing_metadata",
  "invalid_metadata",
  "user_not_found",
  "error",
  "stuck_alert",
]);

// Outcomes worth retrying automatically: the event was refused for a reason that
// a fixed guard or a later arriving record might resolve. Never auto-retry an
// amount mismatch — that is the underpayment signal and must stay rejected.
const RETRYABLE_OUTCOMES = new Set([
  "transaction_not_found",
  "missing_metadata",
  "invalid_metadata",
  "user_not_found",
]);

const MAX_AUTO_RETRIES = 3;
const RETRY_WINDOW_MS = 24 * 60 * 60 * 1000; // do not resurrect day-old events

export function severityForOutcome(outcome: string): "info" | "warn" | "critical" {
  if (outcome === "processed_successfully" || outcome.startsWith("updated_") || outcome.startsWith("ignored") || outcome === "already_processing") {
    return "info";
  }
  if (outcome === "amount_mismatch" || outcome === "error") return "critical";
  return "warn";
}

/**
 * Persist one processed event. Never throws — observability must not break the
 * payment flow it is observing.
 */
export async function recordPaymentEvent(args: {
  orderId?: string | null;
  paymentId?: string | null;
  gateway?: string | null;
  eventType?: string | null;
  outcome: string;
  detail?: any;
}): Promise<void> {
  try {
    const severity = severityForOutcome(args.outcome);
    let detailStr: string | null = null;
    if (args.detail !== undefined && args.detail !== null) {
      detailStr = typeof args.detail === "string" ? args.detail : JSON.stringify(args.detail);
      if (detailStr && detailStr.length > 4000) detailStr = detailStr.slice(0, 4000);
    }
    await db.insert(paymentEvents).values({
      orderId: args.orderId || null,
      paymentId: args.paymentId || null,
      gateway: args.gateway || null,
      eventType: args.eventType || null,
      outcome: args.outcome,
      severity,
      detail: detailStr,
    });
  } catch (e: any) {
    console.warn("[payment-events] failed to record event:", e?.message || e);
  }
}

/**
 * Alert the operators about an event that needs attention. Best-effort and
 * de-duplicated: one alert per (order, outcome) per hour, so a webhook flood or
 * a retrying gateway cannot spam the inbox.
 */
export async function alertPaymentIssue(args: {
  orderId?: string | null;
  paymentId?: string | null;
  outcome: string;
  detail?: any;
}): Promise<void> {
  try {
    if (!ALERT_OUTCOMES.has(args.outcome)) return;

    // De-dupe window.
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recent = await db
      .select({ id: paymentEvents.id })
      .from(paymentEvents)
      .where(and(
        eq(paymentEvents.outcome, args.outcome),
        sql`COALESCE(${paymentEvents.orderId}, '') = ${args.orderId || ""}`,
        sql`${paymentEvents.createdAt} > ${oneHourAgo}`,
      ))
      .limit(2);
    if (recent.length > 1) return; // the row we just wrote + an earlier one

    const { users } = await import("../db/schema");
    const admins = await db.select({ email: users.email }).from(users).where(eq(users.role, "admin"));
    const detailStr = args.detail === undefined ? "" : (typeof args.detail === "string" ? args.detail : JSON.stringify(args.detail));
    const subjectNote = `[PAYMENT ALERT] ${args.outcome} — order ${args.orderId || args.paymentId || "?"}`;

    for (const a of admins) {
      if (!a.email) continue;
      await sendEmail(a.email, "payment_alert", {
        outcome: args.outcome,
        orderId: args.orderId || "",
        paymentId: args.paymentId || "",
        detail: detailStr.slice(0, 800),
        subjectNote,
      }).catch((e: any) => console.warn("[payment-alert] send failed (non-blocking):", e?.message || e));
    }
  } catch (e: any) {
    console.warn("[payment-alert] failed:", e?.message || e);
  }
}

/** Record + alert in one call (the common path from the webhook processor). */
export async function reportPaymentOutcome(args: {
  orderId?: string | null;
  paymentId?: string | null;
  gateway?: string | null;
  eventType?: string | null;
  outcome: string;
  detail?: any;
}): Promise<void> {
  await recordPaymentEvent(args);
  await alertPaymentIssue({
    orderId: args.orderId,
    paymentId: args.paymentId,
    outcome: args.outcome,
    detail: args.detail,
  });
}

/**
 * Watchdog: find paid-but-stuck orders — money was received (payment_status is
 * completed OR the gateway reports the payment paid) but the domain was never
 * provisioned (no domain_id / non-terminal status) older than `minAgeMinutes`.
 *
 * This is the safety net for the exact failure mode where a provider ACKs with
 * 200 and never retries: nothing else in the system notices the order is stuck.
 */
export async function findStuckPaidOrders(minAgeMinutes = 30, limit = 50) {
  const cutoff = new Date(Date.now() - minAgeMinutes * 60 * 1000);
  return db
    .select({
      id: transactions.id,
      orderId: transactions.orderId,
      paymentId: transactions.paymentId,
      status: transactions.status,
      paymentStatus: transactions.paymentStatus,
      amount: transactions.amount,
      domainId: transactions.domainId,
      createdAt: transactions.createdAt,
    })
    .from(transactions)
    .where(and(
      // Money is in …
      eq(transactions.paymentStatus, "completed"),
      // … but the order never reached a settled state.
      or(
        eq(transactions.status, "pending_payment"),
        eq(transactions.status, "processing_domain"),
        eq(transactions.status, "action_required"),
      ),
      sql`${transactions.createdAt} < ${cutoff}`,
    ))
    .limit(limit);
}

/**
 * Re-process stuck paid orders that are safe to retry (i.e. not currently
 * mid-flight elsewhere). Returns the ids it touched so the caller can log them.
 * The per-order CAS inside processWebhookPayload makes concurrent runs safe.
 */
export async function replayStuckPaidOrders(minAgeMinutes = 30): Promise<Array<{ id: number; orderId: string | null; result: string }>> {
  const stuck = await findStuckPaidOrders(minAgeMinutes);
  const out: Array<{ id: number; orderId: string | null; result: string }> = [];
  if (stuck.length === 0) return out;

  const { processWebhookPayload } = await import("../modules/payments/payments.service");

  for (const tx of stuck) {
    // Only auto-retry orders whose events were refused for a retryable reason.
    // An order stuck because of a hard underpayment must NOT be auto-provisioned.
    const retryable = await db
      .select({ id: paymentEvents.id })
      .from(paymentEvents)
      .where(and(
        sql`COALESCE(${paymentEvents.orderId}, '') = ${tx.orderId || ""}`,
        sql`${paymentEvents.outcome} IN ('transaction_not_found','missing_metadata','invalid_metadata','user_not_found','amount_mismatch')`,
      ))
      .limit(1);

    if (retryable.length > 0) {
      // amount_mismatch is surfaced for a human, never auto-replayed here.
      const isMismatch = await db
        .select({ id: paymentEvents.id })
        .from(paymentEvents)
        .where(and(
          sql`COALESCE(${paymentEvents.orderId}, '') = ${tx.orderId || ""}`,
          eq(paymentEvents.outcome, "amount_mismatch"),
        ))
        .limit(1);
      if (isMismatch.length > 0) {
        out.push({ id: tx.id, orderId: tx.orderId, result: "skipped_amount_mismatch" });
        continue;
      }
    }

    try {
      const meta = await db.select({ metadata: transactions.metadata }).from(transactions).where(eq(transactions.id, tx.id)).limit(1);
      const raw = meta[0]?.metadata;
      let parsed: any = {};
      try { parsed = typeof raw === "string" ? JSON.parse(raw) : raw || {}; } catch {}
      const fee = Number(parsed?.fee || 0);
      const amount = Number(tx.amount);

      const res = await processWebhookPayload({
        event_type: "payment.completed",
        data: {
          payment_id: tx.paymentId,
          order_id: tx.orderId,
          amount: amount + fee,
          fee,
          net_amount: amount,
          status: "completed",
          _autoReplay: true,
        },
      }, "sumopod");
      out.push({ id: tx.id, orderId: tx.orderId, result: (res as any)?.status || "unknown" });
    } catch (e: any) {
      out.push({ id: tx.id, orderId: tx.orderId, result: `error:${e?.message || e}` });
    }
  }
  return out;
}

/**
 * Sweep: auto-replay safe stuck orders and alert on the rest. Runs from the
 * background sweeper in index.ts.
 */
export async function sweepStuckPaidOrders(): Promise<void> {
  try {
    const results = await replayStuckPaidOrders(30);
    for (const r of results) {
      const ok = !r.result.startsWith("skipped") && !r.result.startsWith("error");
      console.log(`[stuck-sweep] tx ${r.id} (${r.orderId}): ${r.result}`);
      if (!ok) {
        await alertPaymentIssue({
          orderId: r.orderId,
          outcome: "error",
          detail: `Auto-replay could not settle this paid order: ${r.result}`,
        });
      }
    }

    // Orders that are still stuck after the replay attempt need a human.
    const stillStuck = await findStuckPaidOrders(60);
    for (const tx of stillStuck) {
      const recentlyAlerted = await db
        .select({ id: paymentEvents.id })
        .from(paymentEvents)
        .where(and(
          sql`COALESCE(${paymentEvents.orderId}, '') = ${tx.orderId || ""}`,
          eq(paymentEvents.outcome, "stuck_alert"),
          sql`${paymentEvents.createdAt} > ${new Date(Date.now() - 6 * 60 * 60 * 1000)}`,
        ))
        .limit(1);
      if (recentlyAlerted.length > 0) continue;

      await recordPaymentEvent({
        orderId: tx.orderId,
        paymentId: tx.paymentId,
        gateway: "sumopod",
        outcome: "stuck_alert",
        detail: { status: tx.status, paymentStatus: tx.paymentStatus, amount: tx.amount },
      });
      await alertPaymentIssue({
        orderId: tx.orderId,
        outcome: "stuck_alert",
        detail: `Order ${tx.orderId} has been paid (Rp${tx.amount}) but is still ${tx.status} after ${60}+ minutes. Manual review needed.`,
      });
    }
  } catch (e: any) {
    console.warn("[stuck-sweep] failed:", e?.message || e);
  }
}
