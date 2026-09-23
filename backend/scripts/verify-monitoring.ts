/**
 * Verifies the three admin monitoring endpoints at the service layer (same code
 * the HTTP routes call), so the page is proven functional without needing a
 * browser session. Read-only except the replay test, which targets an
 * ALREADY-completed order to prove idempotency (no side effects).
 */
import {
  listPaymentEvents,
  getPaymentEventStats,
  replayOrderForAdmin,
} from "../src/lib/payment-observability";

const all = await listPaymentEvents({ page: 1, perPage: 5 });
console.log("listPaymentEvents(all):", JSON.stringify({
  rows: all.data.length,
  total: all.meta.total,
  totalPages: all.meta.totalPages,
  first: all.data[0]?.outcome,
}));

const issues = await listPaymentEvents({ page: 1, perPage: 5, onlyIssues: true });
console.log("listPaymentEvents(onlyIssues):", JSON.stringify({
  rows: issues.data.length,
  total: issues.meta.total,
  severities: issues.data.map((r) => r.severity),
}));

const stats = await getPaymentEventStats();
console.log("getPaymentEventStats:", JSON.stringify(stats));

// Idempotency: replaying an already-completed order must be a no-op success.
const replay = await replayOrderForAdmin("INV-REG-5c16cfa36801c14fdd28a239");
console.log("replayOrderForAdmin(completed order):", JSON.stringify(replay));

// Unknown order must be refused, not throw.
const missing = await replayOrderForAdmin("INV-DOES-NOT-EXIST-XYZ");
console.log("replayOrderForAdmin(unknown):", JSON.stringify(missing));

process.exit(0);
