import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, Search, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { matchPlate, createAdhocArrival } from '../../api/orders';
import { createInbound } from '../../api/weighingEvents';
import useMasterDataStore from '../../store/masterDataStore';
import StatusBadge from '../../components/ui/StatusBadge';
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
      setAdhocForm({ carrier_id: '', supplier_id: '', waste_stream_id: '', notes: '' });
      // Refresh search to show the new order in the match list
      searchPlate(plate);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create ad-hoc order');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-grey-900 mb-6">Arrival Registration</h1>

      <div className="max-w-5xl">
        <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-6 mb-6 max-w-3xl">
          <label className="block text-sm font-medium text-grey-700 mb-2">
            Enter License Plate
          </label>
          <div className="relative">
            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-grey-400" />
            <input
              type="text"
              value={plate}
              onChange={(e) => setPlate(e.target.value.toUpperCase())}
              placeholder="AB-123-CD"
              autoFocus
              className="w-full pl-12 pr-4 py-4 rounded-md border border-grey-300 text-lg font-mono text-grey-900 placeholder:text-grey-400 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors tracking-wider"
            />
          </div>
          {searching && (
            <p className="text-sm text-grey-400 mt-2">Searching...</p>
          )}
        </div>

        {searched && matches.length > 0 && (
          <div className="space-y-3 mb-6">
            <h2 className="text-base font-semibold text-grey-900">Matching Planned Orders</h2>
            {matches.map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-lg border border-grey-200 shadow-sm p-5 max-w-4xl"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-grey-500">Order #:</span>
                    <span className="text-sm font-semibold text-grey-900">{order.order_number}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-grey-500">Status:</span>
                    <StatusBadge status={order.status} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-grey-500">Carrier:</span>
                    <span className="text-sm text-grey-900">{order.carrier?.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-grey-500">Supplier:</span>
                    <span className="text-sm text-grey-900">{order.supplier?.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-grey-500">Waste Stream:</span>
                    <span className="text-sm text-grey-900">
                      {order.waste_stream?.name_en} ({order.waste_stream?.code})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-grey-500">Planned:</span>
                    <span className="text-sm text-grey-900">
                      {format(new Date(order.planned_date), 'dd MMM yyyy')}
                      {order.planned_time_window_start && order.planned_time_window_end && (
                        <>, {format(new Date(order.planned_time_window_start), 'HH:mm')}-{format(new Date(order.planned_time_window_end), 'HH:mm')}</>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-grey-500">Vehicle:</span>
                    <span className="text-sm font-mono text-grey-900">{order.vehicle_plate || plate}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-grey-500">Expected Skips:</span>
                    <span className="text-sm text-grey-900">{order.expected_skip_count}</span>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => handleAddInbound(order)}
                    disabled={submitting}
                    className="h-9 px-4 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                  >
                    <Truck size={16} />
                    Add Inbound
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {searched && matches.length === 0 && plate.length >= 2 && (
          <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-6 text-center mb-6 max-w-3xl">
            <p className="text-sm text-grey-600 mb-3">
              No planned orders found for plate &quot;{plate}&quot;
            </p>
            {!showAdhoc && (
              <button
                onClick={() => setShowAdhoc(true)}
                className="inline-flex items-center gap-2 h-9 px-4 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-700 transition-colors"
              >
                <Plus size={16} />
                Create Ad-hoc Order
              </button>
            )}
          </div>
        )}

        {showAdhoc && (
          <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-6 max-w-3xl">
            <h2 className="text-base font-semibold text-grey-900 mb-4">Ad-hoc Order</h2>
            <form onSubmit={handleAdhocSubmit} className="space-y-4">
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
    </div>
  );
}
