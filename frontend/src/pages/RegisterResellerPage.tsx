import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Card, Button, InfoBanner } from "../components/ui";

export default function RegisterResellerPage() {
  const { register } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "", reseller_id: "", api_key: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function set(k: string) { return (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value }); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(""); setLoading(true);
    try { await register({ email: form.email, password: form.password, name: form.name, reseller_id: form.reseller_id, api_key: form.api_key }); }
    catch (err: any) { setError(err.message); }
    setLoading(false);
  }

  return (
    <div className="max-w-md mx-auto mt-8 px-4">
      <Card>
        <h1 className="text-xl font-bold text-gray-900 mb-1">Reseller Setup</h1>
        <p className="text-sm text-gray-500 mb-6">Admin registration with LIQUID credentials</p>
        {error && <div className="mb-4"><InfoBanner type="error" message={error} /></div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Name</label>
            <input value={form.name} onChange={set("name")} className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black" required /></div>
          <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Email</label>
            <input type="email" value={form.email} onChange={set("email")} className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black" required /></div>
          <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Password</label>
            <input type="password" value={form.password} onChange={set("password")} className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black" required minLength={6} /></div>
          <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wider">LIQUID Reseller ID</label>
            <input value={form.reseller_id} onChange={set("reseller_id")} className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black" required /></div>
          <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wider">LIQUID API Key</label>
            <input value={form.api_key} onChange={set("api_key")} className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black" required /></div>
          <Button type="submit" disabled={loading} className="w-full">{loading ? "Creating..." : "Setup Reseller"}</Button>
        </form>
      </Card>
    </div>
  );
}
