import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Scale, Truck, CheckCircle, Download, Pencil, Trash2, Plus, Printer, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import useWeighingStore from '../../store/weighingStore';
import useAuthStore from '../../store/authStore';
import useMasterDataStore from '../../store/masterDataStore';
import StatusBadge from '../../components/ui/StatusBadge';
import {
  triggerGrossWeighing,
  triggerTareWeighing,
  advanceToTare,
  confirmWeighingEvent,
  overrideWeight,
  downloadTicketPdf,
} from '../../api/weighingEvents';
import { createAsset, updateAsset as updateAssetApi, deleteAsset, getNextLabel } from '../../api/assets';
import { printAssetLabel } from '../../utils/printLabel';
import { format } from 'date-fns';

const SKIP_TYPES = ['OPEN_TOP', 'CLOSED_TOP', 'GITTERBOX', 'PALLET', 'OTHER'];
const SKIP_LABELS = { OPEN_TOP: 'Open Top', CLOSED_TOP: 'Closed Top', GITTERBOX: 'Gitterbox', PALLET: 'Pallet', OTHER: 'Other' };

export default function WeighingEventPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { currentEvent: event, isLoading, isTriggering, fetchEvent, setEvent, setTriggering, clearEvent } = useWeighingStore();
  const { productCategories } = useMasterDataStore();
  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    fetchEvent(eventId);
    return () => clearEvent();
  }, [eventId, fetchEvent, clearEvent]);

  if (isLoading || !event) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-text-placeholder" size={24} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <Link
        to={`/orders/${event.order_id}`}
        className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-foreground mb-4 transition"
      >
        <ArrowLeft size={16} /> Back to Order
      </Link>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_2fr_1fr] gap-6">
        {/* Left Column — Order Summary */}
        <OrderSummaryCard event={event} />

        {/* Centre Column — Weighing Controls */}
        <WeighingControls
          event={event}
          isAdmin={isAdmin}
          isTriggering={isTriggering}
          setTriggering={setTriggering}
          fetchEvent={fetchEvent}
          eventId={eventId}
          setEvent={setEvent}
        />

        {/* Right Column — Skips Panel */}
        <SkipsPanel
          event={event}
          eventId={eventId}
          fetchEvent={fetchEvent}
          productCategories={productCategories}
        />
      </div>
    </div>
  );
}

/* ───── Order Summary Card ───── */
function OrderSummaryCard({ event }) {
  const order = event.order;
  return (
    <div className="bg-surface rounded-xl border border-border p-5 h-fit">
      <h2 className="text-sm font-semibold text-foreground mb-4">Order Summary</h2>
      <div className="space-y-3">
        <InfoRow label="Order #" value={order.order_number} />
        <InfoRow label="Status">
          <StatusBadge status={order.status} />
        </InfoRow>
        <InfoRow label="Carrier" value={order.carrier?.name} />
        <InfoRow label="Supplier" value={order.supplier?.name} />
        <InfoRow label="Vehicle Plate">
          <span className="font-mono text-base font-bold tracking-wider text-foreground">
            {event.vehicle?.registration_plate}
          </span>
        </InfoRow>
        <InfoRow label="Arrived At" value={format(new Date(event.arrived_at), 'dd MMM yyyy HH:mm')} />
        <InfoRow label="Waste Stream" value={order.waste_stream ? `${order.waste_stream.name_en} (${order.waste_stream.code})` : '—'} />
        <InfoRow label="Expected Skips" value={order.expected_skip_count} />
        {event.notes && <InfoRow label="Notes" value={event.notes} />}
      </div>
    </div>
  );
}

function InfoRow({ label, value, children }) {
  return (
    <div>
      <span className="text-xs text-text-tertiary uppercase tracking-wide">{label}</span>
      {children ? <div className="mt-0.5">{children}</div> : <p className="text-sm font-medium text-foreground mt-0.5">{value ?? '—'}</p>}
    </div>
  );
}

