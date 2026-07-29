import { Elysia } from "elysia";
import { loginSchema, registerSchema, customerRegisterSchema } from "./auth.schema";
import * as h from "./auth.handler";
import { authGuard } from "../../middleware/auth";

export const authRoutes = new Elysia({ prefix: "/auth" })
  .post("/register", h.register, {
    body: registerSchema,
    detail: { tags: ["Auth"], summary: "Register" },
  })
  .post("/register/customer", h.registerCustomer, {
    body: customerRegisterSchema,
    detail: { tags: ["Auth"], summary: "Register as customer" },
  })
  .post("/login", h.login, {
    body: loginSchema,
    detail: { tags: ["Auth"], summary: "Login" },
  })
  .get("/me", h.me, {
    beforeHandle: authGuard,
    detail: { tags: ["Auth"], summary: "Current user" },
  })
  .get("/profile", h.getProfile, {
    beforeHandle: authGuard,
    detail: { tags: ["Auth"], summary: "Get profile" },
  })
  .put("/profile", h.updateProfile, {
    beforeHandle: authGuard,
    detail: { tags: ["Auth"], summary: "Update profile" },
  });
