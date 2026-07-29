import { Elysia } from "elysia";
import { dnsRecordSchema } from "./dns.schema";
import * as h from "./dns.handler";
import { authGuard } from "../../middleware/auth";

// Note: DNS routes are mounted at /domains/:id/dns by index.ts prefix
export const dnsRoutes = new Elysia()
  .guard({ beforeHandle: authGuard }, (app) =>
    app
      .get("/dns/:type", h.list as any, { detail: { tags: ["DNS"], summary: "List DNS records" } })
      .post("/dns/:type", h.add as any, { body: dnsRecordSchema, detail: { tags: ["DNS"], summary: "Add DNS record" } })
      .put("/dns/:type/:oldHost/:oldValue", h.update as any, { body: dnsRecordSchema, detail: { tags: ["DNS"], summary: "Update DNS record" } })
      .delete("/dns/:type/:hostname/:value", h.remove as any, { detail: { tags: ["DNS"], summary: "Delete DNS record" } })
  );
