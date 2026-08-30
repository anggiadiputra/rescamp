import { useState, useEffect, useCallback } from "react";
import { Card, Button, InfoBanner, LoadingSpinner, toast } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { User, Lock, Building, MapPin, Mail, ShieldCheck, CreditCard, EyeOff, Pencil, X, CheckCircle2, AlertCircle } from "lucide-react";
import { hasResellerCapabilities } from "../lib/types";

export default function ProfilePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [editing, setEditing] = useState(false);

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

  const [originalForm, setOriginalForm] = useState({ ...form });
  const [resellerData, setResellerData] = useState<any>(null);
  const [waStatus, setWaStatus] = useState<boolean | null>(null);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<any>("/auth/profile");
      const data = res?.data || res;
      const fresh = {
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
      };
      setForm(fresh);
      setOriginalForm(fresh);
    } catch (e: any) {
      setMsg(e.message || "Gagal memuat informasi profil");
    }
    setLoading(false);
  }, [user?.name, user?.email]);

  const fetchResellerData = useCallback(async () => {
    try {
      const res = await api.get<any>("/auth/reseller-data");
      setResellerData(res.data || res);
    } catch { /* silently fail */ }
  }, []);

  useEffect(() => {
    fetchProfile();
    if (hasResellerCapabilities(user?.role)) fetchResellerData();
  }, [fetchProfile, fetchResellerData, user?.role]);

  function startEdit() {
    setOriginalForm({ ...form });
    setEditing(true);
    setMsg("");
  }

  function cancelEdit() {
    setForm({ ...originalForm });
    setEditing(false);
    setMsg("");
  }

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
      setOriginalForm({ ...form });
      setEditing(false);
      // Check WhatsApp status once after save
      try {
        const checkRes = await api.post<any>("/auth/check-whatsapp", { phone: `+${form.phone_cc}${form.phone}` });
        setWaStatus(checkRes?.registered ?? false);
      } catch { setWaStatus(false); }
    } catch (e: any) {
      setMsg(e.message || "Gagal menyimpan perubahan profil");
    }
    setSaving(false);
  }

  if (loading) return <LoadingSpinner />;

  const fullPhone = form.phone ? `+${form.phone_cc}${form.phone}` : "—";
  const fullAddress = [form.address, form.city, form.state, form.country, form.zipcode].filter(Boolean).join(", ") || "—";

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <User className="w-6 h-6 text-gray-700" />
            Profil Saya
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Kelola informasi kontak dan profil akun Anda.
          </p>
        </div>
        {!editing && (
          <Button onClick={startEdit}>
            <Pencil className="w-3.5 h-3.5 inline mr-1" /> Edit Profil
          </Button>
        )}
      </div>

      {msg && <InfoBanner type="error" message={msg} />}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Account Security */}
        <Card className="p-6 bg-white border border-gray-200 shadow-xs rounded-xl space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Keamanan Akun</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                <Mail className="w-3.5 h-3.5 text-gray-400" /> Email
                <Lock className="w-3 h-3 text-amber-500 ml-auto" />
              </label>
              <p className="text-sm font-mono font-medium text-gray-500 bg-gray-50 px-3.5 py-2.5 rounded-lg border border-gray-200">
                {form.email}
              </p>
            </div>
          </div>
        </Card>

        {/* Reseller Info */}
        {hasResellerCapabilities(user?.role) && (
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
              <p className="text-xs text-gray-400 italic">Data reseller belum tersedia.</p>
            )}
          </Card>
        )}

        {/* Contact & Address */}
        <Card className="p-6 bg-white border border-gray-200 shadow-xs rounded-xl space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
            <Building className="w-5 h-5 text-gray-700" />
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Informasi Kontak & Alamat</h2>
          </div>

          {!editing ? (
            /* ----- VIEW MODE ----- */
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-0.5 block">Nama</label>
                  <p className="text-sm font-semibold text-gray-900">{form.name}</p>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-0.5 block">Perusahaan</label>
                  <p className="text-sm font-semibold text-gray-900">{form.company || "—"}</p>
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-0.5 block">Alamat</label>
                <p className="text-sm font-semibold text-gray-900">{fullAddress}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-0.5 block">Telepon</label>
                  <p className="text-sm font-mono font-semibold text-gray-900">
                    {fullPhone}
                    {waStatus === true && <CheckCircle2 className="w-4 h-4 text-blue-500 inline ml-1.5" />}
                    {waStatus === false && <AlertCircle className="w-4 h-4 text-gray-300 inline ml-1.5" />}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* ----- EDIT MODE ----- */
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Nama Lengkap</label>
                  <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Perusahaan</label>
                  <input type="text" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-gray-400" /> Alamat Jalan
                </label>
                <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Kota</label>
                  <input type="text" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Provinsi</label>
                  <input type="text" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Negara</label>
                  <select value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white font-medium">
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
                  <input type="text" value={form.zipcode} onChange={(e) => setForm({ ...form, zipcode: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white font-mono" />
                </div>
              </div>

              <div className="grid grid-cols-[auto_1fr] gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Kode</label>
                  <select value={form.phone_cc} onChange={(e) => setForm({ ...form, phone_cc: e.target.value })}
                    className="w-20 px-2 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white">
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
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Nomor Telepon</label>
                  <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white" />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <Button variant="secondary" type="button" onClick={cancelEdit}>
                  <X className="w-3.5 h-3.5 inline mr-1" /> Batal
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Menyimpan..." : "Simpan"}
                </Button>
              </div>
            </div>
          )}
        </Card>
      </form>
    </div>
  );
}