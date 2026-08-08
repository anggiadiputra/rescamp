import { mysqlTable, int, varchar, timestamp, mysqlEnum } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  role: mysqlEnum("role", ["reseller", "customer"]).default("reseller"),
  resellerId: varchar("reseller_id", { length: 100 }),
  apiKey: varchar("api_key", { length: 255 }), // plaintext (legacy, to be deprecated)
  apiKeyEncrypted: varchar("api_key_encrypted", { length: 512 }), // encrypted (new)
  parentResellerId: int("parent_reseller_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});
