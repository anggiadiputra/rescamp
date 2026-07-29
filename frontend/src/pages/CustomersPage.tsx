import { useState, useEffect } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { Card, Button, LoadingSpinner, EmptyState, Modal, ConfirmDialog, toast } from "../components/ui";
import { api } from "../lib/api";
import type { Customer } from "../lib/types";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editId, setEditId] = useState(0);
  const [form, setForm] = useState({ name: "", email: "", country: "ID", phone: "" });
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
    setSaving(true);
    try {
      if (editMode) {
        await api.put(`/customers/${editId}`, form);
        toast("Customer updated");
      } else {
        await api.post("/customers", form);
        toast("Customer created");
      }
      setModalOpen(false);
      setEditMode(false);
      setForm({ name: "", email: "", country: "ID", phone: "" });
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
    setForm({ name: c.name, email: c.email, country: c.country, phone: c.phone || "" });
    setModalOpen(true);
  }

  function openCreate() {
    setEditMode(false);
    setForm({ name: "", email: "", country: "ID", phone: "" });
    setModalOpen(true);
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Customers</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={doSync} disabled={syncing}>
            <RefreshCw className={`w-3.5 h-3.5 inline mr-1 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Sync from LIQUID"}
          </Button>
          <Button onClick={openCreate}><Plus className="w-3.5 h-3.5 inline mr-1" /> Add Customer</Button>
        </div>
      </div>

      {customers.length === 0 ? (
        <EmptyState icon={Plus} title="No customers yet" description="Add your first customer contact" action={{ label: "Add Customer", onClick: () => setModalOpen(true) }} />
      ) : (
        <Card className="p-0">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Country</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-800 font-semibold">{c.name}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{c.email}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{c.country}</td>
                    <td className="px-4 py-3 text-right space-x-1">
                      <button onClick={() => openEdit(c)} className="text-xs text-gray-500 hover:text-black font-semibold">Edit</button>
                      <button onClick={() => { setDeleteId(c.id); setDeleteName(c.name); }} className="text-xs text-red-500 hover:text-red-700 font-semibold">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="block md:hidden divide-y divide-gray-100 p-4 space-y-4">
            {customers.map((c) => (
              <div key={c.id} className="rounded-xl p-4 shadow-sm border bg-white">
                <p className="text-sm font-bold text-gray-900">{c.name}</p>
                <p className="text-xs text-gray-500">{c.email} &middot; {c.country}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editMode ? "Edit Customer" : "Add Customer"}>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black" required />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black" required />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving..." : (editMode ? "Update" : "Save")}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={deleteId > 0} title="Delete Customer" message={`Delete ${deleteName}? This cannot be undone.`} onConfirm={doDelete} onClose={() => setDeleteId(0)} loading={deleteLoading} />
    </div>
  );
}
