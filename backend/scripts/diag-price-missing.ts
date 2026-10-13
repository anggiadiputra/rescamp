/**
 * Capture WHICH TLDs go missing when the registrar returns a short price list.
 * Runs many samples and prints the missing set for every short response, so we
 * can confirm whether the .id family is exactly what disappears.
 */
import { getSystemSettings } from "../src/modules/settings/settings.service";
import { LiquidClient, formatCustomerPrices } from "../src/lib/liquid";

const s: any = await getSystemSettings();
const client = new LiquidClient(String(s.reseller_id || "").trim(), String(s.reseller_api_key || s.liquid_api_key || "").trim());

const baseline: string[] = [];
const shortRuns: Array<{ run: number; count: number; missing: string[] }> = [];
let maxCount = 0;

for (let i = 1; i <= 15; i++) {
  try {
    const raw = await client.getCustomerPrices(true);
    const keys = Object.keys(formatCustomerPrices(raw));
    if (keys.length > maxCount) {
      maxCount = keys.length;
      baseline.length = 0;
      baseline.push(...keys);
    }
    if (keys.length < maxCount) {
      const missing = baseline.filter((k) => !keys.includes(k));
      shortRuns.push({ run: i, count: keys.length, missing });
    }
    console.log(`run ${String(i).padStart(2)}: keys=${keys.length}`);
  } catch (e: any) {
    console.log(`run ${String(i).padStart(2)}: FAILED ${e?.message || e}`);
  }
}

console.log("\nbaseline (max) keys:", maxCount, baseline.join(", "));
console.log("\nshort responses:", shortRuns.length);
for (const r of shortRuns) {
  console.log(`  run ${r.run}: ${r.count} keys, missing = [${r.missing.join(", ")}]`);
}

process.exit(0);
