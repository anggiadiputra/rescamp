import { t } from "elysia";
import { sanitizedString } from "../../lib/schema-helpers";
import { sanitizeInput, sanitizePhone } from "../../lib/sanitize";

// Password policy: min 8 chars, must contain at least one letter and one digit
export const passwordField = t.String({
  minLength: 8,
  pattern: "^(?=.*[A-Za-z])(?=.*\\d).{8,}$",
  error: "Password minimal 8 karakter dan harus mengandung huruf & angka",
});

export const sendRegisterOtpSchema = t.Object({
  email: sanitizedString((v: string) => (v || "").trim().toLowerCase(), { format: "email" }),
  cfTurnstileResponse: t.Optional(t.String()),
});

export const sendOtpSchema = t.Object({
  email: sanitizedString((v: string) => (v || "").trim().toLowerCase(), { format: "email" }),
  password: t.String({ minLength: 6 }),
  cfTurnstileResponse: t.Optional(t.String()),
});

export const registerSchema = t.Object({
  email: sanitizedString((v: string) => (v || "").trim().toLowerCase(), { format: "email" }),
  password: passwordField,
  name: sanitizedString((v: string) => sanitizeInput(v), { minLength: 1 }),
  reseller_id: t.Optional(t.String()),
  company: t.Optional(t.String()),
  address: t.Optional(t.String()),
  city: t.Optional(t.String()),
  state: t.Optional(t.String()),
  country: t.Optional(t.String()),
  zipcode: t.Optional(t.String()),
  phone_cc: t.Optional(t.String()),
  phone: t.Optional(t.String()),
  cfTurnstileResponse: t.Optional(t.String()),
  code: t.String({ minLength: 6, maxLength: 6, pattern: "^\\d{6}$" }),
});

export const customerRegisterSchema = t.Object({
  email: sanitizedString((v: string) => (v || "").trim().toLowerCase(), { format: "email" }),
  password: passwordField,
  name: sanitizedString((v: string) => sanitizeInput(v), { minLength: 1 }),
  reseller_id: t.String({ minLength: 1 }),
  company: sanitizedString((v: string) => sanitizeInput(v), { minLength: 1 }),
  address: sanitizedString((v: string) => sanitizeInput(v), { minLength: 1 }),
  city: sanitizedString((v: string) => sanitizeInput(v), { minLength: 1 }),
  state: sanitizedString((v: string) => sanitizeInput(v), { minLength: 1 }),
  country: sanitizedString((v: string) => (v || "").trim().toUpperCase(), { minLength: 2, maxLength: 2 }),
  zipcode: sanitizedString((v: string) => sanitizeInput(v), { minLength: 1 }),
  phone_cc: sanitizedString((v: string) => sanitizePhone(v), { minLength: 1 }),
  phone: sanitizedString((v: string) => sanitizePhone(v), { minLength: 1 }),
  cfTurnstileResponse: t.Optional(t.String()),
  code: t.String({ minLength: 6, maxLength: 6, pattern: "^\\d{6}$" }),
});

export const loginSchema = t.Object({
  email: sanitizedString((v: string) => (v || "").trim().toLowerCase(), { format: "email" }),
  // Legacy accounts may have shorter passwords; policy is enforced on register/reset only
  password: t.String({ minLength: 6 }),
  cfTurnstileResponse: t.Optional(t.String()),
});

export const resetPasswordSchema = t.Object({
  token: t.String({ minLength: 1 }),
  password: passwordField,
  email: sanitizedString((v: string) => (v || "").trim().toLowerCase(), { format: "email" }),
  cfTurnstileResponse: t.Optional(t.String()),
});
