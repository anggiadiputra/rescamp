import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Card, Button, InfoBanner, TurnstileWidget, WaBadge, toast } from "../components/ui";
import { api } from "../lib/api";
import { KeyRound, ArrowLeft } from "lucide-react";

const COUNTRIES = [
  { code: "ID", name: "Indonesia", phone_cc: "62" },
  { code: "US", name: "United States", phone_cc: "1" },
  { code: "SG", name: "Singapore", phone_cc: "65" },
  { code: "MY", name: "Malaysia", phone_cc: "60" },
  { code: "AU", name: "Australia", phone_cc: "61" },
  { code: "GB", name: "United Kingdom", phone_cc: "44" },
  { code: "JP", name: "Japan", phone_cc: "81" },
  { code: "KR", name: "South Korea", phone_cc: "82" },
];

export default function RegisterPage() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get("redirect") || "/domains";

  const [form, setForm] = useState({
    name: "", email: "", password: "",
    company: "", address: "", city: "", state: "", country: "ID",
    zipcode: "", phone_cc: "62", phone: "",
  });
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"form" | "otp">("form");
  const [cfTurnstileToken, setCfTurnstileToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function set(k: string) { return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value }); }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(""); setLoading(true);
    try {
      await api.post("/auth/send-register-otp", {
        email: form.email,
        cfTurnstileResponse: cfTurnstileToken,
      });
      toast("Kode OTP verifikasi telah dikirim ke email Anda!");
      setStep("otp");
    } catch (err: any) { setError(err.message || "Gagal mengirim OTP"); }
    setLoading(false);
  }

  async function handleVerifyAndRegister(e: React.FormEvent) {
    e.preventDefault();
    if (loading || otp.length < 6) return;
    setError(""); setLoading(true);
    try {
      await register({
        email: form.email, password: form.password, name: form.name,
        reseller_id: "", api_key: undefined,
        company: form.company, address: form.address,
        city: form.city, state: form.state, country: form.country,
        zipcode: form.zipcode, phone_cc: form.phone_cc, phone: form.phone,
        cfTurnstileResponse: cfTurnstileToken,
        code: otp,
      } as any);
      toast("🎉 Pendaftaran berhasil!");
      nav(redirect);
    } catch (err: any) { setError(err.message || "Verifikasi OTP gagal"); }
    setLoading(false);
  }

  if (step === "otp") {
    return (
      <div className="max-w-md mx-auto mt-12 px-4 mb-12">
        <Card>
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-full bg-black flex items-center justify-center mx-auto mb-3 text-white">
              <KeyRound className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">Verifikasi Email OTP</h1>
            <p className="text-xs text-gray-500 mt-1">
              Kode OTP 6 digit telah dikirim melalui Kirisan ke email <strong className="text-gray-900">{form.email}</strong>
            </p>
          </div>

          {error && <div className="mb-4"><InfoBanner type="error" message={error} /></div>}

          <form onSubmit={handleVerifyAndRegister} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Kode OTP (6 Digit)</label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.trim())}
                placeholder="123456"
                maxLength={6}
                className="w-full text-center text-2xl font-mono tracking-widest px-3.5 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black"
                required
              />
            </div>
            <Button type="submit" disabled={loading || otp.length < 6} className="w-full py-3 text-sm font-semibold">
              {loading ? "Memverifikasi & Mendaftar..." : "Verifikasi & Buat Akun"}
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => { setStep("form"); setError(""); }}
              className="text-gray-500 hover:text-black font-semibold flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Ubah Data
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={handleSendOtp}
              className="text-black font-semibold hover:underline"
            >
              Kirim Ulang OTP
            </button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto mt-8 px-4 mb-12">
      <Card>
        <h1 className="text-xl font-bold text-gray-900 mb-1">Create Account</h1>
        <p className="text-sm text-gray-500 mb-6">Semua field diperlukan untuk verifikasi data domain.</p>
        {error && <div className="mb-4"><InfoBanner type="error" message={error} /></div>}
        <form onSubmit={handleSendOtp} className="space-y-4">
          <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Nama Lengkap *</label>
            <input type="text" value={form.name} onChange={set("name")} className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black" required /></div>
          <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Email *</label>
            <input type="email" value={form.email} onChange={set("email")} className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black" required /></div>
          <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Password *</label>
            <input type="password" value={form.password} onChange={set("password")} className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black" required minLength={6} /></div>
          <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Perusahaan / Organization *</label>
            <input type="text" value={form.company} onChange={set("company")} className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black" required /></div>
          <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Alamat Lengkap *</label>
            <input type="text" value={form.address} onChange={set("address")} className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black" placeholder="Street address" required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Kota *</label>
              <input type="text" value={form.city} onChange={set("city")} className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black" required /></div>
            <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Provinsi / State *</label>
              <input type="text" value={form.state} onChange={set("state")} className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black" required /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Negara *</label>
              <select value={form.country} onChange={set("country")} className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black">
                {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name} ({c.code})</option>)}
              </select></div>
            <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Kode Pos *</label>
              <input type="text" value={form.zipcode} onChange={set("zipcode")} className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black" required /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Kode Negara *</label>
              <select value={form.phone_cc} onChange={set("phone_cc")} className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black">
                {COUNTRIES.map(c => <option key={c.code} value={c.phone_cc}>+{c.phone_cc}</option>)}
              </select></div>
            <div className="sm:col-span-2"><label className="text-xs font-bold text-gray-500 uppercase tracking-wider">No. WhatsApp / HP *</label>
              <input type="text" value={form.phone} onChange={set("phone")} className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black" placeholder="812345678" required />
              <div className="mt-1"><WaBadge phone={`+${form.phone_cc}${form.phone}`} /></div>
            </div>
          </div>
          <TurnstileWidget onVerify={(token) => setCfTurnstileToken(token)} />
          <Button type="submit" disabled={loading} className="w-full py-3 font-semibold text-sm">
            {loading ? "Mengirim Kode OTP..." : "Kirim Kode OTP Verifikasi"}
          </Button>
        </form>
        <p className="text-xs text-gray-500 mt-4 text-center">Already have an account? <Link to="/login" className="text-black font-semibold hover:underline">Login</Link></p>
      </Card>
    </div>
  );
}
