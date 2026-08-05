/**
 * One-shot idempotent backfill:
 *   transactions.orderId   EXT-*  ->  INV-*
 *   metadata.orderId       EXT-*  ->  INV-*
 *
 * Run with:
 *   cd backend && npx tsx src/db/migrations/run-invoice-prefix-backfill.ts
 *
 * Safe to re-run: rows already prefixed INV- are skipped by the WHERE clause.
 */

import { db } from "../../db";
import { sql } from "drizzle-orm";

async function backfill() {
  const rows: any = await db.execute(sql`
    SELECT id, orderId, metadata
    FROM transactions
    WHERE orderId LIKE 'EXT-%'
       OR metadata LIKE '%"orderId":"EXT-%'
       OR metadata LIKE '%"orderId": "EXT-%'
  `);

  let updated = 0;
  for (const row of rows) {
    let newOrderId = row.orderId;
    if (typeof row.orderId === "string" && row.orderId.startsWith("EXT-")) {
      newOrderId = `INV-${row.orderId.slice(4)}`;
    }

    let newMetadata = row.metadata;
    if (typeof row.metadata === "string" && row.metadata.includes('"orderId":"EXT-')) {
      try {
        const meta = JSON.parse(row.metadata);
        if (typeof meta.orderId === "string" && meta.orderId.startsWith("EXT-")) {
          meta.orderId = `INV-${meta.orderId.slice(4)}`;
          newMetadata = JSON.stringify(meta);
        }
      } catch {}
    }

    if (newOrderId !== row.orderId || newMetadata !== row.metadata) {
      await db.execute(sql`
        UPDATE transactions
        SET orderId = ${newOrderId}, metadata = ${newMetadata}
        WHERE id = ${row.id}
      `);
      updated++;
    }
  }

  console.log(`[backfill] updated ${updated} of ${rows.length} rows`);
  process.exit(0);
}

backfill().catch((e) => {
  console.error("[backfill] error:", e);
  process.exit(1);
});
