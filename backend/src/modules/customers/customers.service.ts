import { db } from "../../db";
import { customers, users } from "../../db/schema";
import { domains } from "../../db/schema/domains";
import { eq, and, like, sql, inArray } from "drizzle-orm";
import { LiquidClient } from "../../lib/liquid";
import { AppError } from "../../lib/error";
import { resolveResellerCreds } from "../../lib/reseller-creds";
import { canAccessTenantResource, loadTenantScope, type TenantPrincipal } from "../../lib/tenant-access";

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

export async function listCustomers(userParam: TenantPrincipal | number, search?: string, page = 1, perPage = 20) {
  const user = typeof userParam === "number"
    ? (await db.select().from(users).where(eq(users.id, userParam)))[0]
    : userParam;
  if (!user) throw new AppError("User not found", 404);
  const scope = await loadTenantScope(user);
  let where: any = scope.unrestricted ? undefined : inArray(customers.id, scope.customerIds.length > 0 ? scope.customerIds : [-1]);
  if (search) where = where ? and(where, like(customers.name, `%${search}%`)) : like(customers.name, `%${search}%`);
  const offset = (page - 1) * perPage;
  const rows = await db.select().from(customers).where(where).orderBy(sql`${customers.createdAt} desc`).limit(perPage).offset(offset);
  const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(customers).where(where);
  return { data: rows, meta: { total: Number(countResult?.count || 0), page, perPage } };
}

export async function getCustomer(userParam: { id: number; role?: string | null; email?: string | null } | number, customerId: number) {
  const user = typeof userParam === "number"
    ? (await db.select().from(users).where(eq(users.id, userParam)))[0]
    : userParam;
  if (!user) throw new AppError("User not found", 404);

  const [cust] = await db.select().from(customers).where(eq(customers.id, customerId));
  if (!cust) throw new AppError("Customer not found", 404);

  const scope = await loadTenantScope(user);
  if (!canAccessTenantResource(scope, { userId: cust.userId, customerId: cust.id }))
    throw new AppError("Customer not found", 404);
  return cust;
}

