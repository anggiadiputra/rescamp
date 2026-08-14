import { t } from "elysia";
import { sanitizeInput, sanitizePhone } from "../../lib/sanitize";

export const sendRegisterOtpSchema = t.Object({
  email: t.String({ 
    format: "email",
    transform: (v: string) => (v || "").trim().toLowerCase(),
  }),
  cfTurnstileResponse: t.Optional(t.String()),
});

export const sendOtpSchema = t.Object({
  email: t.String({ 
    format: "email",
    transform: (v: string) => (v || "").trim().toLowerCase(),
  }),
  password: t.String({ minLength: 6 }),
  cfTurnstileResponse: t.Optional(t.String()),
});

export const registerSchema = t.Object({
  email: t.String({ 
    format: "email",
    transform: (v: string) => (v || "").trim().toLowerCase(),
  }),
  password: t.String({ minLength: 6 }),
  name: t.String({ 
    minLength: 1,
    transform: (v: string) => sanitizeInput(v),
  }),
  reseller_id: t.Optional(t.String()),
  api_key: t.Optional(t.String()),
  company: t.Optional(t.String()),
  address: t.Optional(t.String()),
  city: t.Optional(t.String()),
  state: t.Optional(t.String()),
  country: t.Optional(t.String()),
  zipcode: t.Optional(t.String()),
  phone_cc: t.Optional(t.String()),
  phone: t.Optional(t.String()),
  cfTurnstileResponse: t.Optional(t.String()),
  code: t.Optional(t.String()),
});

export const customerRegisterSchema = t.Object({
  email: t.String({ 
    format: "email",
    transform: (v: string) => (v || "").trim().toLowerCase(),
  }),
  password: t.String({ minLength: 6 }),
  name: t.String({ 
    minLength: 1,
    transform: (v: string) => sanitizeInput(v),
  }),
  reseller_id: t.String({ minLength: 1 }),
  company: t.String({ 
    minLength: 1,
    transform: (v: string) => sanitizeInput(v),
  }),
  address: t.String({ 
    minLength: 1,
    transform: (v: string) => sanitizeInput(v),
  }),
  city: t.String({ 
    minLength: 1,
    transform: (v: string) => sanitizeInput(v),
  }),
  state: t.String({ 
    minLength: 1,
    transform: (v: string) => sanitizeInput(v),
  }),
  country: t.String({ 
    minLength: 2, 
    maxLength: 2,
    transform: (v: string) => (v || "").trim().toUpperCase(),
  }),
  zipcode: t.String({ 
    minLength: 1,
    transform: (v: string) => sanitizeInput(v),
  }),
  phone_cc: t.String({ 
    minLength: 1,
    transform: (v: string) => sanitizePhone(v),
  }),
  phone: t.String({ 
    minLength: 1,
    transform: (v: string) => sanitizePhone(v),
  }),
  cfTurnstileResponse: t.Optional(t.String()),
  code: t.Optional(t.String()),
});

export const loginSchema = t.Object({
  email: t.String({ 
    format: "email",
    transform: (v: string) => (v || "").trim().toLowerCase(),
  }),
  password: t.String({ minLength: 6 }),
  cfTurnstileResponse: t.Optional(t.String()),
});
