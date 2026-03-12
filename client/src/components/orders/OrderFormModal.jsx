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
    vehicle_plate: order?.vehicle_plate || '',
    afvalstroomnummer: order?.afvalstroomnummer || '',
    planned_time_window_start: order?.planned_time_window_start ? new Date(order.planned_time_window_start).toISOString().slice(0, 16) : '',
    planned_time_window_end: order?.planned_time_window_end ? new Date(order.planned_time_window_end).toISOString().slice(0, 16) : '',
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

  const inputClass = "w-full h-10 px-3.5 rounded-md border border-grey-300 text-sm text-grey-900 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors";
  const selectClass = `${inputClass} bg-white`;

  return (
    <div className="app-modal-overlay">
      <div className="app-modal-panel max-w-lg">
        <div className="flex items-center justify-between px-5 py-3 border-b border-grey-200">
          <h2 className="text-lg font-semibold text-grey-900">
            {isEdit ? 'Edit Order' : 'New Order'}
          </h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-grey-50 transition-colors">
            <X size={18} className="text-grey-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-grey-700 mb-1.5">Carrier <span className="text-red-500">*</span></label>
            <select name="carrier_id" value={form.carrier_id} onChange={handleChange} required className={selectClass}>
              <option value="">Select carrier...</option>
              {carriers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-grey-700 mb-1.5">Supplier <span className="text-red-500">*</span></label>
            <select name="supplier_id" value={form.supplier_id} onChange={handleChange} required className={selectClass}>
              <option value="">Select supplier...</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-grey-700 mb-1.5">Waste Stream <span className="text-red-500">*</span></label>
            <select name="waste_stream_id" value={form.waste_stream_id} onChange={handleChange} required className={selectClass}>
              <option value="">Select waste stream...</option>
              {wasteStreams.map((ws) => (
                <option key={ws.id} value={ws.id}>{ws.name_en} ({ws.code})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">Planned Date <span className="text-red-500">*</span></label>
              <input type="date" name="planned_date" value={form.planned_date} onChange={handleChange} required className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">Expected Skips</label>
              <input type="number" name="expected_skip_count" value={form.expected_skip_count} onChange={handleChange} min={1} className={inputClass} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-grey-700 mb-1.5">Vehicle Plate</label>
            <input
              type="text"
              name="vehicle_plate"
              value={form.vehicle_plate}
              onChange={(e) => setForm((p) => ({ ...p, vehicle_plate: e.target.value.toUpperCase() }))}
              placeholder="AB-123-CD"
              className={`${inputClass} font-mono tracking-wider`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-grey-700 mb-1.5">Afvalstroomnummer</label>
            <input type="text" name="afvalstroomnummer" value={form.afvalstroomnummer} onChange={handleChange} placeholder="Optional" className={inputClass} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">Time Window Start</label>
              <input type="datetime-local" name="planned_time_window_start" value={form.planned_time_window_start} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">Time Window End</label>
              <input type="datetime-local" name="planned_time_window_end" value={form.planned_time_window_end} onChange={handleChange} className={inputClass} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-grey-700 mb-1.5">Notes</label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={3}
              placeholder="Optional notes..."
              className="w-full min-h-[80px] px-3.5 py-2.5 rounded-md border border-grey-300 text-sm text-grey-900 placeholder:text-grey-400 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors resize-vertical"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 bg-white text-grey-700 border border-grey-300 rounded-md text-sm font-semibold hover:bg-grey-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-9 px-4 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Saving...' : isEdit ? 'Update Order' : 'Create Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
