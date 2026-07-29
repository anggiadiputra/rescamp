import { t } from "elysia";

export const sendRegisterOtpSchema = t.Object({
  email: t.String({ format: "email" }),
});

export const registerSchema = t.Object({
  email: t.String({ format: "email" }),
  password: t.String({ minLength: 6 }),
  name: t.String({ minLength: 1 }),
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
  email: t.String({ format: "email" }),
  password: t.String({ minLength: 6 }),
  name: t.String({ minLength: 1 }),
  reseller_id: t.String({ minLength: 1 }),
  company: t.String({ minLength: 1 }),
  address: t.String({ minLength: 1 }),
  city: t.String({ minLength: 1 }),
  state: t.String({ minLength: 1 }),
  country: t.String({ minLength: 2, maxLength: 2 }),
  zipcode: t.String({ minLength: 1 }),
  phone_cc: t.String({ minLength: 1 }),
  phone: t.String({ minLength: 1 }),
  cfTurnstileResponse: t.Optional(t.String()),
  code: t.Optional(t.String()),
});

export const loginSchema = t.Object({
  email: t.String({ format: "email" }),
  password: t.String({ minLength: 6 }),
  cfTurnstileResponse: t.Optional(t.String()),
});

