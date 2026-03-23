import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Check, ChevronDown, CheckCircle, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import Breadcrumb from '../../components/ui/Breadcrumb';
import useMasterDataStore from '../../store/masterDataStore';
import { createOrder } from '../../api/orders';
import { matchContractForOrder } from '../../api/contracts';

const inputClass = 'w-full h-10 px-3.5 rounded-md border border-grey-300 text-sm text-grey-900 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors';
const selectClass = `${inputClass} bg-white`;

export default function OrderCreatePage() {
  const navigate = useNavigate();
  const { carriers, suppliers, loadAll } = useMasterDataStore();
  const allSuppliers = useMasterDataStore((s) => s.suppliers);

  useEffect(() => {
    if (carriers.length === 0 || allSuppliers.length === 0) {
      loadAll();
    }
  }, [carriers.length, allSuppliers.length, loadAll]);

  const [form, setForm] = useState({
    supplier_id: '',
    carrier_id: '',
    waste_stream_ids: [],
    planned_date: '',
    planned_time_window_start: '',
    planned_time_window_end: '',
    expected_skip_count: 1,
    vehicle_plate: '',
    is_lzv: false,
    notes: '',
    client_reference: '',
  });

  const [matchedContract, setMatchedContract] = useState(null);
  const [contractLoading, setContractLoading] = useState(false);
  const [contractWasteStreams, setContractWasteStreams] = useState([]);
  const [wsDropdownOpen, setWsDropdownOpen] = useState(false);
  const wsDropdownRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedSupplier = allSuppliers.find((s) => s.id === form.supplier_id);
  const selectedSupplierType = selectedSupplier?.supplier_type;

  // Close waste stream dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (wsDropdownRef.current && !wsDropdownRef.current.contains(e.target)) {
        setWsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-match contract when supplier + carrier change
  useEffect(() => {
    if (!form.supplier_id || !form.carrier_id) {
      setMatchedContract(null);
      setContractWasteStreams([]);
      setForm((prev) => ({ ...prev, waste_stream_ids: [] }));
      return;
    }

    let cancelled = false;
    setContractLoading(true);
    matchContractForOrder({
      supplier_id: form.supplier_id,
      carrier_id: form.carrier_id,
      date: form.planned_date || new Date().toISOString().split('T')[0],
    })
      .then(({ data }) => {
        if (cancelled) return;
        setMatchedContract(data.data);
        const cws = data.data?.contract_waste_streams || [];
        setContractWasteStreams(cws);
        // Reset waste stream selection
        setForm((prev) => ({ ...prev, waste_stream_ids: [] }));
      })
      .catch(() => {
        if (cancelled) return;
        setMatchedContract(null);
        setContractWasteStreams([]);
        setForm((prev) => ({ ...prev, waste_stream_ids: [] }));
      })
      .finally(() => {
        if (!cancelled) setContractLoading(false);
      });

    return () => { cancelled = true; };
  }, [form.supplier_id, form.carrier_id, form.planned_date]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
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

  // Build ASN preview from selected waste streams
  const asnPreview = form.waste_stream_ids
    .map((wsId) => {
      const cws = contractWasteStreams.find((c) => c.waste_stream?.id === wsId || c.waste_stream_id === wsId);
      return cws ? { name: cws.waste_stream?.name, code: cws.waste_stream?.code, asn: cws.afvalstroomnummer } : null;
    })
    .filter(Boolean);

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.waste_stream_ids.length === 0) {
      toast.error('Please select at least one waste stream');
      return;
    }
    if (!form.vehicle_plate) {
      toast.error('Vehicle plate is required');
      return;
    }

    setSubmitting(true);
    try {
      await createOrder({
        ...form,
        contract_id: matchedContract?.id || null,
        vehicle_plate: form.vehicle_plate,
      });
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

      <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
        {/* Supplier + Carrier */}
        <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">Supplier <span className="text-red-500">*</span></label>
              <select name="supplier_id" value={form.supplier_id} onChange={handleChange} required className={selectClass}>
                <option value="">Select supplier...</option>
                {allSuppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">Carrier <span className="text-red-500">*</span></label>
              <select name="carrier_id" value={form.carrier_id} onChange={handleChange} required className={selectClass}>
                <option value="">Select carrier...</option>
                {carriers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          {/* Contract Match Banner */}
          {form.supplier_id && form.carrier_id && (
            <div className={`mt-4 flex items-center gap-2 p-3 rounded-md text-sm ${
              contractLoading
                ? 'bg-grey-50 text-grey-500'
                : matchedContract
                  ? 'bg-green-25 text-green-700 border border-green-300'
                  : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {contractLoading ? (
                'Searching for active contract...'
              ) : matchedContract ? (
                <>
                  <CheckCircle size={16} />
                  <span className="font-medium">{matchedContract.contract_number}</span>
                  <span>\u2014 {matchedContract.name}</span>
                  <Link to={`/contracts/${matchedContract.id}`} className="ml-auto text-xs underline">View</Link>
                </>
              ) : (
                <>
                  <AlertTriangle size={16} />
                  No active contract found for this supplier + carrier combination
                </>
              )}
            </div>
          )}
        </div>

        {/* Waste Streams + ASN Preview */}
        <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-5">
          <div ref={wsDropdownRef} className="relative">
            <label className="block text-sm font-medium text-grey-700 mb-1.5">Waste Streams <span className="text-red-500">*</span></label>
            <button
              type="button"
              onClick={() => setWsDropdownOpen((v) => !v)}
              disabled={contractWasteStreams.length === 0}
              className={`${selectClass} flex items-center justify-between text-left ${
                form.waste_stream_ids.length === 0 ? 'text-grey-400' : 'text-grey-900'
              } ${contractWasteStreams.length === 0 ? 'bg-grey-50 cursor-not-allowed' : ''}`}
            >
              <span className="truncate">
                {contractWasteStreams.length === 0
                  ? 'No waste streams available'
                  : form.waste_stream_ids.length === 0
                    ? 'Select waste streams...'
                    : `${form.waste_stream_ids.length} selected`}
              </span>
              <ChevronDown size={16} className={`text-grey-400 transition-transform flex-shrink-0 ${wsDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {wsDropdownOpen && contractWasteStreams.length > 0 && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-grey-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                {contractWasteStreams.map((cws) => {
                  const wsId = cws.waste_stream?.id || cws.waste_stream_id;
                  const checked = form.waste_stream_ids.includes(wsId);
                  return (
                    <label
                      key={cws.id}
                      onClick={() => toggleWasteStream(wsId)}
                      className="flex items-center gap-2.5 px-3 py-2 hover:bg-grey-50 cursor-pointer text-sm text-grey-900"
                    >
                      <span className={`flex items-center justify-center w-4 h-4 rounded border flex-shrink-0 ${checked ? 'bg-green-500 border-green-500' : 'border-grey-300'}`}>
                        {checked && <Check size={12} className="text-white" strokeWidth={3} />}
                      </span>
                      {cws.waste_stream?.name} ({cws.waste_stream?.code})
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* ASN Preview */}
          {asnPreview.length > 0 && (
            <div className="mt-4 p-3 bg-grey-50 rounded-md border border-grey-200">
              <p className="text-xs font-medium text-grey-500 uppercase tracking-wide mb-2">Afvalstroomnummer</p>
              <div className="space-y-1">
                {asnPreview.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-grey-700">{item.name} ({item.code})</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-25 text-green-700 border border-green-300">
                      {item.asn}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Dates + Vehicle */}
        <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-5 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">Planned Date <span className="text-red-500">*</span></label>
              <input type="date" name="planned_date" value={form.planned_date} onChange={handleChange} required className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">Time Window Start</label>
              <input type="datetime-local" name="planned_time_window_start" value={form.planned_time_window_start} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">Time Window End</label>
              <input type="datetime-local" name="planned_time_window_end" value={form.planned_time_window_end} onChange={handleChange} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">Vehicle Plate <span className="text-red-500">*</span></label>
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
              <label className="block text-sm font-medium text-grey-700 mb-1.5">Expected Parcels</label>
              <input type="number" name="expected_skip_count" value={form.expected_skip_count} onChange={handleChange} min={1} className={inputClass} />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm text-grey-700 cursor-pointer">
                <input type="checkbox" checked={form.is_lzv} onChange={(e) => setForm((p) => ({ ...p, is_lzv: e.target.checked }))}
                  className="h-4 w-4 rounded border-grey-300 text-green-500 focus:ring-green-500/15" />
                LZV Vehicle (up to 3 containers)
              </label>
            </div>
          </div>

          {selectedSupplierType === 'THIRD_PARTY' && (
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">Client Reference</label>
              <input type="text" value={form.client_reference} onChange={(e) => setForm((p) => ({ ...p, client_reference: e.target.value }))} className={inputClass} placeholder="Client PO/reference number" />
            </div>
          )}

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
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate('/orders')}
            className="h-9 px-4 bg-white text-grey-700 border border-grey-300 rounded-md text-sm font-semibold hover:bg-grey-50 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={submitting}
            className="h-9 px-4 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors">
            {submitting ? 'Creating...' : 'Create Order'}
          </button>
        </div>
      </form>
    </div>
  );
}
