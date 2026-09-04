import { mysqlTable, int, varchar, text, timestamp, mysqlEnum } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  role: mysqlEnum("role", ["admin", "reseller", "customer"]).default("customer"),
  resellerId: varchar("reseller_id", { length: 100 }),
  apiKey: varchar("api_key", { length: 255 }),
  apiKeyEncrypted: text("api_key_encrypted"),
  parentResellerId: int("parent_reseller_id"),
  sessionVersion: int("session_version").notNull().default(0),
  lastActiveAt: timestamp("last_active_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});
