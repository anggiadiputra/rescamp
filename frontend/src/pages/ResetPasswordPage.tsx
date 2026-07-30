import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Card, Button, InfoBanner } from "../components/ui";
import { api } from "../lib/api";
import { Lock, Key, CheckCircle2 } from "lucide-react";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const initialToken = searchParams.get("token") || searchParams.get("code") || "";

  const [inputToken, setInputToken] = useState(initialToken);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    const finalToken = (inputToken || "").trim();
    if (!finalToken) { setError("Masukkan Kode Reset atau Token"); return; }
    if (password !== confirm) { setError("Password tidak cocok"); return; }
    if (password.length < 6) { setError("Password minimal 6 karakter"); return; }
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token: finalToken, password });
      setDone(true);
    } catch (err: any) {
      setError(err.message || "Gagal reset password");
    }
    setLoading(false);
  }

  if (done) {
    return (
      <div className="max-w-md mx-auto mt-16 px-4">
        <Card>
          <div className="text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
            <h1 className="text-xl font-bold text-gray-900">Password Berhasil Direset!</h1>
            <p className="text-xs text-gray-500 mt-2">Silakan login dengan password baru Anda.</p>
            <Link to="/login" className="inline-block mt-4 text-sm font-semibold text-black hover:underline">Login Sekarang</Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-16 px-4">
      <Card>
        <h1 className="text-xl font-bold text-gray-900 mb-1">Reset Password</h1>
        <p className="text-sm text-gray-500 mb-6">Masukkan Kode Reset / Token dan password baru Anda.</p>

        {error && <div className="mb-4"><InfoBanner type="error" message={error} /></div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <Key className="w-3.5 h-3.5" /> Kode OTP / Token Reset
            </label>
            <input type="text" value={inputToken} onChange={(e) => setInputToken(e.target.value)} placeholder="Contoh: 123456 atau Token Reset" className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black text-gray-800 font-mono" required />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <Lock className="w-3.5 h-3.5" /> Password Baru
            </label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black text-gray-800" required minLength={6} />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <Lock className="w-3.5 h-3.5" /> Konfirmasi Password
            </label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black text-gray-800" required minLength={6} />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Memproses..." : "Reset Password"}
          </Button>
        </form>

        <p className="text-xs text-gray-500 mt-4 text-center">
          <Link to="/login" className="text-black font-semibold hover:underline">← Kembali ke Login</Link>
        </p>
      </Card>
    </div>
  );
}
