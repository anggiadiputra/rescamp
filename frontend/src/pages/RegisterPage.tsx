import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Card, Button, InfoBanner } from "../components/ui";

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
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function set(k: string) { return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value }); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(""); setLoading(true);
    try {
      await register({
        email: form.email, password: form.password, name: form.name,
        reseller_id: "", api_key: undefined,
        company: form.company, address: form.address,
        city: form.city, state: form.state, country: form.country,
        zipcode: form.zipcode, phone_cc: form.phone_cc, phone: form.phone,
      } as any);
      nav(redirect);
    } catch (err: any) { setError(err.message); }
    setLoading(false);
  }

  return (
    <div className="max-w-lg mx-auto mt-8 px-4">
      <Card>
        <h1 className="text-xl font-bold text-gray-900 mb-1">Create Account</h1>
        <p className="text-sm text-gray-500 mb-6">All fields are required for domain registration.</p>
        {error && <div className="mb-4"><InfoBanner type="error" message={error} /></div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Name *</label>
            <input type="text" value={form.name} onChange={set("name")} className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black" required /></div>
          <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Email *</label>
            <input type="email" value={form.email} onChange={set("email")} className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black" required /></div>
          <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Password *</label>
            <input type="password" value={form.password} onChange={set("password")} className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black" required minLength={6} /></div>
          <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Company *</label>
            <input type="text" value={form.company} onChange={set("company")} className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black" required /></div>
          <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Address *</label>
            <input type="text" value={form.address} onChange={set("address")} className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black" placeholder="Street address" required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wider">City *</label>
              <input type="text" value={form.city} onChange={set("city")} className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black" required /></div>
            <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wider">State *</label>
              <input type="text" value={form.state} onChange={set("state")} className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black" required /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Country *</label>
              <select value={form.country} onChange={set("country")} className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black">
                {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name} ({c.code})</option>)}
              </select></div>
            <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Zipcode *</label>
              <input type="text" value={form.zipcode} onChange={set("zipcode")} className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black" required /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Phone CC *</label>
              <select value={form.phone_cc} onChange={set("phone_cc")} className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black">
                {COUNTRIES.map(c => <option key={c.code} value={c.phone_cc}>+{c.phone_cc}</option>)}
              </select></div>
            <div className="col-span-2"><label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Phone *</label>
              <input type="text" value={form.phone} onChange={set("phone")} className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black" placeholder="812345678" required /></div>
          </div>
          <Button type="submit" disabled={loading} className="w-full">{loading ? "Creating account..." : "Register"}</Button>
        </form>
        <p className="text-xs text-gray-500 mt-4 text-center">Already have an account? <Link to="/login" className="text-black font-semibold hover:underline">Login</Link></p>
      </Card>
    </div>
  );
}
