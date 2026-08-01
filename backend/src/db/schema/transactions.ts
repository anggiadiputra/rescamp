import { mysqlTable, int, varchar, decimal, text, timestamp, mysqlEnum, uniqueIndex } from "drizzle-orm/mysql-core";
import { users } from "./users";
import { customers } from "./customers";
import { domains } from "./domains";

export const transactions = mysqlTable("transactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  customerId: int("customer_id").references(() => customers.id, { onDelete: "set null" }),
  domainId: int("domain_id").references(() => domains.id, { onDelete: "set null" }),
  type: mysqlEnum("type", ["register", "renew", "transfer", "restore", "privacy", "fund", "debit"]).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("IDR"),
  status: mysqlEnum("status", ["pending_payment", "processing_domain", "completed", "failed", "cancelled", "expired", "action_required"]).default("pending_payment"),
  paymentGateway: varchar("payment_gateway", { length: 50 }).default("sumopod"),
  paymentId: varchar("payment_id", { length: 100 }),
  paymentLinkUrl: text("payment_link_url"),
  paymentStatus: mysqlEnum("payment_status", ["pending", "completed", "failed", "expired"]).default("pending"),
  metadata: text("metadata"),
  liquidTransactionId: varchar("liquid_transaction_id", { length: 100 }),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  liquidTxnIdUnique: uniqueIndex("liquid_transaction_id_unique").on(table.liquidTransactionId),
}));
