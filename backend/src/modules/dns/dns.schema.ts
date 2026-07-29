import { t } from "elysia";

export const dnsRecordSchema = t.Object({
  hostname: t.String({ minLength: 1 }),
  value: t.String({ minLength: 1 }),
  ttl: t.Optional(t.Numeric({ default: 3600 })),
});

export const dnsTypeParam = t.String({
  enum: ["a", "aaaa", "cname", "mx", "txt", "ns", "srv"],
});
