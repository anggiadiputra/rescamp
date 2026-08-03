import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, Button, InfoBanner } from "../components/ui";
import { api } from "../lib/api";
import { Mail, CheckCircle2 } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } catch (err: any) {
      setError(err.message || "Gagal mengirim link reset");
    }
    setLoading(false);
  }

  if (sent) {
    return (
      <div className="max-w-md mx-auto mt-16 px-4">
        <Card>
          <div className="text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
            <h1 className="text-xl font-bold text-gray-900">Link & Kode Reset Terkirim!</h1>
            <p className="text-xs text-gray-500 mt-2">
              Email <strong>{email}</strong> telah dikirimi instruksi reset password. Silakan cek inbox/spam email Anda untuk link dan kode OTP.
            </p>

            <div className="mt-4 flex justify-between items-center text-xs">
              <Link to="/reset-password" className="text-black font-semibold hover:underline">Masukkan Kode Token / OTP →</Link>
              <Link to="/login" className="text-gray-500 hover:underline">← Ke Login</Link>
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
        <p className="text-sm text-gray-500 mb-6">Masukkan email Anda, kami akan kirim link reset password.</p>

        {error && <div className="mb-4"><InfoBanner type="error" message={error} /></div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <Mail className="w-3.5 h-3.5" /> Email
            </label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black text-gray-800" required />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Mengirim..." : "Kirim Link Reset"}
          </Button>
        </form>

        <p className="text-xs text-gray-500 mt-4 text-center">
          <Link to="/login" className="text-black font-semibold hover:underline">← Kembali ke Login</Link>
        </p>
      </Card>
    </div>
  );
}
