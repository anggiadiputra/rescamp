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
import { securityHeaders } from "./lib/security-headers";

// Ensure MySQL database schema (ENUMS) match codebase
ensureDatabaseSchema().catch((e) => console.warn("[db] ensureDatabaseSchema failed:", e));

const allowedOrigins = (env.CORS_ORIGIN || "*")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const app = new Elysia()
  .use(securityHeaders)
  .use(
    cors({
      origin: true,
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    })
  )
  .onRequest(({ request }) => {
    (request as any)._startTime = performance.now();
  })
  .onAfterHandle(({ request, set }) => {
    const start = (request as any)._startTime || performance.now();
    const duration = (performance.now() - start).toFixed(1);
    const method = request.method;
    const url = new URL(request.url).pathname;
    const status = set.status || 200;
    console.log(`[HTTP] ${method} ${url} ${status} (${duration}ms)`);
  })
  .error({ AppError })
  .onError(({ code, error, set, request }) => {
    const start = (request as any)?._startTime || performance.now();
    const duration = (performance.now() - start).toFixed(1);
    const method = request?.method || "HTTP";
    const url = request?.url ? new URL(request.url).pathname : "";

    if (error instanceof AppError) {
      set.status = error.statusCode;
      console.warn(`[HTTP WARN] ${method} ${url} ${error.statusCode} (${duration}ms) - ${error.message}`);
      return { error: error.message, statusCode: error.statusCode };
    }
    if (code === "VALIDATION") {
      const status = (error as any).status || 422;
      set.status = status;
      console.warn(`[HTTP VALIDATION] ${method} ${url} ${status} (${duration}ms) - ${error.message}`);
      return { error: error.message, statusCode: status };
    }
    if (code === "NOT_FOUND") {
      set.status = 404;
      console.warn(`[HTTP NOT_FOUND] ${method} ${url} 404 (${duration}ms)`);
      return { error: "Not found", statusCode: 404 };
    }
    set.status = 500;
    const errMsg = error instanceof Error ? error.message : "Internal server error";
    console.error(`[HTTP ERROR] ${method} ${url} 500 (${duration}ms) - ${errMsg}`, error);
    return { error: errMsg, statusCode: 500 };
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
