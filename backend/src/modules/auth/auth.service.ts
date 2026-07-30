import { db } from "../../db";
import { users, customers, otpCodes } from "../../db/schema";
import { eq, and } from "drizzle-orm";
import { hashPassword, verifyPassword } from "../../lib/hash";
import { signToken } from "../../lib/jwt";
import { AppError } from "../../lib/error";
import { LiquidClient } from "../../lib/liquid";
import { sendEmail } from "../../lib/email";

const MYSQL_DUP_ENTRY = 1062;

export async function sendRegisterOtp(email: string) {
  const [existingUser] = await db.select().from(users).where(eq(users.email, email));
  if (existingUser) throw new AppError("Email sudah terdaftar", 409);

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 menit

  await db.update(otpCodes).set({ used: true }).where(
    and(eq(otpCodes.email, email), eq(otpCodes.purpose, "register"), eq(otpCodes.used, false))
  );

  await db.insert(otpCodes).values({ email, code, purpose: "register", expiresAt });

  await sendEmail(email, "register_otp", { otp: code, code, expiry_minutes: 5 });

  return { message: "Kode OTP verifikasi pendaftaran telah dikirim ke email Anda" };
}

export async function register(data: {
  email: string; password: string; name: string; reseller_id: string;
  api_key?: string;
  company?: string; address?: string; city?: string; state?: string;
  country?: string; zipcode?: string; phone_cc?: string; phone?: string;
  code?: string;
}) {
  if (data.code) {
    const [record] = await db.select().from(otpCodes).where(
      and(eq(otpCodes.email, data.email), eq(otpCodes.code, data.code), eq(otpCodes.purpose, "register"), eq(otpCodes.used, false))
    );
    if (!record) throw new AppError("Kode OTP verifikasi tidak valid", 401);
    if (new Date() > record.expiresAt) throw new AppError("Kode OTP sudah kadaluarsa", 401);
    await db.update(otpCodes).set({ used: true }).where(eq(otpCodes.id, record.id));
  } else {
    // If an OTP was issued for this email, require code verification
    const [record] = await db.select().from(otpCodes).where(
      and(eq(otpCodes.email, data.email), eq(otpCodes.purpose, "register"), eq(otpCodes.used, false))
    );
    if (record && new Date() <= record.expiresAt) {
      throw new AppError("Kode OTP verifikasi diperlukan. Silakan periksa email Anda.", 400);
    }
  }

  const passwordHash = await hashPassword(data.password);
  const role = data.api_key ? "reseller" : "customer";
  // For customer: use reseller_id from request, or fallback to DEFAULT_RESELLER_ID from .env
  const resellerId = data.reseller_id || (process.env.DEFAULT_RESELLER_ID || "");
  let parentResellerId: number | null = null;
  let resellerObj: any = null;
  if (role === "customer") {
    if (
      !data.company?.trim() ||
      !data.address?.trim() ||
      !data.city?.trim() ||
      !data.state?.trim() ||
      !data.country?.trim() ||
      !data.zipcode?.trim() ||
      !data.phone?.trim()
    ) {
      throw new AppError("Seluruh data profil (Perusahaan, Alamat, Kota, Provinsi, Negara, Kode Pos, Nomor Telepon) wajib diisi dengan benar.", 400);
    }

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
    let liquidCustomerId = "";
    if (role === "customer") {
      (async () => {
        try {
          const liquid = new LiquidClient(resellerObj.resellerId!, resellerObj.apiKey!);
          const liqCust = await liquid.createCustomer({
            name: data.name, email: data.email,
            company: data.company || "", address: data.address || "",
            city: data.city || "", state: data.state || "",
            country: data.country || "ID", zipcode: data.zipcode || "",
            tel_cc_no: data.phone_cc || "62", phone: data.phone || "",
          });
          const lCustId = String(liqCust?.customer_id || liqCust?.id || "");
          if (lCustId) {
             await db.update(customers).set({ liquidCustomerId: lCustId }).where(eq(customers.email, data.email));
          }
        } catch (e) { console.error("[auth] LIQUID customer auto-create failed:", e); }
      })();
    }

    // Always insert local customer record for customers
    let hasProfile = false;
    if (role === "customer") {
      try {
        await db.insert(customers).values({
          userId: parentResellerId!,
          liquidCustomerId: null,
          name: data.name, email: data.email,
          company: data.company || "", address: data.address || "",
          city: data.city || "", state: data.state || "",
          country: data.country || "ID", zipcode: data.zipcode || "",
          phone_cc: data.phone_cc || "62",
          phone: data.phone || "",
        });
        hasProfile = true;
      } catch (e) { console.error("[auth] customer record insert failed:", e); }
    }

    const token = await signToken({ sub: user.id, email: user.email, role: user.role as string });
    return {
      user: { id: user.id, email: user.email, name: user.name, role: user.role, hasProfile },
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

  let hasProfile = true;
  if (user.role === "customer") {
    const [cust] = await db.select({ id: customers.id }).from(customers).where(eq(customers.email, user.email));
    hasProfile = !!cust;
  }

  const token = await signToken({ sub: user.id, email: user.email, role: user.role as string });
  return {
    user: { id: user.id, email: user.email, name: user.name, role: user.role, hasProfile },
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
    phone_cc: cust?.phone_cc || "62",
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
  phone_cc?: string;
  phone?: string;
}) {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) throw new AppError("User not found", 404);

  if (data.name) {
    await db.update(users).set({ name: data.name }).where(eq(users.id, userId));
  }

  const [cust] = await db.select().from(customers).where(eq(customers.email, user.email));
  if (cust) {
    const updatedCust = { ...cust, ...data };
    if (user.role === "customer") {
      if (
        !updatedCust.name?.trim() ||
        !updatedCust.company?.trim() ||
        !updatedCust.address?.trim() ||
        !updatedCust.city?.trim() ||
        !updatedCust.state?.trim() ||
        !updatedCust.country?.trim() ||
        !updatedCust.zipcode?.trim() ||
        !updatedCust.phone?.trim()
      ) {
        throw new AppError("Seluruh field profil (Nama, Perusahaan, Alamat, Kota, Provinsi, Negara, Kode Pos, Nomor Telepon) wajib diisi dengan benar.", 400);
      }
    }

    await db.update(customers).set({
      name: data.name || cust.name,
      company: data.company !== undefined ? data.company : cust.company,
      address: data.address !== undefined ? data.address : cust.address,
      city: data.city !== undefined ? data.city : cust.city,
      state: data.state !== undefined ? data.state : cust.state,
      country: data.country || cust.country,
      zipcode: data.zipcode !== undefined ? data.zipcode : cust.zipcode,
      phone_cc: data.phone_cc !== undefined ? data.phone_cc : cust.phone_cc,
      phone: data.phone !== undefined ? data.phone : cust.phone,
    }).where(eq(customers.id, cust.id));

    // Sync to LIQUID
    let resellerId = user.resellerId;
    let apiKey = user.apiKey;
    if ((!resellerId || !apiKey) && user.parentResellerId) {
      const [parent] = await db.select().from(users).where(eq(users.id, user.parentResellerId));
      if (parent) {
        resellerId = parent.resellerId;
        apiKey = parent.apiKey;
      }
    }

    if (cust.liquidCustomerId && resellerId && apiKey) {
      (async () => {
        try {
          const liquid = new LiquidClient(resellerId, apiKey);
          await liquid.updateCustomer(cust.liquidCustomerId!, {
            name: updatedCust.name,
            email: updatedCust.email,
            company: updatedCust.company || "",
            address_line_1: updatedCust.address || "",
            city: updatedCust.city || "",
            state: updatedCust.state || "",
            country_code: (updatedCust.country || "ID").slice(0, 2).toUpperCase(),
            zipcode: updatedCust.zipcode || "",
            tel_cc_no: updatedCust.phone_cc || "62",
            tel_no: updatedCust.phone || "",
          });
        } catch (e) { console.error("[profile] LIQUID customer update failed:", e); }
      })();
    } else if (!cust.liquidCustomerId && resellerId && apiKey) {
      // Auto-create in LIQUID if not created yet
      (async () => {
        try {
          const liquid = new LiquidClient(resellerId, apiKey);
          const liqCust = await liquid.createCustomer({
            name: updatedCust.name,
            email: updatedCust.email,
            company: updatedCust.company || "",
            address: updatedCust.address || "",
            city: updatedCust.city || "",
            state: updatedCust.state || "",
            country: updatedCust.country || "ID",
            zipcode: updatedCust.zipcode || "",
            phone_cc: updatedCust.phone_cc || "62",
            phone: updatedCust.phone || "",
          });
          const liquidId = String(liqCust?.customer_id || liqCust?.id || "");
          if (liquidId) {
            await db.update(customers).set({ liquidCustomerId: liquidId }).where(eq(customers.id, cust.id));
          }
        } catch (e) { console.error("[profile] LIQUID customer create failed:", e); }
      })();
    } else if (user.role === "reseller" && resellerId && apiKey) {
      // Sync reseller's own profile to LIQUID via /resellers/{id}
      (async () => {
        try {
          const liquid = new LiquidClient(resellerId, apiKey);
          await liquid.updateReseller(resellerId, {
            name: data.name || user.name,
            email: user.email,
            company: data.company !== undefined ? data.company : cust.company || "",
            address_line_1: data.address !== undefined ? data.address : cust.address || "",
            city: data.city !== undefined ? data.city : cust.city || "",
            state: data.state !== undefined ? data.state : cust.state || "",
            country_code: (data.country || cust.country || "ID").slice(0, 2).toUpperCase(),
            zipcode: data.zipcode !== undefined ? data.zipcode : cust.zipcode || "",
            tel_cc_no: data.phone_cc !== undefined ? data.phone_cc : cust.phone_cc || "62",
            tel_no: data.phone !== undefined ? data.phone : cust.phone || "",
            selling_currency: "IDR",
          });
        } catch (e) { console.error("[profile] LIQUID reseller update failed:", e); }
      })();
    }
  }

  return getProfile(userId);
}

function maskApiKey(key: string): string {
  if (!key || key.length < 8) return key ? key[0] + "****" : "";
  return key.slice(0, 4) + "****" + key.slice(-4);
}

export async function getResellerData(userId: number) {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) throw new AppError("User not found", 404);
  if (user.role !== "reseller") throw new AppError("Only resellers can access this data", 403);

  let account: any = null;
  let balance: any = null;
  let syncError = "";

  if (user.resellerId && user.apiKey) {
    const liquid = new LiquidClient(user.resellerId, user.apiKey);
    try {
      const [acc, bal] = await Promise.all([
        liquid.getReseller(user.resellerId).catch(() => null),
        liquid.getBalance().catch(() => null),
      ]);
      account = acc;
      balance = bal;

      // Upsert reseller's own data into customers table so profile page shows it
      if (account) {
        const email = account.email || user.email;
        const [existing] = await db.select().from(customers).where(eq(customers.email, email));
        const custData = {
          name: account.name || account.company || user.name,
          email,
          company: account.company || "",
          address: account.address || account.address_line_1 || "",
          city: account.city || "",
          state: account.state || "",
          country: (account.country_code || account.country || "ID").slice(0, 2).toUpperCase(),
          zipcode: account.zipcode || account.zip || "",
          phone_cc: String(account.tel_cc_no || account.phone_cc || "62"),
          phone: account.tel_no || account.phone || "",
        };
        if (existing) {
          await db.update(customers).set(custData).where(eq(customers.id, existing.id));
        } else {
          await db.insert(customers).values({
            userId: null,
            liquidCustomerId: null,
            ...custData,
          });
        }
      }
    } catch (e: any) {
      syncError = e.message || "Gagal sinkronisasi";
    }
  }

  return {
    reseller_id: user.resellerId || "",
    api_key_masked: maskApiKey(user.apiKey || ""),
    balance,
    account,
    name: user.name,
    email: user.email,
    synced: !!account,
    sync_error: syncError || undefined,
  };
}

