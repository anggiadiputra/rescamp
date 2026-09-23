/**
 * Verification for watchdog #2 (unresolved rejected payments) — the exact class
 * of the real incident: a webhook was refused (amount_mismatch), so the
 * transaction stayed at payment_status='pending' and the paid-but-stuck watchdog
 * could never see it. This inserts an isolated probe, asserts detection, then
 * removes it (including the payment_events rows it creates).
 */
import { db } from "../src/db";
import { transactions, paymentEvents } from "../src/db/schema";
import { eq, sql, or } from "drizzle-orm";
import { findUnresolvedRejectedPayments, recordPaymentEvent } from "../src/lib/payment-observability";

const PROBE_ORDER = "INV-PROBE-REJECTED-TEST";

// Clean any leftovers from a previous run.
await db.delete(transactions).where(eq(transactions.orderId, PROBE_ORDER)).catch(() => {});
await db.delete(paymentEvents).where(sql`COALESCE(${paymentEvents.orderId},'') = ${PROBE_ORDER}`).catch(() => {});

// Shape: exactly like tx 199 before it was fixed — paid by the customer, but our
// DB still says pending because the webhook was refused.
await db.insert(transactions).values({
  userId: 3,
  type: "register",
  amount: "250000",
  currency: "IDR",
  status: "pending_payment",
  paymentStatus: "pending",
  paymentGateway: "sumopod",
  orderId: PROBE_ORDER,
  paymentId: "probe-rejected-pay-id",
  createdAt: sql`NOW() - INTERVAL 2 HOUR`,
  description: "rejected payment probe",
  metadata: JSON.stringify({ fee: 2050 }),
});

await recordPaymentEvent({
  orderId: PROBE_ORDER,
  paymentId: "probe-rejected-pay-id",
  gateway: "sumopod",
  eventType: "payment.completed",
  outcome: "amount_mismatch",
  detail: { received: { amount: 252050, fee: 2050, net_amount: 250000 } },
});

const found = (await findUnresolvedRejectedPayments(60)).find((r) => r.orderId === PROBE_ORDER);
console.log("watchdog #2 DETECTED unresolved rejected payment:", !!found);
if (found) console.log("detected row:", JSON.stringify(found));

// A settled order with a past rejection must NOT be flagged (no false alarms).
await db.update(transactions)
  .set({ status: "completed", paymentStatus: "completed" })
  .where(eq(transactions.orderId, PROBE_ORDER));
const afterSettle = (await findUnresolvedRejectedPayments(60)).find((r) => r.orderId === PROBE_ORDER);
console.log("settled order correctly not flagged:", !afterSettle);

await db.delete(transactions).where(eq(transactions.orderId, PROBE_ORDER));
await db.delete(paymentEvents).where(sql`COALESCE(${paymentEvents.orderId},'') = ${PROBE_ORDER}`);
console.log("probe cleaned up");

process.exit(0);
