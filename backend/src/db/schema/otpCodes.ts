import { mysqlTable, int, varchar, boolean, timestamp, mysqlEnum, index } from "drizzle-orm/mysql-core";

export const otpCodes = mysqlTable("otp_codes", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  code: varchar("code", { length: 128 }).notNull(), // plaintext (legacy, to be deprecated)
  codeEncrypted: varchar("code_encrypted", { length: 255 }), // encrypted (new)
  purpose: mysqlEnum("purpose", ["login", "reset", "register"]).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  emailIdx: index("email_idx").on(table.email),
  codeIdx: index("code_idx").on(table.code),
  purposeIdx: index("purpose_idx").on(table.purpose)
}));
