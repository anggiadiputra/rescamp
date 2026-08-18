import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Card, Button, InfoBanner, PasswordInput } from "../components/ui";
import { api } from "../lib/api";
import { Lock, Key, Mail, CheckCircle2 } from "lucide-react";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  // H9: reset token now arrives in the URL fragment (#token=...) so it never
  // hits Referer headers or proxy access logs. Query params kept for legacy links.
  const hashParams = new URLSearchParams(window.location.hash.slice(1));
  const hashToken = hashParams.get("token") || "";
  const hashEmail = hashParams.get("email") || "";
  const initialToken = searchParams.get("token") || searchParams.get("code") || hashToken;
  const initialEmail = searchParams.get("email") || hashEmail;

  const [email, setEmail] = useState(initialEmail);
  const [inputToken, setInputToken] = useState(initialToken);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    const cleanEmail = (email || "").trim().toLowerCase();
    const finalToken = (inputToken || "").trim();
    if (!cleanEmail) { setError("Masukkan alamat email Anda"); return; }
    if (!finalToken) { setError("Masukkan Kode Reset atau Token"); return; }
    if (password !== confirm) { setError("Password tidak cocok"); return; }
    if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(password)) { setError("Password minimal 8 karakter dan harus mengandung huruf & angka"); return; }
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token: finalToken, password, email: cleanEmail });
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
        <p className="text-sm text-gray-500 mb-6">Masukkan email, Kode Reset / Token dan password baru Anda.</p>

        {error && <div className="mb-4"><InfoBanner type="error" message={error} /></div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <Mail className="w-3.5 h-3.5" /> Email
            </label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@email.com" className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black text-gray-800" required />
          </div>
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
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <Lock className="w-3.5 h-3.5" /> Konfirmasi Password
            </label>
            <PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} />
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
