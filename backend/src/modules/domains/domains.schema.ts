import { t } from "elysia";

export const domainRegisterSchema = t.Object({
  domain_name: t.String({ minLength: 1 }),
  tld: t.String({ minLength: 1 }),
  years: t.Numeric({ minimum: 1, maximum: 10, default: 1 }),
  customer_id: t.Optional(t.Numeric()),
  nameservers: t.Optional(t.Array(t.String())),
  auto_renew: t.Optional(t.Boolean()),
  privacy_protection: t.Optional(t.Boolean()),
});

export const domainRenewSchema = t.Object({
  years: t.Numeric({ minimum: 1, maximum: 10, default: 1 }),
});

export const transferSchema = t.Object({
  domain_name: t.String(),
  auth_code: t.Optional(t.String()),
});

export const nameserverSchema = t.Object({
  nameservers: t.Array(t.String({ minLength: 1 }), { minItems: 2 }),
});

export const authCodeSchema = t.Object({
  auth_code: t.String({ minLength: 1 }),
});

export const suspendSchema = t.Object({
  reason: t.String({ minLength: 5, maxLength: 500 }),
});
