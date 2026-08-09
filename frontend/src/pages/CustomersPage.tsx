import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Plus, RefreshCw, User, Pencil, Trash2, Mail, Phone, Building2, MapPin, Globe, Calendar, ExternalLink } from "lucide-react";
import { Card, Button, LoadingSpinner, EmptyState, Modal, ConfirmDialog, SearchBar, Pagination, toast } from "../components/ui";
import { api } from "../lib/api";
import type { Customer, PaginatedResponse } from "../lib/types";

const defaultForm = {
  name: "",
  email: "",
  company: "",
  address: "",
  city: "",
  state: "",
  country: "ID",
  zipcode: "",
  phone: "",
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const perPage = 10;
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [overviewId, setOverviewId] = useState<number | null>(null);

  // Form modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editId, setEditId] = useState(0);
  const [form, setForm] = useState(defaultForm);
  const [deleteId, setDeleteId] = useState(0);
  const [deleteName, setDeleteName] = useState("");

  async function fetchCustomers() {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), per_page: String(perPage) });
    try {
      const res = await api.get<PaginatedResponse<Customer>>(`/customers/remote?${params}`);
      setCustomers(res.data || []);
      setTotal(res.meta?.total || 0);
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error(err);
        toast(err?.message || "Gagal memuat customer dari Resellercamp", "error");
      }
    }
    setLoading(false);
  }

  // Client-side filter for live Resellercamp data (server has no search param).
  const visibleCustomers = customers.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (c.name || "").toLowerCase().includes(q) ||
      (c.email || "").toLowerCase().includes(q) ||
      (c.company || "").toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    fetchCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  async function save() {
    if (saving) return;
    if (!form.name.trim() || !form.email.trim()) {
      toast("Name and Email are required", "error");
      return;
    }
    setSaving(true);
    const payload = { ...form, state: form.state.trim() || "Not Applicable" };
    try {
      if (editMode) {
        await api.put(`/customers/${editId}`, payload);
        toast("Customer updated successfully");
      } else {
        await api.post("/customers", payload);
        toast("Customer created & linked to Resellercamp");
      }
      setModalOpen(false);
      setEditMode(false);
      setForm(defaultForm);
      fetchCustomers();
    } catch (e: any) { toast(e.message, "error"); }
    setSaving(false);
  }

  async function doDelete() {
    toast("Delete belum didukung di mode live Resellercamp — edit di dashboard Resellercamp", "info");
  }

  function openEdit(c: Customer) {
    setEditId(c.id);
    toast(`Edit untuk ${c.name} belum didukung di mode live Resellercamp — edit di dashboard Resellercamp`, "info");
  }

  function openCreate() {
    setEditMode(false);
    setForm(defaultForm);
    setModalOpen(true);
  }

  const overviewCustomer = overviewId ? customers.find((c) => c.id === overviewId) || null : null;

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Customers</h1>
        <p className="text-sm text-gray-500 mt-1">Daftar customer yang terhubung dengan akun Anda.</p>
      </div>

      {/* Search & Action Bar */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <SearchBar value={search} onChange={setSearch} placeholder="Cari customer berdasarkan nama, email, perusahaan..." />
        <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
          <Button variant="outline" onClick={() => fetchCustomers()} disabled={loading} className="shadow-2xs text-xs sm:text-sm !py-2.5">
            <RefreshCw className={`w-4 h-4 inline mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={openCreate} className="bg-black hover:bg-gray-800 text-white text-xs sm:text-sm !py-2.5 shadow-sm">
            <Plus className="w-4 h-4 inline mr-1.5" /> Tambah Customer
          </Button>
        </div>
      </div>

      {visibleCustomers.length === 0 && !search ? (
          <EmptyState icon={User} title="Belum Ada Customer" description="Belum ada customer yang terhubung dengan akun Anda" />
      ) : visibleCustomers.length === 0 && search ? (
        <EmptyState icon={User} title="Customer Tidak Ditemukan" description="Coba gunakan kata kunci pencarian yang berbeda" />
      ) : (
        <Card className="p-0 overflow-hidden border border-gray-200/80 shadow-xs rounded-2xl">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/70 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  <th className="px-5 py-4">Customer / Company</th>
                  <th className="px-5 py-4">Email</th>
                  <th className="px-5 py-4">Phone</th>
                  <th className="px-5 py-4">Location</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {visibleCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/70 transition-colors cursor-pointer group" onClick={() => setOverviewId(c.id)}>
                    <td className="px-5 py-4">
                      <p className="text-sm text-gray-900 font-bold group-hover:text-black">{c.name}</p>
                      {c.company && <p className="text-xs text-gray-500 font-medium">{c.company}</p>}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-700 font-medium">{c.email}</td>
                    <td className="px-5 py-4 text-sm text-gray-700 font-medium">{c.phone || "-"}</td>
                    <td className="px-5 py-4 text-sm text-gray-600">
                      {[c.city, c.country].filter(Boolean).join(", ") || c.country}
                    </td>
                    <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(c)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-700 hover:text-black bg-white hover:bg-gray-50 border border-gray-200 rounded-lg shadow-2xs transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5 text-gray-500" /> Edit
                        </button>
                        <button
                          onClick={() => { setDeleteId(c.id); setDeleteName(c.name); }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-600 hover:text-red-700 bg-red-50/60 hover:bg-red-50 border border-red-100 rounded-lg shadow-2xs transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-500" /> Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="block md:hidden space-y-3 p-4">
            {visibleCustomers.map((c) => (
              <div key={c.id} className="rounded-xl p-4 shadow-2xs border border-gray-200 bg-white space-y-2 cursor-pointer hover:border-gray-300 transition-colors" onClick={() => setOverviewId(c.id)}>
                <div className="flex justify-between items-start">
                  <p className="text-base font-bold text-gray-900">{c.name}</p>
                  <span className="text-xs font-bold uppercase bg-gray-100 px-2.5 py-1 rounded text-gray-700 shrink-0 ml-2 border border-gray-200">{c.country}</span>
                </div>
                {c.company && <p className="text-xs font-semibold text-gray-500">{c.company}</p>}
                <p className="text-sm text-gray-700 truncate font-medium">{c.email}</p>
                {c.phone && <p className="text-xs text-gray-500 font-medium">{c.phone}</p>}
                <div className="pt-2 flex gap-2 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => openEdit(c)} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg shadow-2xs transition-colors"><Pencil className="w-3.5 h-3.5 text-gray-500" /> Edit</button>
                  <button onClick={() => { setDeleteId(c.id); setDeleteName(c.name); }} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-red-600 bg-red-50/60 border border-red-100 hover:bg-red-50 rounded-lg shadow-2xs transition-colors"><Trash2 className="w-3.5 h-3.5 text-red-500" /> Hapus</button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {total > perPage && (
            <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 bg-gray-50">
              <span className="text-xs sm:text-sm text-gray-600 font-medium">
                Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of {total}
              </span>
              <Pagination page={page} totalPages={Math.ceil(total / perPage)} onPage={setPage} />
            </div>
          )}
        </Card>
      )}

      {/* Customer Overview Modal */}
      <Modal open={overviewId !== null} onClose={() => setOverviewId(null)} title="Customer Overview" size="lg">
        {overviewCustomer ? (
          <div className="space-y-5">
            {/* Identity */}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center shrink-0">
                <User className="w-5.5 h-5.5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">{overviewCustomer.name}</h3>
                {overviewCustomer.company && <p className="text-xs text-gray-500">{overviewCustomer.company}</p>}
              </div>
            </div>

            {/* Detail fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                <div>
                  <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Email</p>
                  <p className="text-xs font-semibold text-gray-800 font-mono">{overviewCustomer.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                <div>
                  <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Phone</p>
                  <p className="text-xs font-semibold text-gray-800 font-mono">{overviewCustomer.phone || "-"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
                <div>
                  <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Company</p>
                  <p className="text-xs font-semibold text-gray-800">{overviewCustomer.company || "-"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                <div>
                  <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Location</p>
                  <p className="text-xs font-semibold text-gray-800">
                    {[overviewCustomer.address, overviewCustomer.city, overviewCustomer.state, overviewCustomer.country, overviewCustomer.zipcode].filter(Boolean).join(", ") || "-"}
                  </p>
                </div>
              </div>
              {overviewCustomer.liquidCustomerId && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <Globe className="w-4 h-4 text-gray-400 shrink-0" />
                  <div>
                    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Customer ID</p>
                    <p className="text-xs font-semibold text-gray-800 font-mono">{overviewCustomer.liquidCustomerId}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                <div>
                  <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Created</p>
                  <p className="text-xs font-semibold text-gray-800">{new Date(overviewCustomer.createdAt).toLocaleDateString("id-ID", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
              <Button variant="secondary" onClick={() => { setOverviewId(null); openEdit(overviewCustomer); }}>
                <Pencil className="w-3.5 h-3.5 inline mr-1" /> Edit
              </Button>
              <Button variant="danger" onClick={() => { setDeleteId(overviewCustomer.id); setDeleteName(overviewCustomer.name); }}>
                <Trash2 className="w-3.5 h-3.5 inline mr-1" /> Hapus
              </Button>
              <Link to={`/domains?customerId=${overviewCustomer.id}`} className="ml-auto">
                <Button variant="primary" onClick={() => setOverviewId(null)}>
                  <ExternalLink className="w-3.5 h-3.5 inline mr-1" /> Lihat Domain
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">Customer not found</p>
          </div>
        )}
      </Modal>

      {/* Add/Edit Customer Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editMode ? "Edit Customer" : "Add Customer"} size="2xl">
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1">Nama Lengkap *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="John Doe" className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black bg-white" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1">Email *</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="john.doe@example.com" className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black bg-white" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1">Perusahaan / Organisasi</label>
              <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="PT Contoh Perusahaan" className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black bg-white" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1">No. Telepon / HP</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="081234567890" className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black bg-white" />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1">Alamat Jalan</label>
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Jl. Contoh No. 123" className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black bg-white" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1">Kota</label>
              <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Jakarta" className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black bg-white" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1">Provinsi</label>
              <input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="DKI Jakarta" className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black bg-white" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1">Kode Pos</label>
              <input value={form.zipcode} onChange={(e) => setForm({ ...form, zipcode: e.target.value })} placeholder="12345" className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black bg-white" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1">Negara (ISO 2-letter)</label>
              <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })} placeholder="ID" maxLength={2} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black uppercase bg-white" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving..." : (editMode ? "Update Contact" : "Save Contact")}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={deleteId > 0} title="Delete Customer Contact" message={`Delete ${deleteName}? This cannot be undone.`} onConfirm={doDelete} onClose={() => setDeleteId(0)} />
    </div>
  );
}