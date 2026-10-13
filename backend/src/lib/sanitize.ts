/**
 * Input sanitization utility to prevent XSS and injection attacks
 * Uses native DOMParser for HTML escaping - no external dependencies
 */

/**
 * Escape HTML special characters to prevent XSS
 * Safe for inserting user content into HTML context
 */
export function escapeHtml(str: string): string {
  const isBrowser = typeof globalThis !== "undefined" && "document" in globalThis && Boolean((globalThis as any).document);
  const div = isBrowser 
    ? (globalThis as any).document.createElement("div") 
    : { innerHTML: "" };
  
  // Native DOM escaping (browser) or manual (Node.js/Bun)
  if ("innerHTML" in div && typeof div.textContent !== "undefined") {
    div.textContent = str;
    return div.innerHTML;
  }
  
  // Manual fallback for server-side
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Sanitize domain name input - allow only valid domain characters
 * Prevents injection in domain registration
 */
export function sanitizeDomain(domain: string): string {
  return (domain || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, "");
}

/**
 * Sanitize nameserver input - allow only valid hostname characters
 */
export function sanitizeNameserver(ns: string): string {
  return (ns || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, "");
}

/**
 * Sanitize company/business name - allow letters, numbers, basic punctuation
 */
export function sanitizeCompanyName(name: string): string {
  return (name || "")
    .trim()
    .replace(/[<>\"'&]/g, "");
}

/**
 * Sanitize address fields - allow alphanumeric and common address characters
 */
export function sanitizeAddress(addr: string): string {
  return (addr || "")
    .trim()
    .replace(/[<>\"'&]/g, "");
}

/**
 * Sanitize phone number - digits, plus, hyphen, parentheses, spaces only
 */
export function sanitizePhone(phone: string): string {
  return (phone || "").replace(/[^\d+\-()\s]/g, "");
}

/**
 * Validate email format (basic check)
 */
export function isValidEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test((email || "").trim());
}

/**
 * Sanitize email - lowercase and trim
 */
export function sanitizeEmail(email: string): string {
  return (email || "").trim().toLowerCase();
}

/**
 * Validate domain format (basic check)
 */
export function isValidDomain(domain: string): boolean {
  const re = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
  return re.test((domain || "").trim());
}

const DNS_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
// Last label of a TLD: starts with a letter (covers IDN "xn--" TLDs too).
const TLD_LAST_LABEL = /^[a-z][a-z0-9-]*[a-z0-9]$/;

/**
 * Validate the (label, tld) pair of a register order and return the single
 * canonical FQDN that BOTH pricing and provisioning must use.
 *
 * `label` must be one DNS label (no dots). Accepting "premium.com" as the label
 * with tld "my.id" used to price the order as .my.id while provisioning
 * premium.com. Returns null when the input is not a valid domain.
 */
export function parseOrderDomain(label: string, tld: string): { label: string; tld: string; fqdn: string } | null {
  const cleanLabel = (label || "").trim().toLowerCase();
  const cleanTld = (tld || "").trim().toLowerCase().replace(/^\./, "");
  if (!DNS_LABEL.test(cleanLabel)) return null;
  const tldLabels = cleanTld.split(".");
  if (tldLabels.length === 0 || tldLabels.length > 3) return null;
  if (!tldLabels.every((l) => DNS_LABEL.test(l))) return null;
  if (!TLD_LAST_LABEL.test(tldLabels[tldLabels.length - 1]!)) return null;
  const fqdn = `${cleanLabel}.${cleanTld}`;
  if (fqdn.length > 253) return null;
  return { label: cleanLabel, tld: cleanTld, fqdn };
}

/**
 * Validate a full domain name (e.g. for transfer) and split it into its first
 * label and the remaining suffix. Returns null when invalid.
 */
export function parseFullDomain(domain: string): { label: string; tld: string; fqdn: string } | null {
  const clean = (domain || "").trim().toLowerCase();
  const dot = clean.indexOf(".");
  if (dot <= 0) return null;
  return parseOrderDomain(clean.slice(0, dot), clean.slice(dot + 1));
}

/**
 * Sanitize arbitrary user input - strip dangerous HTML characters
 * Generic fallback for untyped fields
 */
export function sanitizeInput(str: string): string {
  return (str || "")
    .trim()
    .replace(/[<>\"'&]/g, "");
}
