import { db } from "../../db";
import { customers, users } from "../../db/schema";
import { domains } from "../../db/schema/domains";
import { eq, and, like } from "drizzle-orm";
import { LiquidClient } from "../../lib/liquid";
import { AppError } from "../../lib/error";

function getLiquid(user: { resellerId: string | null; apiKey: string | null }): LiquidClient {
  return new LiquidClient(user.resellerId || "", user.apiKey || "");
}

export async function createCustomer(
  user: { resellerId: string | null; apiKey: string | null; id: number; parentResellerId?: number | null },
  data: { name: string; email: string; company?: string; address?: string; city?: string; state?: string; country: string; zipcode?: string; phone?: string },
) {
  // Create in LIQUID first
  let liquidId = "";
  try {
    const liquidRes = await getLiquid(user).createCustomer(data);
    liquidId = liquidRes?.id || liquidRes?.customer_id || "";
  } catch {
    // LIQUID may fail, still save locally
  }

  const insertResult: any = await db.insert(customers).values({
    userId: user.id,
    liquidCustomerId: liquidId || null,
    name: data.name,
    email: data.email,
    company: data.company,
    address: data.address,
    city: data.city,
    state: data.state,
    country: data.country,
    zipcode: data.zipcode,
    phone: data.phone,
  });
  const custId = Number(insertResult[0]?.insertId || insertResult.insertId);
  const [cust] = await db.select().from(customers).where(eq(customers.id, custId));

  return cust!;
}

export async function listCustomers(userId: number, search?: string) {
  let where = eq(customers.userId, userId);
  if (search) where = and(where, like(customers.name, `%${search}%`)) as any;
  return db.select().from(customers).where(where);
}

export async function getCustomer(userId: number, customerId: number) {
  const [cust] = await db.select().from(customers).where(and(eq(customers.id, customerId), eq(customers.userId, userId)));
  if (!cust) throw new AppError("Customer not found", 404);
  return cust;
}

export async function updateCustomer(userId: number, customerId: number, data: Partial<{
  name: string; email: string; company: string; address: string; city: string; state: string; country: string; zipcode: string; phone: string;
}>) {
  await getCustomer(userId, customerId);
  await db.update(customers).set(data).where(eq(customers.id, customerId));
  const [updated] = await db.select().from(customers).where(eq(customers.id, customerId));
  return updated!;
}

export async function deleteCustomer(creds: { resellerId: string | null; apiKey: string | null }, userId: number, customerId: number) {
  const cust = await getCustomer(userId, customerId);

  // Check for active domains before deleting
  const [active] = await db.select({ id: domains.id }).from(domains)
    .where(and(eq(domains.customerId, customerId), eq(domains.status, "active")));
  if (active) throw new AppError("Customer has active domains. Transfer or delete domains first.", 409);

  // Delete from LIQUID first
  if (cust.liquidCustomerId && creds.resellerId && creds.apiKey) {
    try {
      const liquid = new LiquidClient(creds.resellerId, creds.apiKey);
      await liquid.deleteCustomer(cust.liquidCustomerId);
    } catch (e) { console.error("[customer] LIQUID delete failed:", e); }
  }

  // Re-verify active domain status before deleting from local DB to avoid FK race condition
  const [recheck] = await db.select({ id: domains.id }).from(domains)
    .where(and(eq(domains.customerId, customerId), eq(domains.status, "active")));
  if (recheck) throw new AppError("Customer has active domains. Cannot delete.", 409);

  await db.delete(customers).where(eq(customers.id, customerId));
}

export async function completeProfile(
  user: { id: number; email: string; name: string; resellerId: string | null; apiKey: string | null; parentResellerId: number | null },
  data: { company: string; address: string; city: string; state: string; country: string; zipcode: string; phone_cc: string; phone: string },
) {
  // Get reseller's LIQUID credentials
  let liquidUser = { resellerId: user.resellerId, apiKey: user.apiKey };
  if (!liquidUser.resellerId || !liquidUser.apiKey) {
    if (!user.parentResellerId) throw new AppError("No reseller linked", 500);
    const [reseller] = await db.select().from(users).where(eq(users.id, user.parentResellerId));
    if (!reseller?.resellerId || !reseller?.apiKey) throw new AppError("Reseller API not configured", 500);
    liquidUser = { resellerId: reseller.resellerId, apiKey: reseller.apiKey };
  }

  // Create LIQUID customer
  let liquidCustomerId = "";
  try {
    const liquidRes = await getLiquid(liquidUser).createCustomer({
      name: user.name,
      email: user.email,
      company: data.company,
      address: data.address,
      city: data.city,
      state: data.state,
      country: data.country,
      zipcode: data.zipcode,
      tel_cc_no: data.phone_cc,
      phone: data.phone,
    });
    liquidCustomerId = liquidRes?.customer_id || liquidRes?.id || "";
  } catch (err: any) {
    console.error("[customer] LIQUID customer creation failed:", err.message);
    // Still save locally even if LIQUID fails
  }

  // Save to our DB — link liquid_customer_id
  const insertResult: any = await db.insert(customers).values({
    userId: user.parentResellerId || user.id,
    liquidCustomerId,
    name: user.name,
    email: user.email,
    company: data.company,
    address: data.address,
    city: data.city,
    state: data.state,
    country: data.country,
    zipcode: data.zipcode,
    phone: data.phone,
  });
  const custId = Number(insertResult[0]?.insertId || insertResult.insertId);
  const [cust] = await db.select().from(customers).where(eq(customers.id, custId));
  return cust!;
}

export async function syncFromLiquid(creds: { resellerId: string | null; apiKey: string | null }, userId: number) {
  if (!creds.resellerId || !creds.apiKey) throw new AppError("LIQUID credentials not configured", 500);
  const liquid = new LiquidClient(creds.resellerId, creds.apiKey);
  const res = await liquid.listCustomers();
  const list = Array.isArray(res) ? res : res?.data || res?.customers || [];
  
  let count = 0;
  for (const c of list) {
    const liquidId = String(c.customer_id || c.id || "");
    if (!liquidId) continue;
    const email = c.email || c.customer_email || "";
    if (!email) continue;
    
    // Check if already exists
    const [existing] = await db.select({ id: customers.id }).from(customers)
      .where(eq(customers.liquidCustomerId, liquidId));
    
    if (!existing) {
      try {
        await db.insert(customers).values({
          userId,
          liquidCustomerId: liquidId,
          name: c.name || c.customer_name || "",
          email,
          company: c.company || "",
          address: c.address_line_1 || c.address || "",
          city: c.city || "",
          state: c.state || "",
          country: c.country_code || c.country || "",
          zipcode: c.zipcode || "",
          phone: c.tel_no || c.phone || "",
        });
        count++;
      } catch (err: any) {
        // Handle duplicate insert gracefully if inserted concurrently
        if (err.code === "ER_DUP_ENTRY" || err.errno === 1062 || err.message?.includes("Duplicate entry")) {
          console.warn(`[customer-sync] Skipped duplicate liquid_customer_id: ${liquidId}`);
        } else {
          throw err;
        }
      }
    }
  }
  return { synced: count, total: list.length };
}
