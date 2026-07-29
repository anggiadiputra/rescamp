import { mysqlTable, varchar, text, timestamp } from "drizzle-orm/mysql-core";

export const appSettings = mysqlTable("app_settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: text("value"),
  category: varchar("category", { length: 50 }).default("general"),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});
