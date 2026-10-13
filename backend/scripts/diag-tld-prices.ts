/**
 * Diagnostic: list the TLDs present in the registrar's customer price list and
 * show the raw entries for the .id family, to explain why co.id / sch.id /
 * biz.id / ai.id / we.id show no price on the frontend.
 */
import { getSystemSettings } from "../src/modules/settings/settings.service";
import { LiquidClient, formatCustomerPrices } from "../src/lib/liquid";

const s: any = await getSystemSettings();
const client = new LiquidClient(String(s.reseller_id || "").trim(), String(s.reseller_api_key || s.liquid_api_key || "").trim());

const t0 = Date.now();
let raw: any = null;
for (const fn of ["getCustomerPrices", "getPrices"] as const) {
  try {
    raw = await (client as any)[fn](true);
    console.log(`[${fn}] ok in ${Date.now() - t0}ms`);
    break;
  } catch (e: any) {
    console.log(`[${fn}] failed: ${e?.message || e}`);
  }
}

if (!raw) {
  console.log("no price list returned");
  process.exit(0);
}

// Shape probe
console.log("raw type:", Array.isArray(raw) ? "array" : typeof raw);
const asObj = raw && !Array.isArray(raw) && typeof raw === "object" ? raw : null;
if (asObj) console.log("raw top-level keys (first 20):", Object.keys(asObj).slice(0, 20).join(", "));

// Try the formatter the API actually uses
let formatted: Record<string, any> = {};
try {
  formatted = formatCustomerPrices(raw);
  console.log("formatted keys count:", Object.keys(formatted).length);
  console.log("formatted sample:", JSON.stringify(Object.entries(formatted).slice(0, 3)));
} catch (e: any) {
  console.log("formatCustomerPrices failed:", e?.message || e);
}

// Which .id TLDs are present anywhere in the payload?
const blob = JSON.stringify(raw).toLowerCase();
for (const t of ["com", "id", "co.id", "we.id", "sch.id", "biz.id", "ai.id", "my.id", "net", "xyz"]) {
  const present = blob.includes(`"${t}"`) || blob.includes(`.${t}"`) || new RegExp(`[".\\s]${t.replace(".", "\\.")}[".\\s,:]`).test(blob);
  console.log(`TLD ${t.padEnd(7)} present in payload: ${present}`);
}

process.exit(0);
