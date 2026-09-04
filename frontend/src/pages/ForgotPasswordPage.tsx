import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, Button, InfoBanner, TurnstileWidget } from "../components/ui";
import { api } from "../lib/api";
import { Mail, MailCheck } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [cfTurnstileToken, setCfTurnstileToken] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError("Masukkan alamat email Anda");
      return;
    }
    if (!cfTurnstileToken) {
      setError("Silakan selesaikan verifikasi Turnstile terlebih dahulu.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email: cleanEmail, cfTurnstileResponse: cfTurnstileToken });
      setSent(true);
    } catch (err: any) {
      setCfTurnstileToken("");
      setError(err.message || "Gagal mengirim link reset");
    }
    setLoading(false);
  }

  if (sent) {
    return (
      <div className="max-w-md mx-auto mt-16 px-4">
        <Card>
          <div className="text-center py-4">
            <MailCheck className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <h1 className="text-xl font-bold text-gray-900">Link Reset Terkirim!</h1>
            <p className="text-sm text-gray-600 mt-2">
              Kami telah mengirim tautan reset password ke <strong>{email.trim().toLowerCase()}</strong>.
            </p>
            <p className="text-sm text-gray-600 mt-2">
              Silakan buka email Anda dan klik tautan tersebut untuk mengatur password baru.
              Jika tidak muncul, periksa folder spam.
            </p>
            <div className="mt-6">
              <Link
                to="/login"
                className="inline-flex items-center justify-center w-full px-4 py-2.5 bg-black text-white text-sm font-semibold rounded-lg hover:bg-gray-800 transition"
              >
                Kembali ke Login
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
        <h1 className="text-xl font-bold text-gray-900 mb-1">Lupa Password</h1>
        <p className="text-sm text-gray-500 mb-6">
          Masukkan email Anda. Kami akan mengirimkan tautan untuk mengatur ulang password.
        </p>

        {error && <div className="mb-4"><InfoBanner type="error" message={error} /></div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <Mail className="w-3.5 h-3.5" /> Email
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
          <TurnstileWidget
            onVerify={(token) => { setCfTurnstileToken(token); setError(""); }}
            onExpire={() => setCfTurnstileToken("")}
            onError={() => setCfTurnstileToken("")}
          />
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Mengirim Link Reset..." : "Kirim Link Reset Password"}
          </Button>
        </form>

        <div className="mt-4 flex justify-between items-center text-xs text-gray-500">
          <Link to="/login" className="text-black font-semibold hover:underline">← Kembali ke Login</Link>
        </div>
      </Card>
    </div>
  );
}
