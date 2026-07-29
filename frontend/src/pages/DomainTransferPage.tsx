import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Card, Button, InfoBanner, toast } from "../components/ui";
import { api } from "../lib/api";

export default function DomainTransferPage() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const paramDomain = searchParams.get("domain") || searchParams.get("search") || "";
  const [domain, setDomain] = useState(paramDomain);
  const [authCode, setAuthCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (paramDomain) setDomain(paramDomain);
  }, [paramDomain]);

  async function submit() {
    if (!domain.includes(".")) { setError("Enter full domain name"); return; }
    setLoading(true);
    setError("");
    try {
      await api.post("/domains/transfer", { domain_name: domain, auth_code: authCode || undefined });
      toast("Transfer initiated for " + domain);
      nav("/domains");
    } catch (err: any) { setError(err.message); }
    setLoading(false);
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900">Transfer Domain</h1>
      <p className="text-sm text-gray-500">Transfer your domain from another registrar to your account.</p>

      <Card>
        {error && <div className="mb-4"><InfoBanner type="error" message={error} /></div>}
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Domain Name</label>
            <input value={domain} onChange={(e) => setDomain(e.target.value)}
              className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black font-mono"
              placeholder="example.com" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Auth / EPP Code (optional)</label>
            <input value={authCode} onChange={(e) => setAuthCode(e.target.value)}
              className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black font-mono"
              placeholder="EPP-XXXXXX" />
          </div>
          <Button onClick={submit} disabled={loading} className="w-full">
            <ArrowRight className="w-4 h-4 inline mr-1" />
            {loading ? "Initiating transfer..." : "Transfer Domain"}
          </Button>
        </div>
      </Card>

      <Link to="/domains" className="text-xs text-gray-500 hover:text-black">← Back to domains</Link>
    </div>
  );
}
