import { db } from "./src/db";
import { users } from "./src/db/schema";
import { eq } from "drizzle-orm";
import { LiquidClient } from "./src/lib/liquid";

async function main() {
  const [reseller] = await db.select().from(users).where(eq(users.role, "reseller")).limit(1);
  const liquid = new LiquidClient(reseller.resellerId!, reseller.apiKey!, "https://api.liqu.id/v1");

  console.log("=== LIST ALL CONTACTS FOR CUSTOMER 12 ===");
  const list = await (liquid as any).request("GET", "/customers/12/contacts");
  console.log(JSON.stringify(list, null, 2));

  console.log("=== GET DEFAULT CONTACTS FOR CUSTOMER 12 ===");
  const def = await (liquid as any).request("GET", "/customers/12/contacts/default");
  console.log(JSON.stringify(def, null, 2));
}

main().catch(console.error);