/* ───── Weighing Controls (Centre) ───── */
function WeighingControls({ event, isAdmin, isTriggering, setTriggering, fetchEvent, eventId, setEvent }) {
  const navigate = useNavigate();
  const [showOverride, setShowOverride] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const handleGross = useCallback(async () => {
    setTriggering(true);
    try {
      const { data } = await triggerGrossWeighing(eventId);
      setEvent(data.data);
      toast.success('Gross weighing complete');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gross weighing failed');
    } finally {
      setTriggering(false);
    }
  }, [eventId, setTriggering, setEvent]);

  const handleAdvanceToTare = useCallback(async () => {
    setTriggering(true);
    try {
      const { data } = await advanceToTare(eventId);
      setEvent(data.data);
      toast.success('Ready for tare weighing');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to advance');
    } finally {
      setTriggering(false);
    }
  }, [eventId, setTriggering, setEvent]);

  const handleTare = useCallback(async () => {
    setTriggering(true);
    try {
      const { data } = await triggerTareWeighing(eventId);
      setEvent(data.data);
      toast.success('Tare weighing complete');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Tare weighing failed');
    } finally {
      setTriggering(false);
    }
  }, [eventId, setTriggering, setEvent]);

  const handleConfirm = useCallback(async () => {
    setTriggering(true);
    try {
      const { data } = await confirmWeighingEvent(eventId);
      setEvent(data.data);
      toast.success('Weighing event confirmed');
      setShowConfirmDialog(false);
      if (data.data.sorting_session?.id) {
        navigate(`/sorting/${data.data.sorting_session.id}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to confirm');
    } finally {
      setTriggering(false);
    }
  }, [eventId, setTriggering, setEvent, navigate]);

  const handleDownloadPdf = useCallback(async () => {
    try {
      const response = await downloadTicketPdf(eventId);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `weight-ticket-${eventId.slice(0, 8)}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download PDF');
    }
  }, [eventId]);

  const grossKg = Number(event.gross_weight_kg) || 0;
  const tareKg = Number(event.tare_weight_kg) || 0;
  const netKg = Number(event.net_weight_kg) || 0;
  const assetCount = event.assets?.length || 0;

  return (
    <div className="space-y-4">
      {/* Status Header */}
      <div className="bg-surface rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground">Weighing Process</h2>
          <StatusBadge status={event.status} />
        </div>

        {/* Persistent Gross Weight Card */}
        {event.gross_ticket && (
          <WeightCard label="Gross Weight" weight={grossKg} ticket={event.gross_ticket} />
        )}

        {/* Persistent Tare Weight Card */}
        {event.tare_ticket && (
          <WeightCard label="Tare Weight" weight={tareKg} ticket={event.tare_ticket} className="mt-3" />
        )}

        {/* Net Weight Summary */}
        {event.status === 'TARE_COMPLETE' || event.status === 'CONFIRMED' ? (
          <div className="mt-4 bg-muted rounded-lg p-4">
            <div className="grid grid-cols-3 text-center">
              <div>
                <span className="text-xs text-text-tertiary">Gross</span>
                <p className="text-sm font-semibold text-foreground">{grossKg.toLocaleString()} kg</p>
              </div>
              <div>
                <span className="text-xs text-text-tertiary">Tare</span>
                <p className="text-sm font-semibold text-foreground">{tareKg.toLocaleString()} kg</p>
              </div>
              <div>
                <span className="text-xs text-text-tertiary">Net</span>
                <p className="text-lg font-bold text-foreground">{netKg.toLocaleString()} kg</p>
              </div>
            </div>
          </div>
        ) : null}

        {/* Status-dependent Action */}
        <div className="mt-5">
          {event.status === 'PENDING_GROSS' && (
            <button
              onClick={handleGross}
              disabled={isTriggering}
              className="w-full h-16 flex items-center justify-center gap-3 bg-primary text-primary-foreground rounded-xl font-semibold text-base hover:bg-primary-hover disabled:opacity-50 transition"
            >
              {isTriggering ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Contacting Pfister weighbridge...
                </>
              ) : (
                <>
                  <Scale size={20} />
                  Trigger Gross Weighing
                </>
              )}
            </button>
          )}

          {event.status === 'GROSS_COMPLETE' && (
            <button
              onClick={handleAdvanceToTare}
              disabled={isTriggering || assetCount === 0}
              className="w-full h-16 flex items-center justify-center gap-3 bg-primary text-primary-foreground rounded-xl font-semibold text-base hover:bg-primary-hover disabled:opacity-50 transition"
            >
              <Truck size={20} />
              Proceed to Tare Weighing
            </button>
          )}
          {event.status === 'GROSS_COMPLETE' && assetCount === 0 && (
            <p className="text-xs text-text-placeholder text-center mt-2">Add at least one skip before proceeding</p>
          )}

          {event.status === 'PENDING_TARE' && (
            <button
              onClick={handleTare}
              disabled={isTriggering}
              className="w-full h-16 flex items-center justify-center gap-3 bg-primary text-primary-foreground rounded-xl font-semibold text-base hover:bg-primary-hover disabled:opacity-50 transition"
            >
              {isTriggering ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Contacting Pfister weighbridge...
                </>
              ) : (
                <>
                  <Scale size={20} />
                  Trigger Tare Weighing
                </>
              )}
            </button>
          )}

          {event.status === 'TARE_COMPLETE' && (
            <button
              onClick={() => setShowConfirmDialog(true)}
              disabled={isTriggering}
              className="w-full h-16 flex items-center justify-center gap-3 bg-green-600 text-white rounded-xl font-semibold text-base hover:bg-green-700 disabled:opacity-50 transition"
            >
              <CheckCircle size={20} />
              Confirm & Complete
            </button>
          )}

          {event.status === 'CONFIRMED' && (
            <div className="space-y-3">
              <button
                onClick={handleDownloadPdf}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:bg-primary-hover transition"
              >
                <Download size={16} />
                Download Weight Ticket (PDF)
              </button>
              {event.sorting_session && (
                <Link
                  to={`/sorting/${event.sorting_session.id}`}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-border rounded-xl font-semibold text-sm text-foreground hover:bg-muted transition"
                >
                  View Sorting Record
                  <StatusBadge status={event.sorting_session.status} />
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Override Link (ADMIN only) */}
        {isAdmin && (event.gross_ticket || event.tare_ticket) && event.status !== 'CONFIRMED' && (
          <button
            onClick={() => setShowOverride(true)}
            className="mt-3 text-xs text-text-tertiary hover:text-foreground underline transition"
          >
            Override Weight
          </button>
        )}
      </div>

      {/* Confirm Dialog */}
      {showConfirmDialog && (
        <ConfirmDialog
          event={event}
          grossKg={grossKg}
          tareKg={tareKg}
          netKg={netKg}
          isTriggering={isTriggering}
          onConfirm={handleConfirm}
          onCancel={() => setShowConfirmDialog(false)}
        />
      )}

      {/* Override Dialog */}
      {showOverride && (
        <OverrideDialog
          eventId={eventId}
          event={event}
          onClose={() => setShowOverride(false)}
          onSuccess={async () => { setShowOverride(false); await fetchEvent(eventId); }}
        />
      )}
    </div>
  );
}

function WeightCard({ label, weight, ticket, className = '' }) {
  return (
    <div className={`bg-muted rounded-lg p-3 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-tertiary">{label}</span>
        {ticket.is_manual_override && (
          <span className="text-xs text-orange-600 font-medium">Overridden</span>
        )}
      </div>
      <p className="text-lg font-bold text-foreground">{weight.toLocaleString()} kg</p>
      <p className="text-xs text-text-placeholder mt-0.5">
        {ticket.ticket_number} — {format(new Date(ticket.timestamp), 'dd MMM yyyy HH:mm:ss')}
      </p>
    </div>
  );
}

/* ───── Confirm Dialog ───── */
function ConfirmDialog({ grossKg, tareKg, netKg, isTriggering, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-overlay/50">
      <div className="bg-surface rounded-2xl border border-border shadow-xl w-full max-w-sm mx-4 p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={20} className="text-orange-500" />
          <h3 className="text-lg font-semibold text-foreground">Confirm Weighing</h3>
        </div>
        <p className="text-sm text-text-secondary mb-4">This action cannot be undone. The weighing event will be finalized.</p>
        <div className="bg-muted rounded-lg p-3 mb-5">
          <div className="grid grid-cols-3 text-center text-sm">
            <div>
              <span className="text-xs text-text-tertiary">Gross</span>
              <p className="font-semibold text-foreground">{grossKg.toLocaleString()} kg</p>
            </div>
            <div>
              <span className="text-xs text-text-tertiary">Tare</span>
              <p className="font-semibold text-foreground">{tareKg.toLocaleString()} kg</p>
            </div>
            <div>
              <span className="text-xs text-text-tertiary">Net</span>
              <p className="font-bold text-foreground">{netKg.toLocaleString()} kg</p>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-text-secondary hover:text-foreground rounded-lg hover:bg-muted transition">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isTriggering}
            className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold text-sm hover:bg-green-700 disabled:opacity-50 transition"
          >
            {isTriggering ? 'Confirming...' : 'Confirm & Complete'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───── Override Dialog ───── */
function OverrideDialog({ eventId, event, onClose, onSuccess }) {
  const [form, setForm] = useState({
    weight_type: 'GROSS',
    weight_kg: '',
    reason_code: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await overrideWeight(eventId, { ...form, weight_kg: Number(form.weight_kg) });
      toast.success('Weight overridden');
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Override failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-overlay/50">
      <div className="bg-surface rounded-2xl border border-border shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Override Weight</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted transition text-text-tertiary">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Weight Type</label>
            <div className="flex gap-4">
              {['GROSS', 'TARE'].map((t) => (
                <label key={t} className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="radio"
                    name="weight_type"
                    value={t}
                    checked={form.weight_type === t}
                    onChange={(e) => setForm((p) => ({ ...p, weight_type: e.target.value }))}
                    disabled={t === 'GROSS' ? !event.gross_ticket : !event.tare_ticket}
                    className="accent-primary"
                  />
                  {t}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">New Weight (kg)</label>
            <input
              type="number"
              value={form.weight_kg}
              onChange={(e) => setForm((p) => ({ ...p, weight_kg: e.target.value }))}
              required
              min="1"
              className="w-full px-3 py-2.5 rounded-lg border border-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Reason Code</label>
            <select
              value={form.reason_code}
              onChange={(e) => setForm((p) => ({ ...p, reason_code: e.target.value }))}
              required
              className="w-full px-3 py-2.5 rounded-lg border border-input text-sm text-foreground bg-surface focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition"
            >
              <option value="">Select reason...</option>
              <option value="CALIBRATION_ERROR">Calibration Error</option>
              <option value="EQUIPMENT_MALFUNCTION">Equipment Malfunction</option>
              <option value="INCORRECT_READING">Incorrect Reading</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2.5 rounded-lg border border-input text-sm text-foreground placeholder-text-placeholder focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-foreground rounded-lg hover:bg-muted transition">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:bg-primary-hover disabled:opacity-50 transition">
              {submitting ? 'Saving...' : 'Override'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ───── Skips Panel (Right Column) ───── */
function SkipsPanel({ event, eventId, fetchEvent, productCategories }) {
  const [showAdd, setShowAdd] = useState(false);
  const assets = event.assets || [];
  const isConfirmed = event.status === 'CONFIRMED';
  const isPendingGross = event.status === 'PENDING_GROSS';
  const canAdd = !isConfirmed && !isPendingGross;

  return (
    <div className="bg-surface rounded-xl border border-border p-5 h-fit">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-foreground">
          Skips <span className="ml-1 text-xs font-normal text-text-tertiary">({assets.length})</span>
        </h2>
        {canAdd && !showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1 px-2.5 py-1 bg-primary text-primary-foreground rounded-lg font-semibold text-xs hover:bg-primary-hover transition"
          >
            <Plus size={14} /> Add Skip
          </button>
        )}
      </div>

      {showAdd && (
        <AddSkipPanel
          eventId={eventId}
          productCategories={productCategories}
          onClose={() => setShowAdd(false)}
          onSuccess={async () => { setShowAdd(false); await fetchEvent(eventId); }}
        />
      )}

      {assets.length === 0 ? (
        <p className="text-sm text-text-placeholder">No skips added yet</p>
      ) : (
        <div className="space-y-2">
          {assets.map((asset) => (
            <SkipCard
              key={asset.id}
              asset={asset}
              order={event.order}
              isConfirmed={isConfirmed}
              eventId={eventId}
              fetchEvent={fetchEvent}
              productCategories={productCategories}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SkipCard({ asset, order, isConfirmed, eventId, fetchEvent, productCategories }) {
  const [showEdit, setShowEdit] = useState(false);

  async function handleDelete() {
    if (!window.confirm(`Delete skip ${asset.asset_label}?`)) return;
    try {
      await deleteAsset(asset.id);
      toast.success('Skip deleted');
      await fetchEvent(eventId);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete skip');
    }
  }

  if (showEdit) {
    return (
      <EditSkipPanel
        asset={asset}
        productCategories={productCategories}
        onClose={() => setShowEdit(false)}
        onSuccess={async () => { setShowEdit(false); await fetchEvent(eventId); }}
      />
    );
  }

  return (
    <div className="bg-muted rounded-lg p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-mono font-bold text-foreground">{asset.asset_label}</span>
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
          {SKIP_LABELS[asset.skip_type] || asset.skip_type}
        </span>
      </div>
      <p className="text-xs text-text-secondary">{asset.material_category?.code_cbs} — {asset.material_category?.description_en}</p>
      {asset.net_weight_kg && (
        <p className="text-xs text-text-tertiary mt-1">
          G: {Number(asset.gross_weight_kg || 0).toFixed(0)} / T: {Number(asset.tare_weight_kg || 0).toFixed(0)} / <strong>N: {Number(asset.net_weight_kg).toFixed(0)} kg</strong>
        </p>
      )}
      {!isConfirmed && (
        <div className="flex gap-1 mt-2">
          <button onClick={() => setShowEdit(true)} className="p-1 rounded hover:bg-surface transition text-text-tertiary hover:text-foreground">
            <Pencil size={13} />
          </button>
          <button onClick={handleDelete} className="p-1 rounded hover:bg-surface transition text-text-tertiary hover:text-red-600">
            <Trash2 size={13} />
          </button>
          <button onClick={() => printAssetLabel(asset, order)} className="p-1 rounded hover:bg-surface transition text-text-tertiary hover:text-foreground">
            <Printer size={13} />
          </button>
        </div>
      )}
      {isConfirmed && (
        <div className="flex gap-1 mt-2">
          <button onClick={() => printAssetLabel(asset, order)} className="p-1 rounded hover:bg-surface transition text-text-tertiary hover:text-foreground">
            <Printer size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

/* ───── Add Skip Panel ───── */
function AddSkipPanel({ eventId, productCategories, onClose, onSuccess }) {
  const [form, setForm] = useState({
    skip_type: '',
    material_category_id: '',
    estimated_volume_m3: '',
    notes: '',
  });
  const [nextLabel, setNextLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [catSearch, setCatSearch] = useState('');

  useEffect(() => {
    getNextLabel().then(({ data }) => setNextLabel(data.data.label)).catch(() => {});
  }, []);

  const filteredCategories = productCategories.filter(
    (c) => !catSearch || c.code_cbs.toLowerCase().includes(catSearch.toLowerCase()) || c.description_en.toLowerCase().includes(catSearch.toLowerCase())
  );

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createAsset({
        weighing_event_id: eventId,
        skip_type: form.skip_type,
        material_category_id: form.material_category_id,
        estimated_volume_m3: form.estimated_volume_m3 ? Number(form.estimated_volume_m3) : null,
        notes: form.notes || null,
      });
      toast.success('Skip added');
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add skip');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-muted rounded-lg p-4 mb-3 space-y-3">
      {nextLabel && (
        <p className="text-xs text-text-tertiary">Next label: <span className="font-mono font-bold text-foreground">{nextLabel}</span></p>
      )}
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1">Skip Type</label>
        <select
          value={form.skip_type}
          onChange={(e) => setForm((p) => ({ ...p, skip_type: e.target.value }))}
          required
          className="w-full px-2.5 py-2 rounded-lg border border-input text-sm text-foreground bg-surface focus:outline-none focus:ring-2 focus:ring-ring transition"
        >
          <option value="">Select...</option>
          {SKIP_TYPES.map((t) => <option key={t} value={t}>{SKIP_LABELS[t]}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1">Material Category</label>
        <input
          type="text"
          placeholder="Search categories..."
          value={catSearch}
          onChange={(e) => setCatSearch(e.target.value)}
          className="w-full px-2.5 py-1.5 rounded-lg border border-input text-xs text-foreground placeholder-text-placeholder mb-1 focus:outline-none focus:ring-2 focus:ring-ring transition"
        />
        <select
          value={form.material_category_id}
          onChange={(e) => setForm((p) => ({ ...p, material_category_id: e.target.value }))}
          required
          size={4}
          className="w-full px-2.5 py-1 rounded-lg border border-input text-xs text-foreground bg-surface focus:outline-none focus:ring-2 focus:ring-ring transition"
        >
          {filteredCategories.map((c) => (
            <option key={c.id} value={c.id}>{c.code_cbs} — {c.description_en}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1">Volume (m³)</label>
        <input
          type="number"
          step="0.1"
          min="0"
          value={form.estimated_volume_m3}
          onChange={(e) => setForm((p) => ({ ...p, estimated_volume_m3: e.target.value }))}
          placeholder="Optional"
          className="w-full px-2.5 py-2 rounded-lg border border-input text-sm text-foreground placeholder-text-placeholder focus:outline-none focus:ring-2 focus:ring-ring transition"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1">Notes</label>
        <input
          type="text"
          value={form.notes}
          onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          placeholder="Optional"
          className="w-full px-2.5 py-2 rounded-lg border border-input text-sm text-foreground placeholder-text-placeholder focus:outline-none focus:ring-2 focus:ring-ring transition"
        />
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs text-text-secondary hover:text-foreground rounded-lg hover:bg-surface transition">
          Cancel
        </button>
        <button type="submit" disabled={submitting} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg font-semibold text-xs hover:bg-primary-hover disabled:opacity-50 transition">
          {submitting ? 'Adding...' : 'Add Skip'}
        </button>
      </div>
    </form>
  );
}

/* ───── Edit Skip Panel ───── */
function EditSkipPanel({ asset, productCategories, onClose, onSuccess }) {
  const [form, setForm] = useState({
    skip_type: asset.skip_type,
    material_category_id: asset.material_category_id || asset.material_category?.id || '',
    estimated_volume_m3: asset.estimated_volume_m3 || '',
    notes: asset.notes || '',
  });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await updateAssetApi(asset.id, {
        skip_type: form.skip_type,
        material_category_id: form.material_category_id,
        estimated_volume_m3: form.estimated_volume_m3 ? Number(form.estimated_volume_m3) : null,
        notes: form.notes || null,
      });
      toast.success('Skip updated');
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update skip');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-muted rounded-lg p-3 space-y-2">
      <p className="text-xs font-mono font-bold text-foreground">{asset.asset_label}</p>
      <select
        value={form.skip_type}
        onChange={(e) => setForm((p) => ({ ...p, skip_type: e.target.value }))}
        required
        className="w-full px-2.5 py-1.5 rounded-lg border border-input text-xs text-foreground bg-surface focus:outline-none focus:ring-2 focus:ring-ring transition"
      >
        {SKIP_TYPES.map((t) => <option key={t} value={t}>{SKIP_LABELS[t]}</option>)}
      </select>
      <select
        value={form.material_category_id}
        onChange={(e) => setForm((p) => ({ ...p, material_category_id: e.target.value }))}
        required
        className="w-full px-2.5 py-1.5 rounded-lg border border-input text-xs text-foreground bg-surface focus:outline-none focus:ring-2 focus:ring-ring transition"
      >
        {productCategories.map((c) => (
          <option key={c.id} value={c.id}>{c.code_cbs} — {c.description_en}</option>
        ))}
      </select>
      <input
        type="number"
        step="0.1"
        min="0"
        value={form.estimated_volume_m3}
        onChange={(e) => setForm((p) => ({ ...p, estimated_volume_m3: e.target.value }))}
        placeholder="Volume (m³)"
        className="w-full px-2.5 py-1.5 rounded-lg border border-input text-xs text-foreground placeholder-text-placeholder focus:outline-none focus:ring-2 focus:ring-ring transition"
      />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="px-2.5 py-1 text-xs text-text-secondary hover:text-foreground rounded-lg hover:bg-surface transition">
          Cancel
        </button>
        <button type="submit" disabled={submitting} className="px-2.5 py-1 bg-primary text-primary-foreground rounded-lg font-semibold text-xs hover:bg-primary-hover disabled:opacity-50 transition">
          {submitting ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  );
}
