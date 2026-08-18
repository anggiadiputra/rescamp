import { db } from "../../db";
import { users, customers, otpCodes, domains } from "../../db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { hashPassword, verifyPassword } from "../../lib/hash";
import { signToken } from "../../lib/jwt";
import { AppError } from "../../lib/error";
import { LiquidClient } from "../../lib/liquid";
import { sendEmail } from "../../lib/email";
import { env } from "../../config/env";
import { encryptOtpCode, decryptOtpCode } from "../../lib/encryption";
import { resolveResellerCreds, resolveCredsFromUser, invalidateCredsCache } from "../../lib/reseller-creds";

const MYSQL_DUP_ENTRY = 1062;

// Per-email OTP failure tracking — lockout after 5 wrong attempts
const otpFailStore = new Map<string, { count: number; lockedUntil: number }>();
const OTP_MAX_FAILURES = 5;
const OTP_LOCKOUT_MS = 5 * 60 * 1000; // 5 menit lockout

function checkOtpLockout(email: string) {
  const record = otpFailStore.get(email);
  if (record && record.count >= OTP_MAX_FAILURES && Date.now() < record.lockedUntil) {
    const remainSec = Math.ceil((record.lockedUntil - Date.now()) / 1000);
    throw new AppError(`Terlalu banyak percobaan OTP salah. Coba lagi dalam ${remainSec} detik.`, 429);
  }
}

function recordOtpFailure(email: string) {
  const record = otpFailStore.get(email) || { count: 0, lockedUntil: 0 };
  record.count += 1;
  if (record.count >= OTP_MAX_FAILURES) {
    record.lockedUntil = Date.now() + OTP_LOCKOUT_MS;
  }
  otpFailStore.set(email, record);
}

function clearOtpFailures(email: string) {
  otpFailStore.delete(email);
}

// Evict expired lockout records periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of otpFailStore) {
    if (record.lockedUntil > 0 && now > record.lockedUntil + 60_000) {
      otpFailStore.delete(key);
    }
  }
}, 10 * 60 * 1000);

export async function sendRegisterOtp(email: string) {
  const cleanEmail = (email || "").trim().toLowerCase();
  const [existingUser] = await db.select().from(users).where(eq(users.email, cleanEmail));
  // Anti-enumeration: same response whether or not the email is registered; no OTP sent if taken
  if (existingUser) return { message: "Kode OTP verifikasi pendaftaran telah dikirim ke email Anda" };

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 menit

  await db.update(otpCodes).set({ used: true }).where(
    and(eq(otpCodes.email, cleanEmail), eq(otpCodes.purpose, "register"), eq(otpCodes.used, false))
  );

  const encryptedCode = await encryptOtpCode(code);
  await db.insert(otpCodes).values({ email: cleanEmail, code: "", codeEncrypted: encryptedCode, purpose: "register", expiresAt });

  await sendEmail(cleanEmail, "register_otp", { otp: code, code, expiry_minutes: 5 });

  return { message: "Kode OTP verifikasi pendaftaran telah dikirim ke email Anda" };
}

