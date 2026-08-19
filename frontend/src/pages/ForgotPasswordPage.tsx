import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, Button, InfoBanner } from "../components/ui";
import { api } from "../lib/api";
import { Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError("Masukkan alamat email Anda");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email: cleanEmail });
      // Langsung arahkan ke form pengaturan password baru dengan email yang sudah terisi
      navigate(`/reset-password?email=${encodeURIComponent(cleanEmail)}&sent=true`);
    } catch (err: any) {
      setError(err.message || "Gagal mengirim kode reset");
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto mt-16 px-4">
      <Card>
        <h1 className="text-xl font-bold text-gray-900 mb-1">Lupa Password</h1>
        <p className="text-sm text-gray-500 mb-6">Masukkan email Anda untuk menerima kode OTP & link reset password.</p>

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
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Mengirim Kode Reset..." : "Kirim Kode & Atur Password Baru"}
          </Button>
        </form>

        <div className="mt-4 flex justify-between items-center text-xs text-gray-500">
          <Link to="/login" className="text-black font-semibold hover:underline">← Kembali ke Login</Link>
          <Link to="/reset-password" className="hover:underline">Sudah punya Kode OTP? →</Link>
        </div>
      </Card>
    </div>
  );
}

