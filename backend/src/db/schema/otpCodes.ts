import { mysqlTable, int, varchar, boolean, timestamp, mysqlEnum, index } from "drizzle-orm/mysql-core";

export const otpCodes = mysqlTable("otp_codes", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  // B-1 follow-up: the legacy plaintext `code` column was DROPPED from the DB
  // (all rows migrated to code_encrypted; plaintext fallback removed). OTPs are
  // stored encrypted ONLY.
  codeEncrypted: varchar("code_encrypted", { length: 255 }).notNull(),
  purpose: mysqlEnum("purpose", ["login", "reset", "register"]).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  emailIdx: index("email_idx").on(table.email),
  purposeIdx: index("purpose_idx").on(table.purpose)
}));
