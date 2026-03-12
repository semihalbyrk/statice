import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Breadcrumb from '../../components/ui/Breadcrumb';
import useOrdersStore from '../../store/ordersStore';
import useMasterDataStore from '../../store/masterDataStore';

const inputClass = "w-full h-10 px-3.5 rounded-md border border-grey-300 text-sm text-grey-900 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors";
const selectClass = `${inputClass} bg-white`;
const labelClass = "block text-sm font-medium text-grey-700 mb-1.5";

export default function OrderCreatePage() {
  const navigate = useNavigate();
  const { createOrder } = useOrdersStore();
  const { carriers, suppliers, wasteStreams, loadAll } = useMasterDataStore();

  const [form, setForm] = useState({
    carrier_id: '',
    supplier_id: '',
    waste_stream_id: '',
    planned_date: '',
    planned_time_window_start: '',
    planned_time_window_end: '',
    expected_skip_count: 1,
    vehicle_plate: '',
    afvalstroomnummer: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (carriers.length === 0 || suppliers.length === 0 || wasteStreams.length === 0) {
      loadAll();
    }
  }, [carriers.length, suppliers.length, wasteStreams.length, loadAll]);

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createOrder(form);
      toast.success('Order created');
      navigate('/orders');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create order');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <Breadcrumb items={[{ label: 'Orders', to: '/orders' }, { label: 'New Order' }]} />

      <h1 className="text-xl font-semibold text-grey-900 mb-6">New Order</h1>

      <div className="max-w-[800px] mx-auto">
        <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className={labelClass}>Carrier</label>
                <select name="carrier_id" value={form.carrier_id} onChange={handleChange} required className={selectClass}>
                  <option value="">Select carrier...</option>
                  {carriers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Supplier</label>
                <select name="supplier_id" value={form.supplier_id} onChange={handleChange} required className={selectClass}>
                  <option value="">Select supplier...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={labelClass}>Waste Stream</label>
              <select name="waste_stream_id" value={form.waste_stream_id} onChange={handleChange} required className={selectClass}>
                <option value="">Select waste stream...</option>
                {wasteStreams.map((ws) => (
                  <option key={ws.id} value={ws.id}>{ws.name_en} ({ws.code})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div>
                <label className={labelClass}>Planned Date</label>
                <input type="date" name="planned_date" value={form.planned_date} onChange={handleChange} required className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Time Window Start</label>
                <input type="datetime-local" name="planned_time_window_start" value={form.planned_time_window_start} onChange={handleChange} required className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Time Window End</label>
                <input type="datetime-local" name="planned_time_window_end" value={form.planned_time_window_end} onChange={handleChange} required className={inputClass} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div>
                <label className={labelClass}>Expected Skips</label>
                <input type="number" name="expected_skip_count" value={form.expected_skip_count} onChange={handleChange} min={1} required className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Vehicle Plate</label>
                <input
                  type="text"
                  name="vehicle_plate"
                  value={form.vehicle_plate}
                  onChange={(e) => setForm((p) => ({ ...p, vehicle_plate: e.target.value.toUpperCase() }))}
                  placeholder="AB-123-CD"
                  required
                  className={`${inputClass} font-mono tracking-wider`}
                />
              </div>
              <div>
                <label className={labelClass}>Afvalstroomnummer</label>
                <input type="text" name="afvalstroomnummer" value={form.afvalstroomnummer} onChange={handleChange} placeholder="e.g. AVS-2026-001" required className={inputClass} />
              </div>
            </div>

            <div>
              <label className={labelClass}>Notes <span className="text-grey-400 font-normal">(optional)</span></label>
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
                onClick={() => navigate('/orders')}
                className="h-9 px-4 bg-white text-grey-700 border border-grey-300 rounded-md text-sm font-semibold hover:bg-grey-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="h-9 px-4 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Creating...' : 'Create Order'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
