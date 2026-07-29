import { useState, useEffect } from "react";
import { Plus, RefreshCw, User, Pencil, Trash2 } from "lucide-react";
import { Card, Button, LoadingSpinner, EmptyState, Modal, ConfirmDialog, toast, TurnstileWidget, WaBadge } from "../components/ui";
import { api } from "../lib/api";
import type { Customer } from "../lib/types";

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
  const [modalOpen, setModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editId, setEditId] = useState(0);
  const [form, setForm] = useState(defaultForm);
  const [cfTurnstileToken, setCfTurnstileToken] = useState("");
  const [deleteId, setDeleteId] = useState(0);
  const [deleteName, setDeleteName] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);

  async function doSync() {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await api.post<any>("/customers/sync");
      toast(`${res.synced || 0} new customers synced from LIQUID`);
      const list = await api.get<any>("/customers");
      setCustomers(list.data);
    } catch (e: any) { toast(e.message, "error"); }
    setSyncing(false);
  }

  useEffect(() => {
    const controller = new AbortController();
    api.get<any>("/customers", { signal: controller.signal })
      .then((res) => setCustomers(res.data))
      .catch((err) => { if (err.name !== "AbortError") console.error(err); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  async function save() {
    if (saving) return;
    if (!form.name.trim() || !form.email.trim()) {
      toast("Name and Email are required", "error");
      return;
    }

    setSaving(true);
    const payload = {
      ...form,
      state: form.state.trim() || "Not Applicable",
      cfTurnstileResponse: cfTurnstileToken,
    };
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
      setCfTurnstileToken("");
      const res = await api.get<any>("/customers");
      setCustomers(res.data);
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function doDelete() {
    setDeleteLoading(true);
    try {
      await api.delete(`/customers/${deleteId}`);
      toast("Customer deleted");
      const res = await api.get<any>("/customers");
      setCustomers(res.data);
    } catch (e: any) { toast(e.message, "error"); }
    setDeleteLoading(false);
    setDeleteId(0);
  }

  function openEdit(c: Customer) {
    setEditMode(true);
    setEditId(c.id);
    setForm({
      name: c.name || "",
      email: c.email || "",
      company: c.company || "",
      address: c.address || "",
      city: c.city || "",
      state: c.state === "Not Applicable" ? "" : (c.state || ""),
      country: c.country || "ID",
      zipcode: c.zipcode || "",
      phone: c.phone || "",
    });
    setModalOpen(true);
  }

  function openCreate() {
    setEditMode(false);
    setForm(defaultForm);
    setModalOpen(true);
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Customers</h1>
          <p className="text-xs text-gray-500 mt-0.5">Kelola akun customer Anda. Setiap customer baru otomatis terhubung ke Resellercamp via Liquid API.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={doSync} disabled={syncing}>
            <RefreshCw className={`w-3.5 h-3.5 inline mr-1 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Sync..." : "Sync"}
          </Button>
          <Button onClick={openCreate}><Plus className="w-3.5 h-3.5 inline mr-1" /> Tambah</Button>
        </div>
      </div>

      {customers.length === 0 ? (
        <EmptyState icon={User} title="No customers yet" description="Add your first customer to start registering domains" action={{ label: "Add Customer", onClick: openCreate }} />
      ) : (
        <Card className="p-0">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer / Company</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Phone</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Location</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-xs text-gray-900 font-bold">{c.name}</p>
                      {c.company && <p className="text-[11px] text-gray-500">{c.company}</p>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 font-mono">{c.email}</td>
                    <td className="px-4 py-3 text-xs text-gray-600 font-mono">{c.phone || "-"}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {[c.city, c.country].filter(Boolean).join(", ") || c.country}
                    </td>
                    <td className="px-4 py-3 text-right space-x-1">
                      <button onClick={() => openEdit(c)} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-700 hover:text-black hover:bg-gray-100 rounded-lg font-semibold transition-colors"><Pencil className="w-3 h-3" /> Edit</button>
                      <button onClick={() => { setDeleteId(c.id); setDeleteName(c.name); }} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg font-semibold transition-colors"><Trash2 className="w-3 h-3" /> Hapus</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="block md:hidden space-y-3 pb-4">
            {customers.map((c) => (
              <div key={c.id} className="rounded-xl p-3 shadow-sm border bg-white space-y-1.5">
                <div className="flex justify-between items-start">
                  <p className="text-sm font-bold text-gray-900">{c.name}</p>
                  <span className="text-[10px] font-bold uppercase bg-gray-100 px-2 py-0.5 rounded text-gray-600 shrink-0 ml-2">{c.country}</span>
                </div>
                {c.company && <p className="text-xs text-gray-500">{c.company}</p>}
                <p className="text-xs text-gray-600 font-mono truncate">{c.email}</p>
                {c.phone && <p className="text-xs text-gray-500 font-mono">{c.phone}</p>}
                <div className="pt-1 flex gap-2">
                  <button onClick={() => openEdit(c)} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"><Pencil className="w-3.5 h-3.5" /> Edit</button>
                  <button onClick={() => { setDeleteId(c.id); setDeleteName(c.name); }} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5" /> Hapus</button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Complete Customer Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editMode ? "Edit Customer" : "Add Customer"} size="2xl">
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1">Nama Lengkap *</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="John Doe"
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black bg-white"
                required
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1">Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="john.doe@example.com"
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black bg-white"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1">Perusahaan / Organisasi</label>
              <input
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                placeholder="PT Contoh Perusahaan (atau N/A)"
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black bg-white"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1">No. Telepon / HP</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="081234567890"
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black bg-white"
              />
              <div className="mt-1"><WaBadge phone={form.phone} /></div>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1">Alamat Jalan</label>
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Jl. Contoh No. 123"
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black bg-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1">Kota</label>
              <input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="Jakarta"
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black bg-white"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1">Provinsi</label>
              <input
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                placeholder="DKI Jakarta (atau kosongkan)"
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1">Kode Pos</label>
              <input
                value={form.zipcode}
                onChange={(e) => setForm({ ...form, zipcode: e.target.value })}
                placeholder="12345"
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black bg-white"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1">Negara (ISO 2-letter)</label>
              <input
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })}
                placeholder="ID"
                maxLength={2}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black uppercase bg-white"
              />
            </div>
          </div>

          <TurnstileWidget onVerify={(token) => setCfTurnstileToken(token)} />

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving..." : (editMode ? "Update Contact" : "Save Contact")}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={deleteId > 0} title="Delete Customer Contact" message={`Delete ${deleteName}? This cannot be undone.`} onConfirm={doDelete} onClose={() => setDeleteId(0)} loading={deleteLoading} />
    </div>
  );
}
