import { useEffect, useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { Plus, RefreshCw, Filter } from "lucide-react";
import { Card, Button, LoadingSpinner, Modal, toast } from "../components/ui";
import { api } from "../lib/api";

const RECORD_TYPES = [
  { value: "a", label: "A - IPv4 Address", help: "Maps your domain to an IPv4 address (e.g. 192.168.1.1)" },
  { value: "aaaa", label: "AAAA - IPv6 Address", help: "Maps your domain to an IPv6 address" },
  { value: "cname", label: "CNAME - Alias", help: "Creates an alias pointing to another domain name" },
  { value: "mx", label: "MX - Mail Exchanger", help: "Routes email to your mail server (requires priority)" },
  { value: "txt", label: "TXT - Text Record", help: "Stores text data — used for SPF, DKIM, and domain verification" },
  { value: "ns", label: "NS - Name Server", help: "Delegates a subdomain to different nameservers" },
  { value: "srv", label: "SRV - Service Locator", help: "Service discovery — defines host and port for specific services" },
];

interface DnsRecord {
  type: string;
  hostname: string;
  value: string;
  ttl: number;
}

export default function DnsManagePage() {
  const { id } = useParams();
  const [records, setRecords] = useState<DnsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ type: "a", hostname: "", value: "", ttl: 3600 });
  const [editingRecord, setEditingRecord] = useState<DnsRecord | null>(null);

  const [submitting, setSubmitting] = useState(false);

  const fetchAllRecords = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled(
        RECORD_TYPES.map(async (t) => {
          const data = await api.get<any[]>(`/domains/${id}/dns/${t.value}`);
          const list = Array.isArray(data) ? data : [];
          return list.map((r: any) => ({
            type: t.value,
            hostname: r.hostname || "@",
            value: r.value || "",
            ttl: r.ttl || 3600,
          }));
        })
      );

      const allFetched: DnsRecord[] = [];
      results.forEach((res) => {
        if (res.status === "fulfilled") {
          allFetched.push(...res.value);
        }
      });
      setRecords(allFetched);
    } catch (err: any) {
      toast(err.message || "Failed to load DNS records", "error");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAllRecords();
  }, [fetchAllRecords]);

  async function addRecord() {
    if (submitting) return;
    if (!form.value) {
      toast("Value is required", "error");
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/domains/${id}/dns/${form.type}`, {
        hostname: form.hostname || "@",
        value: form.value,
        ttl: form.ttl,
      });
      toast("DNS record added successfully");
      setAddOpen(false);
      setForm({ type: "a", hostname: "", value: "", ttl: 3600 });
      await fetchAllRecords();
    } catch (err: any) {
      toast(err.message || "Failed to add DNS record", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function updateRecord() {
    if (!editingRecord || submitting) return;
    if (!form.value) {
      toast("Value is required", "error");
      return;
    }
    setSubmitting(true);
    try {
      // If type changed, delete old and add new; otherwise update
      if (form.type !== editingRecord.type) {
        await api.delete(`/domains/${id}/dns/${editingRecord.type}/${editingRecord.hostname}/${editingRecord.value}`);
        await api.post(`/domains/${id}/dns/${form.type}`, {
          hostname: form.hostname || "@",
          value: form.value,
          ttl: form.ttl,
        });
      } else {
        await api.put(`/domains/${id}/dns/${editingRecord.type}/${editingRecord.hostname}/${editingRecord.value}`, {
          hostname: form.hostname || "@",
          value: form.value,
          ttl: form.ttl,
        });
      }
      toast("DNS record updated successfully");
      setEditOpen(false);
      setEditingRecord(null);
      await fetchAllRecords();
    } catch (err: any) {
      toast(err.message || "Failed to update DNS record", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteRecord(r: DnsRecord) {
    if (submitting) return;
    if (!confirm(`Are you sure you want to delete this ${r.type.toUpperCase()} record?`)) return;
    setSubmitting(true);
    try {
      await api.delete(`/domains/${id}/dns/${r.type}/${r.hostname}/${r.value}`);
      toast("DNS record deleted successfully");
      await fetchAllRecords();
    } catch (err: any) {
      toast(err.message || "Failed to delete DNS record", "error");
    } finally {
      setSubmitting(false);
    }
  }

  function openEdit(r: DnsRecord) {
    setEditingRecord(r);
    setForm({ type: r.type, hostname: r.hostname, value: r.value, ttl: r.ttl || 3600 });
    setEditOpen(true);
  }

  const filteredRecords = filterType === "all"
    ? records
    : records.filter((r) => r.type === filterType);

  const selectedHelp = RECORD_TYPES.find((t) => t.value === form.type)?.help || "";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900">DNS Management</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchAllRecords} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1 inline ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={() => { setForm({ type: "a", hostname: "", value: "", ttl: 3600 }); setAddOpen(true); }}>
            <Plus className="w-3.5 h-3.5 inline mr-1" /> Add Record
          </Button>
        </div>
      </div>

      <Card className="p-0">
        {/* Header Controls: Filter & Count */}
        <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/50 rounded-t-xl">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs font-semibold text-gray-600">Filter Type:</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white font-medium focus:outline-none focus:ring-1 focus:ring-black"
            >
              <option value="all">All Types ({records.length})</option>
              {RECORD_TYPES.map((t) => {
                const count = records.filter((r) => r.type === t.value).length;
                return (
                  <option key={t.value} value={t.value}>
                    {t.value.toUpperCase()} ({count})
                  </option>
                );
              })}
            </select>
          </div>
          <span className="text-xs text-gray-500 font-medium">
            Showing {filteredRecords.length} of {records.length} record(s)
          </span>
        </div>

        {loading ? (
          <div className="py-12"><LoadingSpinner size="sm" /></div>
        ) : filteredRecords.length === 0 ? (
          <div className="text-center py-12 text-xs text-gray-400">
            {filterType === "all" ? "No DNS records found for this domain." : `No ${filterType.toUpperCase()} records found.`}
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Hostname</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Value</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">TTL</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredRecords.map((r, i) => (
                    <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 text-xs">
                        <span className="inline-block px-2 py-0.5 font-mono font-bold text-xs uppercase bg-gray-100 text-gray-800 rounded border border-gray-200">
                          {r.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-800 font-mono font-medium">{r.hostname}</td>
                      <td className="px-4 py-3 text-xs text-gray-600 font-mono break-all">{r.value}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{r.ttl}</td>
                      <td className="px-4 py-3 text-right space-x-1">
                        <button
                          onClick={() => openEdit(r)}
                          className="px-2 py-1 text-xs font-semibold text-gray-600 hover:text-black hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteRecord(r)}
                          className="px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="md:hidden divide-y divide-gray-100 p-3 space-y-2">
              {filteredRecords.map((r, i) => (
                <div key={i} className="rounded-lg border border-gray-200 bg-white p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 font-mono font-bold text-xs uppercase bg-gray-100 text-gray-800 rounded border border-gray-200">
                        {r.type}
                      </span>
                      <span className="text-xs font-mono font-bold text-gray-900 truncate max-w-[150px]">
                        {r.hostname}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-400 font-mono">TTL: {r.ttl}</span>
                  </div>
                  <p className="text-xs font-mono text-gray-600 break-all bg-gray-50 p-2 rounded border border-gray-100">
                    {r.value}
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => openEdit(r)}
                      className="flex-1 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteRecord(r)}
                      className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      <Link to={`/domains/${id}`} className="inline-block text-xs text-gray-500 hover:text-black font-medium">
        ← Back to domain
      </Link>

      {/* Add Record Modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add DNS Record">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Record Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black bg-white mt-1 font-medium"
            >
              {RECORD_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            {selectedHelp && <p className="text-[11px] text-gray-400 mt-1">{selectedHelp}</p>}
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Hostname</label>
            <input
              value={form.hostname}
              onChange={(e) => setForm({ ...form, hostname: e.target.value })}
              className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black font-mono mt-1"
              placeholder="@ or sub"
            />
            <p className="text-[11px] text-gray-400 mt-1">Use @ for root domain, or enter subdomain prefix</p>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Value</label>
            <input
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
              className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black font-mono mt-1"
              placeholder={form.type === "a" ? "192.168.1.1" : form.type === "cname" ? "example.com" : "Value"}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">TTL</label>
            <select
              value={form.ttl}
              onChange={(e) => setForm({ ...form, ttl: Number(e.target.value) })}
              className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black bg-white mt-1 font-medium"
            >
              <option value={3600}>3600 (1 hour)</option>
              <option value={14400}>14400 (4 hours)</option>
              <option value={86400}>86400 (24 hours)</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={addRecord} disabled={submitting}>
              {submitting ? "Saving..." : "Save Record"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Record Modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit DNS Record">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Record Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black bg-white mt-1 font-medium"
            >
              {RECORD_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Hostname</label>
            <input
              value={form.hostname}
              onChange={(e) => setForm({ ...form, hostname: e.target.value })}
              className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black font-mono mt-1"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Value</label>
            <input
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
              className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black font-mono mt-1"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">TTL</label>
            <select
              value={form.ttl}
              onChange={(e) => setForm({ ...form, ttl: Number(e.target.value) })}
              className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black bg-white mt-1 font-medium"
            >
              <option value={3600}>3600 (1 hour)</option>
              <option value={14400}>14400 (4 hours)</option>
              <option value={86400}>86400 (24 hours)</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={updateRecord} disabled={submitting}>
              {submitting ? "Updating..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
