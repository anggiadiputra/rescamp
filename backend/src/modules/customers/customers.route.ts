import { Elysia } from "elysia";
import { customerSchema, completeProfileSchema } from "./customers.schema";
import * as h from "./customers.handler";
import { authGuard } from "../../middleware/auth";

export const customerRoutes = new Elysia({ prefix: "/customers" })
  .guard({ beforeHandle: authGuard }, (app) =>
    app
      .get("/", h.list as any, { detail: { tags: ["Customers"], summary: "List customers" } })
      .post("/", h.create as any, { body: customerSchema, detail: { tags: ["Customers"], summary: "Create customer" } })
      .post("/complete-profile", h.completeProfile as any, { body: completeProfileSchema, detail: { tags: ["Customers"], summary: "Complete profile + create LIQUID customer" } })
      .get("/:id", h.detail as any, { detail: { tags: ["Customers"], summary: "Get customer" } })
      .put("/:id", h.update as any, { body: customerSchema, detail: { tags: ["Customers"], summary: "Update customer" } })
      .delete("/:id", h.remove as any)
      .post("/sync", h.sync as any, { detail: { tags: ["Customers"], summary: "Delete customer" } })
  );
