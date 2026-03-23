import { useEffect, useState, useCallback, Fragment } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Loader2, Scale, Download, Pencil, Trash2, Plus, AlertTriangle, ExternalLink, Package, Box, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore';
import ClickableStatusBadge from '../../components/ui/ClickableStatusBadge';
import SupplierTypeBadge from '../../components/ui/SupplierTypeBadge';
import {
  getInbound as getInboundApi,
  triggerNextWeighing,
  registerParcel as registerParcelApi,
  overrideWeight,
  downloadTicketPdf,
  updateInboundStatus,
  setInboundIncident,
  confirmWeighing,
  getWeighingAmendments,
} from '../../api/weighingEvents';
import { deleteAsset, getNextContainerLabel, lookupContainerByLabel } from '../../api/assets';
import { format } from 'date-fns';
import Breadcrumb from '../../components/ui/Breadcrumb';

const CONTAINER_TYPES = ['OPEN_TOP', 'CLOSED_TOP', 'GITTERBOX', 'PALLET', 'OTHER'];
const CONTAINER_TYPE_LABELS = { OPEN_TOP: 'Open Top', CLOSED_TOP: 'Closed Top', GITTERBOX: 'Gitterbox', PALLET: 'Pallet', OTHER: 'Other' };
const CONTAINER_TARE_WEIGHTS = { OPEN_TOP: 300, CLOSED_TOP: 350, GITTERBOX: 85, PALLET: 25, OTHER: 0 };

const inputClass = "w-full h-10 px-3.5 rounded-md border border-grey-300 text-sm text-grey-900 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors";
const selectClass = `${inputClass} bg-white`;

const MANUAL_TRANSITIONS = {
  WEIGHED_OUT: ['READY_FOR_SORTING'],
};

const PROGRESS_STEPS = [
  { key: 'ARRIVED', label: 'Arrived' },
  { key: 'WEIGHED_IN', label: 'Weighing' },
  { key: 'WEIGHED_OUT', label: 'Weighed Out' },
  { key: 'READY_FOR_SORTING', label: 'Ready for Sorting' },
  { key: 'SORTED', label: 'Sorted' },
];

function formatDateTime(value, pattern = 'dd MMM yyyy HH:mm') {
  return value ? format(new Date(value), pattern) : '—';
}