// --- OTP & Password Reset ---

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function generateResetToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let token = "";
  for (let i = 0; i < 48; i++) token += chars[Math.floor(Math.random() * chars.length)];
  return token;
}

export async function sendLoginOtp(email: string, password: string) {
  let [user] = await db.select().from(users).where(eq(users.email, email));

  // If not found in users table, check if customer exists in customers table
  if (!user) {
    const [cust] = await db.select().from(customers).where(eq(customers.email, email));
    if (cust) {
      const passwordHash = await hashPassword(password);
      const [res] = await db.insert(users).values({
        email: cust.email,
        name: cust.name,
        passwordHash,
        role: "customer",
      });
      const newUserId = Number(res.insertId);
      await db.update(customers).set({ userId: newUserId }).where(eq(customers.id, cust.id));
      [user] = await db.select().from(users).where(eq(users.id, newUserId));
    }
  }

  if (!user) throw new AppError("Email tidak ditemukan. Silakan daftar terlebih dahulu.", 400);
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) throw new AppError("Password salah", 401);

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 menit

  // Invalidate old OTPs
  await db.update(otpCodes).set({ used: true }).where(
    and(eq(otpCodes.email, email), eq(otpCodes.purpose, "login"), eq(otpCodes.used, false))
  );

  await db.insert(otpCodes).values({ email, code, purpose: "login", expiresAt });

  await sendEmail(email, "login_otp", { otp: code, code, expiry_minutes: 5 });

  return { message: "Kode OTP telah dikirim ke email Anda" };
}

