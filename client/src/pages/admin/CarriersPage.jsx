import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { getCarriers, createCarrier, updateCarrier, deleteCarrier } from '../../api/carriers';

function CarrierFormModal({ carrier, onClose, onSuccess }) {
  const isEdit = !!carrier;
  const [form, setForm] = useState({
    name: carrier?.name || '',
    kvk_number: carrier?.kvk_number || '',
    contact_name: carrier?.contact_name || '',
    contact_email: carrier?.contact_email || '',
    contact_phone: carrier?.contact_phone || '',
    licence_number: carrier?.licence_number || '',
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
        await updateCarrier(carrier.id, form);
        toast.success('Carrier updated');
      } else {
        await createCarrier(form);
        toast.success('Carrier created');
      }
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save carrier');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-overlay/50">
      <div className="bg-surface rounded-2xl border border-border shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">
            {isEdit ? 'Edit Carrier' : 'New Carrier'}
          </h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted transition text-text-tertiary">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Name</label>
            <input name="name" value={form.name} onChange={handleChange} required
              className="w-full px-3 py-2.5 rounded-lg border border-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition" />
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
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Contact Phone</label>
            <input name="contact_phone" value={form.contact_phone} onChange={handleChange}
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

export default function CarriersPage() {
  const [carriers, setCarriers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editCarrier, setEditCarrier] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getCarriers({ limit: 100, search: search || undefined });
      setCarriers(data.data);
    } catch {
      toast.error('Failed to load carriers');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(fetchData, 300);
    return () => clearTimeout(timer);
  }, [fetchData]);

  async function handleDelete(id) {
    if (!window.confirm('Deactivate this carrier?')) return;
    try {
      await deleteCarrier(id);
      toast.success('Carrier deactivated');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to deactivate carrier');
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-h-xs font-bold text-foreground">Carriers</h1>
        <button onClick={() => { setEditCarrier(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:bg-primary-hover transition">
          <Plus size={16} /> Add Carrier
        </button>
      </div>

      <div className="relative max-w-xs mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-placeholder" />
        <input type="text" placeholder="Search carriers..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-input text-sm text-foreground placeholder-text-placeholder focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition" />
      </div>

      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted">
              <th className="text-left px-4 py-3 font-medium text-text-secondary">Name</th>
              <th className="text-left px-4 py-3 font-medium text-text-secondary">KVK</th>
              <th className="text-left px-4 py-3 font-medium text-text-secondary">Contact</th>
              <th className="text-left px-4 py-3 font-medium text-text-secondary">Status</th>
              <th className="text-right px-4 py-3 font-medium text-text-secondary">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-text-placeholder">Loading...</td></tr>
            ) : carriers.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-text-placeholder">No carriers found</td></tr>
            ) : carriers.map((c) => (
              <tr key={c.id} className="hover:bg-muted transition">
                <td className="px-4 py-3 font-medium text-foreground">{c.name}</td>
                <td className="px-4 py-3 text-text-secondary">{c.kvk_number || '—'}</td>
                <td className="px-4 py-3 text-text-secondary">{c.contact_email || c.contact_name || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-grey-100 text-grey-500'}`}>
                    {c.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => { setEditCarrier(c); setShowModal(true); }}
                    className="p-1.5 rounded-md hover:bg-muted transition text-text-tertiary hover:text-foreground"><Pencil size={15} /></button>
                  {c.is_active && (
                    <button onClick={() => handleDelete(c.id)}
                      className="p-1.5 rounded-md hover:bg-muted transition text-text-tertiary hover:text-red-600 ml-1"><Trash2 size={15} /></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <CarrierFormModal
          carrier={editCarrier}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); fetchData(); }}
        />
      )}
    </div>
  );
}
