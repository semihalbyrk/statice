import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier } from '../../api/suppliers';

const SUPPLIER_TYPES = ['PRIVATE_INDIVIDUAL', 'PRO', 'THIRD_PARTY'];
const TYPE_LABELS = { PRIVATE_INDIVIDUAL: 'Private', PRO: 'PRO', THIRD_PARTY: 'Third Party' };

function SupplierFormModal({ supplier, onClose, onSuccess }) {
  const isEdit = !!supplier;
  const [form, setForm] = useState({
    name: supplier?.name || '',
    supplier_type: supplier?.supplier_type || '',
    kvk_number: supplier?.kvk_number || '',
    contact_name: supplier?.contact_name || '',
    contact_email: supplier?.contact_email || '',
  });
  const [submitting, setSubmitting] = useState(false);

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isEdit) {
        await updateSupplier(supplier.id, form);
        toast.success('Supplier updated');
      } else {
        await createSupplier(form);
        toast.success('Supplier created');
      }
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save supplier');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-overlay/50">
      <div className="bg-surface rounded-2xl border border-border shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">{isEdit ? 'Edit Supplier' : 'New Supplier'}</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted transition text-text-tertiary">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Name</label>
            <input name="name" value={form.name} onChange={handleChange} required
              className="w-full px-3 py-2.5 rounded-lg border border-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition" />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Type</label>
            <select name="supplier_type" value={form.supplier_type} onChange={handleChange} required
              className="w-full px-3 py-2.5 rounded-lg border border-input text-sm text-foreground bg-surface focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition">
              <option value="">Select type...</option>
              {SUPPLIER_TYPES.map((t) => (
                <option key={t} value={t}>{TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">KVK Number</label>
            <input name="kvk_number" value={form.kvk_number} onChange={handleChange}
              className="w-full px-3 py-2.5 rounded-lg border border-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition" />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Contact Name</label>
            <input name="contact_name" value={form.contact_name} onChange={handleChange}
              className="w-full px-3 py-2.5 rounded-lg border border-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition" />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Contact Email</label>
            <input name="contact_email" type="email" value={form.contact_email} onChange={handleChange}
              className="w-full px-3 py-2.5 rounded-lg border border-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-foreground rounded-lg hover:bg-muted transition">Cancel</button>
            <button type="submit" disabled={submitting}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:bg-primary-hover disabled:opacity-50 transition">
              {submitting ? 'Saving...' : isEdit ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editSupplier, setEditSupplier] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getSuppliers({ limit: 100, search: search || undefined });
      setSuppliers(data.data);
    } catch {
      toast.error('Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(fetchData, 300);
    return () => clearTimeout(timer);
  }, [fetchData]);

  async function handleDelete(id) {
    if (!window.confirm('Deactivate this supplier?')) return;
    try {
      await deleteSupplier(id);
      toast.success('Supplier deactivated');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to deactivate supplier');
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-h-xs font-bold text-foreground">Suppliers</h1>
        <button onClick={() => { setEditSupplier(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:bg-primary-hover transition">
          <Plus size={16} /> Add Supplier
        </button>
      </div>

      <div className="relative max-w-xs mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-placeholder" />
        <input type="text" placeholder="Search suppliers..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-input text-sm text-foreground placeholder-text-placeholder focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition" />
      </div>

      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted">
              <th className="text-left px-4 py-3 font-medium text-text-secondary">Name</th>
              <th className="text-left px-4 py-3 font-medium text-text-secondary">Type</th>
              <th className="text-left px-4 py-3 font-medium text-text-secondary">KVK</th>
              <th className="text-left px-4 py-3 font-medium text-text-secondary">Status</th>
              <th className="text-right px-4 py-3 font-medium text-text-secondary">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-text-placeholder">Loading...</td></tr>
            ) : suppliers.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-text-placeholder">No suppliers found</td></tr>
            ) : suppliers.map((s) => (
              <tr key={s.id} className="hover:bg-muted transition">
                <td className="px-4 py-3 font-medium text-foreground">{s.name}</td>
                <td className="px-4 py-3 text-text-secondary">{TYPE_LABELS[s.supplier_type] || s.supplier_type}</td>
                <td className="px-4 py-3 text-text-secondary">{s.kvk_number || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-grey-100 text-grey-500'}`}>
                    {s.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => { setEditSupplier(s); setShowModal(true); }}
                    className="p-1.5 rounded-md hover:bg-muted transition text-text-tertiary hover:text-foreground"><Pencil size={15} /></button>
                  {s.is_active && (
                    <button onClick={() => handleDelete(s.id)}
                      className="p-1.5 rounded-md hover:bg-muted transition text-text-tertiary hover:text-red-600 ml-1"><Trash2 size={15} /></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <SupplierFormModal
          supplier={editSupplier}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); fetchData(); }}
        />
      )}
    </div>
  );
}
