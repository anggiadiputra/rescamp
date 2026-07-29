import { db } from "../../db";
import { users, customers } from "../../db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword } from "../../lib/hash";
import { signToken } from "../../lib/jwt";
import { AppError } from "../../lib/error";
import { LiquidClient } from "../../lib/liquid";

const MYSQL_DUP_ENTRY = 1062;

export async function register(data: {
  email: string; password: string; name: string; reseller_id: string;
  api_key?: string;
  company?: string; address?: string; city?: string; state?: string;
  country?: string; zipcode?: string; phone_cc?: string; phone?: string;
}) {
  const passwordHash = await hashPassword(data.password);
  const role = data.api_key ? "reseller" : "customer";
  // For customer: use reseller_id from request, or fallback to DEFAULT_RESELLER_ID from .env
  const resellerId = data.reseller_id || (process.env.DEFAULT_RESELLER_ID || "");
  let parentResellerId: number | null = null;
  let resellerObj: any = null;
  if (role === "customer") {
    const [reseller] = await db.select().from(users)
      .where(eq(users.resellerId, resellerId));
    if (!reseller) throw new AppError("Reseller not found. Contact support.", 404);
    parentResellerId = reseller.id;
    resellerObj = reseller;
  }

  try {
    const result: any = await db.insert(users).values({
      email: data.email,
      passwordHash,
      name: data.name,
      role,
      resellerId: role === "reseller" ? data.reseller_id : null,
      apiKey: data.api_key || null,
      parentResellerId,
    });
    const userId = Number(result[0]?.insertId || result.insertId);
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) throw new AppError("Registration failed", 500);

    // Auto-create LIQUID customer for customer role (so they appear in resellercamp immediately)
    if (role === "customer") {
      try {
        const liquid = new LiquidClient(resellerObj.resellerId!, resellerObj.apiKey!);
        const liqCust = await liquid.createCustomer({
          name: data.name, email: data.email,
          company: data.company || "", address: data.address || "",
          city: data.city || "", state: data.state || "Not Applicable",
          country: data.country || "ID", zipcode: data.zipcode || "",
          tel_cc_no: data.phone_cc || "62", phone: data.phone || "",
        });
        const liquidId = liqCust?.customer_id || liqCust?.id || "";
        await db.insert(customers).values({
          userId: parentResellerId!,
          liquidCustomerId: String(liquidId),
          name: data.name, email: data.email,
          company: data.company || "", address: data.address || "",
          city: data.city || "", state: data.state || "Not Applicable",
          country: data.country || "ID", zipcode: data.zipcode || "",
          phone: data.phone || "",
        });
      } catch (e) { console.error("[auth] LIQUID customer auto-create failed:", e); }
    }

    const token = await signToken({ sub: user.id, email: user.email, role: user.role as string });
    return {
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      token,
    };
  } catch (err: any) {
    const msg = err.message || "";
    const cause = err.cause?.message || "";
    if (err.code === "ER_DUP_ENTRY" || err.errno === MYSQL_DUP_ENTRY ||
        msg.includes("Duplicate entry") || cause.includes("Duplicate entry") ||
        (msg.includes("insert") && msg.includes("users"))) {
      throw new AppError("Email already registered", 409);
    }
    throw err;
  }
}

export async function login(data: { email: string; password: string }) {
  const [user] = await db.select().from(users).where(eq(users.email, data.email));
  if (!user) throw new AppError("Invalid credentials", 401);
  const valid = await verifyPassword(data.password, user.passwordHash);
  if (!valid) throw new AppError("Invalid credentials", 401);
  const token = await signToken({ sub: user.id, email: user.email, role: user.role as string });
  return {
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    token,
  };
}

export async function me(userId: number) {
  const [user] = await db.select({
    id: users.id, email: users.email, name: users.name, role: users.role,
  }).from(users).where(eq(users.id, userId));
  if (!user) throw new AppError("User not found", 404);

  // Check if customer has LIQUID customer record
  let hasProfile = true;
  if (user.role === "customer") {
    const [cust] = await db.select({ id: customers.id }).from(customers).where(eq(customers.email, user.email));
    hasProfile = !!cust;
  }

  return { user: { ...user, hasProfile } };
}

export async function getProfile(userId: number) {
  const [user] = await db.select({
    id: users.id, email: users.email, name: users.name, role: users.role,
  }).from(users).where(eq(users.id, userId));
  if (!user) throw new AppError("User not found", 404);

  const [cust] = await db.select().from(customers).where(eq(customers.email, user.email));

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    company: cust?.company || "",
    address: cust?.address || "",
    city: cust?.city || "",
    state: cust?.state || "",
    country: cust?.country || "ID",
    zipcode: cust?.zipcode || "",
    phone: cust?.phone || "",
  };
}

export async function updateProfile(userId: number, data: {
  name?: string;
  company?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  zipcode?: string;
}) {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) throw new AppError("User not found", 404);

  if (data.name) {
    await db.update(users).set({ name: data.name }).where(eq(users.id, userId));
  }

  const [cust] = await db.select().from(customers).where(eq(customers.email, user.email));
  if (cust) {
    await db.update(customers).set({
      name: data.name || cust.name,
      company: data.company !== undefined ? data.company : cust.company,
      address: data.address !== undefined ? data.address : cust.address,
      city: data.city !== undefined ? data.city : cust.city,
      state: data.state !== undefined ? data.state : cust.state,
      country: data.country || cust.country,
      zipcode: data.zipcode !== undefined ? data.zipcode : cust.zipcode,
    }).where(eq(customers.id, cust.id));
  }

  return getProfile(userId);
}