function printAssetLabel(asset) {
  const printWindow = window.open('', '_blank', 'width=420,height=320');
  if (!printWindow) return;

  printWindow.document.write(`
    <html>
      <head>
        <title>${asset.asset_label}</title>
        <style>
          body { font-family: monospace; padding: 24px; margin: 0; }
          .label { border: 2px solid #111827; border-radius: 12px; padding: 24px; }
          .title { font-size: 14px; letter-spacing: 0.2em; color: #6b7280; margin-bottom: 12px; }
          .code { font-size: 34px; font-weight: 700; letter-spacing: 0.08em; margin-bottom: 12px; }
          .meta { font-size: 14px; color: #374151; line-height: 1.6; }
        </style>
      </head>
      <body>
        <div class="label">
          <div class="title">STATICE ASSET LABEL</div>
          <div class="code">${asset.asset_label}</div>
          <div class="meta">
            <div>Type: ${asset.parcel_type === 'CONTAINER' ? (CONTAINER_TYPE_LABELS[asset.container_type] || asset.container_type || 'Container') : 'Material'}</div>
            <div>Waste Stream: ${asset.waste_stream?.name || '—'}</div>
            <div>Gross/Tare Pair: ${asset.gross_weight_kg != null ? Number(asset.gross_weight_kg).toLocaleString() : '—'} / ${asset.tare_weight_kg != null ? Number(asset.tare_weight_kg).toLocaleString() : '—'} kg</div>
          </div>
        </div>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 150);
}

export default function InboundDetailPage() {
  const { inboundId } = useParams();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';

  const [inbound, setInbound] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTriggering, setTriggering] = useState(false);
  const [incidentCategory, setIncidentCategory] = useState('');
  const [incidentNotes, setIncidentNotes] = useState('');

  const fetchInbound = useCallback(async (id) => {
    setIsLoading(true);
    try {
      const { data } = await getInboundApi(id);
      setInbound(data.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load inbound');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInbound(inboundId);
  }, [inboundId, fetchInbound]);

  const handleStatusChange = useCallback(async (newStatus) => {
    try {
      const { data } = await updateInboundStatus(inboundId, newStatus);
      setInbound(data.data);
      toast.success(`Status updated to ${newStatus.replace(/_/g, ' ')}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update status');
    }
  }, [inboundId]);

  const handleIncident = async () => {
    try {
      await setInboundIncident(inboundId, { incident_category: incidentCategory, notes: incidentNotes });
      toast.success('Incident reported');
      setIncidentCategory('');
      setIncidentNotes('');
      fetchInbound(inboundId);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to report incident');
    }
  };

  const handleConfirmWeighing = async (sequence) => {
    try {
      await confirmWeighing(inboundId, sequence);
      toast.success('Weighing confirmed');
      fetchInbound(inboundId);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to confirm weighing');
    }
  };

  const refreshInbound = useCallback(() => fetchInbound(inboundId), [inboundId, fetchInbound]);

  if (isLoading || !inbound) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-grey-400" size={24} />
      </div>
    );
  }

  const order = inbound.order;
  const assets = inbound.assets || [];
  const weighings = inbound.weighings || [];
  const allowedManual = MANUAL_TRANSITIONS[inbound.status] || [];

  // Order waste streams for parcel registration
  const orderWasteStreams = order?.waste_streams?.map((ws) => ws.waste_stream) || [];
  if (orderWasteStreams.length === 0 && order?.waste_stream) {
    orderWasteStreams.push(order.waste_stream);
  }

  return (
    <div>
      <Breadcrumb items={[{ label: 'Inbounds', to: '/inbounds' }, { label: inbound.inbound_number || 'Inbound' }]} />

      {/* Title + Status */}
      <div className="flex items-center mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-semibold text-grey-900">{inbound.inbound_number || 'Inbound'}</h1>
          <ClickableStatusBadge
            status={inbound.status}
            allowedTransitions={allowedManual}
            onTransition={handleStatusChange}
          />
          {inbound.order?.is_lzv && (
            <span className="text-sm font-medium text-grey-700 ml-2">LZV Vehicle</span>
          )}
          {inbound.incident_category && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
              Incident: {inbound.incident_category.replace('_', ' ')}
            </span>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <ProgressBar status={inbound.status} />

      {/* Info Card */}
      <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-4 mb-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="grid flex-1 grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-y-3 gap-x-6 min-w-0">
            <InfoField label="Carrier" value={order?.carrier?.name} />
            <InfoField label="Supplier">
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-sm font-medium text-grey-900">{order?.supplier?.name || '—'}</span>
                <SupplierTypeBadge type={order?.supplier?.supplier_type} />
              </div>
            </InfoField>
            <InfoField label="Vehicle Plate">
              <span className="font-mono text-sm font-bold tracking-wider text-grey-900">
                {inbound.vehicle?.registration_plate || '—'}
              </span>
            </InfoField>
            <InfoField label="Waste Stream(s)" value={orderWasteStreams.map((ws) => `${ws.name} (${ws.code})`).join(', ') || '—'} />
            <InfoField label="Arrived At" value={formatDateTime(inbound.arrived_at)} />
            {inbound.notes && <InfoField className="sm:col-span-2 xl:col-span-5" label="Notes" value={inbound.notes} />}
          </div>
          {/* Incident Section */}
          {!['READY_FOR_SORTING', 'SORTED'].includes(inbound.status) && (
            <div className="mt-4 pt-4 border-t border-grey-200">
              <h4 className="text-sm font-medium text-grey-700 mb-2">Report Incident</h4>
              <div className="flex gap-2">
                <select
                  value={incidentCategory}
                  onChange={e => setIncidentCategory(e.target.value)}
                  className="h-10 px-3.5 rounded-md border border-grey-300 text-sm text-grey-900 bg-white focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors"
                >
                  <option value="">Select incident type...</option>
                  <option value="DAMAGE">Damage</option>
                  <option value="DISPUTE">Dispute</option>
                  <option value="SPECIAL_HANDLING">Special Handling</option>
                  <option value="DRIVER_INSTRUCTION">Driver Instruction</option>
                </select>
                <input
                  type="text"
                  placeholder="Notes..."
                  value={incidentNotes}
                  onChange={e => setIncidentNotes(e.target.value)}
                  className="flex-1 h-10 px-3.5 rounded-md border border-grey-300 text-sm text-grey-900 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors"
                />
                <button
                  onClick={handleIncident}
                  disabled={!incidentCategory}
                  className="h-10 px-4 bg-red-500 text-white rounded-md text-sm font-semibold hover:bg-red-600 disabled:opacity-50 transition-colors"
                >
                  Report
                </button>
              </div>
            </div>
          )}
          <InfoField className="lg:min-w-[180px] lg:text-right" label="Order Name">
            <Link
              to={`/orders/${inbound.order_id}`}
              className="inline-flex items-center gap-1 text-sm font-semibold text-green-600 hover:text-green-700 transition-colors"
            >
              {order?.order_number || '—'}
              <ExternalLink size={12} />
            </Link>
          </InfoField>
        </div>
      </div>

      {/* Weighing + Parcels side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <WeighingFlowSection
          inbound={inbound}
          inboundId={inboundId}
          weighings={weighings}
          assets={assets}
          orderWasteStreams={orderWasteStreams}
          isTriggering={isTriggering}
          setTriggering={setTriggering}
          setInbound={setInbound}
          refreshInbound={refreshInbound}
          isAdmin={isAdmin}
          user={user}
          onConfirmWeighing={handleConfirmWeighing}
        />

        <ParcelsTable
          inbound={inbound}
          assets={assets}
          refreshInbound={refreshInbound}
        />
      </div>

      {/* Actions */}
      <ActionsFooter
        inbound={inbound}
        inboundId={inboundId}
        isTriggering={isTriggering}
        setTriggering={setTriggering}
        setInbound={setInbound}
      />
    </div>
  );
}

