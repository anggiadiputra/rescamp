import { t } from "elysia";

export const registerSchema = t.Object({
  email: t.String({ format: "email" }),
  password: t.String({ minLength: 6 }),
  name: t.String({ minLength: 1 }),
  reseller_id: t.Optional(t.String()),
  api_key: t.Optional(t.String()),
});

export const customerRegisterSchema = t.Object({
  email: t.String({ format: "email" }),
  password: t.String({ minLength: 6 }),
  name: t.String({ minLength: 1 }),
  reseller_id: t.String({ minLength: 1 }),
});

export const loginSchema = t.Object({
  email: t.String({ format: "email" }),
  password: t.String({ minLength: 6 }),
});
