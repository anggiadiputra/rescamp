import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Card, Button, Badge, LoadingSpinner, Modal, InfoBanner, ConfirmDialog, toast, PaymentModal } from "../components/ui";
import { api } from "../lib/api";
import type { Domain } from "../lib/types";

export default function DomainDetailPage() {
  const { id } = useParams();
  const [domain, setDomain] = useState<Domain | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  // Modal states
  const [renewOpen, setRenewOpen] = useState(false);
  const [renewYears, setRenewYears] = useState(1);
  const [renewLoading, setRenewLoading] = useState(false);

  // Payment modal state
  const [paymentData, setPaymentData] = useState<{
    open: boolean;
    orderId: string;
    paymentLinkUrl: string;
    amount: number;
    domainName: string;
  }>({ open: false, orderId: "", paymentLinkUrl: "", amount: 0, domainName: "" });

  const [nsOpen, setNsOpen] = useState(false);
  const [nsForm, setNsForm] = useState(["", ""]);
  const [nsLoading, setNsLoading] = useState(false);

  const [authCodeOpen, setAuthCodeOpen] = useState(false);
  const [authCode, setAuthCode] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [suspendLoading, setSuspendLoading] = useState(false);

  useEffect(() => { fetchDomain(); }, [id]);

  async function fetchDomain() {
    setLoading(true);
    try { const d = await api.get<Domain>(`/domains/${id}`); setDomain(d); } catch { /* 404 */ }
    setLoading(false);
  }

  async function toggleLock() {
    if (!domain) return;
    setMsg("");
    try {
      if (domain.locked) await api.delete(`/domains/${id}/locked`);
      else await api.put(`/domains/${id}/locked`);
      await fetchDomain();
    } catch (e: any) { setMsg(e.message); }
  }

  async function doRenew() {
    setRenewLoading(true);
    setMsg("");
    try {
      const res: any = await api.post(`/domains/${id}/renew`, { years: renewYears });
      setRenewOpen(false);
      const paymentInfo = res?.data || res;
      if (paymentInfo?.paymentLinkUrl) {
        setPaymentData({
          open: true,
          orderId: paymentInfo.orderId,
          paymentLinkUrl: paymentInfo.paymentLinkUrl,
          amount: paymentInfo.amount,
          domainName: domain?.domainName || "",
        });
        window.open(paymentInfo.paymentLinkUrl, "_blank");
      } else {
        toast("Domain renewed successfully");
        await fetchDomain();
      }
    } catch (e: any) { setMsg(e.message); }
    setRenewLoading(false);
  }

  async function doUpdateNs() {
    setNsLoading(true);
    setMsg("");
    try {
      await api.put(`/domains/${id}/ns`, { nameservers: nsForm.filter(Boolean) });
      setNsOpen(false);
      await fetchDomain();
    } catch (e: any) { setMsg(e.message); }
    setNsLoading(false);
  }

  async function getAuthCode() {
    setAuthLoading(true);
    try {
      const res = await api.get<{ auth_code?: string; epp_code?: string }>(`/domains/${id}/auth-code`);
      setAuthCode(res.auth_code || res.epp_code || "-");
      setAuthCodeOpen(true);
    } catch (e: any) { setMsg(e.message); }
    setAuthLoading(false);
  }

  async function toggleSuspend() {
    setSuspendLoading(true);
    try {
      if (domain?.status === "suspended") {
        await api.delete(`/domains/${id}/suspended`);
        toast("Domain unsuspended");
      } else {
        await api.put(`/domains/${id}/suspended`);
        toast("Domain suspended");
      }
      await fetchDomain();
    } catch (e: any) { toast(e.message, "error"); }
    setSuspendLoading(false);
  }

  async function toggleTheft() {
    try {
      if (domain?.theftProtection) {
        await api.delete(`/domains/${id}/theft-protection`);
        toast("Theft protection disabled");
      } else {
        await api.put(`/domains/${id}/theft-protection`);
        toast("Theft protection enabled");
      }
      await fetchDomain();
    } catch (e: any) { toast(e.message, "error"); }
  }

  async function doDelete() {
    setDeleteLoading(true);
    try {
      await api.delete(`/domains/${id}`);
      toast("Domain deleted");
      window.location.href = "/domains";
    } catch (e: any) { toast(e.message, "error"); setDeleteOpen(false); }
    setDeleteLoading(false);
  }

  if (loading) return <LoadingSpinner />;
  if (!domain) return <div className="text-center py-16 text-gray-500">Domain not found</div>;

  return (
    <div className="space-y-6">
      {msg && <InfoBanner type="error" message={msg} />}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{domain.domainName}</h1>
          <p className="text-xs text-gray-400 mt-0.5">Expires: {domain.expiryDate || "-"}</p>
        </div>
        <Badge status={domain.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">Info</h2>
          <div className="space-y-2 text-xs text-gray-700">
            <div className="flex justify-between"><span className="text-gray-400">Registration</span><span>{domain.registrationDate || "-"}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Expiry</span><span>{domain.expiryDate || "-"}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Years</span><span>{domain.years}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Auto Renew</span><span>{domain.autoRenew ? "On" : "Off"}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Privacy</span><span>{domain.privacyProtection ? "On" : "Off"}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Theft Protection</span><span>{domain.theftProtection ? "On" : "Off"}</span></div>
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">Nameservers</h2>
          {(domain.nameservers?.length ? domain.nameservers : ["ns1.liquid.net", "ns2.liquid.net"]).map((ns: string, i: number) => (
            <p key={i} className="text-xs text-gray-700 font-mono">{ns}</p>
          ))}
        </Card>
      </div>

      <Card>
        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link to={`/domains/${id}/dns`}><Button>Manage DNS</Button></Link>
          <Button variant="secondary" onClick={() => { setRenewYears(1); setRenewOpen(true); }}>Renew Domain</Button>
          <Button variant={domain.locked ? "danger" : "secondary"} onClick={toggleLock}>
            {domain.locked ? "Unlock" : "Lock"} Domain
          </Button>
          <Button variant="secondary" onClick={() => { setNsForm(domain.nameservers?.length ? [...domain.nameservers] : ["", ""]); setNsOpen(true); }}>
            Edit Nameservers
          </Button>
          <Button variant="secondary" onClick={getAuthCode} disabled={authLoading}>
            {authLoading ? "..." : "Get Auth Code"}
          </Button>
          <Button variant={domain.theftProtection ? "secondary" : "secondary"} onClick={toggleTheft}>
            {domain.theftProtection ? "Disable" : "Enable"} Theft Protection
          </Button>
          <Button variant="secondary" onClick={toggleSuspend} disabled={suspendLoading}>
            {domain.status === "suspended" ? "Unsuspend" : "Suspend"} Domain
          </Button>
          <Button variant="danger" onClick={() => setDeleteOpen(true)}>
            Delete Domain
          </Button>
        </div>
      </Card>

      <Link to="/domains" className="text-xs text-gray-500 hover:text-black inline-block">← Back to domains</Link>

      {/* Renew Modal */}
      <Modal open={renewOpen} onClose={() => setRenewOpen(false)} title="Renew Domain">
        <div className="space-y-4">
          <p className="text-sm text-gray-700">Renew <strong className="font-mono">{domain.domainName}</strong></p>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Years</label>
            <select value={renewYears} onChange={(e) => setRenewYears(Number(e.target.value))}
              className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black">
              {[1,2,3,4,5,6,7,8,9,10].map(y => <option key={y} value={y}>{y} year{y>1?"s":""}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setRenewOpen(false)}>Cancel</Button>
            <Button onClick={doRenew} disabled={renewLoading}>{renewLoading ? "..." : "Renew"}</Button>
          </div>
        </div>
      </Modal>

      {/* Nameserver Edit Modal */}
      <Modal open={nsOpen} onClose={() => setNsOpen(false)} title="Edit Nameservers">
        <div className="space-y-4">
          {nsForm.map((ns, i) => (
            <div key={i}>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Nameserver {i+1}</label>
              <input value={ns} onChange={(e) => { const n = [...nsForm]; n[i] = e.target.value; setNsForm(n); }}
                className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black font-mono" />
            </div>
          ))}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setNsOpen(false)}>Cancel</Button>
            <Button onClick={doUpdateNs} disabled={nsLoading}>{nsLoading ? "..." : "Save"}</Button>
          </div>
        </div>
      </Modal>
      {/* Auth Code Modal */}
      <Modal open={authCodeOpen} onClose={() => setAuthCodeOpen(false)} title="Auth / EPP Code">
        <div className="space-y-3">
          <p className="text-xs text-gray-500">Use this code to transfer your domain to another registrar.</p>
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 font-mono text-sm text-center font-bold select-all">{authCode}</div>
          <button onClick={() => { navigator.clipboard.writeText(authCode); toast("Auth code copied!"); }} className="w-full px-4 py-2 bg-black text-white text-sm font-semibold rounded-lg hover:bg-gray-800 transition-colors">Copy to Clipboard</button>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog open={deleteOpen} title="Delete Domain" message={`Are you sure you want to delete ${domain.domainName}? This cannot be undone.`} onConfirm={doDelete} onClose={() => setDeleteOpen(false)} loading={deleteLoading} />

      {/* Payment Gateway Modal */}
      <PaymentModal
        open={paymentData.open}
        onClose={() => setPaymentData({ ...paymentData, open: false })}
        orderId={paymentData.orderId}
        paymentLinkUrl={paymentData.paymentLinkUrl}
        amount={paymentData.amount}
        currency="IDR"
        domainName={paymentData.domainName}
        onSuccess={() => fetchDomain()}
      />
    </div>
  );
}
