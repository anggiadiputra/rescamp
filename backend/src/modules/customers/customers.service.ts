import { db } from "../../db";
import { customers, users } from "../../db/schema";
import { domains } from "../../db/schema/domains";
import { eq, and, like, sql } from "drizzle-orm";
import { LiquidClient } from "../../lib/liquid";
import { AppError } from "../../lib/error";
import { resolveResellerCreds } from "../../lib/reseller-creds";

function getLiquid(creds: { resellerId: string; apiKey: string }): LiquidClient {
  return new LiquidClient(creds.resellerId || "", creds.apiKey || "");
}

export async function createCustomer(
  user: { resellerId: string | null; apiKey: string | null; id: number; parentResellerId?: number | null },
  data: { name: string; email: string; company?: string; address?: string; city?: string; state?: string; country: string; zipcode?: string; phone?: string },
) {
  // Resolve reseller liquid credentials via centralized helper (handles decryption + cache)
  const creds = await resolveResellerCreds(user.id);

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
      } catch (fallbackErr: any) {
        console.error("[customer-create] LIQUID fallback search also failed:", fallbackErr?.message || fallbackErr);
      }
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

export async function listCustomers(userId: number, search?: string, page = 1, perPage = 20) {
  const [user] = await db.select({ role: users.role, email: users.email }).from(users).where(eq(users.id, userId));
  if (user?.role === "customer") {
    let rows = await db.select().from(customers).where(eq(customers.email, user.email));
    if (rows.length === 0) {
      rows = await db.select().from(customers).where(eq(customers.userId, userId));
    }
    return { data: rows, meta: { total: rows.length, page: 1, perPage: rows.length } };
  }
  let where: any = undefined;
  if (search) where = like(customers.name, `%${search}%`);
  const offset = (page - 1) * perPage;
  const rows = await db.select().from(customers).where(where).orderBy(sql`${customers.createdAt} desc`).limit(perPage).offset(offset);
  const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(customers).where(where);
  return { data: rows, meta: { total: Number(countResult?.count || 0), page, perPage } };
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
  // Resolve reseller's LIQUID credentials via centralized helper
  const liquidCreds = await resolveResellerCreds(user.id);
  if (!liquidCreds.resellerId || !liquidCreds.apiKey) {
    throw new AppError("Reseller API not configured", 500);
  }

  // Create LIQUID customer
  let liquidCustomerId = "";
  try {
    const liquidRes = await getLiquid(liquidCreds).createCustomer({
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
      eligibility_criteria: "co",
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

// Proxy list directly from Resellercamp (no DB cache). Paginated; for customer role pass their liquidCustomerId.
export async function listCustomersFromLiquid(
  creds: { resellerId: string; apiKey: string },
  customerLiquidId: string | null,
  page: number,
  perPage: number,
) {
  if (!creds?.resellerId || !creds?.apiKey) {
    throw new AppError("Resellercamp credentials not configured", 400);
  }
  const liquid = new LiquidClient(creds.resellerId, creds.apiKey);
  const params: Record<string, string> = {
    limit: String(perPage),
    page_no: String(page),
  };
  if (customerLiquidId) params.customer_id = String(customerLiquidId);

  const raw = await liquid.listCustomers(params);
  const list: any[] = Array.isArray(raw) ? raw : raw?.data || raw?.customers || [];

  const items = list
    .map((c: any) => {
      const liquidId = String(c.customer_id || c.id || "");
      if (!liquidId) return null;
      return {
        // Use liquidCustomerId as numeric-ish `id` for FE compatibility with existing Customer type.
        // Stored as string; backend endpoints that take `:id` will need to special-case this.
        id: liquidId as any,
        liquidCustomerId: liquidId,
        name: c.name || c.customer_name || "",
        email: c.email || c.customer_email || "",
        company: c.company || "",
        address: c.address_line_1 || c.address || "",
        city: c.city || "",
        state: c.state || "",
        country: c.country_code || c.country || "ID",
        zipcode: c.zipcode || c.zip || "",
        phone: c.tel_no || c.phone || "",
        phone_cc: c.tel_cc_no || c.phone_cc || "62",
        createdAt: c.creation_time || c.creation_date || c.created_at || "",
      };
    })
    .filter(Boolean);

  const reachedEnd = list.length < perPage;
  const total = reachedEnd ? (page - 1) * perPage + list.length : page * perPage + 1;

  return { items, total, reachedEnd };
}
