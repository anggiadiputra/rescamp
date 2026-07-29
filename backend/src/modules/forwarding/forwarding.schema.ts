import { t } from "elysia";

export const domainForwardSchema = t.Object({
  destination_url: t.String({ minLength: 1 }),
  enabled: t.Boolean(),
});

export const emailForwardSchema = t.Object({
  email: t.String({ minLength: 1 }),
  forward_to: t.String({ minLength: 1 }),
});
