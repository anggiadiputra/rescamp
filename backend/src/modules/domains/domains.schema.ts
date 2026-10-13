import { t } from "elysia";
import { sanitizedString } from "../../lib/schema-helpers";
import { sanitizeDomain, sanitizeNameserver } from "../../lib/sanitize";

// Pilihan gateway checkout (opsional — default sumopod).
// Dipakai bersama oleh register/renew/transfer/buy-privacy.
const gatewaySelection = {
  gateway: t.Optional(t.Union([t.Literal("sumopod"), t.Literal("duitku")])),
  payment_method: t.Optional(t.String({ maxLength: 8 })),
};

export const domainRegisterSchema = t.Object({
  domain_name: sanitizedString((v: string) => sanitizeDomain(v), { minLength: 1 }),
  tld: sanitizedString((v: string) => sanitizeDomain(v), { minLength: 1 }),
  // Whole years only: a fractional value (1.5) used to flow into the price
  // multiplier, the Liquid request and the local years counter.
  years: t.Integer({ minimum: 1, maximum: 10, default: 1 }),
  customer_id: t.Optional(t.Numeric()),
  nameservers: t.Optional(t.Array(
    sanitizedString((v: string) => sanitizeNameserver(v), { minLength: 1 })
  )),
  auto_renew: t.Optional(t.Boolean()),
  privacy_protection: t.Optional(t.Boolean()),
  ...gatewaySelection,
});

export const domainRenewSchema = t.Object({
  // Whole years only: a fractional value (1.5) used to flow into the price
  // multiplier, the Liquid request and the local years counter.
  years: t.Integer({ minimum: 1, maximum: 10, default: 1 }),
  purchase_privacy_protection: t.Optional(t.Boolean()),
  privacy_protection: t.Optional(t.Boolean()),
  ...gatewaySelection,
});

export const transferSchema = t.Object({
  domain_name: sanitizedString((v: string) => sanitizeDomain(v)),
  auth_code: t.Optional(t.String()),
  ...gatewaySelection,
});

export const nameserverSchema = t.Object({
  nameservers: t.Array(sanitizedString((v: string) => sanitizeNameserver(v), { minLength: 1 }), { minItems: 2 }),
});

export const authCodeSchema = t.Object({
  auth_code: t.String({ minLength: 1 }),
});

export const suspendSchema = t.Object({
  reason: t.String({ minLength: 5, maxLength: 500 }),
});