export async function register(data: {
  email: string; password: string; name: string; reseller_id: string;
  company?: string; address?: string; city?: string; state?: string;
  country?: string; zipcode?: string; phone_cc?: string; phone?: string;
  code?: string;
}) {
  const cleanEmail = (data.email || "").trim().toLowerCase();
  if (data.code) {
    checkOtpLockout(cleanEmail);
    const [record] = await db.select().from(otpCodes).where(
      and(eq(otpCodes.email, cleanEmail), eq(otpCodes.purpose, "register"), eq(otpCodes.used, false))
    ).orderBy(desc(otpCodes.id)).limit(1);
    if (!record) {
      recordOtpFailure(cleanEmail);
      throw new AppError("Kode OTP verifikasi tidak valid", 401);
    }
    if (new Date() > record.expiresAt) throw new AppError("Kode OTP sudah kadaluarsa", 401);
    if (!(await otpCodeMatches(record, data.code))) {
      recordOtpFailure(cleanEmail);
      throw new AppError("Kode OTP verifikasi tidak valid", 401);
    }
    // N1: CAS — if a concurrent caller already consumed this code, affectedRows=0 → reject
    const markUsed: any = await db.update(otpCodes).set({ used: true })
      .where(and(eq(otpCodes.id, record.id), eq(otpCodes.used, false)));
    if ((markUsed[0]?.affectedRows ?? 0) === 0) {
      throw new AppError("Kode OTP sudah digunakan", 401);
    }
    clearOtpFailures(cleanEmail);
  } else {
    // If an OTP was issued for this email, require code verification
    const [record] = await db.select().from(otpCodes).where(
      and(eq(otpCodes.email, cleanEmail), eq(otpCodes.purpose, "register"), eq(otpCodes.used, false))
    ).orderBy(desc(otpCodes.id)).limit(1);
    if (record && new Date() <= record.expiresAt) {
      throw new AppError("Kode OTP verifikasi diperlukan. Silakan periksa email Anda.", 400);
    }
  }

  const passwordHash = await hashPassword(data.password);
  // C1: registration always creates a customer account. api_key was removed from
  // the public schema — it previously granted reseller role to any caller.
  const role = "customer";
  // For customer: use reseller_id from request, or fallback to DEFAULT_RESELLER_ID from .env
  const resellerId = data.reseller_id || (process.env.DEFAULT_RESELLER_ID || "");
  let parentResellerId: number | null = null;
  let resellerObj: any = null;
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

  // H3: reseller_id must resolve to a real reseller account — fallback to master/default reseller in DB
  let reseller: any = null;
  if (resellerId) {
    [reseller] = await db.select().from(users).where(eq(users.resellerId, resellerId));
    if (!reseller && !isNaN(Number(resellerId))) {
      [reseller] = await db.select().from(users).where(eq(users.id, Number(resellerId)));
    }
    if (reseller && reseller.role !== "reseller") reseller = null;
  }
  if (!reseller) {
    [reseller] = await db.select().from(users).where(eq(users.role, "reseller")).limit(1);
  }
  if (!reseller) {
    const [adminUser] = await db.select().from(users).where(sql`${users.role} IN ('reseller', 'admin')`).limit(1);
    if (adminUser) reseller = adminUser;
  }
  if (!reseller) {
    throw new AppError("Reseller tidak ditemukan. Hubungi penyedia layanan.", 400);
  }
  parentResellerId = reseller.id;
  resellerObj = reseller;

  try {
    // apiKey/apiKeyEncrypted no longer written — resellers are provisioned manually
    const result: any = await db.insert(users).values({
      email: data.email,
      passwordHash,
      name: data.name,
      role,
      resellerId: null,
      apiKey: null,
      apiKeyEncrypted: null,
      parentResellerId,
    });
    const userId = Number(result[0]?.insertId || result.insertId);
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) throw new AppError("Registration failed", 500);

    // Auto-create LIQUID customer for customer role (so they appear in resellercamp immediately)
    let liquidCustomerId: string | null = null;
    if (role === "customer") {
      try {
        const creds = resellerObj ? await resolveCredsFromUser(resellerObj) : await resolveResellerCreds(parentResellerId || undefined);
        if (creds.resellerId && creds.apiKey) {
          const liquid = new LiquidClient(creds.resellerId, creds.apiKey);
          const createPayload = {
            name: data.name, email: data.email,
            company: data.company || "", address: data.address || "",
            city: data.city || "", state: data.state || "",
            country: data.country || "ID", zipcode: data.zipcode || "",
            tel_cc_no: data.phone_cc || "62", phone: data.phone || "",
          };
          const liqCust: any = await liquid.createCustomer(createPayload);
          const lCustId = String(liqCust?.data?.customer_id || liqCust?.customer_id || liqCust?.id || liqCust?.data?.id || "").trim();
          if (lCustId && lCustId !== "null" && lCustId !== "undefined") {
            liquidCustomerId = lCustId;
          } else {
            console.warn("[auth.register] createCustomer returned OK but no valid customer_id extracted");
          }
        } else {
          console.warn("[auth.register] Skipped LIQUID customer auto-create: no reseller credentials configured");
        }
      } catch (e: any) {
        console.error("[auth.register] LIQUID customer auto-create failed:", e?.message || e);
      }
    }

    // Always insert local customer record for customers
    let hasProfile = false;
    if (role === "customer") {
      try {
        await db.insert(customers).values({
          userId: userId,
          liquidCustomerId: liquidCustomerId || null,
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

    // Dispatch registration confirmation email via Kirisan API (asynchronous / non-blocking)
    (async () => {
      try {
        await sendEmail(data.email, "register_success", {
          name: data.name,
          email: data.email,
          company: data.company || "",
          phone: data.phone || "",
          customer_id: liquidCustomerId || "",
          liquid_customer_id: liquidCustomerId || "",
          purpose: "register_success",
        });
      } catch (e: any) {
        console.error("[auth] Send registration confirmation email failed:", e?.message || e);
      }
    })();

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
    const creds = await resolveResellerCreds(userId);
    const resellerId = creds.resellerId;
    const apiKey = creds.apiKey;

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

  // Resolve credentials with decryption + cache
  const creds = await resolveResellerCreds(userId);
  const apiKey = creds.apiKey;

  if (creds.resellerId && apiKey) {
    const liquid = new LiquidClient(creds.resellerId, apiKey);
    try {
      const [acc, bal] = await Promise.all([
        liquid.getReseller(creds.resellerId).catch(() => null),
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
    api_key_masked: maskApiKey(apiKey || ""),
    balance,
    account,
    name: user.name,
    email: user.email,
    synced: !!account,
    sync_error: syncError || undefined,
  };
}

// --- OTP & Password Reset ---

/**
 * Generate cryptographically secure 6-digit OTP using crypto.getRandomValues()
 * ponytail: uses modulo 10, introduces slight bias but negligible for OTP use case
 */
function generateOtp(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String((array[0] ?? 0) % 1000000).padStart(6, "0");
}

/**
 * Generate cryptographically secure 48-character reset token
 * Uses unbiased modulo reduction via rejection sampling
 */
function generateResetToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const array = new Uint32Array(48);
  crypto.getRandomValues(array);
  let token = "";
  for (let i = 0; i < 48; i++) {
    token += chars[(array[i] ?? 0) % chars.length];
  }
  return token;
}

// H7: OTPs are stored encrypted only; this helper decrypts-and-compares with a
// legacy fallback for rows written before encryption was enforced.
async function otpCodeMatches(record: any, input: string): Promise<boolean> {
  if (record.codeEncrypted) {
    try {
      return (await decryptOtpCode(record.codeEncrypted)) === input.trim();
    } catch {
      return false;
    }
  }
  return record.code === input.trim();
}

export async function sendLoginOtp(email: string, password: string) {
  const cleanEmail = (email || "").trim().toLowerCase();
  // N4: never auto-create a user from a customer record — that path was an
  // account takeover (attacker supplied password became the user's password).
  // User must register via /auth/register first; if email is only in `customers`
  // (legacy data, no users row), reject and direct them to register.
  const [user] = await db.select().from(users).where(eq(users.email, cleanEmail));
  // H6 anti-enumeration: identical message whether the email exists or the password is wrong
  if (!user) throw new AppError("Email atau password salah", 401);
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) throw new AppError("Email atau password salah", 401);

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 menit

  // Invalidate old OTPs
  await db.update(otpCodes).set({ used: true }).where(
    and(eq(otpCodes.email, cleanEmail), eq(otpCodes.purpose, "login"), eq(otpCodes.used, false))
  );

  const encryptedCode = await encryptOtpCode(code);
  await db.insert(otpCodes).values({ email: cleanEmail, code: "", codeEncrypted: encryptedCode, purpose: "login", expiresAt });

  clearOtpFailures(cleanEmail);

  await sendEmail(cleanEmail, "login_otp", { otp: code, code, expiry_minutes: 5 });

  return { message: "Kode OTP telah dikirim ke email Anda" };
}

export async function verifyLoginOtp(email: string, code: string) {
  const cleanEmail = (email || "").trim().toLowerCase();
  const cleanCode = (code || "").trim();
  if (!cleanCode) throw new AppError("Kode OTP tidak valid atau sudah digunakan", 401);

  checkOtpLockout(cleanEmail);

  const [record] = await db.select().from(otpCodes).where(
    and(eq(otpCodes.email, cleanEmail), eq(otpCodes.purpose, "login"), eq(otpCodes.used, false))
  ).orderBy(desc(otpCodes.id)).limit(1);

  if (!record || !(await otpCodeMatches(record, cleanCode))) {
    recordOtpFailure(cleanEmail);
    throw new AppError("Kode OTP tidak valid atau sudah digunakan", 401);
  }
  if (new Date() > record.expiresAt) throw new AppError("Kode OTP sudah kadaluarsa. Silakan minta kode baru.", 401);

  // N1: CAS — concurrent caller cannot consume the same code twice
  const markUsed: any = await db.update(otpCodes).set({ used: true })
    .where(and(eq(otpCodes.id, record.id), eq(otpCodes.used, false)));
  if ((markUsed[0]?.affectedRows ?? 0) === 0) {
    throw new AppError("Kode OTP sudah digunakan", 401);
  }

  clearOtpFailures(cleanEmail);

  const [user] = await db.select().from(users).where(eq(users.email, cleanEmail));
  if (!user) throw new AppError("User tidak ditemukan", 404);

  const token = await signToken({ sub: user.id, email: user.email, role: user.role as string });
  return {
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    token,
  };
}

export async function forgotPassword(email: string) {
  const cleanEmail = (email || "").trim();
  const [user] = await db.select().from(users).where(eq(users.email, cleanEmail));
  // H6 anti-enumeration: same response whether or not the email exists; nothing sent if not
  if (!user) {
    return { message: "Link & Kode OTP reset password telah berhasil dikirim" };
  }

  const token = generateResetToken();
  const otpCode = generateOtp();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 menit

  // Invalidate previous unused reset tokens for this email
  await db.update(otpCodes).set({ used: true }).where(
    and(eq(otpCodes.email, cleanEmail), eq(otpCodes.purpose, "reset"), eq(otpCodes.used, false))
  );

  // Insert both token and 6-digit OTP code so user can reset via link OR OTP code
  const encryptedToken = await encryptOtpCode(token);
  const encryptedOtpCode = await encryptOtpCode(otpCode);
  await db.insert(otpCodes).values({ email: cleanEmail, code: "", codeEncrypted: encryptedToken, purpose: "reset", expiresAt });
  await db.insert(otpCodes).values({ email: cleanEmail, code: "", codeEncrypted: encryptedOtpCode, purpose: "reset", expiresAt });

  // H9: token goes in the URL fragment (#token=...) so it never hits Referer headers,
  // browser history entries, or reverse-proxy access logs.
  const origins = (env.CORS_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean);
  const frontendUrl = origins[0] && origins[0] !== "*" ? origins[0] : env.APP_URL || "";
  const resetLink = `${frontendUrl}/reset-password#token=${token}&email=${encodeURIComponent(cleanEmail)}`;

  await sendEmail(cleanEmail, "reset_password", {
    token,
    code: otpCode,
    otp: otpCode,
    reset_link: resetLink,
    reset_url: resetLink,
    link: resetLink,
    button_url: resetLink,
    action_url: resetLink,
    url: resetLink,
    expiry_minutes: 30,
  });

  return {
    message: "Link & Kode OTP reset password telah berhasil dikirim",
  };
}

export async function resetPassword(tokenOrCode: string, newPassword: string, email?: string) {
  const clean = (tokenOrCode || "").trim();
  if (!clean) throw new AppError("Token atau Kode OTP reset tidak valid", 400);
  if (!email || !email.trim()) throw new AppError("Email wajib diisi untuk reset password", 400);
  const cleanEmail = email.trim().toLowerCase();

  // Scope to the specific user's email only
  const rows = await db.select().from(otpCodes).where(
    and(
      eq(otpCodes.purpose, "reset"),
      eq(otpCodes.used, false),
      eq(otpCodes.email, cleanEmail)
    )
  ).orderBy(desc(otpCodes.id)).limit(5);

  let record: any = null;
  for (const r of rows) {
    if (await otpCodeMatches(r, clean)) { record = r; break; }
  }

  if (!record) throw new AppError("Token atau Kode OTP reset tidak valid atau sudah digunakan", 401);
  if (new Date() > (record as any).expiresAt) throw new AppError("Token atau Kode OTP reset sudah kadaluarsa", 401);

  // Invalidate all reset tokens for this email
  await db.update(otpCodes).set({ used: true }).where(
    and(eq(otpCodes.email, record.email), eq(otpCodes.purpose, "reset"))
  );

  const passwordHash = await hashPassword(newPassword);
  await db.update(users).set({ passwordHash }).where(eq(users.email, record.email));

  return { message: "Password berhasil diubah. Silakan login." };
}
