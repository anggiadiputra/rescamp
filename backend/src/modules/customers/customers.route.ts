import { Elysia } from "elysia";
import { customerSchema, completeProfileSchema } from "./customers.schema";
import * as h from "./customers.handler";
import { authGuard, resellerGuard } from "../../middleware/auth";

export const customerRoutes = new Elysia({ prefix: "/customers" })
  .post("/complete-profile", h.completeProfile as any, { beforeHandle: authGuard, body: completeProfileSchema, detail: { tags: ["Customers"], summary: "Complete profile + create LIQUID customer" } })
  .get("/", h.list as any, { beforeHandle: authGuard, detail: { tags: ["Customers"], summary: "List customers" } })
  .get("/remote", h.listRemote as any, { beforeHandle: authGuard, detail: { tags: ["Customers"], summary: "List customers live from Resellercamp (no DB cache)" } })
  .guard({ beforeHandle: [authGuard, resellerGuard] }, (app) =>
    app
      .post("/", h.create as any, { body: customerSchema, detail: { tags: ["Customers"], summary: "Create customer" } })
      .get("/:id", h.detail as any, { detail: { tags: ["Customers"], summary: "Get customer" } })
      .put("/:id", h.update as any, { body: customerSchema, detail: { tags: ["Customers"], summary: "Update customer" } })
      .delete("/:id", h.remove as any)
  );
