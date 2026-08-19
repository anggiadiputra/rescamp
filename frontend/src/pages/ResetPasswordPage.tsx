import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Card, Button, InfoBanner, PasswordInput } from "../components/ui";
import { api } from "../lib/api";
import { Lock, Key, Mail, CheckCircle2, ShieldCheck, RefreshCw } from "lucide-react";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const hashParams = new URLSearchParams(window.location.hash.slice(1));
  const hashToken = hashParams.get("token") || "";
  const hashEmail = hashParams.get("email") || "";
  const initialToken = searchParams.get("token") || searchParams.get("code") || hashToken;
  const initialEmail = searchParams.get("email") || hashEmail;
  const wasSent = searchParams.get("sent") === "true";

  const [email, setEmail] = useState(initialEmail);
  const [inputToken, setInputToken] = useState(initialToken);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(wasSent ? 30 : 0);
  const [resendMessage, setResendMessage] = useState(
    wasSent ? `Kode OTP reset password telah dikirim ke ${initialEmail || "email Anda"}. Silakan periksa inbox/spam.` : ""
  );
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  // Countdown timer for resend OTP
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const hasDirectToken = !!initialToken && initialToken.length > 10;

  async function handleResendOtp() {
    const cleanEmail = (email || "").trim().toLowerCase();
    if (!cleanEmail) {
      setError("Masukkan email Anda terlebih dahulu untuk mengirim ulang kode.");
      return;
    }
    setError("");
    setResending(true);
    try {
      await api.post("/auth/forgot-password", { email: cleanEmail });
      setResendMessage(`Kode OTP baru telah dikirim ke ${cleanEmail}.`);
      setResendCooldown(30);
    } catch (err: any) {
      setError(err.message || "Gagal mengirim ulang kode OTP");
    }
    setResending(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    const cleanEmail = (email || "").trim().toLowerCase();
    const finalToken = (inputToken || "").trim();
    if (!cleanEmail) { setError("Masukkan alamat email Anda"); return; }
    if (!finalToken) { setError("Masukkan Kode OTP atau Token Reset"); return; }
    if (password !== confirm) { setError("Password dan Konfirmasi Password tidak cocok"); return; }
    if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(password)) {
      setError("Password minimal 8 karakter dan harus mengandung kombinasi huruf & angka");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token: finalToken, password, email: cleanEmail });
      setDone(true);
    } catch (err: any) {
      setError(err.message || "Gagal mengatur password baru. Pastikan Kode OTP atau Token valid.");
    }
    setLoading(false);
  }

  if (done) {
    return (
      <div className="max-w-md mx-auto mt-16 px-4">
        <Card>
          <div className="text-center py-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <h1 className="text-xl font-bold text-gray-900">Password Berhasil Diubah!</h1>
            <p className="text-sm text-gray-600 mt-2">
              Kata sandi baru Anda telah aktif. Silakan masuk kembali dengan password baru Anda.
            </p>
            <div className="mt-6">
              <Link
                to="/login"
                className="inline-flex items-center justify-center w-full px-4 py-2.5 bg-black text-white text-sm font-semibold rounded-lg hover:bg-gray-800 transition"
              >
                Masuk ke Akun
              </Link>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-16 px-4">
      <Card>
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Atur Password Baru</h1>
          <p className="text-sm text-gray-500 mt-1">
            {hasDirectToken
              ? "Tautan reset terverifikasi. Masukkan kata sandi baru Anda di bawah ini."
              : "Masukkan email, Kode OTP / Token yang dikirim ke email, dan password baru Anda."}
          </p>
        </div>

        {resendMessage && (
          <div className="mb-4">
            <InfoBanner type="success" message={resendMessage} />
          </div>
        )}

        {error && (
          <div className="mb-4">
            <InfoBanner type="error" message={error} />
          </div>
        )}

        {hasDirectToken && (
          <div className="mb-4 flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Token keamanan reset password terdeteksi dari email</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <Mail className="w-3.5 h-3.5" /> Email Akun
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com"
              className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black text-gray-800"
              required
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5" /> Kode OTP / Token Reset
              </label>
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resending || resendCooldown > 0}
                className="text-xs text-blue-600 hover:underline disabled:opacity-50 disabled:no-underline flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${resending ? "animate-spin" : ""}`} />
                {resendCooldown > 0 ? `Kirim Ulang (${resendCooldown}s)` : "Kirim Ulang OTP"}
              </button>
            </div>
            <input
              type="text"
              value={inputToken}
              onChange={(e) => setInputToken(e.target.value)}
              placeholder="Contoh: 123456 atau Token Reset"
              className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black text-gray-800 font-mono tracking-wider"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <Lock className="w-3.5 h-3.5" /> Password Baru
            </label>
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="Minimal 8 karakter (huruf & angka)"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <Lock className="w-3.5 h-3.5" /> Konfirmasi Password Baru
            </label>
            <PasswordInput
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
              placeholder="Ulangi password baru"
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Menyimpan Password Baru..." : "Simpan Password Baru"}
          </Button>
        </form>

        <p className="text-xs text-gray-500 mt-5 text-center">
          <Link to="/login" className="text-black font-semibold hover:underline">← Kembali ke Login</Link>
        </p>
      </Card>
    </div>
  );
}

