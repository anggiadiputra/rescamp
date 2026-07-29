import { useState, useEffect, useCallback } from "react";
import { Card, Button, InfoBanner, LoadingSpinner, toast, WaBadge } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { User, Lock, Building, MapPin, Mail, ShieldCheck, CreditCard, EyeOff } from "lucide-react";

export default function ProfilePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone_cc: "62",
    phone: "",
    company: "",
    address: "",
    city: "",
    state: "",
    country: "ID",
    zipcode: "",
  });

  // Reseller data
  const [resellerData, setResellerData] = useState<any>(null);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<any>("/auth/profile");
      const data = res?.data || res;
      setForm({
        name: data.name || user?.name || "",
        email: data.email || user?.email || "",
        phone_cc: data.phone_cc || "62",
        phone: data.phone || "",
        company: data.company || "",
        address: data.address || "",
        city: data.city || "",
        state: data.state || "",
        country: data.country || "ID",
        zipcode: data.zipcode || "",
      });
    } catch (e: any) {
      setMsg(e.message || "Gagal memuat informasi profil");
    }
    setLoading(false);
  }, [user?.name, user?.email]);

  const fetchResellerData = useCallback(async () => {
    try {
      const res = await api.get<any>("/auth/reseller-data");
      setResellerData(res.data || res);
    } catch { /* silently fail — not critical for profile view */ }
  }, []);

  useEffect(() => {
    fetchProfile();
    if (user?.role === "reseller") fetchResellerData();
  }, [fetchProfile, fetchResellerData, user?.role]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setMsg("");
    try {
      await api.put("/auth/profile", {
        name: form.name,
        company: form.company,
        address: form.address,
        city: form.city,
        state: form.state,
        country: form.country,
        zipcode: form.zipcode,
        phone_cc: form.phone_cc,
        phone: form.phone,
      });
      toast("Profil berhasil diperbarui!");
    } catch (e: any) {
      setMsg(e.message || "Gagal menyimpan perubahan profil");
    }
    setSaving(false);
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
          <User className="w-6 h-6 text-gray-700" />
          Profil Saya
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
          Kelola informasi kontak dan profil akun Anda. Email dikunci untuk alasan keamanan.
        </p>
      </div>

      {msg && <InfoBanner type="error" message={msg} />}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Read-Only Account Security Section */}
        <Card className="p-6 bg-white border border-gray-200 shadow-xs rounded-xl space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Keamanan Akun Utama</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                <Mail className="w-3.5 h-3.5 text-gray-400" /> Email (Terkunci)
                <Lock className="w-3 h-3 text-amber-500 ml-auto" />
              </label>
              <input
                type="email"
                value={form.email}
                disabled
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-100 text-gray-500 font-medium cursor-not-allowed select-none"
              />
            </div>
          </div>
          <p className="text-[11px] text-gray-400 italic">
            * Untuk mengubah Alamat Email utama, silakan hubungi tim bantuan/support.
          </p>
        </Card>

        {/* Reseller Information — only for reseller role */}
        {user?.role === "reseller" && (
          <Card className="p-6 bg-white border border-indigo-200 shadow-xs rounded-xl space-y-4">
            <div className="flex items-center gap-2 border-b border-indigo-100 pb-3">
              <CreditCard className="w-5 h-5 text-indigo-600" />
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Informasi Reseller</h2>
            </div>
            {resellerData ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Reseller ID</label>
                    <p className="text-sm font-mono font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                      {resellerData.reseller_id}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <EyeOff className="w-3 h-3" /> API Key
                    </label>
                    <p className="text-sm font-mono font-medium text-gray-500 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                      {resellerData.api_key_masked || "—"}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Balance</label>
                    <p className="text-sm font-bold text-indigo-700 bg-indigo-50 px-3 py-2 rounded-lg border border-indigo-200">
                      {(() => {
                        const b = resellerData.balance;
                        if (typeof b === "number") return `Rp ${b.toLocaleString("id-ID")}`;
                        if (b?.available !== undefined) return `Rp ${Number(b.available).toLocaleString("id-ID")}`;
                        if (b?.balance !== undefined) return `Rp ${Number(b.balance).toLocaleString("id-ID")}`;
                        if (b?.error) return "Gagal memuat";
                        return "—";
                      })()}
                    </p>
                  </div>
                </div>
                {!resellerData.synced && (
                  <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    ⚠️ Data profil belum disinkronkan dengan LIQUID. Silakan sync dari halaman{" "}
                    <a href="/settings" className="font-semibold underline">Settings</a>.
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-gray-400 italic">
                Data reseller belum tersedia. Silakan sync dari halaman Settings.
              </p>
            )}
          </Card>
        )}

        {/* Editable Personal & Address Information */}
        <Card className="p-6 bg-white border border-gray-200 shadow-xs rounded-xl space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
            <Building className="w-5 h-5 text-gray-700" />
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Informasi Kontak & Alamat</h2>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white"
                  placeholder="Nama Lengkap"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Perusahaan / Organisasi</label>
                <input
                  type="text"
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white"
                  placeholder="Nama Perusahaan (Opsional)"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-gray-400" /> Alamat Jalan
              </label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white"
                placeholder="Alamat domisili lengkap..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Kota</label>
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white"
                  placeholder="Kota"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Provinsi / State</label>
                <input
                  type="text"
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white"
                  placeholder="Provinsi"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Negara</label>
                <select
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white font-medium"
                >
                  <option value="ID">Indonesia (ID)</option>
                  <option value="US">United States (US)</option>
                  <option value="SG">Singapore (SG)</option>
                  <option value="MY">Malaysia (MY)</option>
                  <option value="AU">Australia (AU)</option>
                  <option value="GB">United Kingdom (GB)</option>
                  <option value="JP">Japan (JP)</option>
                  <option value="KR">South Korea (KR)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Kode Pos</label>
                <input
                  type="text"
                  value={form.zipcode}
                  onChange={(e) => setForm({ ...form, zipcode: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white font-mono"
                  placeholder="12345"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Kode Negara</label>
                <select
                  value={form.phone_cc}
                  onChange={(e) => setForm({ ...form, phone_cc: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white"
                >
                  <option value="62">+62</option>
                  <option value="1">+1</option>
                  <option value="65">+65</option>
                  <option value="60">+60</option>
                  <option value="61">+61</option>
                  <option value="44">+44</option>
                  <option value="81">+81</option>
                  <option value="82">+82</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Nomor Telepon</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white"
                  placeholder="812345678"
                />
                <div className="mt-1"><WaBadge phone={`+${form.phone_cc}${form.phone}`} /></div>
              </div>
            </div>
          </div>

          <div className="pt-3 flex justify-end">
            <Button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-black hover:bg-gray-800 text-white font-bold text-xs rounded-lg transition-all shadow-xs"
            >
              {saving ? "Saving..." : "Simpan Perubahan Profil"}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
