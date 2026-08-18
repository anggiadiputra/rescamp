import { Elysia } from "elysia";
import * as h from "./billing.handler";
import { authGuard, resellerGuard } from "../../middleware/auth";
import { authenticatedRateLimiter, rateLimit } from "../../lib/rate-limit";

export const billingRoutes = new Elysia({ prefix: "/billing" })
  .get("/prices", h.prices as any, { detail: { tags: ["Billing"], summary: "Get prices" } })
  .guard({ beforeHandle: [authGuard, rateLimit(authenticatedRateLimiter, "Terlalu banyak permintaan billing. Silakan coba lagi nanti.")] }, (app) =>
    app
      // H12: reseller account balance & wholesale ledger are reseller-only
      .get("/balance", h.balance as any, { beforeHandle: resellerGuard, detail: { tags: ["Billing"], summary: "Get balance" } })
      .get("/transactions", h.transactions as any, { detail: { tags: ["Billing"], summary: "List transactions" } })
      .get("/transactions/remote", h.listTransactionsRemote as any, { beforeHandle: resellerGuard, detail: { tags: ["Billing"], summary: "List reseller account transactions live from Resellercamp" } })
      .get("/transactions/:id", h.transactionDetail as any, { detail: { tags: ["Billing"], summary: "Get transaction" } })
      .post("/sync", h.sync as any, { beforeHandle: resellerGuard, detail: { tags: ["Billing"], summary: "Sync transactions from Resellercamp" } })
  );
