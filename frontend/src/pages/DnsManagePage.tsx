import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Plus, RefreshCw } from "lucide-react";
import { Card, Button, LoadingSpinner, Modal } from "../components/ui";
import { api } from "../lib/api";

const RECORD_TYPES = ["a", "aaaa", "cname", "mx", "txt", "ns", "srv"];

const RECORD_HELP: Record<string, string> = {
  a: "Maps your domain to an IPv4 address (e.g. 192.168.1.1)",
  aaaa: "Maps your domain to an IPv6 address",
  cname: "Creates an alias pointing to another domain name",
  mx: "Routes email to your mail server (requires priority)",
  txt: "Stores text data — used for SPF, DKIM, and domain verification",
  ns: "Delegates a subdomain to different nameservers",
  srv: "Service discovery — defines host and port for specific services",
};

export default function DnsManagePage() {
  const { id } = useParams();
  const [records, setRecords] = useState<Record<string, any[]>>({});
  const [activeType, setActiveType] = useState("a");
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ hostname: "", value: "", ttl: 3600 });
  const [editIdx, setEditIdx] = useState(-1);

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    api.get<any>(`/domains/${id}/dns/${activeType}`, { signal: controller.signal })
      .then((data) => {
        setRecords((prev) => ({ ...prev, [activeType]: Array.isArray(data) ? data : [] }));
      })
      .catch((err) => { if (err.name !== "AbortError") console.error(err); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [activeType, id]);

  async function fetchRecords() {
    setLoading(true);
    try {
      const data = await api.get<any>(`/domains/${id}/dns/${activeType}`);
      setRecords((prev) => ({ ...prev, [activeType]: Array.isArray(data) ? data : [] }));
    } finally { setLoading(false); }
  }

  async function addRecord() {
    if (submitting) return;
    setSubmitting(true);
    try {
      await api.post(`/domains/${id}/dns/${activeType}`, form);
      setAddOpen(false);
      setForm({ hostname: "", value: "", ttl: 3600 });
      await fetchRecords();
    } finally {
      setSubmitting(false);
    }
  }

  async function updateRecord() {
    if (submitting) return;
    const old = records[activeType]?.[editIdx];
    if (!old) return;
    setSubmitting(true);
    try {
      await api.put(`/domains/${id}/dns/${activeType}/${old.hostname}/${old.value}`, form);
      setEditOpen(false);
      await fetchRecords();
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteRecord(r: any) {
    if (submitting) return;
    setSubmitting(true);
    try {
      await api.delete(`/domains/${id}/dns/${activeType}/${r.hostname}/${r.value}`);
      await fetchRecords();
    } finally {
      setSubmitting(false);
    }
  }

  function openEdit(r: any, i: number) {
    setEditIdx(i);
    setForm({ hostname: r.hostname, value: r.value, ttl: r.ttl || 3600 });
    setEditOpen(true);
  }

  const current = records[activeType] || [];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">DNS Management</h1>

      <Card className="p-0">
        <div className="flex overflow-x-auto border-b border-gray-100 px-4">
          {RECORD_TYPES.map((t) => (
            <button key={t} onClick={() => setActiveType(t)}
              className={`px-4 py-3 text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${activeType === t ? "text-black border-b-2 border-black" : "text-gray-400 hover:text-gray-600"}`}>
              {t}
            </button>
          ))}
        </div>

        <div className="px-4 py-2 text-[10px] text-gray-400 border-b border-gray-50">{RECORD_HELP[activeType]}</div>

        <div className="p-4 flex justify-between items-center">
          <span className="text-xs text-gray-500">{current.length} record(s)</span>
          <Button onClick={() => { setForm({ hostname: "", value: "", ttl: 3600 }); setAddOpen(true); }}>
            <Plus className="w-3.5 h-3.5 inline mr-1" /> Add Record
          </Button>
        </div>

        {loading ? <LoadingSpinner size="sm" /> : current.length === 0 ? (
          <div className="text-center py-8 text-xs text-gray-400">No {activeType.toUpperCase()} records.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Hostname</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Value</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">TTL</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {current.map((r: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-800 font-mono">{r.hostname}</td>
                    <td className="px-4 py-3 text-xs text-gray-600 font-mono break-all">{r.value}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{r.ttl || 3600}</td>
                    <td className="px-4 py-3 text-right space-x-1">
                      <button onClick={() => openEdit(r, i)} className="p-1.5 text-gray-400 hover:text-black hover:bg-gray-100 rounded-lg transition-colors">
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteRecord(r)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Link to={`/domains/${id}`} className="text-xs text-gray-500 hover:text-black">← Back to domain</Link>

      {/* Add Modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={`Add ${activeType.toUpperCase()} Record`}>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Hostname</label>
            <input value={form.hostname} onChange={(e) => setForm({ ...form, hostname: e.target.value })}
              className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black font-mono" placeholder="@" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Value</label>
            <input value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })}
              className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black font-mono" placeholder="192.168.1.1" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">TTL</label>
            <select value={form.ttl} onChange={(e) => setForm({ ...form, ttl: Number(e.target.value) })}
              className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black">
              <option value={3600}>3600 (1 hour)</option>
              <option value={14400}>14400 (4 hours)</option>
              <option value={86400}>86400 (24 hours)</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={addRecord}>Save</Button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={`Edit ${activeType.toUpperCase()} Record`}>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Hostname</label>
            <input value={form.hostname} onChange={(e) => setForm({ ...form, hostname: e.target.value })}
              className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black font-mono" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Value</label>
            <input value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })}
              className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black font-mono" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">TTL</label>
            <select value={form.ttl} onChange={(e) => setForm({ ...form, ttl: Number(e.target.value) })}
              className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black">
              <option value={3600}>3600 (1 hour)</option>
              <option value={14400}>14400 (4 hours)</option>
              <option value={86400}>86400 (24 hours)</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={updateRecord}>Save Changes</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
