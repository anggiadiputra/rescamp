import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { env } from "./config/env";
import { authRoutes } from "./modules/auth/auth.route";
import { domainRoutes } from "./modules/domains/domains.route";
import { dnsRoutes } from "./modules/dns/dns.route";
import { customerRoutes } from "./modules/customers/customers.route";
import { billingRoutes } from "./modules/billing/billing.route";
import { forwardingRoutes } from "./modules/forwarding/forwarding.route";
import { paymentRoutes } from "./modules/payments/payments.route";
import { settingsRoutes } from "./modules/settings/settings.route";
import { sweepExpiredTransactions, sweepActionRequiredRetries } from "./modules/billing/billing.service";
import { ensureDatabaseSchema } from "./db";
import { AppError } from "./lib/error";

// Ensure MySQL database schema (ENUMS) match codebase
ensureDatabaseSchema().catch((e) => console.warn("[db] ensureDatabaseSchema failed:", e));

const allowedOrigins = (env.CORS_ORIGIN || "*")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const app = new Elysia()
  .use(
    cors({
      origin: true,
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    })
  )
  .error({ AppError })
  .onError(({ code, error, set }) => {
    if (error instanceof AppError) {
      set.status = error.statusCode;
      return { error: error.message, statusCode: error.statusCode };
    }
    if (code === "VALIDATION") {
      set.status = (error as any).status || 422;
      return { error: error.message, statusCode: (error as any).status || 422 };
    }
    if (code === "NOT_FOUND") {
      set.status = 404;
      return { error: "Not found", statusCode: 404 };
    }
    set.status = 500;
    return { error: error instanceof Error ? error.message : "Internal server error", statusCode: 500 };
  })
  .get("/", () => ({ message: "Domain Dashboard API", version: "1.0.0" }))
  .group("/api", (app) =>
    app
      .use(authRoutes)
      .use(domainRoutes)
      .use(dnsRoutes)
      .use(customerRoutes)
      .use(billingRoutes)
      .use(forwardingRoutes)
      .use(paymentRoutes)
      .use(settingsRoutes)
  )
  .listen(env.PORT);

console.log(`🚀 Server running on port ${env.PORT}`);

// Background sweeper: expire pending_payment + retry action_required every 15 minutes
let sweepTimer: Timer | null = null;
function startAutoExpireSweeper() {
  if (sweepTimer) return;
  sweepExpiredTransactions().catch((e) => console.warn("[sweeper] initial run failed:", e));
  sweepActionRequiredRetries().catch((e) => console.warn("[sweeper] initial action_required run failed:", e));
  sweepTimer = setInterval(() => {
    sweepExpiredTransactions().catch((e) => console.warn("[sweeper] run failed:", e));
    sweepActionRequiredRetries().catch((e) => console.warn("[sweeper] action_required run failed:", e));
  }, 15 * 60 * 1000);
}
startAutoExpireSweeper();
