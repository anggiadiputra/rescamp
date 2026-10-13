/**
 * Is the registrar price list itself intermittent? Call it repeatedly and count
 * how many TLDs come back each time, and whether the .id family is present.
 */
import { getSystemSettings } from "../src/modules/settings/settings.service";
import { LiquidClient, formatCustomerPrices } from "../src/lib/liquid";

const s: any = await getSystemSettings();
const client = new LiquidClient(String(s.reseller_id || "").trim(), String(s.reseller_api_key || s.liquid_api_key || "").trim());

const watch = ["com", "id", "co.id", "web.id", "sch.id", "biz.id", "ai.id", "my.id", "co.uk"];

for (let i = 1; i <= 6; i++) {
  const t0 = Date.now();
  try {
    const raw = await client.getCustomerPrices(true);
    const formatted = formatCustomerPrices(raw);
    const keys = Object.keys(formatted);
    const missing = watch.filter((t) => !(t in formatted));
    console.log(
      `run ${i}: ${Date.now() - t0}ms  rawKeys=${Object.keys(raw || {}).length}  formatted=${keys.length}  missing=[${missing.join(", ")}]`,
    );
  } catch (e: any) {
    console.log(`run ${i}: ${Date.now() - t0}ms  FAILED ${e?.message || e}`);
  }
}

process.exit(0);
