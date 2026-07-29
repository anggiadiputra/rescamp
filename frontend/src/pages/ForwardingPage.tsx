import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { Card, Button, LoadingSpinner, Modal, toast } from "../components/ui";
import { api } from "../lib/api";

export default function ForwardingPage() {
  const { id } = useParams();
  const [tab, setTab] = useState<"domain" | "email">("domain");
  const [loading, setLoading] = useState(true);

  // Domain forwarding
  const [_domainFwd, setDomainFwd] = useState<any>(null);
  const [dfUrl, setDfUrl] = useState("");

  // Email forwarding
  const [emailFwds, setEmailFwds] = useState<any[]>([]);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailForm, setEmailForm] = useState({ email: "", forward_to: "" });

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get<any>(`/domains/${id}/domain-forwarding`).catch(() => null),
      api.get<any>(`/domains/${id}/email-forwarding`).catch(() => []),
    ]).then(([df, ef]) => {
      setDomainFwd(df);
      setDfUrl(df?.destination_url || "");
      setEmailFwds(Array.isArray(ef) ? ef : ef?.data || []);
    }).finally(() => setLoading(false));
  }, [id]);

  async function updateDomainFwd() {
    await api.put(`/domains/${id}/domain-forwarding`, { destination_url: dfUrl, enabled: true });
    toast("Domain forwarding updated");
  }

  async function createEmailFwd() {
    await api.post(`/domains/${id}/email-forwarding`, { email: emailForm.email, forward_to: emailForm.forward_to });
    setEmailOpen(false);
    setEmailForm({ email: "", forward_to: "" });
    const res = await api.get<any>(`/domains/${id}/email-forwarding`);
    setEmailFwds(Array.isArray(res) ? res : res?.data || []);
    toast("Email forwarding created");
  }

  async function deleteEmailFwd(email: string) {
    await api.delete(`/domains/${id}/email-forwarding/${email}`);
    const res = await api.get<any>(`/domains/${id}/email-forwarding`);
    setEmailFwds(Array.isArray(res) ? res : res?.data || []);
    toast("Email forwarding deleted");
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Forwarding</h1>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {(["domain", "email"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-colors ${tab === t ? "bg-white text-black shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            {t} Forwarding
          </button>
        ))}
      </div>

      {tab === "domain" && (
        <Card>
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">Domain Forwarding</h2>
          <p className="text-xs text-gray-500 mb-3">Redirect visitors from this domain to another URL.</p>
          <div className="space-y-3">
            <input value={dfUrl} onChange={(e) => setDfUrl(e.target.value)}
              className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black font-mono"
              placeholder="https://example.com" />
            <Button onClick={updateDomainFwd}>Save</Button>
          </div>
        </Card>
      )}

      {tab === "email" && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Email Forwarding</h2>
            <Button onClick={() => { setEmailForm({ email: "", forward_to: "" }); setEmailOpen(true); }}>Add Forward</Button>
          </div>
          {emailFwds.length === 0 ? (
            <p className="text-xs text-gray-400 py-4">No email forwarding rules.</p>
          ) : (
            <div className="space-y-2">
              {emailFwds.map((f: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div>
                    <p className="text-xs font-mono text-gray-800">{f.email || f.from}</p>
                    <p className="text-[10px] text-gray-400">→ {f.forward_to || f.to}</p>
                  </div>
                  <Button variant="danger" onClick={() => deleteEmailFwd(f.email || f.from)}>Delete</Button>
                </div>
              ))}
            </div>
          )}
          <Modal open={emailOpen} onClose={() => setEmailOpen(false)} title="Add Email Forward">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Email address</label>
                <input value={emailForm.email} onChange={(e) => setEmailForm({ ...emailForm, email: e.target.value })}
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black font-mono" placeholder="admin@yourdomain.com" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Forward to</label>
                <input value={emailForm.forward_to} onChange={(e) => setEmailForm({ ...emailForm, forward_to: e.target.value })}
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black" placeholder="you@gmail.com" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" onClick={() => setEmailOpen(false)}>Cancel</Button>
                <Button onClick={createEmailFwd}>Save</Button>
              </div>
            </div>
          </Modal>
        </Card>
      )}

      <Link to={`/domains/${id}`} className="text-xs text-gray-500 hover:text-black">← Back to domain</Link>
    </div>
  );
}
