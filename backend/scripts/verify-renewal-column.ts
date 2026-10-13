/**
 * End-to-end check of the Perpanjangan column: list live domains from the
 * registrar, derive the TLD the way the API now does, and resolve the renewal
 * price from the price list the way the frontend does. Confirms the column will
 * no longer render "-" for second-level ccTLDs.
 */
import { getSystemSettings } from "../src/modules/settings/settings.service";
import { LiquidClient, formatCustomerPrices } from "../src/lib/liquid";
import { tldFromDomainName } from "../src/lib/domain-tld";
import { listDomainsFromLiquid } from "../src/modules/domains/domains.service";

const s: any = await getSystemSettings();
const resellerId = String(s.reseller_id || "").trim();
const apiKey = String(s.reseller_api_key || s.liquid_api_key || "").trim();

// Price list (same source as /billing/prices)
const client = new LiquidClient(resellerId, apiKey);
const prices = formatCustomerPrices(await client.getCustomerPrices());

// Live list (same source as /domains/remote)
const result = await listDomainsFromLiquid({ resellerId, apiKey }, null, 1, 50);
const items: any[] = result.items || [];

function renewPriceFor(domain: any): number | null {
  const keys = [String(domain.tld || "").toLowerCase(), tldFromDomainName(domain.domainName)].filter(Boolean);
  for (const key of keys) {
    const info = prices[key];
    const raw = Number(info?.price_renew);
    if (info && Number.isFinite(raw) && raw > 0) return raw < 1000 ? raw * 1000 : raw;
  }
  return null;
}

console.log("domain".padEnd(24), "tld".padEnd(10), "renew/thn");
console.log("-".repeat(52));
let missing = 0;
for (const d of items) {
  const p = renewPriceFor(d);
  if (p === null) missing++;
  console.log(
    String(d.domainName).padEnd(24),
    String(d.tld).padEnd(10),
    p === null ? "-(TIDAK ADA)" : `Rp${p.toLocaleString("id-ID")}`,
  );
}
console.log("-".repeat(52));
console.log(`total=${items.length}  tanpa harga perpanjangan=${missing}`);
process.exit(0);
