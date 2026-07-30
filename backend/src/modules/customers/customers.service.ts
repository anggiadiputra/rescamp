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
  // Resolve reseller liquid credentials if user is linked to a parent reseller
  let creds = { resellerId: user.resellerId, apiKey: user.apiKey };
  if (!creds.resellerId || !creds.apiKey) {
    if (user.parentResellerId) {
      const [reseller] = await db.select().from(users).where(eq(users.id, user.parentResellerId));
      if (reseller?.resellerId && reseller?.apiKey) {
        creds = { resellerId: reseller.resellerId, apiKey: reseller.apiKey };
      }
    }
  }

  // Create in LIQUID API first
  let liquidCustomerId = "";
  if (creds.resellerId && creds.apiKey) {
    try {
      const liquid = new LiquidClient(creds.resellerId, creds.apiKey);
      const liquidRes = await liquid.createCustomer(data);
      liquidCustomerId = String(liquidRes?.customer_id || liquidRes?.id || "");
    } catch (err: any) {
      console.error("[customer-create] LIQUID create customer error:", err);
      // Fallback: search existing customer in LIQUID if email already registered
      try {
        const liquid = new LiquidClient(creds.resellerId, creds.apiKey);
        const listRes = await liquid.listCustomers();
        const list = Array.isArray(listRes) ? listRes : listRes?.data || listRes?.customers || [];
        const match = list.find((c: any) => (c.email || c.customer_email)?.toLowerCase() === data.email.toLowerCase());
        if (match) {
          liquidCustomerId = String(match.customer_id || match.id || "");
        }
      } catch {}
    }
  }

  const insertResult: any = await db.insert(customers).values({
    userId: user.id,
    liquidCustomerId: liquidCustomerId || null,
    name: data.name,
    email: data.email,
    company: data.company || null,
    address: data.address || null,
    city: data.city || null,
    state: data.state || null,
    country: data.country || "ID",
    zipcode: data.zipcode || null,
    phone: data.phone || null,
  });
  const custId = Number(insertResult[0]?.insertId || insertResult.insertId);
  const [cust] = await db.select().from(customers).where(eq(customers.id, custId));

  return cust!;
}

export async function listCustomers(userId: number, search?: string) {
  const [user] = await db.select({ role: users.role, email: users.email }).from(users).where(eq(users.id, userId));
  if (user?.role === "customer") {
    let rows = await db.select().from(customers).where(eq(customers.email, user.email));
    if (rows.length === 0) {
      rows = await db.select().from(customers).where(eq(customers.userId, userId));
    }
    return rows;
  }
  let where = eq(customers.userId, userId);
  if (search) where = and(where, like(customers.name, `%${search}%`)) as any;
  return db.select().from(customers).where(where);
}

export async function getCustomer(userId: number, customerId: number) {
  const [cust] = await db.select().from(customers).where(and(eq(customers.id, customerId), eq(customers.userId, userId)));
  if (!cust) throw new AppError("Customer not found", 404);
  return cust;
}

export async function updateCustomer(
  creds: { resellerId: string | null; apiKey: string | null },
  userId: number,
  customerId: number,
  data: Partial<{
    name: string; email: string; company: string; address: string; city: string; state: string; country: string; zipcode: string; phone: string;
  }>,
) {
  const cust = await getCustomer(userId, customerId);
  await db.update(customers).set(data).where(eq(customers.id, customerId));

  // Sync to LIQUID
  if (cust.liquidCustomerId && creds.resellerId && creds.apiKey) {
    (async () => {
      try {
        const liquid = new LiquidClient(creds.resellerId!, creds.apiKey!);
        await liquid.updateCustomer(cust.liquidCustomerId!, {
          name: data.name ?? cust.name,
          email: data.email ?? cust.email,
          company: data.company ?? cust.company ?? "",
          address_line_1: data.address ?? cust.address ?? "",
          city: data.city ?? cust.city ?? "",
          state: data.state ?? cust.state ?? "",
          country_code: (data.country ?? cust.country ?? "ID").slice(0, 2).toUpperCase(),
          zipcode: data.zipcode ?? cust.zipcode ?? "",
          tel_cc_no: cust.phone_cc || "62",
          tel_no: data.phone ?? cust.phone ?? "",
        });
      } catch (e) { console.error("[customer] LIQUID update failed:", e); }
    })();
  }

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
  if (cust.email) {
    await db.delete(users).where(and(eq(users.email, cust.email), eq(users.role, "customer")));
  }
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
