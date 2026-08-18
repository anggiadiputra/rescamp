import { Elysia } from "elysia";
import { customerSchema, completeProfileSchema } from "./customers.schema";
import * as h from "./customers.handler";
import { authGuard, resellerGuard } from "../../middleware/auth";
import { authenticatedRateLimiter, rateLimit } from "../../lib/rate-limit";

export const customerRoutes = new Elysia({ prefix: "/customers" })
  .post("/complete-profile", h.completeProfile as any, { beforeHandle: [authGuard, rateLimit(authenticatedRateLimiter, "Terlalu banyak permintaan.")], body: completeProfileSchema, detail: { tags: ["Customers"], summary: "Complete profile + create LIQUID customer" } })
  .get("/", h.list as any, { beforeHandle: [authGuard, rateLimit(authenticatedRateLimiter, "Terlalu banyak permintaan.")], detail: { tags: ["Customers"], summary: "List customers" } })
  .get("/remote", h.listRemote as any, { beforeHandle: [authGuard, rateLimit(authenticatedRateLimiter, "Terlalu banyak permintaan.")], detail: { tags: ["Customers"], summary: "List customers live from Resellercamp (no DB cache)" } })
  .post("/sync", h.sync as any, { beforeHandle: [authGuard, resellerGuard, rateLimit(authenticatedRateLimiter, "Terlalu banyak permintaan.")], detail: { tags: ["Customers"], summary: "Sync customers from Resellercamp into local DB" } })
  .guard({ beforeHandle: [authGuard, resellerGuard, rateLimit(authenticatedRateLimiter, "Terlalu banyak permintaan.")] }, (app) =>
    app
      .post("/", h.create as any, { body: customerSchema, detail: { tags: ["Customers"], summary: "Create customer" } })
      .get("/:id", h.detail as any, { detail: { tags: ["Customers"], summary: "Get customer" } })
      .put("/:id", h.update as any, { body: customerSchema, detail: { tags: ["Customers"], summary: "Update customer" } })
      .delete("/:id", h.remove as any)
  );
