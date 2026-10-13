/**
 * Show the formatted price entries for the .id family, to confirm whether the
 * backend actually produces a usable price for co.id / we.id / sch.id / biz.id /
 * ai.id — or whether they are dropped/malformed in formatting.
 */
import { getSystemSettings } from "../src/modules/settings/settings.service";
import { LiquidClient, formatCustomerPrices } from "../src/lib/liquid";

const s: any = await getSystemSettings();
const client = new LiquidClient(String(s.reseller_id || "").trim(), String(s.reseller_api_key || s.liquid_api_key || "").trim());

const raw = await client.getCustomerPrices(true);
console.log("=== RAW .id family ===");
for (const k of Object.keys(raw || {})) {
  if (/id$/i.test(k) || /id/i.test(k)) {
    console.log(k, "->", JSON.stringify(raw[k]));
  }
}

const formatted = formatCustomerPrices(raw);
console.log("\n=== FORMATTED: all tld keys ===");
console.log(Object.keys(formatted).join(", "));

console.log("\n=== FORMATTED .id family detail ===");
for (const [tld, v] of Object.entries(formatted) as any) {
  if (tld.includes("id") && tld !== "com") {
    console.log(`${tld.padEnd(10)} new=${v.price_new} renew=${v.price_renew} currency=${v.currency} tldField=${v.tld}`);
  }
}

process.exit(0);
