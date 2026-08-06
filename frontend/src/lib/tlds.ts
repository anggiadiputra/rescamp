// Default TLDs offered in the dashboard hero search. Order = display order.
// Mirrors backend defaultTlds in domains.service.ts (single source for FE display).
// ponytail: keep in sync with backend defaultTlds. When drift becomes a problem,
// serve via /config endpoint instead of hand-editing both sides.
export const DEFAULT_TLDS = ["com", "id", "co.id", "my.id", "or.id", "ac.id", "sch.id", "xyz"] as const;
export type DefaultTld = (typeof DEFAULT_TLDS)[number];