/* ───── Progress Bar ───── */
function ProgressBar({ status }) {
  const currentIndex = PROGRESS_STEPS.findIndex((s) => s.key === status);

  return (
    <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-4 mb-4">
      <div className="flex items-center gap-2">
        {PROGRESS_STEPS.map((step, i) => (
          <Fragment key={step.key}>
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-[11px] font-semibold transition-colors ${
                i < currentIndex
                  ? 'bg-green-500 border-green-500 text-white'
                  : i === currentIndex
                    ? 'bg-green-500 border-green-500 text-white'
                    : 'bg-white border-grey-300 text-grey-400'
              }`}>
                {i < currentIndex ? <Check size={14} /> : i + 1}
              </div>
              <span className={`text-xs font-medium hidden sm:inline ${
                i <= currentIndex ? 'text-grey-900' : 'text-grey-400'
              }`}>
                {step.label}
              </span>
            </div>
            {i < PROGRESS_STEPS.length - 1 && (
              <div className={`flex-1 h-[2px] ${i < currentIndex ? 'bg-green-500' : 'bg-grey-200'}`} />
            )}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

/* ───── Info Field ───── */
function InfoField({ label, value, children, className = '' }) {
  return (
    <div className={`min-w-0 overflow-hidden ${className}`}>
      <span className="text-xs font-medium text-grey-500 uppercase tracking-wide">{label}</span>
      {children ? <div className="mt-0.5 min-w-0">{children}</div> : <p className="text-sm font-medium text-grey-900 mt-0.5 break-words">{value ?? '—'}</p>}
    </div>
  );
}

/* ───── Weighing Flow Section ───── */
function WeighingFlowSection({ inbound, inboundId, weighings, assets, orderWasteStreams, isTriggering, setTriggering, setInbound, refreshInbound, isAdmin, user, onConfirmWeighing }) {
  const [showManualFallback, setShowManualFallback] = useState(false);
  const [showOverride, setShowOverride] = useState(false);
  const [registeredParcel, setRegisteredParcel] = useState(null);

  const isTerminal = ['READY_FOR_SORTING', 'SORTED'].includes(inbound.status);

  const handleWeighing = useCallback(async (isTare = false) => {
    setTriggering(true);
    try {
      const { data } = await triggerNextWeighing(inboundId, { is_tare: isTare });
      setInbound(data.data);
      const label = weighings.length === 0 ? 'First weighing' : isTare ? 'Tare weighing' : 'Weighing';
      toast.success(`${label} complete`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Weighing failed');
      setShowManualFallback(true);
    } finally {
      setTriggering(false);
    }
  }, [inboundId, weighings.length, setTriggering, setInbound]);

  const handleParcelRegistered = useCallback((parcel) => {
    setRegisteredParcel(parcel);
    refreshInbound();
  }, [refreshInbound]);

  return (
    <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-4 self-start">
      <h2 className="text-sm font-semibold text-grey-900 mb-2">Weighing Process</h2>

      {/* Summary stats */}
      {weighings.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap mb-3">
          {inbound.gross_weight_kg && (
            <span className="text-xs text-grey-500">Gross: <strong className="text-grey-700">{Number(inbound.gross_weight_kg).toLocaleString()} kg</strong></span>
          )}
          {inbound.tare_weight_kg && (
            <span className="text-xs text-grey-500">Tare: <strong className="text-grey-700">{Number(inbound.tare_weight_kg).toLocaleString()} kg</strong></span>
          )}
          {inbound.net_weight_kg && (
            <span className="text-xs text-green-600">Net: <strong>{Number(inbound.net_weight_kg).toLocaleString()} kg</strong></span>
          )}
          {isAdmin && (
            <button
              onClick={() => setShowOverride(true)}
              className="h-7 px-2.5 flex items-center gap-1 border border-grey-300 rounded-md text-[11px] font-medium text-grey-700 hover:bg-grey-50 transition-colors"
            >
              <Pencil size={11} /> Override
            </button>
          )}
        </div>
      )}

      {/* Weighing Timeline */}
      {weighings.length > 0 && (
        <WeighingTimeline weighings={weighings} assets={assets} user={user} onConfirmWeighing={onConfirmWeighing} />
      )}

      {/* First Weighing Button */}
      {inbound.can_weigh_first && !isTerminal && (
        <div className="mt-3">
          <button
            onClick={() => handleWeighing(false)}
            disabled={isTriggering}
            className="h-12 px-6 flex items-center gap-2 bg-green-500 text-white rounded-md font-semibold text-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {isTriggering ? <Loader2 className="animate-spin" size={18} /> : <Scale size={18} />}
            First Weighing (Gross)
          </button>
        </div>
      )}

      {/* Parcel Registration Form */}
      {inbound.can_register_parcel && !isTerminal && (
        <div className="mt-4">
          <ParcelRegistrationForm
            inboundId={inboundId}
            orderWasteStreams={orderWasteStreams}
            onSuccess={handleParcelRegistered}
          />
        </div>
      )}

      {/* Registered Parcel Confirmation */}
      {registeredParcel && (
        <div className="mt-3 bg-green-25 border border-green-300 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <Check size={16} className="text-green-700" />
            <span className="text-sm font-semibold text-green-700">Parcel Registered</span>
          </div>
          <p className="text-2xl font-mono font-bold text-green-700 tracking-wider">{registeredParcel.asset_label}</p>
          <p className="text-xs text-green-600 mt-1">Write this ID on the cargo packaging for tracking</p>
          <div className="mt-3 flex gap-3">
            <button onClick={() => printAssetLabel(registeredParcel)} className="text-xs font-semibold text-green-700 underline">Print Label</button>
            <button onClick={() => setRegisteredParcel(null)} className="text-xs text-green-700 underline">Dismiss</button>
          </div>
        </div>
      )}

      {/* Next Weighing / Tare Buttons */}
      {inbound.can_weigh_next && !isTerminal && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => handleWeighing(false)}
            disabled={isTriggering}
            className="h-10 px-5 flex items-center gap-2 bg-green-500 text-white rounded-md font-semibold text-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {isTriggering ? <Loader2 className="animate-spin" size={16} /> : <Scale size={16} />}
            Next Weighing
          </button>
          <button
            onClick={() => handleWeighing(true)}
            disabled={isTriggering}
            className="h-10 px-5 flex items-center gap-2 border-2 border-green-500 text-green-700 rounded-md font-semibold text-sm hover:bg-green-25 disabled:opacity-50 transition-colors"
          >
            {isTriggering ? <Loader2 className="animate-spin" size={16} /> : <Scale size={16} />}
            Final Weighing (Tare)
          </button>
        </div>
      )}

      {/* Manual Weighing Fallback */}
      {showManualFallback && (
        <ManualWeighingDialog
          inboundId={inboundId}
          isTare={inbound.can_weigh_tare}
          onSuccess={async (data) => { setInbound(data); setShowManualFallback(false); }}
          onClose={() => setShowManualFallback(false)}
        />
      )}

      {/* Override Dialog */}
      {showOverride && (
        <OverrideDialog
          inboundId={inboundId}
          weighings={weighings}
          onClose={() => setShowOverride(false)}
          onSuccess={async () => { setShowOverride(false); await refreshInbound(); }}
        />
      )}
    </div>
  );
}

/* ───── Weighing Timeline ───── */
function WeighingTimeline({ weighings, assets, user, onConfirmWeighing }) {
  // Build interleaved list: W1, P1, W2, P2, ... Wn
  const items = [];
  weighings.forEach((w) => {
    items.push({ type: 'weighing', data: w });
    const parcel = assets.find((a) => a.sequence === w.sequence);
    if (parcel) items.push({ type: 'parcel', data: parcel });
  });

  return (
    <div className="space-y-1.5">
      {items.map((item) => {
        if (item.type === 'weighing') {
          const w = item.data;
          const ticket = w.pfister_ticket;
          const typeLabel = w.sequence === 1 ? 'Gross' : w.is_tare ? 'Tare' : `Weighing ${w.sequence}`;
          return (
            <div key={w.id} className="inline-block bg-green-25 border border-green-200 rounded-lg px-4 py-2.5">
              <div className="flex items-center gap-2">
                <Scale size={16} className="text-green-600 shrink-0" />
                <span className="text-base font-semibold text-green-800">{typeLabel}</span>
                <span className="text-base font-bold text-green-900 tabular-nums">{Number(w.weight_kg).toLocaleString()} kg</span>
                {ticket?.is_manual_override && <span className="text-[10px] text-orange-600 font-medium">(manual)</span>}
                {ticket?.is_confirmed && (
                  <span className="text-xs text-green-600" title="Confirmed">&#x1f512;</span>
                )}
              </div>
              {ticket && (
                <p className="text-xs text-green-500 font-mono mt-1 ml-6">{ticket.ticket_number} &middot; {format(new Date(ticket.timestamp), 'dd.MM.yyyy HH:mm')}</p>
              )}
            </div>
          );
        }

        // Parcel entry
        const p = item.data;
        const carrierLabel = p.container_type ? CONTAINER_TYPE_LABELS[p.container_type] : 'Loose';
        return (
          <div key={p.id} className="flex items-center gap-2 px-4 py-1.5 ml-4">
            <Package size={14} className="text-grey-400 shrink-0" />
            <span className="text-xs font-medium text-grey-400 uppercase tracking-wide">Parcel</span>
            <span className="text-sm font-semibold text-grey-900">{p.asset_label}</span>
            <span className="text-xs text-grey-400">&middot;</span>
            <span className="text-xs text-grey-500">{carrierLabel}</span>
            {p.net_weight_kg != null && (
              <>
                <span className="text-xs text-grey-400">&middot;</span>
                <span className="text-sm font-bold text-grey-700 tabular-nums">{Number(p.net_weight_kg).toLocaleString()} kg</span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ───── Parcel Registration Form ───── */
function ParcelRegistrationForm({ inboundId, orderWasteStreams, onSuccess }) {
  const [registrationMode, setRegistrationMode] = useState('new_container'); // 'new_container' | 'existing_container' | 'no_container'
  const [form, setForm] = useState({
    container_label: '',
    container_type: '',
    estimated_tare_weight_kg: '',
    waste_stream_id: orderWasteStreams.length === 1 ? orderWasteStreams[0].id : '',
    estimated_volume_m3: '',
    notes: '',
  });
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fetch next container label when switching to new_container mode
  useEffect(() => {
    if (registrationMode === 'new_container') {
      getNextContainerLabel().then(({ data }) => {
        setForm((p) => ({ ...p, container_label: data.data.label }));
      }).catch(() => {});
    }
  }, [registrationMode]);

  const isExisting = registrationMode === 'existing_container';
  const isContainer = registrationMode !== 'no_container';

  const handleLookup = useCallback(async (label) => {
    if (!label || label.length < 3) { setLookupResult(null); return; }
    setLookupLoading(true);
    try {
      const { data } = await lookupContainerByLabel(label);
      if (data.data) {
        setLookupResult(data.data);
        setForm((p) => ({
          ...p,
          container_type: data.data.container_type || '',
          estimated_volume_m3: data.data.estimated_volume_m3 ? String(data.data.estimated_volume_m3) : '',
          estimated_tare_weight_kg: data.data.estimated_tare_weight_kg ? String(data.data.estimated_tare_weight_kg) : '',
        }));
      } else {
        setLookupResult(null);
      }
    } catch {
      setLookupResult(null);
    } finally {
      setLookupLoading(false);
    }
  }, []);

  function handleContainerTypeChange(val) {
    const tare = CONTAINER_TARE_WEIGHTS[val] != null ? String(CONTAINER_TARE_WEIGHTS[val]) : '';
    setForm((p) => ({ ...p, container_type: val, estimated_tare_weight_kg: tare }));
  }

  function handleModeChange(mode) {
    setRegistrationMode(mode);
    setLookupResult(null);
    setForm((p) => ({
      ...p,
      container_label: '',
      container_type: '',
      estimated_tare_weight_kg: '',
      estimated_volume_m3: '',
    }));
  }

  function resetForm() {
    setLookupResult(null);
    setForm({
      container_label: '',
      container_type: '',
      estimated_tare_weight_kg: '',
      waste_stream_id: orderWasteStreams.length === 1 ? orderWasteStreams[0].id : '',
      estimated_volume_m3: '',
      notes: '',
    });
    // Refresh container label for next registration
    if (registrationMode === 'new_container') {
      getNextContainerLabel().then(({ data }) => {
        setForm((p) => ({ ...p, container_label: data.data.label }));
      }).catch(() => {});
    }
  }

  function buildPayload() {
    const payload = {
      parcel_type: isContainer ? 'CONTAINER' : 'MATERIAL',
      waste_stream_id: form.waste_stream_id || null,
      estimated_volume_m3: form.estimated_volume_m3 ? Number(form.estimated_volume_m3) : null,
      estimated_tare_weight_kg: form.estimated_tare_weight_kg ? Number(form.estimated_tare_weight_kg) : null,
      notes: form.notes || null,
    };
    if (registrationMode === 'new_container') {
      payload.container_type = form.container_type;
      payload.container_label = form.container_label || null;
    } else if (registrationMode === 'existing_container') {
      payload.container_type = form.container_type;
      payload.existing_container_label = form.container_label || null;
    }
    return payload;
  }

  async function handleContinue() {
    if (isContainer && registrationMode === 'new_container' && !form.container_type) return;
    if (isContainer && registrationMode === 'existing_container' && !lookupResult) return;
    setSubmitting(true);
    try {
      const payload = buildPayload();
      const { data } = await registerParcelApi(inboundId, payload);
      toast.success('Parcel registered');
      // Trigger next weighing (non-tare)
      try {
        await triggerNextWeighing(inboundId, { is_tare: false });
        toast.success('Next weighing complete');
      } catch (err) {
        toast.error(err.response?.data?.error || 'Weighing failed — register manually');
      }
      onSuccess(data.data);
      resetForm();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to register parcel');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFinalize() {
    if (isContainer && registrationMode === 'new_container' && !form.container_type) return;
    if (isContainer && registrationMode === 'existing_container' && !lookupResult) return;
    setSubmitting(true);
    try {
      const payload = buildPayload();
      const { data } = await registerParcelApi(inboundId, payload);
      toast.success('Parcel registered');
      // Trigger tare weighing to finalize
      try {
        await triggerNextWeighing(inboundId, { is_tare: true });
        toast.success('Tare weighing complete — weighing finalized');
      } catch (err) {
        toast.error(err.response?.data?.error || 'Tare weighing failed — trigger manually');
      }
      onSuccess(data.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to register parcel');
    } finally {
      setSubmitting(false);
    }
  }

  const continueDisabled = submitting || (isContainer && registrationMode === 'new_container' && !form.container_type) || (isContainer && registrationMode === 'existing_container' && !lookupResult);
  const finalizeDisabled = continueDisabled;

  return (
    <div className="bg-grey-50 rounded-lg border border-grey-200 p-4">
      <h3 className="text-sm font-semibold text-grey-900 mb-3">Register Unloaded Cargo</h3>

      {/* 3-option radio */}
      <div className="flex gap-4 mb-4">
        {[
          { value: 'new_container', icon: <Box size={14} />, label: 'New Container' },
          { value: 'existing_container', icon: <Box size={14} />, label: 'Existing Container' },
          { value: 'no_container', icon: <Package size={14} />, label: 'No Container' },
        ].map((opt) => (
          <label key={opt.value} className="flex items-center gap-2 text-sm text-grey-700 cursor-pointer">
            <input
              type="radio"
              name="registrationMode"
              value={opt.value}
              checked={registrationMode === opt.value}
              onChange={() => handleModeChange(opt.value)}
              className="accent-green-500"
            />
            <span className="flex items-center gap-1.5">
              {opt.icon} {opt.label}
            </span>
          </label>
        ))}
      </div>

      {/* Container ID — New Container mode */}
      {registrationMode === 'new_container' && (
        <div className="mb-3">
          <label className="block text-xs font-medium text-grey-700 mb-1">Container ID</label>
          <input
            type="text"
            value={form.container_label}
            onChange={(e) => setForm((p) => ({ ...p, container_label: e.target.value.toUpperCase() }))}
            placeholder="CNT-00001"
            className={`${inputClass} font-mono`}
          />
        </div>
      )}

      {/* Container ID — Existing Container mode (lookup) */}
      {registrationMode === 'existing_container' && (
        <div className="mb-3">
          <label className="block text-xs font-medium text-grey-700 mb-1">Container ID</label>
          <input
            type="text"
            value={form.container_label}
            onChange={(e) => {
              const val = e.target.value.toUpperCase();
              setForm((p) => ({ ...p, container_label: val }));
              handleLookup(val);
            }}
            placeholder="CNT-00001"
            className={`${inputClass} font-mono`}
          />
          {lookupLoading && <p className="text-xs text-grey-400 mt-1">Searching...</p>}
          {lookupResult && (
            <p className="text-xs text-green-600 mt-1">Found: {lookupResult.container_label} — {CONTAINER_TYPE_LABELS[lookupResult.container_type] || lookupResult.container_type}</p>
          )}
          {!lookupLoading && form.container_label.length >= 3 && !lookupResult && (
            <p className="text-xs text-red-500 mt-1">Container not found</p>
          )}
        </div>
      )}

      {/* Container fields (type, tare, volume) */}
      {isContainer && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium text-grey-700 mb-1">Container Type <span className="text-red-500">*</span></label>
            <select
              value={form.container_type}
              onChange={(e) => handleContainerTypeChange(e.target.value)}
              disabled={isExisting}
              className={`${selectClass} ${isExisting ? 'bg-grey-100 text-grey-500 cursor-not-allowed' : ''}`}
            >
              <option value="">Select...</option>
              {CONTAINER_TYPES.map((t) => <option key={t} value={t}>{CONTAINER_TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-grey-700 mb-1">Tare Weight (kg)</label>
            <input
              type="number"
              step="1"
              min="0"
              placeholder="Auto"
              value={form.estimated_tare_weight_kg}
              onChange={(e) => setForm((p) => ({ ...p, estimated_tare_weight_kg: e.target.value }))}
              disabled={isExisting}
              className={`${inputClass} ${isExisting ? 'bg-grey-100 text-grey-500 cursor-not-allowed' : ''}`}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-grey-700 mb-1">Volume (m³)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              placeholder="Optional"
              value={form.estimated_volume_m3}
              onChange={(e) => setForm((p) => ({ ...p, estimated_volume_m3: e.target.value }))}
              disabled={isExisting}
              className={`${inputClass} ${isExisting ? 'bg-grey-100 text-grey-500 cursor-not-allowed' : ''}`}
            />
          </div>
        </div>
      )}

      {/* Waste Stream + Notes — all modes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs font-medium text-grey-700 mb-1">Waste Stream</label>
          {orderWasteStreams.length <= 1 ? (
            <div className="h-10 bg-grey-50 border border-grey-200 rounded-md px-3.5 text-sm text-grey-700 flex items-center">
              {orderWasteStreams[0]?.name || '—'}
            </div>
          ) : (
            <select value={form.waste_stream_id} onChange={(e) => setForm((p) => ({ ...p, waste_stream_id: e.target.value }))} className={selectClass}>
              <option value="">Select...</option>
              {orderWasteStreams.map((ws) => <option key={ws.id} value={ws.id}>{ws.name} ({ws.code})</option>)}
            </select>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-grey-700 mb-1">Notes</label>
          <input type="text" placeholder="Optional"
            value={form.notes}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            className={inputClass} />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={handleFinalize}
          disabled={finalizeDisabled}
          className="h-9 px-5 border-2 border-green-500 text-green-700 rounded-md font-semibold text-sm hover:bg-green-25 disabled:opacity-50 transition-colors flex items-center gap-2"
        >
          {submitting ? <Loader2 className="animate-spin" size={14} /> : <Scale size={14} />}
          Finalize Weighing
        </button>
        <button
          type="button"
          onClick={handleContinue}
          disabled={continueDisabled}
          className="h-9 px-5 bg-green-500 text-white rounded-md font-semibold text-sm hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center gap-2"
        >
          {submitting ? <Loader2 className="animate-spin" size={14} /> : <Scale size={14} />}
          Continue Next Weighing
        </button>
      </div>
    </div>
  );
}

/* ───── Parcels Table ───── */
function ParcelsTable({ inbound, assets, refreshInbound }) {
  const isTerminal = ['READY_FOR_SORTING', 'SORTED'].includes(inbound.status);
  const totalNet = assets.reduce((sum, a) => sum + (Number(a.net_weight_kg) || 0), 0);

  if (assets.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-4 self-start">
        <h2 className="text-sm font-semibold text-grey-900 mb-3">Parcels</h2>
        <p className="text-sm text-grey-400 py-4 text-center">No parcels registered yet</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-4 self-start">
      <h2 className="text-sm font-semibold text-grey-900 mb-3">
        Parcels <span className="ml-1 text-xs font-normal text-grey-500">({assets.length})</span>
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-grey-50 border-b border-grey-200">
              <th className="px-2.5 py-2 text-left text-xs font-medium text-grey-500 uppercase tracking-wide">Parcel ID</th>
              <th className="px-2.5 py-2 text-left text-xs font-medium text-grey-500 uppercase tracking-wide">Container ID</th>
              <th className="px-2.5 py-2 text-right text-xs font-medium text-grey-500 uppercase tracking-wide">Gross (kg)</th>
              <th className="px-2.5 py-2 text-right text-xs font-medium text-grey-500 uppercase tracking-wide">Tare (kg)</th>
              <th className="px-2.5 py-2 text-right text-xs font-medium text-grey-500 uppercase tracking-wide">Net (kg)</th>
              <th className="px-2.5 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {assets.map((asset) => (
              <tr key={asset.id} className="border-b border-grey-100 hover:bg-grey-50 group">
                <td className="px-2.5 py-2.5">
                  <span className="text-sm font-semibold text-grey-900">{asset.asset_label}</span>
                  {asset.notes && <p className="text-[11px] text-grey-400 mt-0.5 truncate max-w-[140px]">{asset.notes}</p>}
                </td>
                <td className="px-2.5 py-2.5 text-sm font-mono text-grey-700">
                  {asset.container_label || '—'}
                </td>
                <td className="px-2.5 py-2.5 text-right text-sm text-grey-700 tabular-nums">
                  {asset.gross_weight_kg != null ? Number(asset.gross_weight_kg).toLocaleString() : '—'}
                </td>
                <td className="px-2.5 py-2.5 text-right text-sm text-grey-700 tabular-nums">
                  {asset.tare_weight_kg != null ? Number(asset.tare_weight_kg).toLocaleString() : '—'}
                </td>
                <td className="px-2.5 py-2.5 text-right text-sm font-bold text-grey-900 tabular-nums">
                  {asset.net_weight_kg != null ? Number(asset.net_weight_kg).toLocaleString() : '—'}
                </td>
                <td className="px-2.5 py-2.5 text-right">
                  {!isTerminal && (
                    <button
                      onClick={async () => {
                        if (!window.confirm(`Delete parcel ${asset.asset_label}?`)) return;
                        try {
                          await deleteAsset(asset.id);
                          toast.success('Parcel deleted');
                          await refreshInbound();
                        } catch (err) {
                          toast.error(err.response?.data?.error || 'Failed to delete');
                        }
                      }}
                      className="p-1 rounded-md hover:bg-grey-100 text-grey-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-grey-300 bg-grey-50">
              <td className="px-2.5 py-2 text-xs font-semibold text-grey-700">Total</td>
              <td className="px-2.5 py-2 text-xs text-grey-500">{assets.length} parcel(s)</td>
              <td></td>
              <td></td>
              <td className="px-2.5 py-2 text-right text-sm font-bold text-grey-900 tabular-nums">{totalNet ? totalNet.toLocaleString() : '—'}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/* ───── Actions Footer ───── */
function ActionsFooter({ inbound, inboundId, isTriggering, setTriggering, setInbound }) {
  const handleReadyForSorting = useCallback(async () => {
    setTriggering(true);
    try {
      const { data } = await updateInboundStatus(inboundId, 'READY_FOR_SORTING');
      setInbound(data.data);
      toast.success('Inbound ready for sorting — sorting process created');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update status');
    } finally {
      setTriggering(false);
    }
  }, [inboundId, setTriggering, setInbound]);

  const handleDownloadPdf = useCallback(async () => {
    try {
      const response = await downloadTicketPdf(inboundId);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `weight-ticket-${inbound.inbound_number || inboundId.slice(0, 8)}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download PDF');
    }
  }, [inboundId, inbound.inbound_number]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {inbound.status === 'WEIGHED_OUT' && (
        <button
          onClick={handleReadyForSorting}
          disabled={isTriggering}
          className="h-10 px-6 flex items-center gap-2 bg-green-500 text-white rounded-md font-semibold text-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          Ready for Sorting
        </button>
      )}

      {['WEIGHED_OUT', 'READY_FOR_SORTING', 'SORTED'].includes(inbound.status) && (
        <>
          <button
            onClick={handleDownloadPdf}
            className="h-9 px-4 flex items-center gap-2 bg-green-500 text-white rounded-md font-semibold text-sm hover:bg-green-700 transition-colors"
          >
            <Download size={16} /> Download Weight Ticket
          </button>
          {inbound.sorting_session && (
            <Link
              to={`/sorting/${inbound.sorting_session.id}`}
              className="h-9 px-4 flex items-center gap-2 border border-grey-300 rounded-md font-semibold text-sm text-grey-700 hover:bg-grey-50 transition-colors"
            >
              View Sorting Process
            </Link>
          )}
        </>
      )}
    </div>
  );
}

/* ───── Manual Weighing Dialog ───── */
function ManualWeighingDialog({ inboundId, isTare, onSuccess, onClose }) {
  const [form, setForm] = useState({ weight_kg: '', reason: '', is_tare: false });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data } = await triggerNextWeighing(inboundId, {
        is_tare: form.is_tare,
        is_manual: true,
        manual_weight_kg: Number(form.weight_kg),
        manual_reason: form.reason,
      });
      toast.success('Manual weight recorded');
      onSuccess(data.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Manual entry failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-3 bg-orange-50 border border-orange-200 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle size={16} className="text-orange-500" />
        <span className="text-sm font-semibold text-grey-900">Manual Weight Entry</span>
      </div>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-grey-700 mb-1">Weight (kg)</label>
          <input type="number" value={form.weight_kg} onChange={(e) => setForm((p) => ({ ...p, weight_kg: e.target.value }))} required min="1" className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-grey-700 mb-1">Reason</label>
          <select value={form.reason} onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))} required className={selectClass}>
            <option value="">Select...</option>
            <option value="Pfister unavailable">Pfister unavailable</option>
            <option value="Communication error">Communication error</option>
            <option value="Calibration in progress">Calibration in progress</option>
            <option value="Other">Other</option>
          </select>
        </div>
        {isTare && (
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-grey-700">
              <input type="checkbox" checked={form.is_tare} onChange={(e) => setForm((p) => ({ ...p, is_tare: e.target.checked }))} className="w-4 h-4 rounded border-grey-300 text-green-500 focus:ring-green-500" />
              This is the tare
            </label>
          </div>
        )}
        <div className="flex items-end gap-2">
          <button type="button" onClick={onClose} className="h-10 px-3 text-xs text-grey-700 hover:text-grey-900 rounded-md hover:bg-white transition-colors">Cancel</button>
          <button type="submit" disabled={submitting} className="h-10 px-4 bg-orange-500 text-white rounded-md font-semibold text-xs hover:bg-orange-600 disabled:opacity-50 transition-colors">
            {submitting ? 'Recording...' : 'Record Weight'}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ───── Override Dialog ───── */
