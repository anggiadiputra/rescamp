import { Elysia } from "elysia";
import { domainForwardSchema, emailForwardSchema } from "./forwarding.schema";
import * as h from "./forwarding.handler";
import { authGuard } from "../../middleware/auth";

export const forwardingRoutes = new Elysia()
  .guard({ beforeHandle: authGuard }, (app) =>
    app
      .get("/domain-forwarding", h.getDomainFwd as any, { detail: { tags: ["Forwarding"], summary: "Get domain forwarding" } })
      .put("/domain-forwarding", h.updateDomainFwd as any, { body: domainForwardSchema, detail: { tags: ["Forwarding"], summary: "Update domain forwarding" } })
      .get("/email-forwarding", h.getEmailFwd as any, { detail: { tags: ["Forwarding"], summary: "List email forwarding" } })
      .post("/email-forwarding", h.createEmailFwd as any, { body: emailForwardSchema, detail: { tags: ["Forwarding"], summary: "Create email forwarding" } })
      .delete("/email-forwarding/:email", h.deleteEmailFwd as any, { detail: { tags: ["Forwarding"], summary: "Delete email forwarding" } })
      .get("/privacy", h.getPrivacy as any, { detail: { tags: ["Privacy"], summary: "Get privacy status" } })
      .put("/privacy", h.enablePrivacy as any, { detail: { tags: ["Privacy"], summary: "Enable privacy" } })
      .delete("/privacy", h.disablePrivacy as any, { detail: { tags: ["Privacy"], summary: "Disable privacy" } })
      .post("/privacy/buy", h.buyPrivacy as any, { detail: { tags: ["Privacy"], summary: "Buy privacy" } })
  );
