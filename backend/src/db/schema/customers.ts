import { mysqlTable, int, varchar, text, char, timestamp, index } from "drizzle-orm/mysql-core";
import { users } from "./users";

export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").references(() => users.id, { onDelete: "cascade" }),
  liquidCustomerId: varchar("liquid_customer_id", { length: 100 }).unique(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  company: varchar("company", { length: 255 }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  country: char("country", { length: 2 }).notNull(),
  zipcode: varchar("zipcode", { length: 20 }),
  phone_cc: varchar("phone_cc", { length: 10 }),
  phone: varchar("phone", { length: 30 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
}, (table) => ({
  userIdIdx: index("user_id_idx").on(table.userId),
  emailIdx: index("email_idx").on(table.email)
}));
