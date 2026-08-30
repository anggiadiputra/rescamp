import { mysqlTable, timestamp, varchar } from "drizzle-orm/mysql-core";

export const webhookReceipts = mysqlTable("webhook_receipts", {
  id: varchar("id", { length: 255 }).primaryKey(),
  receivedAt: timestamp("received_at").defaultNow().notNull(),
});
