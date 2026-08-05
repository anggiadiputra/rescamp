import { Elysia } from "elysia";
import * as h from "./billing.handler";
import { authGuard } from "../../middleware/auth";

export const billingRoutes = new Elysia({ prefix: "/billing" })
  .guard({ beforeHandle: authGuard }, (app) =>
    app
      .get("/balance", h.balance as any, { detail: { tags: ["Billing"], summary: "Get balance" } })
      .get("/prices", h.prices as any, { detail: { tags: ["Billing"], summary: "Get prices" } })
      .get("/transactions", h.transactions as any, { detail: { tags: ["Billing"], summary: "List transactions" } })
      .get("/transactions/remote", h.listTransactionsRemote as any, { detail: { tags: ["Billing"], summary: "List reseller account transactions live from Resellercamp" } })
      .get("/transactions/:id", h.transactionDetail as any, { detail: { tags: ["Billing"], summary: "Get transaction" } })
      .post("/sync", h.sync as any, { detail: { tags: ["Billing"], summary: "Sync transactions from Resellercamp" } })
  );
