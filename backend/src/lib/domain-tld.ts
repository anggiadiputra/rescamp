/**
 * TLD suffix of a domain name, preserving the separator so second-level ccTLDs
 * survive: "whoops.web.id" -> "web.id", "a.co.id" -> "co.id", "a.com" -> "com".
 *
 * The price list (`/billing/prices`) is keyed by these exact values, so
 * collapsing the dot ("webid") silently breaks every renewal-price lookup.
 */
export function tldFromDomainName(name: unknown): string {
  const n = String(name ?? "").trim().toLowerCase();
  const i = n.indexOf(".");
  return i >= 0 ? n.slice(i + 1) : "";
}
