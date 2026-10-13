/**
 * Diagnostic: why do .co.id / .sch.id / .biz.id / .ai.id (and .we.id) never come
 * back with a price? Times a direct registrar lookup per TLD and reports the
 * outcome, so we can tell a slow registry from an unsupported one.
 */
import { getSystemSettings } from "../src/modules/settings/settings.service";
import { LiquidClient } from "../src/lib/liquid";

const s: any = await getSystemSettings();
const client = new LiquidClient(String(s.reseller_id || "").trim(), String(s.reseller_api_key || s.liquid_api_key || "").trim());

const words = ["diagtest"];
const tlds = ["com", "id", "co.id", "we.id", "sch.id", "biz.id", "ai.id", "my.id", "net", "xyz"];

for (const tld of tlds) {
  const domain = `${words[0]}.${tld}`;
  const t0 = Date.now();
  try {
    const res: any = await client.checkAvailability(domain, 15_000);
    const ms = Date.now() - t0;
    console.log(`${domain.padEnd(22)} ${String(ms).padStart(6)}ms  OK   ${JSON.stringify(res)?.slice(0, 160)}`);
  } catch (e: any) {
    const ms = Date.now() - t0;
    console.log(`${domain.padEnd(22)} ${String(ms).padStart(6)}ms  FAIL ${e?.message || e}`);
  }
}

process.exit(0);
