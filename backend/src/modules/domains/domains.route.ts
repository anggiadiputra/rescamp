import { Elysia } from "elysia";
import { domainRegisterSchema, domainRenewSchema, nameserverSchema, authCodeSchema, suspendSchema } from "./domains.schema";
import * as h from "./domains.handler";
import { authGuard, resellerGuard } from "../../middleware/auth";
import { dnsRoutes } from "../dns/dns.route";
import { forwardingRoutes } from "../forwarding/forwarding.route";

export const domainRoutes = new Elysia({ prefix: "/domains" })
  .get("/availability", h.checkAvailability as any, { detail: { tags: ["Domains"], summary: "Check availability" } })
  .get("/bulk-availability", h.bulkAvailability as any, { detail: { tags: ["Domains"], summary: "Bulk availability across TLDs" } })
  .get("/suggestion", h.suggestions as any, { detail: { tags: ["Domains"], summary: "Suggestions" } })
  .guard({ beforeHandle: authGuard }, (app) =>
    app
      .post("/", h.register as any, { body: domainRegisterSchema, detail: { tags: ["Domains"], summary: "Register domain" } })
      .post("/transfer", h.transfer as any, { detail: { tags: ["Domains"], summary: "Transfer domain" } })
      .post("/sync", h.sync as any, { detail: { tags: ["Domains"], summary: "Sync domains from Resellercamp" } })
      .get("/remote", h.listRemote as any, { detail: { tags: ["Domains"], summary: "List domains live from Resellercamp (no DB cache)" } })
      .get("/", h.list as any, { detail: { tags: ["Domains"], summary: "List domains" } })
      .get("/:id", h.detail as any, { detail: { tags: ["Domains"], summary: "Get domain" } })
      .post("/:id/renew", h.renew as any, { body: domainRenewSchema, detail: { tags: ["Domains"], summary: "Renew domain" } })
      .put("/:id/locked", h.lock as any, { detail: { tags: ["Domains"], summary: "Lock domain" } })
      .delete("/:id/locked", h.unlock as any, { detail: { tags: ["Domains"], summary: "Unlock domain" } })
      .put("/:id/ns", h.updateNs as any, { body: nameserverSchema, detail: { tags: ["Domains"], summary: "Update nameservers" } })
      .get("/:id/ns", h.getNs as any, { detail: { tags: ["Domains"], summary: "Get nameservers" } })
      .get("/:id/auth-code", h.getAuth as any, { detail: { tags: ["Domains"], summary: "Get auth code" } })
      .put("/:id/auth-code", h.updateAuth as any, { body: authCodeSchema, detail: { tags: ["Domains"], summary: "Update auth code" } })
      .put("/:id/theft-protection", h.enableTheft as any, { detail: { tags: ["Domains"], summary: "Enable theft protection" } })
      .delete("/:id/theft-protection", h.disableTheft as any, { detail: { tags: ["Domains"], summary: "Disable theft protection" } })
      .post("/:id/restore", h.restore as any, { detail: { tags: ["Domains"], summary: "Restore domain" } })
      .put("/:id/suspended", h.suspend as any, { beforeHandle: resellerGuard, body: suspendSchema, detail: { tags: ["Domains"], summary: "Suspend domain (reseller only)" } })
      .delete("/:id/suspended", h.unsuspend as any, { beforeHandle: resellerGuard, detail: { tags: ["Domains"], summary: "Unsuspend domain (reseller only)" } })
      .delete("/:id", h.remove as any, { detail: { tags: ["Domains"], summary: "Delete domain" } })
      // Mount DNS + Forwarding sub-routes under :id
      .group("/:id", (app) => app.use(dnsRoutes).use(forwardingRoutes))
  );
