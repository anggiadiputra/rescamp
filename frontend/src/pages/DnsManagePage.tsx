import { useEffect, useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { Plus, RefreshCw, Filter, ArrowLeft, Edit2, Trash2, Globe, Info, Copy, Check } from "lucide-react";
import { Card, Button, LoadingSpinner, Modal, toast } from "../components/ui";
import { api } from "../lib/api";

const RECORD_TYPES = [
  { value: "a", label: "A - IPv4 Address", help: "Maps your domain to an IPv4 address (e.g. 192.168.1.1)", badgeBg: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "aaaa", label: "AAAA - IPv6 Address", help: "Maps your domain to an IPv6 address", badgeBg: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  { value: "cname", label: "CNAME - Alias", help: "Creates an alias pointing to another domain name", badgeBg: "bg-purple-50 text-purple-700 border-purple-200" },
  { value: "mx", label: "MX - Mail Exchanger", help: "Routes email to your mail server (requires priority)", badgeBg: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { value: "txt", label: "TXT - Text Record", help: "Stores text data — used for SPF, DKIM, and domain verification", badgeBg: "bg-amber-50 text-amber-700 border-amber-200" },
  { value: "ns", label: "NS - Name Server", help: "Delegates a subdomain to different nameservers", badgeBg: "bg-rose-50 text-rose-700 border-rose-200" },
  { value: "srv", label: "SRV - Service Locator", help: "Service discovery — defines host and port for specific services", badgeBg: "bg-teal-50 text-teal-700 border-teal-200" },
];

function getBadgeStyle(type: string) {
  const found = RECORD_TYPES.find((t) => t.value === type.toLowerCase());
  return found?.badgeBg || "bg-gray-100 text-gray-800 border-gray-200";
}

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
  const [copiedValue, setCopiedValue] = useState<string | null>(null);

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

  function copyToClipboard(val: string) {
    navigator.clipboard.writeText(val);
    setCopiedValue(val);
    toast("Copied to clipboard");
    setTimeout(() => setCopiedValue(null), 2000);
  }

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
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header & Navigation */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              to={`/domains/${id}`}
              className="inline-flex items-center text-xs font-semibold text-gray-600 hover:text-gray-900 transition-colors bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-2xs"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Domain
            </Link>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2.5 pt-1">
            <Globe className="w-7 h-7 text-gray-800" />
            DNS Management
          </h1>
          <p className="text-sm text-gray-500">
            Configure A, CNAME, MX, TXT, and other DNS records for your domain.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button variant="outline" onClick={fetchAllRecords} disabled={loading} className="shadow-2xs text-xs sm:text-sm !py-2.5">
            <RefreshCw className={`w-4 h-4 mr-1.5 inline ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            onClick={() => { setForm({ type: "a", hostname: "", value: "", ttl: 3600 }); setAddOpen(true); }}
            className="shadow-sm bg-black hover:bg-gray-800 text-white text-xs sm:text-sm !py-2.5"
          >
            <Plus className="w-4 h-4 inline mr-1.5" /> Add Record
          </Button>
        </div>
      </div>

      {/* Main Records Container */}
      <Card className="p-0 overflow-hidden border border-gray-200/80 shadow-xs rounded-2xl">
        {/* Header Controls: Filter & Count Bar */}
        <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white rounded-lg border border-gray-200 shadow-2xs">
              <Filter className="w-4 h-4 text-gray-600" />
            </div>
            <span className="text-sm font-semibold text-gray-800">Filter Record Type:</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3.5 py-2 border border-gray-200 rounded-lg text-sm bg-white font-semibold text-gray-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black"
            >
              <option value="all">All Types ({records.length})</option>
              {RECORD_TYPES.map((t) => {
                const count = records.filter((r) => r.type === t.value).length;
                return (
                  <option key={t.value} value={t.value}>
                    {t.label.split(" - ")[0]} ({count})
                  </option>
                );
              })}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs sm:text-sm font-medium bg-gray-100 text-gray-700 border border-gray-200/60">
              Showing {filteredRecords.length} of {records.length} record(s)
            </span>
          </div>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <LoadingSpinner size="md" />
            <span className="text-sm text-gray-500 font-medium">Fetching DNS records from Resellercamp...</span>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="text-center py-20 px-4 space-y-3">
            <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto text-gray-400">
              <Globe className="w-6 h-6" />
            </div>
            <p className="text-base font-semibold text-gray-800">
              {filterType === "all" ? "No DNS Records Found" : `No ${filterType.toUpperCase()} Records`}
            </p>
            <p className="text-sm text-gray-500 max-w-sm mx-auto">
              {filterType === "all"
                ? "This domain doesn't have any configured DNS records yet. Click 'Add Record' above to create one."
                : `There are currently no ${filterType.toUpperCase()} records added. Select 'All Types' or add a new record.`}
            </p>
            <Button
              variant="outline"
              onClick={() => { setForm({ type: filterType === "all" ? "a" : filterType, hostname: "", value: "", ttl: 3600 }); setAddOpen(true); }}
              className="mt-2 text-xs sm:text-sm"
            >
              <Plus className="w-4 h-4 mr-1 inline" /> Add {filterType === "all" ? "DNS" : filterType.toUpperCase()} Record
            </Button>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/60 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    <th className="px-5 py-4 w-32">Type</th>
                    <th className="px-5 py-4">Hostname</th>
                    <th className="px-5 py-4">Value</th>
                    <th className="px-5 py-4 w-32">TTL</th>
                    <th className="px-5 py-4 text-right w-44">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100/80 text-sm">
                  {filteredRecords.map((r, i) => (
                    <tr key={i} className="hover:bg-gray-50/70 transition-colors group">
                      {/* Type Badge */}
                      <td className="px-5 py-4 align-middle">
                        <span className={`inline-flex items-center justify-center px-3 py-1 font-bold text-xs uppercase rounded-md border shadow-2xs ${getBadgeStyle(r.type)}`}>
                          {r.type}
                        </span>
                      </td>

                      {/* Hostname */}
                      <td className="px-5 py-4 align-middle font-semibold text-gray-900 text-sm">
                        {r.hostname}
                      </td>

                      {/* Value with copy button */}
                      <td className="px-5 py-4 align-middle text-sm text-gray-800 break-all max-w-md">
                        <div className="flex items-center gap-2 group/val">
                          <span className="truncate">{r.value}</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(r.value)}
                            className="opacity-0 group-hover/val:opacity-100 p-1 hover:bg-gray-200/60 rounded text-gray-400 hover:text-gray-700 transition-all shrink-0"
                            title="Copy value"
                          >
                            {copiedValue === r.value ? (
                              <Check className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* TTL */}
                      <td className="px-5 py-4 align-middle text-sm text-gray-600">
                        <span className="inline-flex items-center px-2.5 py-1 bg-gray-100 rounded-md text-xs text-gray-700 font-semibold">
                          {r.ttl}s
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 align-middle text-right">
                        <div className="flex items-center justify-end gap-2 opacity-90 group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => openEdit(r)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-700 hover:text-black bg-white hover:bg-gray-50 border border-gray-200 rounded-lg shadow-2xs transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-gray-500" /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteRecord(r)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-600 hover:text-red-700 bg-red-50/60 hover:bg-red-50 border border-red-100 rounded-lg shadow-2xs transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-500" /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View */}
            <div className="md:hidden divide-y divide-gray-100 p-3 space-y-3">
              {filteredRecords.map((r, i) => (
                <div key={i} className="rounded-xl border border-gray-200 bg-white p-4 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 font-mono font-bold text-xs uppercase rounded border ${getBadgeStyle(r.type)}`}>
                        {r.type}
                      </span>
                      <span className="text-xs font-mono font-bold text-gray-900 truncate max-w-[160px]">
                        {r.hostname}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-400 font-mono bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                      TTL: {r.ttl}s
                    </span>
                  </div>

                  <div className="relative group bg-gray-50 p-2.5 rounded-lg border border-gray-100 font-mono text-xs text-gray-700 break-all">
                    {r.value}
                  </div>

                  <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                    <Button
                      variant="outline"
                      onClick={() => openEdit(r)}
                      className="flex-1 !py-1.5 !text-xs !font-semibold text-gray-700 border-gray-200"
                    >
                      <Edit2 className="w-3.5 h-3.5 mr-1.5 inline text-gray-500" /> Edit
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => deleteRecord(r)}
                      className="!py-1.5 !text-xs !font-semibold"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1.5 inline" /> Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* Add Record Modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add New DNS Record">
        <div className="space-y-4 pt-1">
          <div>
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center justify-between">
              <span>Record Type</span>
            </label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black bg-white mt-1 font-semibold text-gray-900 shadow-2xs"
            >
              {RECORD_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            {selectedHelp && (
              <div className="flex items-start gap-1.5 mt-1.5 text-[11px] text-gray-500 bg-gray-50 p-2 rounded-lg border border-gray-100">
                <Info className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                <span>{selectedHelp}</span>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Hostname</label>
            <input
              value={form.hostname}
              onChange={(e) => setForm({ ...form, hostname: e.target.value })}
              className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black font-mono mt-1 text-gray-900 shadow-2xs"
              placeholder="@ or subdomain (e.g. www)"
            />
            <p className="text-[11px] text-gray-400 mt-1">Use @ for root domain, or enter subdomain prefix</p>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Value / Destination</label>
            <input
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
              className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black font-mono mt-1 text-gray-900 shadow-2xs"
              placeholder={form.type === "a" ? "192.168.1.1" : form.type === "cname" ? "example.com" : "Value"}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">TTL (Time to Live)</label>
            <select
              value={form.ttl}
              onChange={(e) => setForm({ ...form, ttl: Number(e.target.value) })}
              className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black bg-white mt-1 font-medium text-gray-800 shadow-2xs"
            >
              <option value={3600}>3600 (1 Hour - Default)</option>
              <option value={14400}>14400 (4 Hours)</option>
              <option value={86400}>86400 (24 Hours)</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
            <Button variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={addRecord} disabled={submitting} className="bg-black hover:bg-gray-800 text-white">
              {submitting ? "Saving..." : "Save Record"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Record Modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit DNS Record">
        <div className="space-y-4 pt-1">
          <div>
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Record Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black bg-white mt-1 font-semibold text-gray-900 shadow-2xs"
            >
              {RECORD_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Hostname</label>
            <input
              value={form.hostname}
              onChange={(e) => setForm({ ...form, hostname: e.target.value })}
              className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black font-mono mt-1 text-gray-900 shadow-2xs"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Value / Destination</label>
            <input
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
              className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black font-mono mt-1 text-gray-900 shadow-2xs"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">TTL (Time to Live)</label>
            <select
              value={form.ttl}
              onChange={(e) => setForm({ ...form, ttl: Number(e.target.value) })}
              className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black bg-white mt-1 font-medium text-gray-800 shadow-2xs"
            >
              <option value={3600}>3600 (1 Hour - Default)</option>
              <option value={14400}>14400 (4 Hours)</option>
              <option value={86400}>86400 (24 Hours)</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
            <Button variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={updateRecord} disabled={submitting} className="bg-black hover:bg-gray-800 text-white">
              {submitting ? "Updating..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
