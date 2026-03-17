import { useState, useRef, useEffect } from 'react';
import { X, ChevronDown, Check, CheckCircle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import useMasterDataStore from '../../store/masterDataStore';
import { createOrder, updateOrder } from '../../api/orders';
import { getSupplierAfvalstroomnummers } from '../../api/suppliers';

function deriveInitialWasteStreamIds(order) {
  if (order?.waste_streams?.length > 0) {
    return order.waste_streams.map((ows) => ows.waste_stream?.id || ows.waste_stream_id).filter(Boolean);
  }
  if (order?.waste_stream_id) {
    return [order.waste_stream_id];
  }
  return [];
}

export default function OrderFormModal({ order, onClose, onSuccess }) {
  const { carriers, suppliers, wasteStreams } = useMasterDataStore();
  const isEdit = !!order;

  const [form, setForm] = useState({
    carrier_id: order?.carrier_id || '',
    supplier_id: order?.supplier_id || '',
    waste_stream_ids: deriveInitialWasteStreamIds(order),
    planned_date: order?.planned_date ? new Date(order.planned_date).toISOString().split('T')[0] : '',
    expected_skip_count: order?.expected_skip_count || 1,
    vehicle_plate: order?.vehicle_plate || '',
    afvalstroomnummer: order?.afvalstroomnummer || '',
    planned_time_window_start: order?.planned_time_window_start ? new Date(order.planned_time_window_start).toISOString().slice(0, 16) : '',
    planned_time_window_end: order?.planned_time_window_end ? new Date(order.planned_time_window_end).toISOString().slice(0, 16) : '',
    notes: order?.notes || '',
    is_lzv: order?.is_lzv || false,
    client_reference: order?.client_reference || '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [wsDropdownOpen, setWsDropdownOpen] = useState(false);
  const wsDropdownRef = useRef(null);
  const [registeredAfs, setRegisteredAfs] = useState([]);

  const selectedSupplier = suppliers.find((s) => s.id === form.supplier_id);
  const selectedSupplierType = selectedSupplier?.supplier_type;

  useEffect(() => {
    function handleClickOutside(e) {
      if (wsDropdownRef.current && !wsDropdownRef.current.contains(e.target)) {
        setWsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (selectedSupplierType === 'PRO' && form.supplier_id) {
      getSupplierAfvalstroomnummers(form.supplier_id)
        .then(res => setRegisteredAfs(res.data))
        .catch(() => setRegisteredAfs([]));
    } else {
      setRegisteredAfs([]);
    }
  }, [form.supplier_id, selectedSupplierType]);

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function toggleWasteStream(wsId) {
    setForm((prev) => {
      const current = prev.waste_stream_ids;
      const next = current.includes(wsId)
        ? current.filter((id) => id !== wsId)
        : [...current, wsId];
      return { ...prev, waste_stream_ids: next };
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.waste_stream_ids.length === 0) {
      toast.error('Please select at least one waste stream');
      return;
    }
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

          <div ref={wsDropdownRef} className="relative">
            <label className="block text-sm font-medium text-grey-700 mb-1.5">Waste Streams <span className="text-red-500">*</span></label>
            <button
              type="button"
              onClick={() => setWsDropdownOpen((v) => !v)}
              className={`${selectClass} flex items-center justify-between text-left ${form.waste_stream_ids.length === 0 ? 'text-grey-400' : 'text-grey-900'}`}
            >
              <span className="truncate">
                {form.waste_stream_ids.length === 0
                  ? 'Select waste streams...'
                  : `${form.waste_stream_ids.length} selected`}
              </span>
              <ChevronDown size={16} className={`text-grey-400 transition-transform flex-shrink-0 ${wsDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {wsDropdownOpen && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-grey-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                {wasteStreams.map((ws) => {
                  const checked = form.waste_stream_ids.includes(ws.id);
                  return (
                    <label
                      key={ws.id}
                      onClick={() => toggleWasteStream(ws.id)}
                      className="flex items-center gap-2.5 px-3 py-2 hover:bg-grey-50 cursor-pointer text-sm text-grey-900"
                    >
                      <span className={`flex items-center justify-center w-4 h-4 rounded border flex-shrink-0 ${checked ? 'bg-green-500 border-green-500' : 'border-grey-300'}`}>
                        {checked && <Check size={12} className="text-white" strokeWidth={3} />}
                      </span>
                      {ws.name_en} ({ws.code})
                    </label>
                  );
                })}
                {wasteStreams.length === 0 && (
                  <p className="px-3 py-2 text-sm text-grey-400">No waste streams available</p>
                )}
              </div>
            )}
            <input type="hidden" name="waste_stream_ids" value={form.waste_stream_ids.join(',')} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">Planned Date <span className="text-red-500">*</span></label>
              <input type="date" name="planned_date" value={form.planned_date} onChange={handleChange} required className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">Expected Parcels</label>
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
            <div className="flex items-center gap-2">
              {selectedSupplierType === 'PRO' ? (
                <select
                  value={form.afvalstroomnummer || ''}
                  onChange={e => setForm(prev => ({ ...prev, afvalstroomnummer: e.target.value }))}
                  className={selectClass}
                >
                  <option value="">Select afvalstroomnummer...</option>
                  {registeredAfs.map(afs => (
                    <option key={afs.id} value={afs.afvalstroomnummer}>
                      {afs.afvalstroomnummer}{afs.waste_stream ? ` (${afs.waste_stream.code})` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <input type="text" name="afvalstroomnummer" value={form.afvalstroomnummer} onChange={handleChange} placeholder="Optional" className={inputClass} />
              )}
              {selectedSupplierType === 'PRO' && form.afvalstroomnummer && (
                registeredAfs.some(afs => afs.afvalstroomnummer === form.afvalstroomnummer)
                  ? <CheckCircle size={18} className="text-green-500 flex-shrink-0" />
                  : <AlertCircle size={18} className="text-red-500 flex-shrink-0" />
              )}
            </div>
            {selectedSupplierType === 'PRO' && form.afvalstroomnummer && !registeredAfs.some(afs => afs.afvalstroomnummer === form.afvalstroomnummer) && (
              <p className="mt-1 text-xs text-red-500">This afvalstroomnummer is not registered for this PRO supplier</p>
            )}
          </div>

          <div className="flex items-center">
            <label className="flex items-center text-sm font-medium text-grey-700 cursor-pointer">
              <input type="checkbox" checked={form.is_lzv} onChange={e => setForm(prev => ({ ...prev, is_lzv: e.target.checked }))} className="mr-2" />
              LZV Vehicle (up to 3 containers)
            </label>
          </div>

          {selectedSupplierType === 'COMMERCIAL' && (
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">Client Reference</label>
              <input type="text" value={form.client_reference || ''} onChange={(e) => setForm(prev => ({ ...prev, client_reference: e.target.value }))} className={inputClass} placeholder="Client PO/reference number" />
            </div>
          )}

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