function OverrideDialog({ inboundId, weighings, onClose, onSuccess }) {
  const [form, setForm] = useState({ sequence: weighings[0]?.sequence || 1, weight_kg: '', reason_code: '' });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await overrideWeight(inboundId, { ...form, weight_kg: Number(form.weight_kg) });
      toast.success('Weight overridden');
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Override failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app-modal-overlay">
      <div className="app-modal-panel max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-grey-200">
          <h2 className="text-lg font-semibold text-grey-900">Override Weight</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-grey-50 text-grey-400">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-grey-700 mb-1.5">Weighing</label>
            <select value={form.sequence} onChange={(e) => setForm((p) => ({ ...p, sequence: parseInt(e.target.value, 10) }))} className={selectClass}>
              {weighings.map((w) => (
                <option key={w.sequence} value={w.sequence}>
                  Weighing {w.sequence} ({w.is_tare ? 'Tare' : w.sequence === 1 ? 'Gross' : 'Intermediate'}) — {Number(w.weight_kg).toLocaleString()} kg
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-grey-700 mb-1.5">New Weight (kg)</label>
            <input type="number" value={form.weight_kg} onChange={(e) => setForm((p) => ({ ...p, weight_kg: e.target.value }))} required min="1" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-grey-700 mb-1.5">Reason Code</label>
            <select value={form.reason_code} onChange={(e) => setForm((p) => ({ ...p, reason_code: e.target.value }))} required className={selectClass}>
              <option value="">Select reason...</option>
              <option value="CALIBRATION_ERROR">Calibration Error</option>
              <option value="EQUIPMENT_MALFUNCTION">Equipment Malfunction</option>
              <option value="INCORRECT_READING">Incorrect Reading</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="h-9 px-4 bg-white text-grey-700 border border-grey-300 rounded-md text-sm font-semibold hover:bg-grey-50 transition-colors">Cancel</button>
            <button type="submit" disabled={submitting} className="h-9 px-4 bg-green-500 text-white rounded-md font-semibold text-sm hover:bg-green-700 disabled:opacity-50 transition-colors">
              {submitting ? 'Saving...' : 'Override'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
