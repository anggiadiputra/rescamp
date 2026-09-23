/**
 * One-off verification that the stuck-paid watchdog detects the exact failure
 * shape it was built for (paid but never provisioned). Inserts an isolated
 * probe row, asserts detection, then removes it. Safe to run: the probe order id
 * is unique and always deleted.
 */
import { db } from "../src/db";
import { transactions } from "../src/db/schema";
import { eq, sql } from "drizzle-orm";
import { findStuckPaidOrders } from "../src/lib/payment-observability";

const PROBE_ORDER = "INV-PROBE-WATCHDOG-TEST";

await db.delete(transactions).where(eq(transactions.orderId, PROBE_ORDER)).catch(() => {});

await db.insert(transactions).values({
  userId: 3,
  type: "register",
  amount: "250000",
  currency: "IDR",
  status: "pending_payment",
  paymentStatus: "completed",
  paymentGateway: "sumopod",
  orderId: PROBE_ORDER,
  paymentId: "probe-pay-id",
  createdAt: sql`NOW() - INTERVAL 2 HOUR`,
  description: "watchdog probe",
  metadata: JSON.stringify({ fee: 2050 }),
});

const stuck = await findStuckPaidOrders(30);
const found = stuck.find((s) => s.orderId === PROBE_ORDER);
console.log("watchdog DETECTED stuck probe:", !!found);
if (found) console.log("detected row:", JSON.stringify(found));

await db.delete(transactions).where(eq(transactions.orderId, PROBE_ORDER));
const after = await findStuckPaidOrders(30);
console.log("probe cleaned up; remaining stuck orders:", after.length);

// Also assert the age gate: a fresh stuck order must NOT be flagged yet.
await db.insert(transactions).values({
  userId: 3,
  type: "register",
  amount: "100000",
  currency: "IDR",
  status: "pending_payment",
  paymentStatus: "completed",
  paymentGateway: "sumopod",
  orderId: PROBE_ORDER + "-FRESH",
  paymentId: "probe-pay-id-fresh",
  description: "watchdog probe fresh",
  metadata: JSON.stringify({ fee: 700 }),
});
const freshStuck = await findStuckPaidOrders(30);
console.log("fresh stuck order correctly ignored:", !freshStuck.some((s) => s.orderId === PROBE_ORDER + "-FRESH"));
await db.delete(transactions).where(eq(transactions.orderId, PROBE_ORDER + "-FRESH"));

process.exit(0);
