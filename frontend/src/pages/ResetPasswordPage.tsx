import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, Button, InfoBanner, PasswordInput } from "../components/ui";
import { api } from "../lib/api";
import { Lock, CheckCircle2 } from "lucide-react";

export default function ResetPasswordPage() {
  // SECURITY (audit B-item): the reset token is ONLY read from the URL FRAGMENT
  // (#token=...&email=...), never from the query string — fragments are not
  // sent to servers/proxies and don't leak into Referer headers or logs.
  // buildResetLink (backend) already emits hash-fragment links.
  const hashParams = new URLSearchParams(window.location.hash.slice(1));
  const initialToken = hashParams.get("token") || "";
  const initialEmail = hashParams.get("email") || "";

  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const hasDirectToken = !!initialToken && initialToken.length > 10;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    const cleanEmail = (email || "").trim().toLowerCase();
    const finalToken = (initialToken || "").trim();
    if (!cleanEmail) { setError("Masukkan alamat email Anda"); return; }
    if (!finalToken) { setError("Tautan reset tidak valid. Silakan minta link baru dari email."); return; }
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
      setError(err.message || "Gagal mengatur password baru. Pastikan tautan reset valid.");
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
              : "Buka tautan reset dari email Anda untuk mengatur password baru."}
          </p>
        </div>

        {error && (
          <div className="mb-4">
            <InfoBanner type="error" message={error} />
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mb-1">
              Email Akun
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