export async function updateCustomer(
  creds: { resellerId: string | null; apiKey: string | null },
  userParam: any,
  customerId: number,
  data: Partial<{
    name: string; email: string; company: string; address: string; city: string; state: string; country: string; zipcode: string; phone: string;
  }>,
) {
  const cust = await getCustomer(userParam, customerId);
  await db.update(customers).set(data).where(eq(customers.id, customerId));

  // Sync to LIQUID
  if (cust.liquidCustomerId && creds.resellerId && creds.apiKey) {
    try {
      const liquid = new LiquidClient(creds.resellerId, creds.apiKey);
      await liquid.updateCustomer(cust.liquidCustomerId, {
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
    } catch (e: any) {
      console.error("[customer] LIQUID update failed:", e?.message || e);
    }
  }

  const [updated] = await db.select().from(customers).where(eq(customers.id, customerId));
  return updated!;
}

export async function deleteCustomer(creds: { resellerId: string | null; apiKey: string | null }, userParam: any, customerId: number) {
  const cust = await getCustomer(userParam, customerId);

  // Delete from LIQUID first
  if (cust.liquidCustomerId && creds.resellerId && creds.apiKey) {
    try {
      const liquid = new LiquidClient(creds.resellerId, creds.apiKey);
      await liquid.deleteCustomer(cust.liquidCustomerId);
    } catch (e: any) { 
      console.error("[customer] LIQUID delete failed:", e?.message || e); 
    }
  }

  // Wrap in database transaction for atomic operation
  await db.transaction(async (tx) => {
    // Check for active domains before deleting to prevent race conditions
    const [active] = await tx.select({ id: domains.id }).from(domains)
      .where(and(eq(domains.customerId, customerId), eq(domains.status, "active")))
      .limit(1);
    
    if (active) {
      throw new AppError("Customer has active domains. Transfer or delete domains first.", 409);
    }

    await tx.delete(customers).where(eq(customers.id, customerId));
    if (cust.email) {
      await tx.delete(users).where(and(eq(users.email, cust.email), eq(users.role, "customer")));
    }
  });
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

function parseLiquidCustomerList(raw: any): any[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "object") {
    if (Array.isArray(raw.data)) return raw.data;
    if (Array.isArray(raw.customers)) return raw.customers;
    // Resellercamp / LogicBoxes API returns { "1": { customerid: "...", ... }, "2": { ... }, "rec_count": 2 }
    return Object.entries(raw)
      .filter(([k]) => k !== "rec_count" && !isNaN(Number(k)))
      .map(([_, v]) => v);
  }
  return [];
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

  const raw = await liquid.listCustomers(params).catch(() => null);
  const list = parseLiquidCustomerList(raw);

  const items = list
    .map((c: any) => {
      const liquidId = String(
        c.customer_id || c.customerid || c.id || c["customer.customerid"] || c["customerid"] || ""
      ).trim();
      if (!liquidId) return null;
      const email = String(
        c.email || c.username || c.customer_email || c["customer.email"] || ""
      ).trim().toLowerCase();
      return {
        // Use liquidCustomerId as numeric-ish `id` for FE compatibility with existing Customer type.
        id: liquidId as any,
        liquidCustomerId: liquidId,
        name: String(c.name || c.customer_name || c["customer.name"] || email.split("@")[0] || "Customer").trim(),
        email,
        company: c.company || c.company_name || "",
        address: c.address_line_1 || c.address || c.address1 || "",
        city: c.city || "",
        state: c.state || "",
        country: String(c.country_code || c.country || "ID").slice(0, 2).toUpperCase(),
        zipcode: c.zipcode || c.zip || "",
        phone: String(c.tel_no || c.phone || ""),
        phone_cc: String(c.tel_cc_no || c.phone_cc || "62"),
        createdAt: c.creation_time || c.creation_date || c.created_at || "",
      };
    })
    .filter(Boolean);

  const reachedEnd = list.length < perPage;

  // Merge any local DB customers not present in remote list (e.g. newly registered users)
  if (page === 1 && !customerLiquidId) {
    try {
      const remoteEmails = new Set(items.map((it: any) => (it.email || "").toLowerCase()));
      const localCusts = await db.select().from(customers);
      for (const lc of localCusts) {
        if (!lc.email || remoteEmails.has(lc.email.toLowerCase())) continue;
        items.unshift({
          id: lc.id as any,
          liquidCustomerId: lc.liquidCustomerId || "",
          name: lc.name || (lc.email ? lc.email.split("@")[0] || "" : ""),
          email: lc.email,
          company: lc.company || "",
          address: lc.address || "",
          city: lc.city || "",
          state: lc.state || "",
          country: lc.country || "ID",
          zipcode: lc.zipcode || "",
          phone: lc.phone || "",
          phone_cc: lc.phone_cc || "62",
          createdAt: lc.createdAt ? new Date(lc.createdAt).toISOString() : "",
        });
        remoteEmails.add(lc.email.toLowerCase());

        // Attempt background auto-creation on Resellercamp for un-linked customers
        if (!lc.liquidCustomerId && creds.resellerId && creds.apiKey) {
          (async () => {
            try {
              const liq = new LiquidClient(creds.resellerId, creds.apiKey);
              const created: any = await liq.createCustomer({
                name: lc.name, email: lc.email,
                company: lc.company || "", address: lc.address || "",
                city: lc.city || "", state: lc.state || "",
                country: lc.country || "ID", zipcode: lc.zipcode || "",
                tel_cc_no: lc.phone_cc || "62", phone: lc.phone || "",
              });
              const cid = String(created?.data?.customer_id || created?.customer_id || created?.id || "").trim();
              if (cid && cid !== "null" && cid !== "undefined") {
                await db.update(customers).set({ liquidCustomerId: cid }).where(eq(customers.id, lc.id));
              }
            } catch {}
          })();
        }
      }
    } catch (e) {
      console.warn("[customers.service] Local customer merge error:", e);
    }
  }

  const total = reachedEnd ? items.length : Math.max(items.length, page * perPage + 1);

  return { items, total, reachedEnd };
}

/**
 * Auto-sync all customers from Resellercamp into local MySQL `customers` table.
 * Performs full upsert (insert new, update existing) with complete fields.
 */
export async function syncCustomersFromLiquid(userId: number) {
  const creds = await resolveResellerCreds(userId);
  if (!creds?.resellerId || !creds?.apiKey) {
    throw new AppError("Resellercamp credentials not configured", 400);
  }

  const liquid = new LiquidClient(creds.resellerId, creds.apiKey);
  let pageNo = 1;
  let syncedCount = 0;
  let newAddedCount = 0;
  let totalRemote = 0;

  while (true) {
    const raw = await liquid.listCustomers({ limit: "100", page_no: String(pageNo) }).catch(() => null);
    const list = parseLiquidCustomerList(raw);
    if (list.length === 0) break;
    totalRemote += list.length;

    for (const c of list) {
      try {
        const liquidId = String(
          c.customer_id || c.customerid || c.id || c["customer.customerid"] || c["customerid"] || ""
        ).trim();
        const email = String(
          c.email || c.username || c.customer_email || c["customer.email"] || ""
        ).trim().toLowerCase();
        if (!email) continue;

        const name = String(c.name || c.customer_name || c["customer.name"] || email.split("@")[0] || "Customer").trim();
        const company = c.company || c.company_name || null;
        const address = c.address_line_1 || c.address || c.address1 || null;
        const city = c.city || null;
        const state = c.state || null;
        const country = String(c.country_code || c.country || "ID").slice(0, 2).toUpperCase();
        const zipcode = c.zipcode || c.zip || null;
        const phone_cc = String(c.tel_cc_no || c.phone_cc || "62");
        const phone = String(c.tel_no || c.phone || "");

        // Match local user ID by email if exists
        const [matchedUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
        const linkedUserId = matchedUser?.id || null;

        // Check if customer exists locally by liquidCustomerId or email
        let [existing] = liquidId
          ? await db.select().from(customers).where(eq(customers.liquidCustomerId, liquidId)).limit(1)
          : [];

        if (!existing) {
          [existing] = await db.select().from(customers).where(eq(customers.email, email)).limit(1);
        }

        const dataToSave = {
          liquidCustomerId: liquidId || null,
          name,
          email,
          company,
          address,
          city,
          state,
          country,
          zipcode,
          phone_cc,
          phone,
          ...(linkedUserId ? { userId: linkedUserId } : {}),
        };

        if (existing) {
          await db.update(customers).set(dataToSave).where(eq(customers.id, existing.id));
          syncedCount++;
        } else {
          await db.insert(customers).values({
            userId: linkedUserId,
            ...dataToSave,
          });
          newAddedCount++;
          syncedCount++;
        }
      } catch (e: any) {
        console.warn(`[syncCustomers] Failed to sync customer ${c.email}:`, e?.message || e);
      }
    }

    if (list.length < 100) break;
    pageNo++;
  }

  return { syncedCount, newAddedCount, total: totalRemote };
}
