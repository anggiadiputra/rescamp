import { Elysia } from "elysia";
import { loginSchema, registerSchema, customerRegisterSchema, sendRegisterOtpSchema } from "./auth.schema";
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
  .post("/send-register-otp", h.sendRegisterOtp, {
    body: sendRegisterOtpSchema,
    detail: { tags: ["Auth"], summary: "Send OTP code for registration" },
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
  })
  .get("/reseller-data", h.resellerData, {
    beforeHandle: authGuard,
    detail: { tags: ["Auth"], summary: "Get reseller data (balance, id, api key)" },
  })
  .post("/send-otp", h.sendOtp, {
    detail: { tags: ["Auth"], summary: "Send OTP code for login" },
  })
  .post("/verify-otp", h.verifyOtp, {
    detail: { tags: ["Auth"], summary: "Verify OTP and login" },
  })
  .post("/forgot-password", h.forgotPassword, {
    detail: { tags: ["Auth"], summary: "Send password reset link" },
  })
  .post("/reset-password", h.resetPassword, {
    detail: { tags: ["Auth"], summary: "Reset password with token" },
  })
  .post("/check-whatsapp", h.checkWa, {
    detail: { tags: ["Auth"], summary: "Check if phone is registered on WhatsApp" },
  });
