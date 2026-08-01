import { mysqlTable, int, varchar, date, tinyint, json, timestamp, mysqlEnum, index, uniqueIndex } from "drizzle-orm/mysql-core";
import { users } from "./users";
import { customers } from "./customers";

export const domains = mysqlTable("domains", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  customerId: int("customer_id").references(() => customers.id, { onDelete: "set null" }),
  domainName: varchar("domain_name", { length: 255 }).notNull(),
  tld: varchar("tld", { length: 20 }).notNull(),
  registrationDate: date("registration_date", { mode: "string" }),
  expiryDate: date("expiry_date", { mode: "string" }),
  years: tinyint("years").default(1),
  status: mysqlEnum("status", ["active", "pending", "expired", "suspended", "transferred"]).default("pending"),
  autoRenew: tinyint("auto_renew").default(0),
  locked: tinyint("locked").default(0),
  theftProtection: tinyint("theft_protection").default(0),
  privacyProtection: tinyint("privacy_protection").default(0),
  liquidOrderId: varchar("liquid_order_id", { length: 100 }),
  nameservers: json("nameservers").$type<string[]>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
}, (table) => ({
  userIdIdx: index("user_id_idx").on(table.userId),
  customerIdIdx: index("customer_id_idx").on(table.customerId),
  statusIdx: index("status_idx").on(table.status),
  domainNameIdx: index("domain_name_idx").on(table.domainName),
  domainNameUnique: uniqueIndex("domain_name_unique").on(table.domainName)
}));
