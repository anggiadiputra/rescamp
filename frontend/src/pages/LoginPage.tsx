import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Card, Button, InfoBanner, TurnstileWidget, PasswordInput } from "../components/ui";
import { api, setToken } from "../lib/api";
import { Mail, Lock, KeyRound } from "lucide-react";

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get("redirect") || "/domains";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [cfTurnstileToken, setCfTurnstileToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [resendCooldown, setResendCooldown] = useState(0);

  // Timer countdown 30 detik untuk resend OTP
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (loading || resendCooldown > 0) return;
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/send-otp", { email, password, cfTurnstileResponse: cfTurnstileToken });
      setStep("otp");
      setResendCooldown(30); // Mulai countdown 30 detik
    } catch (err: any) {
      setError(err.message || "Gagal mengirim OTP");
    }
    setLoading(false);
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (loading || otp.length < 6) return;
    setError("");
    setLoading(true);
    try {
      const res = await api.post<{ user: any; token: string }>("/auth/verify-otp", { email, code: otp });
      setToken(res.token);
      window.location.href = redirect;
    } catch (err: any) {
      setError(err.message || "OTP tidak valid");
      setLoading(false);
    }
  }

  if (step === "otp") {
    return (
      <div className="max-w-md mx-auto mt-16 px-4">
        <Card>
          <div className="text-center mb-4">
            <div className="w-12 h-12 rounded-full bg-black flex items-center justify-center mx-auto mb-3">
              <KeyRound className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">Verifikasi OTP</h1>
            <p className="text-xs text-gray-500 mt-1">
              Kode 6 digit telah dikirim ke <strong>{email}</strong>
            </p>
          </div>

          {error && <div className="mb-4"><InfoBanner type="error" message={error} /></div>}

          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Kode OTP</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-full px-3.5 py-3 border border-gray-200 rounded-lg text-lg text-center font-mono font-bold tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-black text-gray-800"
                placeholder="000000"
                autoFocus
                required
              />
            </div>
            <Button type="submit" disabled={loading || otp.length < 6} className="w-full">
              {loading ? "Memverifikasi..." : "Verifikasi & Login"}
            </Button>
          </form>

          <div className="mt-4 text-center space-y-2">
            <button onClick={() => { setStep("credentials"); setError(""); }} className="text-xs text-gray-500 hover:text-black font-semibold">
              ← Kembali
            </button>
            <p className="text-xs text-gray-400">
              Tidak menerima kode?{" "}
              <button
                onClick={handleSendOtp}
                disabled={loading || resendCooldown > 0}
                className="text-black font-semibold hover:underline disabled:text-gray-400 disabled:no-underline disabled:cursor-not-allowed"
              >
                {resendCooldown > 0 ? `Kirim Ulang (${resendCooldown}s)` : "Kirim Ulang"}
              </button>
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-16 px-4">
      <Card>
        <h1 className="text-xl font-bold text-gray-900 mb-1">Login</h1>
        <p className="text-sm text-gray-500 mb-6">Masukkan email & password, lalu verifikasi OTP</p>

        {error && <div className="mb-4"><InfoBanner type="error" message={error} /></div>}

        <form onSubmit={handleSendOtp} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <Mail className="w-3.5 h-3.5" /> Email
            </label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black text-gray-800" required />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <Lock className="w-3.5 h-3.5" /> Password
            </label>
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>
          <TurnstileWidget onVerify={(token) => setCfTurnstileToken(token)} />
          <Button type="submit" disabled={loading} className="w-full">{loading ? "Mengirim OTP..." : "Kirim OTP"}</Button>
        </form>

        <div className="mt-4 text-center space-y-2">
          <p className="text-xs text-gray-500">
            <Link to="/forgot-password" className="text-black font-semibold hover:underline">Lupa password?</Link>
          </p>
          <p className="text-xs text-gray-500">
            Belum punya akun? <Link to="/register" className="text-black font-semibold hover:underline">Daftar</Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
