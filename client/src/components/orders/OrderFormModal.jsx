import { useState } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import useMasterDataStore from '../../store/masterDataStore';
import { createOrder, updateOrder } from '../../api/orders';

export default function OrderFormModal({ order, onClose, onSuccess }) {
  const { carriers, suppliers, wasteStreams } = useMasterDataStore();
  const isEdit = !!order;

  const [form, setForm] = useState({
    carrier_id: order?.carrier_id || '',
    supplier_id: order?.supplier_id || '',
    waste_stream_id: order?.waste_stream_id || '',
    planned_date: order?.planned_date ? new Date(order.planned_date).toISOString().split('T')[0] : '',
    expected_skip_count: order?.expected_skip_count || 1,
    notes: order?.notes || '',
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
        await updateOrder(order.id, form);
        toast.success('Order updated');
      } else {
        await createOrder(form);
        toast.success('Order created');
      }
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save order');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-overlay/50">
      <div className="bg-surface rounded-2xl border border-border shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">
            {isEdit ? 'Edit Order' : 'New Order'}
          </h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted transition">
            <X size={18} className="text-text-tertiary" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Carrier</label>
            <select
              name="carrier_id"
              value={form.carrier_id}
              onChange={handleChange}
              required
              className="w-full px-3 py-2.5 rounded-lg border border-input text-sm text-foreground bg-surface focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition"
            >
              <option value="">Select carrier...</option>
              {carriers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Supplier</label>
            <select
              name="supplier_id"
              value={form.supplier_id}
              onChange={handleChange}
              required
              className="w-full px-3 py-2.5 rounded-lg border border-input text-sm text-foreground bg-surface focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition"
            >
              <option value="">Select supplier...</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Waste Stream</label>
            <select
              name="waste_stream_id"
              value={form.waste_stream_id}
              onChange={handleChange}
              required
              className="w-full px-3 py-2.5 rounded-lg border border-input text-sm text-foreground bg-surface focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition"
            >
              <option value="">Select waste stream...</option>
              {wasteStreams.map((ws) => (
                <option key={ws.id} value={ws.id}>{ws.name_en} ({ws.code})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Planned Date</label>
              <input
                type="date"
                name="planned_date"
                value={form.planned_date}
                onChange={handleChange}
                required
                className="w-full px-3 py-2.5 rounded-lg border border-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Expected Skips</label>
              <input
                type="number"
                name="expected_skip_count"
                value={form.expected_skip_count}
                onChange={handleChange}
                min={1}
                className="w-full px-3 py-2.5 rounded-lg border border-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Notes</label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={3}
              placeholder="Optional notes (e.g. license plate)..."
              className="w-full px-3 py-2.5 rounded-lg border border-input text-sm text-foreground placeholder-text-placeholder focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-foreground rounded-lg hover:bg-muted transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:bg-primary-hover disabled:opacity-50 transition"
            >
              {submitting ? 'Saving...' : isEdit ? 'Update Order' : 'Create Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
