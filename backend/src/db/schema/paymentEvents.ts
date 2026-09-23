import { mysqlTable, bigint, varchar, text, timestamp, index } from "drizzle-orm/mysql-core";

/**
 * Audit trail for every payment event the backend processes (accepted OR
 * rejected). The Sumopod webhook returns HTTP 200 even when processing refuses
 * the event, so HTTP status alone can never tell you a payment was silently
 * dropped — this table is the durable record that closes that blind spot.
 */
export const paymentEvents = mysqlTable("payment_events", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  orderId: varchar("order_id", { length: 100 }),
  paymentId: varchar("payment_id", { length: 100 }),
  gateway: varchar("gateway", { length: 50 }),
  eventType: varchar("event_type", { length: 50 }),
  outcome: varchar("outcome", { length: 80 }).notNull(),
  severity: varchar("severity", { length: 20 }).notNull().default("info"),
  detail: text("detail"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  orderIdx: index("payment_events_order_idx").on(table.orderId),
  createdIdx: index("payment_events_created_idx").on(table.createdAt),
}));
