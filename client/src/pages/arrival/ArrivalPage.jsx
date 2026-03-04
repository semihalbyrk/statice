import { useState, useEffect, useCallback } from 'react';
import { Truck, Search, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { matchPlate, arriveOrder, createAdhocArrival } from '../../api/orders';
import useMasterDataStore from '../../store/masterDataStore';
import StatusBadge from '../../components/ui/StatusBadge';
import { format } from 'date-fns';

export default function ArrivalPage() {
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

  async function handleConfirmArrival(orderId) {
    setSubmitting(true);
    try {
      await arriveOrder(orderId);
      toast.success('Arrival confirmed');
      setMatches((prev) => prev.filter((o) => o.id !== orderId));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to confirm arrival');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAdhocSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createAdhocArrival({ ...adhocForm, notes: `License plate: ${plate}. ${adhocForm.notes}`.trim() });
      toast.success('Ad-hoc arrival created');
      setPlate('');
      setShowAdhoc(false);
      setMatches([]);
      setSearched(false);
      setAdhocForm({ carrier_id: '', supplier_id: '', waste_stream_id: '', notes: '' });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create ad-hoc arrival');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-h-xs font-bold text-foreground mb-6">Arrival Registration</h1>

      {/* Plate Input */}
      <div className="bg-surface rounded-xl border border-border p-6 mb-6">
        <label className="block text-sm font-medium text-text-secondary mb-2">
          Enter License Plate
        </label>
        <div className="relative">
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-placeholder" />
          <input
            type="text"
            value={plate}
            onChange={(e) => setPlate(e.target.value.toUpperCase())}
            placeholder="AB-123-CD"
            autoFocus
            className="w-full pl-12 pr-4 py-4 rounded-xl border border-input text-lg font-mono text-foreground placeholder-text-placeholder focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition tracking-wider"
          />
        </div>
        {searching && (
          <p className="text-sm text-text-placeholder mt-2">Searching...</p>
        )}
      </div>

      {/* Matched Orders */}
      {searched && matches.length > 0 && (
        <div className="space-y-3 mb-6">
          <h2 className="text-sm font-semibold text-foreground">Matching Planned Orders</h2>
          {matches.map((order) => (
            <div
              key={order.id}
              className="bg-surface rounded-xl border border-border p-4 flex items-center justify-between"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-foreground">{order.order_number}</span>
                  <StatusBadge status={order.status} />
                </div>
                <p className="text-sm text-text-secondary">
                  {order.carrier?.name} — {order.supplier?.name}
                </p>
                <p className="text-xs text-text-tertiary mt-0.5">
                  Planned: {format(new Date(order.planned_date), 'dd MMM yyyy')}
                </p>
              </div>
              <button
                onClick={() => handleConfirmArrival(order.id)}
                disabled={submitting}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:bg-primary-hover disabled:opacity-50 transition"
              >
                <Truck size={16} />
                Confirm Arrival
              </button>
            </div>
          ))}
        </div>
      )}

      {/* No matches */}
      {searched && matches.length === 0 && plate.length >= 2 && (
        <div className="bg-surface rounded-xl border border-border p-6 text-center mb-6">
          <p className="text-sm text-text-secondary mb-3">
            No planned orders found for plate &quot;{plate}&quot;
          </p>
          {!showAdhoc && (
            <button
              onClick={() => setShowAdhoc(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:bg-primary-hover transition"
            >
              <Plus size={16} />
              Create Ad-hoc Arrival
            </button>
          )}
        </div>
      )}

      {/* Ad-hoc Form */}
      {showAdhoc && (
        <div className="bg-surface rounded-xl border border-border p-6">
          <h2 className="text-sm font-semibold text-foreground mb-4">Ad-hoc Arrival</h2>
          <form onSubmit={handleAdhocSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Carrier</label>
              <select
                value={adhocForm.carrier_id}
                onChange={(e) => setAdhocForm((p) => ({ ...p, carrier_id: e.target.value }))}
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
                value={adhocForm.supplier_id}
                onChange={(e) => setAdhocForm((p) => ({ ...p, supplier_id: e.target.value }))}
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
                value={adhocForm.waste_stream_id}
                onChange={(e) => setAdhocForm((p) => ({ ...p, waste_stream_id: e.target.value }))}
                required
                className="w-full px-3 py-2.5 rounded-lg border border-input text-sm text-foreground bg-surface focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition"
              >
                <option value="">Select waste stream...</option>
                {wasteStreams.map((ws) => (
                  <option key={ws.id} value={ws.id}>{ws.name_en} ({ws.code})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Notes</label>
              <textarea
                value={adhocForm.notes}
                onChange={(e) => setAdhocForm((p) => ({ ...p, notes: e.target.value }))}
                rows={2}
                placeholder="Optional notes..."
                className="w-full px-3 py-2.5 rounded-lg border border-input text-sm text-foreground placeholder-text-placeholder focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition resize-none"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowAdhoc(false)}
                className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-foreground rounded-lg hover:bg-muted transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:bg-primary-hover disabled:opacity-50 transition"
              >
                {submitting ? 'Creating...' : 'Create Arrival'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
