import { defineConfig } from "drizzle-kit";

// Load .env file for drizzle-kit CLI (bun --env-file is not used by drizzle-kit)
const env = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: parseInt(process.env.DB_PORT || "3306"),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || undefined,
  database: process.env.DB_NAME || "domain_dashboard",
};

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle/migrations",
  dialect: "mysql",
  dbCredentials: {
    host: env.host,
    port: env.port,
    user: env.user,
    password: env.password,
    database: env.database,
  },
});