export async function verifyLoginOtp(email: string, code: string) {
  const cleanEmail = (email || "").trim();
  const cleanCode = (code || "").trim();
  const [record] = await db.select().from(otpCodes).where(
    and(eq(otpCodes.email, cleanEmail), eq(otpCodes.code, cleanCode), eq(otpCodes.purpose, "login"), eq(otpCodes.used, false))
  );
  if (!record) throw new AppError("Kode OTP tidak valid atau sudah digunakan", 401);
  if (new Date() > record.expiresAt) throw new AppError("Kode OTP sudah kadaluarsa. Silakan minta kode baru.", 401);

  await db.update(otpCodes).set({ used: true }).where(eq(otpCodes.id, record.id));

  const [user] = await db.select().from(users).where(eq(users.email, cleanEmail));
  if (!user) throw new AppError("User tidak ditemukan", 404);

  const token = await signToken({ sub: user.id, email: user.email, role: user.role as string });
  return {
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    token,
  };
}

export async function forgotPassword(email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) return { message: "Jika email terdaftar, link reset password telah dikirim" };

  const token = generateResetToken();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 menit

  await db.insert(otpCodes).values({ email, code: token, purpose: "reset", expiresAt });

  const resetLink = `${process.env.CORS_ORIGIN || "http://localhost:5173"}/reset-password?token=${token}`;
  await sendEmail(email, "reset_password", { token, reset_link: resetLink, code: token, expiry_minutes: 30 });

  return { message: "Jika email terdaftar, link reset password telah dikirim" };
}

export async function resetPassword(token: string, newPassword: string) {
  const [record] = await db.select().from(otpCodes).where(
    and(eq(otpCodes.code, token), eq(otpCodes.purpose, "reset"), eq(otpCodes.used, false))
  );
  if (!record) throw new AppError("Token reset tidak valid atau sudah digunakan", 401);
  if (new Date() > record.expiresAt) throw new AppError("Token reset sudah kadaluarsa", 401);

  await db.update(otpCodes).set({ used: true }).where(eq(otpCodes.id, record.id));

  const passwordHash = await hashPassword(newPassword);
  await db.update(users).set({ passwordHash }).where(eq(users.email, record.email));

  return { message: "Password berhasil direset. Silakan login." };
}
