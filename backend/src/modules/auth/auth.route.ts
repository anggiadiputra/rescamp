import { Elysia } from "elysia";
import { registerSchema, customerRegisterSchema, sendRegisterOtpSchema, sendOtpSchema, resetPasswordSchema } from "./auth.schema";
import * as h from "./auth.handler";
import { authGuard } from "../../middleware/auth";
import { otpRateLimiter, authRateLimiter, rateLimit } from "../../lib/rate-limit";

export const authRoutes = new Elysia({ prefix: "/auth" })
  // OTP endpoints - stricter limit (5/minute)
  .post("/send-register-otp", h.sendRegisterOtp, {
    body: sendRegisterOtpSchema,
    beforeHandle: rateLimit(otpRateLimiter, "Terlalu banyak permintaan OTP. Silakan coba lagi dalam 1 menit."),
    detail: { tags: ["Auth"], summary: "Send OTP code for registration" },
  })
  .post("/send-otp", h.sendOtp, {
    body: sendOtpSchema,
    beforeHandle: rateLimit(otpRateLimiter, "Terlalu banyak permintaan OTP. Silakan coba lagi dalam 1 menit."),
    detail: { tags: ["Auth"], summary: "Send OTP code for login" },
  })
  .post("/verify-otp", h.verifyOtp, {
    beforeHandle: rateLimit(otpRateLimiter, "Terlalu banyak verifikasi OTP. Silakan coba lagi dalam 1 menit."),
    detail: { tags: ["Auth"], summary: "Verify OTP and login" },
  })
  // Password reset - also OTP-based, use stricter limit
  .post("/forgot-password", h.forgotPassword, {
    beforeHandle: rateLimit(otpRateLimiter, "Terlalu banyak permintaan reset password. Silakan coba lagi dalam 1 menit."),
    detail: { tags: ["Auth"], summary: "Send password reset link" },
  })
  .post("/reset-password", h.resetPassword, {
    body: resetPasswordSchema,
    beforeHandle: rateLimit(otpRateLimiter, "Terlalu banyak permintaan reset password. Silakan coba lagi dalam 1 menit."),
    detail: { tags: ["Auth"], summary: "Reset password with token" },
  })
  .post("/logout", h.logout, {
    beforeHandle: authGuard,
    detail: { tags: ["Auth"], summary: "Logout and clear session cookie" },
  })
  // Registration - standard limit (10/minute). Login sessions are issued only
  // after the /send-otp -> /verify-otp flow; there is no password-only route.
  .post("/register", h.register, {
    body: registerSchema,
    beforeHandle: rateLimit(authRateLimiter, "Terlalu banyak permintaan registrasi. Silakan coba lagi dalam 1 menit."),
    detail: { tags: ["Auth"], summary: "Register" },
  })
  .post("/register/customer", h.registerCustomer, {
    body: customerRegisterSchema,
    beforeHandle: rateLimit(authRateLimiter, "Terlalu banyak permintaan registrasi. Silakan coba lagi dalam 1 menit."),
    detail: { tags: ["Auth"], summary: "Register as customer" },
  })
  // Authenticated endpoints - use existing authGuard
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
  .post("/check-whatsapp", h.checkWa, {
    beforeHandle: [authGuard, rateLimit(authRateLimiter, "Terlalu banyak permintaan. Silakan coba lagi dalam 1 menit.")],
    detail: { tags: ["Auth"], summary: "Check if phone is registered on WhatsApp" },
  });
