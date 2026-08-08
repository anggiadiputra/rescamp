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

/**
 * Sanitize arbitrary user input - strip dangerous HTML characters
 * Generic fallback for untyped fields
 */
export function sanitizeInput(str: string): string {
  return (str || "")
    .trim()
    .replace(/[<>\"'&]/g, "");
}
