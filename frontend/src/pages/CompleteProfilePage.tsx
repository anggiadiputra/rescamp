import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Button, InfoBanner, toast } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";

const COUNTRIES = [
  { code: "ID", name: "Indonesia", phone_cc: "62" },
  { code: "US", name: "United States", phone_cc: "1" },
  { code: "SG", name: "Singapore", phone_cc: "65" },
  { code: "MY", name: "Malaysia", phone_cc: "60" },
  { code: "AU", name: "Australia", phone_cc: "61" },
  { code: "GB", name: "United Kingdom", phone_cc: "44" },
];

export default function CompleteProfilePage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState({
    company: "",
    address: "",
    city: "",
    state: "Not Applicable",
    country: "ID",
    zipcode: "",
    phone_cc: "62",
    phone: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function set(k: string) { return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value }); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true); setError("");
    try {
      await api.post("/customers/complete-profile", form);
      toast("Profile completed! You can now order domains.");
      nav("/dashboard");
    } catch (err: any) { setError(err.message); }
    setLoading(false);
  }

  if (user?.role !== "customer") {
    nav("/dashboard");
    return null;
  }

  return (
    <div className="max-w-lg mx-auto mt-8 px-4 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Complete Your Profile</h1>
        <p className="text-sm text-gray-500 mt-1">We need your contact details to register domains on your behalf.</p>
      </div>

      <Card>
        {error && <div className="mb-4"><InfoBanner type="error" message={error} /></div>}
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Company *</label>
            <input value={form.company} onChange={set("company")} className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black" placeholder="Your company name" required />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Address *</label>
            <input value={form.address} onChange={set("address")} className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black" placeholder="Street address" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">City *</label>
              <input value={form.city} onChange={set("city")} className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black" required />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">State *</label>
              <input value={form.state} onChange={set("state")} className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Country *</label>
              <select value={form.country} onChange={set("country")} className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black">
                {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Zipcode *</label>
              <input value={form.zipcode} onChange={set("zipcode")} className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black" required />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Phone CC *</label>
              <select value={form.phone_cc} onChange={set("phone_cc")} className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black">
                {COUNTRIES.map(c => <option key={c.code} value={c.phone_cc}>{c.phone_cc}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Phone Number *</label>
              <input value={form.phone} onChange={set("phone")} className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black" placeholder="812345678" required />
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full">{loading ? "Saving..." : "Complete Profile"}</Button>
        </form>
      </Card>
    </div>
  );
}
