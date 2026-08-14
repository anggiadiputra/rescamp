import { t } from "elysia";

export const customerSchema = t.Object({
  name: t.String({ minLength: 1 }),
  email: t.String({ format: "email" }),
  company: t.Optional(t.String()),
  address: t.Optional(t.String()),
  city: t.Optional(t.String()),
  state: t.Optional(t.String()),
  country: t.String({ minLength: 2, maxLength: 2 }),
  zipcode: t.Optional(t.String()),
  phone: t.Optional(t.String()),
  cfTurnstileResponse: t.Optional(t.String()),
});

export const completeProfileSchema = t.Object({
  company: t.String({ minLength: 1 }),
  address: t.String({ minLength: 1 }),
  city: t.String({ minLength: 1 }),
  state: t.String({ minLength: 1 }),
  country: t.String({ minLength: 2, maxLength: 2 }),
  zipcode: t.String({ minLength: 1 }),
  phone_cc: t.String({ minLength: 1 }),
  phone: t.String({ minLength: 1 }),
});
