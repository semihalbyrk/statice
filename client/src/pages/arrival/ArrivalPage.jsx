import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, Plus, Clock, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import { matchPlate, createAdhocArrival } from '../../api/orders';
import { createInbound } from '../../api/weighingEvents';
import useMasterDataStore from '../../store/masterDataStore';
import StatusBadge from '../../components/ui/StatusBadge';
import SupplierTypeBadge from '../../components/ui/SupplierTypeBadge';
import { format } from 'date-fns';

const inputClass = "w-full h-10 px-3.5 rounded-md border border-grey-300 text-sm text-grey-900 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors";
const selectClass = `${inputClass} bg-white`;

export default function ArrivalPage() {
  const navigate = useNavigate();
  const { carriers, suppliers, wasteStreams } = useMasterDataStore();
  const [plate, setPlate] = useState('');
  const [matches, setMatches] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [showAdhoc, setShowAdhoc] = useState(false);
  const [adhocForm, setAdhocForm] = useState({
    carrier_id: '',
    supplier_id: '',
    waste_stream_id: '',
    notes: '',
    adhoc_person_name: '',
    adhoc_id_reference: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const searchPlate = useCallback(async (query) => {
    if (query.length < 2) {
      setMatches([]);
      setSearched(false);
      return;
    }
    setSearching(true);
    try {
      const { data } = await matchPlate(query);
      setMatches(data.data);
      setSearched(true);
    } catch {
      setMatches([]);
      setSearched(true);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => searchPlate(plate), 300);
    return () => clearTimeout(timer);
  }, [plate, searchPlate]);

  async function handleAddInbound(order) {
    setSubmitting(true);
    try {
      const { data } = await createInbound({
        order_id: order.id,
        registration_plate: plate,
      });
      toast.success('Inbound created');
      navigate(`/inbounds/${data.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create inbound');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAdhocSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createAdhocArrival({
        ...adhocForm,
        vehicle_plate: plate,
        notes: adhocForm.notes || null,
      });
      toast.success('Ad-hoc order created');
      setShowAdhoc(false);
      setAdhocForm({ carrier_id: '', supplier_id: '', waste_stream_id: '', notes: '', adhoc_person_name: '', adhoc_id_reference: '' });
      searchPlate(plate);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create ad-hoc order');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-grey-900 mb-6 text-center">Arrival Registration</h1>

      {/* License Plate Card */}
      <div className="bg-white rounded-xl border border-grey-200 shadow-sm p-8 mb-6">
        <div className="text-center mb-4">
          <h2 className="text-base font-semibold text-grey-900 mb-1">Scan or enter the vehicle license plate</h2>
          <p className="text-xs text-grey-400">The system will match the plate against planned orders</p>
        </div>

        {/* EU License Plate */}
        <div className="mx-auto" style={{ maxWidth: 520 }}>
          <div className="flex items-stretch rounded-lg border-[3px] border-grey-900 overflow-hidden shadow-md bg-[#F5A623]">
            {/* EU country badge */}
            <div className="w-16 bg-[#003399] flex flex-col items-center justify-center shrink-0 py-3 gap-1.5">
              <svg width="30" height="30" viewBox="0 0 30 30">
                <circle cx="15" cy="15" r="12" fill="none" stroke="#FFD700" strokeWidth="0.5" opacity="0.3" />
                {[0,30,60,90,120,150,180,210,240,270,300,330].map((deg) => {
                  const rad = (deg - 90) * Math.PI / 180;
                  const x = 15 + 10 * Math.cos(rad);
                  const y = 15 + 10 * Math.sin(rad);
                  return <text key={deg} x={x} y={y} textAnchor="middle" dominantBaseline="central" fill="#FFD700" fontSize="6" fontFamily="serif">&#9733;</text>;
                })}
              </svg>
              <span className="text-[13px] font-bold text-white tracking-[0.15em]">NL</span>
            </div>
            {/* Plate input */}
            <input
              type="text"
              value={plate}
              onChange={(e) => setPlate(e.target.value.toUpperCase())}
              placeholder="XX-999-XX"
              autoFocus
              className="flex-1 bg-[#F5A623] text-center text-4xl font-bold font-mono text-grey-900 placeholder:text-[#D4891A]/60 py-5 px-6 outline-none tracking-[0.2em] border-none"
            />
          </div>
        </div>

        {searching && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-grey-400">Searching orders...</span>
          </div>
        )}

      </div>

      {/* Matching orders */}
      {searched && matches.length > 0 && (
        <div className="space-y-3 mb-6">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-grey-900">Matching Orders</h2>
            <span className="text-xs bg-green-25 text-green-700 border border-green-200 rounded-full px-2 py-0.5 font-medium">{matches.length} found</span>
          </div>
          {matches.map((order) => (
            <div
              key={order.id}
              className="bg-white rounded-xl border border-grey-200 shadow-sm overflow-hidden"
            >
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-base font-bold text-grey-900">{order.order_number}</span>
                    <StatusBadge status={order.status} />
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-grey-400">
                    <Clock size={12} />
                    {format(new Date(order.planned_date), 'dd MMM yyyy')}
                    {order.planned_time_window_start && order.planned_time_window_end && (
                      <span>, {format(new Date(order.planned_time_window_start), 'HH:mm')}-{format(new Date(order.planned_time_window_end), 'HH:mm')}</span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <span className="text-[11px] text-grey-400 uppercase tracking-wide font-medium">Carrier</span>
                    <p className="text-sm font-medium text-grey-900 mt-0.5">{order.carrier?.name || '—'}</p>
                  </div>
                  <div>
                    <span className="text-[11px] text-grey-400 uppercase tracking-wide font-medium">Supplier</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <p className="text-sm font-medium text-grey-900">{order.supplier?.name || '—'}</p>
                      <SupplierTypeBadge type={order.supplier?.supplier_type} />
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] text-grey-400 uppercase tracking-wide font-medium">Waste Stream</span>
                    <p className="text-sm font-medium text-grey-900 mt-0.5">{order.waste_stream?.name_en || '—'}</p>
                  </div>
                  <div>
                    <span className="text-[11px] text-grey-400 uppercase tracking-wide font-medium">Expected Parcels</span>
                    <p className="text-sm font-medium text-grey-900 mt-0.5">{order.expected_skip_count}</p>
                  </div>
                </div>
              </div>
              <div className="bg-grey-50 border-t border-grey-100 px-5 py-3 flex items-center justify-between">
                <span className="text-xs font-mono text-grey-500 tracking-wide">{order.vehicle_plate || plate}</span>
                <button
                  onClick={() => handleAddInbound(order)}
                  disabled={submitting}
                  className="h-9 px-5 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  <Truck size={15} />
                  Register Arrival
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No results */}
      {searched && matches.length === 0 && plate.length >= 2 && (
        <div className="bg-white rounded-xl border border-grey-200 shadow-sm p-8 text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-grey-100 mb-3">
            <Package size={22} className="text-grey-400" />
          </div>
          <p className="text-sm font-medium text-grey-700 mb-1">
            No orders match plate &quot;{plate}&quot;
          </p>
          <p className="text-xs text-grey-400 mb-4">The plate must exactly match the one registered on the order</p>
          {!showAdhoc && (
            <button
              onClick={() => setShowAdhoc(true)}
              className="inline-flex items-center gap-2 h-9 px-5 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-700 transition-colors"
            >
              <Plus size={16} />
              Create Ad-hoc Order
            </button>
          )}
        </div>
      )}

      {/* Ad-hoc form */}
      {showAdhoc && (
        <div className="bg-white rounded-xl border border-grey-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-grey-900 mb-4">Ad-hoc Order</h2>
          <form onSubmit={handleAdhocSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-grey-700 mb-1.5">Carrier</label>
                <select
                  value={adhocForm.carrier_id}
                  onChange={(e) => setAdhocForm((p) => ({ ...p, carrier_id: e.target.value }))}
                  required
                  className={selectClass}
                >
                  <option value="">Select carrier...</option>
                  {carriers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-grey-700 mb-1.5">Supplier</label>
                <select
                  value={adhocForm.supplier_id}
                  onChange={(e) => setAdhocForm((p) => ({ ...p, supplier_id: e.target.value }))}
                  required
                  className={selectClass}
                >
                  <option value="">Select supplier...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">Waste Stream</label>
              <select
                value={adhocForm.waste_stream_id}
                onChange={(e) => setAdhocForm((p) => ({ ...p, waste_stream_id: e.target.value }))}
                required
                className={selectClass}
              >
                <option value="">Select waste stream...</option>
                {wasteStreams.map((ws) => (
                  <option key={ws.id} value={ws.id}>{ws.name_en} ({ws.code})</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-grey-700 mb-1.5">Contact Person</label>
                <input type="text" value={adhocForm.adhoc_person_name || ''} onChange={(e) => setAdhocForm((p) => ({ ...p, adhoc_person_name: e.target.value }))} className={inputClass} placeholder="Name of person delivering" />
              </div>
              <div>
                <label className="block text-sm font-medium text-grey-700 mb-1.5">ID Reference (optional)</label>
                <input type="text" value={adhocForm.adhoc_id_reference || ''} onChange={(e) => setAdhocForm((p) => ({ ...p, adhoc_id_reference: e.target.value }))} className={inputClass} placeholder="ID or reference number" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">Notes</label>
              <textarea
                value={adhocForm.notes}
                onChange={(e) => setAdhocForm((p) => ({ ...p, notes: e.target.value }))}
                rows={2}
                placeholder="Optional notes..."
                className="w-full min-h-[80px] px-3.5 py-2.5 rounded-md border border-grey-300 text-sm text-grey-900 placeholder:text-grey-400 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors resize-vertical"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowAdhoc(false)}
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
      )}
    </div>
  );
}
