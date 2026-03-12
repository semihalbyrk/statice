import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Loader2, Scale, Download, Pencil, Trash2, Plus, Printer, AlertTriangle, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore';
import useMasterDataStore from '../../store/masterDataStore';
import ClickableStatusBadge from '../../components/ui/ClickableStatusBadge';
import {
  getInbound as getInboundApi,
  triggerGrossWeighing,
  triggerTareWeighing,
  manualWeighing as manualWeighingApi,
  overrideWeight,
  downloadTicketPdf,
  updateInboundStatus,
  setInboundWasteStream,
} from '../../api/weighingEvents';
import { createAsset, updateAsset as updateAssetApi, deleteAsset, getNextLabel, setAssetGrossWeight } from '../../api/assets';
import { printAssetLabel } from '../../utils/printLabel';
import { format } from 'date-fns';
import Breadcrumb from '../../components/ui/Breadcrumb';

const SKIP_TYPES = ['OPEN_TOP', 'CLOSED_TOP', 'GITTERBOX', 'PALLET', 'OTHER'];
const SKIP_LABELS = { OPEN_TOP: 'Open Top', CLOSED_TOP: 'Closed Top', GITTERBOX: 'Gitterbox', PALLET: 'Pallet', OTHER: 'Other' };

const inputClass = "w-full h-10 px-3.5 rounded-md border border-grey-300 text-sm text-grey-900 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors";
const selectClass = `${inputClass} bg-white`;

// Manual transitions allowed by the operator (auto-transitions happen on backend)
const MANUAL_TRANSITIONS = {
  WEIGHED_OUT: ['READY_FOR_SORTING'],
};

function formatDateTime(value, pattern = 'dd MMM yyyy HH:mm') {
  return value ? format(new Date(value), pattern) : '—';
}

function formatTicketTimestamp(ticket) {
  return ticket?.timestamp ? format(new Date(ticket.timestamp), 'dd.MM.yyyy - HH:mm:ss') : '—';
}

export default function InboundDetailPage() {
  const { inboundId } = useParams();
  const user = useAuthStore((s) => s.user);
  const { wasteStreams } = useMasterDataStore();
  const isAdmin = user?.role === 'ADMIN';

  const [inbound, setInbound] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTriggering, setTriggering] = useState(false);

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
  const allowedManual = MANUAL_TRANSITIONS[inbound.status] || [];

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
        </div>
      </div>

      {/* Horizontal Info Card */}
      <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-4 mb-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="grid flex-1 grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-y-3 gap-x-6">
            <InfoField label="Carrier" value={order?.carrier?.name} />
            <InfoField label="Supplier" value={order?.supplier?.name} />
            <InfoField label="Vehicle Plate">
              <span className="font-mono text-sm font-bold tracking-wider text-grey-900">
                {inbound.vehicle?.registration_plate || '—'}
              </span>
            </InfoField>
            <InfoField label="Waste Stream" value={
              inbound.waste_stream
                ? `${inbound.waste_stream.name_en} (${inbound.waste_stream.code})`
                : order?.waste_stream
                  ? `${order.waste_stream.name_en} (${order.waste_stream.code})`
                  : '—'
            } />
            <InfoField label="Arrived At" value={formatDateTime(inbound.arrived_at)} />
            {inbound.notes && <InfoField className="sm:col-span-2 xl:col-span-5" label="Notes" value={inbound.notes} />}
          </div>
          <InfoField className="lg:min-w-[180px] lg:text-right" label="Linked Order">
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

      {/* Pfister Reference Weights */}
      <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-4 mb-4">
        <PfisterSection
          inbound={inbound}
          inboundId={inboundId}
          isTriggering={isTriggering}
          setTriggering={setTriggering}
          setInbound={setInbound}
          isAdmin={isAdmin}
          refreshInbound={refreshInbound}
        />
      </div>

      {/* Skips Section */}
      <SkipsSection
        inbound={inbound}
        inboundId={inboundId}
        assets={assets}
        wasteStreams={wasteStreams}
        refreshInbound={refreshInbound}
        setInbound={setInbound}
      />

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

/* ───── Info Field ───── */
function InfoField({ label, value, children, className = '' }) {
  return (
    <div className={className}>
      <span className="text-xs font-medium text-grey-500 uppercase tracking-wide">{label}</span>
      {children ? <div className="mt-0.5">{children}</div> : <p className="text-sm font-medium text-grey-900 mt-0.5">{value ?? '—'}</p>}
    </div>
  );
}

/* ───── Pfister Section ───── */
function PfisterSection({ inbound, inboundId, isTriggering, setTriggering, setInbound, isAdmin, refreshInbound }) {
  const [showManualFallback, setShowManualFallback] = useState(null);
  const [showOverride, setShowOverride] = useState(false);
  const assets = inbound.assets || [];
  const assetsWithGross = assets.filter((a) => a.gross_weight_kg != null && Number(a.gross_weight_kg) > 0);

  const canTriggerGross = !inbound.gross_ticket;
  const canTriggerTare = !!inbound.gross_ticket && !inbound.tare_ticket && assetsWithGross.length > 0;
  const isTerminal = ['READY_FOR_SORTING', 'SORTED'].includes(inbound.status);

  const handleGross = useCallback(async () => {
    setTriggering(true);
    try {
      const { data } = await triggerGrossWeighing(inboundId);
      setInbound(data.data);
      toast.success('Pfister gross weighing complete — status: WEIGHED IN');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Pfister gross weighing failed');
      setShowManualFallback('GROSS');
    } finally {
      setTriggering(false);
    }
  }, [inboundId, setTriggering, setInbound]);

  const handleTare = useCallback(async () => {
    setTriggering(true);
    try {
      const { data } = await triggerTareWeighing(inboundId);
      setInbound(data.data);
      toast.success('Pfister tare weighing complete — tare distributed to skips');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Pfister tare weighing failed');
      setShowManualFallback('TARE');
    } finally {
      setTriggering(false);
    }
  }, [inboundId, setTriggering, setInbound]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-grey-900">Pfister Weighbridge</h2>
        {isAdmin && (inbound.gross_ticket || inbound.tare_ticket) && (
          <button
            onClick={() => setShowOverride(true)}
            className="h-9 px-4 flex items-center gap-2 border border-grey-300 rounded-md text-sm font-medium text-grey-700 hover:bg-grey-50 transition-colors"
          >
            <Pencil size={14} /> Override
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-3">
        <WeightCard label="Gross Weight" weight={Number(inbound.gross_weight_kg) || null} ticket={inbound.gross_ticket} />
        <WeightCard label="Tare Weight" weight={Number(inbound.tare_weight_kg) || null} ticket={inbound.tare_ticket} />
        <WeightCard label="Net Weight" weight={
          (inbound.gross_weight_kg && inbound.tare_weight_kg)
            ? Number(inbound.net_weight_kg) || (Number(inbound.gross_weight_kg) - Number(inbound.tare_weight_kg))
            : null
        } highlight />
      </div>

      {!isTerminal && (
        <div className="flex flex-wrap gap-2">
          {canTriggerGross && (
            <button
              onClick={handleGross}
              disabled={isTriggering}
              className="h-9 px-4 flex items-center gap-2 bg-green-500 text-white rounded-md font-semibold text-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {isTriggering ? <Loader2 className="animate-spin" size={16} /> : <Scale size={16} />}
              Trigger Gross Weighing
            </button>
          )}
          {canTriggerTare && (
            <button
              onClick={handleTare}
              disabled={isTriggering}
              className="h-9 px-4 flex items-center gap-2 bg-green-500 text-white rounded-md font-semibold text-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {isTriggering ? <Loader2 className="animate-spin" size={16} /> : <Scale size={16} />}
              Trigger Tare Weighing
            </button>
          )}
          {!canTriggerTare && !canTriggerGross && inbound.gross_ticket && !inbound.tare_ticket && (
            <p className="text-xs text-grey-400">Add at least one skip with gross weight to enable tare</p>
          )}
        </div>
      )}

      {showManualFallback && (
        <ManualWeighingDialog
          weightType={showManualFallback}
          inboundId={inboundId}
          onSuccess={async (data) => { setInbound(data); setShowManualFallback(null); }}
          onClose={() => setShowManualFallback(null)}
        />
      )}

      {showOverride && (
        <OverrideDialog
          inboundId={inboundId}
          inbound={inbound}
          onClose={() => setShowOverride(false)}
          onSuccess={async () => { setShowOverride(false); await refreshInbound(); }}
        />
      )}
    </div>
  );
}

function WeightCard({ label, weight, ticket, highlight }) {
  return (
    <div className={`rounded-md p-3 ${highlight && weight ? 'bg-green-25 border border-green-200' : 'bg-grey-50 border border-grey-200'}`}>
      <span className={`text-xs ${highlight && weight ? 'text-green-700' : 'text-grey-500'}`}>{label}</span>
      <p className={`text-lg font-bold ${highlight && weight ? 'text-green-700' : weight ? 'text-grey-900' : 'text-grey-400'}`}>
        {weight ? `${weight.toLocaleString()} kg` : '—'}
      </p>
      {ticket && (
        <>
          <p className="mt-1 text-xs font-semibold tracking-[0.02em] text-grey-600">
            {formatTicketTimestamp(ticket)}
            {ticket.is_manual_override && <span className="text-orange-600 ml-1">(overridden)</span>}
          </p>
          <p className="text-[10px] font-mono text-grey-400 mt-0.5">Ticket: {ticket.ticket_number}</p>
        </>
      )}
    </div>
  );
}

/* ───── Skips Section ───── */
function SkipsSection({ inbound, inboundId, assets, wasteStreams, refreshInbound, setInbound }) {
  const [showAdd, setShowAdd] = useState(false);
  const isTerminal = ['READY_FOR_SORTING', 'SORTED'].includes(inbound.status);

  const totals = assets.reduce(
    (acc, a) => {
      acc.gross += Number(a.gross_weight_kg) || 0;
      acc.tare += Number(a.tare_weight_kg) || 0;
      acc.net += Number(a.net_weight_kg) || 0;
      return acc;
    },
    { gross: 0, tare: 0, net: 0 }
  );

  return (
    <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-grey-900">
          Skip Containers <span className="ml-1 text-xs font-normal text-grey-500">({assets.length})</span>
        </h2>
        {!isTerminal && !showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-green-500 text-white rounded-md font-semibold text-xs hover:bg-green-700 transition-colors"
          >
            <Plus size={14} /> Add Skip
          </button>
        )}
      </div>

      {showAdd && (
        <AddSkipPanel
          inboundId={inboundId}
          wasteStreams={wasteStreams}
          onClose={() => setShowAdd(false)}
          onSuccess={async () => { setShowAdd(false); await refreshInbound(); }}
        />
      )}

      {assets.length === 0 ? (
        <p className="text-sm text-grey-400">No skips added yet</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="bg-grey-50 border-b border-grey-200">
                <th className="px-3 py-2.5 text-left text-xs font-medium text-grey-500 uppercase tracking-wide">Label</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-grey-500 uppercase tracking-wide">Type</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-grey-500 uppercase tracking-wide">Waste Stream</th>
                <th className="px-3 py-2.5 text-right text-xs font-medium text-grey-500 uppercase tracking-wide">Volume (m³)</th>
                <th className="px-3 py-2.5 text-right text-xs font-medium text-grey-500 uppercase tracking-wide">Gross (kg)</th>
                <th className="px-3 py-2.5 text-right text-xs font-medium text-grey-500 uppercase tracking-wide">Tare (kg)</th>
                <th className="px-3 py-2.5 text-right text-xs font-medium text-grey-500 uppercase tracking-wide">Net (kg)</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-grey-500 uppercase tracking-wide">Notes</th>
                <th className="px-3 py-2.5 text-right text-xs font-medium text-grey-500 uppercase tracking-wide w-20"></th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => (
                <SkipRow
                  key={asset.id}
                  asset={asset}
                  order={inbound.order}
                  isTerminal={isTerminal}
                  hasTare={!!inbound.tare_ticket}
                  inboundId={inboundId}
                  refreshInbound={refreshInbound}
                  wasteStreams={wasteStreams}
                />
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-grey-300 bg-grey-50">
                <td colSpan={4} className="px-3 py-2.5 text-xs font-semibold text-grey-700">Totals</td>
                <td className="px-3 py-2.5 text-right text-sm font-semibold text-grey-900">{totals.gross ? totals.gross.toLocaleString() : '—'}</td>
                <td className="px-3 py-2.5 text-right text-sm font-semibold text-grey-900">{totals.tare ? totals.tare.toLocaleString() : '—'}</td>
                <td className="px-3 py-2.5 text-right text-sm font-bold text-grey-900">{totals.net ? totals.net.toLocaleString() : '—'}</td>
                <td className="px-3 py-2.5 text-xs text-grey-500">—</td>
                <td className="px-3 py-2.5 text-right text-xs text-grey-500">{assets.length} skip(s)</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Pfister total vs skip total comparison */}
      {inbound.gross_weight_kg && assets.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-grey-500">
          <span>Pfister Gross: <strong className="text-grey-700">{Number(inbound.gross_weight_kg).toLocaleString()} kg</strong></span>
          <span>Skip Gross Total: <strong className="text-grey-700">{totals.gross.toLocaleString()} kg</strong></span>
          {totals.gross > 0 && (
            <span className={Math.abs(totals.gross - Number(inbound.gross_weight_kg)) > 50 ? 'text-orange-600' : 'text-green-600'}>
              Diff: {(totals.gross - Number(inbound.gross_weight_kg)).toLocaleString()} kg
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ───── Skip Table Row ───── */
function SkipRow({ asset, order, isTerminal, hasTare, inboundId, refreshInbound, wasteStreams }) {
  const [showEdit, setShowEdit] = useState(false);
  const [grossInput, setGrossInput] = useState(asset.gross_weight_kg ? String(Number(asset.gross_weight_kg)) : '');
  const [savingGross, setSavingGross] = useState(false);

  const grossKg = Number(asset.gross_weight_kg) || 0;
  const tareKg = Number(asset.tare_weight_kg) || 0;
  const netKg = Number(asset.net_weight_kg) || 0;

  const handleGrossBlur = useCallback(async () => {
    const val = Number(grossInput);
    if (!val || val === grossKg) return;
    setSavingGross(true);
    try {
      await setAssetGrossWeight(asset.id, { weight_kg: val });
      toast.success('Gross weight saved');
      await refreshInbound();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
      setGrossInput(grossKg ? String(grossKg) : '');
    } finally {
      setSavingGross(false);
    }
  }, [grossInput, grossKg, asset.id, refreshInbound]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.target.blur(); handleGrossBlur(); }
  };

  async function handleDelete() {
    if (!window.confirm(`Delete skip ${asset.asset_label}?`)) return;
    try {
      await deleteAsset(asset.id);
      toast.success('Skip deleted');
      await refreshInbound();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    }
  }

  if (showEdit) {
    return (
      <tr>
        <td colSpan={9} className="p-2">
          <EditSkipPanel
            asset={asset}
            wasteStreams={wasteStreams}
            onClose={() => setShowEdit(false)}
            onSuccess={async () => { setShowEdit(false); await refreshInbound(); }}
          />
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-grey-100 hover:bg-grey-50 group">
      <td className="px-3 py-3">
        <span className="text-sm font-mono font-bold text-grey-900">{asset.asset_label}</span>
      </td>
      <td className="px-3 py-3">
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-300">
          {SKIP_LABELS[asset.skip_type] || asset.skip_type}
        </span>
      </td>
      <td className="px-3 py-3 text-sm text-grey-700">
        {asset.waste_stream ? `${asset.waste_stream.name_en} (${asset.waste_stream.code})` : '—'}
      </td>
      <td className="px-3 py-3 text-right text-sm text-grey-700">
        {asset.estimated_volume_m3 != null ? Number(asset.estimated_volume_m3).toLocaleString() : '—'}
      </td>
      <td className="px-3 py-3 text-right">
        {isTerminal || hasTare ? (
          <span className="text-sm font-semibold text-grey-900">{grossKg ? grossKg.toLocaleString() : '—'}</span>
        ) : (
          <div className="relative inline-block w-24">
            <input
              type="number"
              value={grossInput}
              onChange={(e) => setGrossInput(e.target.value)}
              onBlur={handleGrossBlur}
              onKeyDown={handleKeyDown}
              placeholder="0"
              min="0"
              step="0.1"
              disabled={savingGross}
              className="w-full px-2 py-1.5 rounded-md border border-grey-300 text-sm text-right text-grey-900 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none disabled:bg-grey-50"
            />
            {savingGross && <Loader2 size={12} className="absolute right-2 top-2.5 animate-spin text-grey-400" />}
          </div>
        )}
      </td>
      <td className="px-3 py-3 text-right text-sm text-grey-700">
        {tareKg ? tareKg.toLocaleString() : '—'}
      </td>
      <td className="px-3 py-3 text-right text-sm font-bold text-grey-900">
        {netKg ? netKg.toLocaleString() : '—'}
      </td>
      <td className="px-3 py-3 text-sm text-grey-700 max-w-[180px] truncate">
        {asset.notes || '—'}
      </td>
      <td className="px-3 py-3 text-right">
        {!isTerminal && (
          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => setShowEdit(true)} className="p-1.5 rounded-md hover:bg-grey-100 text-grey-400 hover:text-grey-900">
              <Pencil size={14} />
            </button>
            <button onClick={handleDelete} className="p-1.5 rounded-md hover:bg-grey-100 text-grey-400 hover:text-red-600">
              <Trash2 size={14} />
            </button>
            <button onClick={() => printAssetLabel(asset, order)} className="p-1.5 rounded-md hover:bg-grey-100 text-grey-400 hover:text-grey-900">
              <Printer size={14} />
            </button>
          </div>
        )}
      </td>
    </tr>
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

      {['READY_FOR_SORTING', 'SORTED'].includes(inbound.status) && (
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

/* ───── Add Skip Panel ───── */
function AddSkipPanel({ inboundId, wasteStreams, onClose, onSuccess }) {
  const [form, setForm] = useState({
    skip_type: '',
    waste_stream_id: '',
    estimated_volume_m3: '',
    notes: '',
  });
  const [nextLabel, setNextLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getNextLabel().then(({ data }) => setNextLabel(data.data.label)).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createAsset({
        inbound_id: inboundId,
        skip_type: form.skip_type,
        waste_stream_id: form.waste_stream_id || null,
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
    <form onSubmit={handleSubmit} className="bg-grey-50 rounded-md p-4 mb-3 border border-grey-200">
      {nextLabel && (
        <p className="text-xs text-grey-500 mb-3">Next label: <span className="font-mono font-bold text-grey-900">{nextLabel}</span></p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-grey-700 mb-1">Skip Type</label>
          <select value={form.skip_type} onChange={(e) => setForm((p) => ({ ...p, skip_type: e.target.value }))} required className={selectClass}>
            <option value="">Select...</option>
            {SKIP_TYPES.map((t) => <option key={t} value={t}>{SKIP_LABELS[t]}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-grey-700 mb-1">Waste Stream</label>
          <select value={form.waste_stream_id} onChange={(e) => setForm((p) => ({ ...p, waste_stream_id: e.target.value }))} className={selectClass}>
            <option value="">Select...</option>
            {wasteStreams.map((ws) => <option key={ws.id} value={ws.id}>{ws.name_en} ({ws.code})</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-grey-700 mb-1">Volume (m³)</label>
          <input
            type="number" step="0.1" min="0" placeholder="Optional"
            value={form.estimated_volume_m3}
            onChange={(e) => setForm((p) => ({ ...p, estimated_volume_m3: e.target.value }))}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-grey-700 mb-1">Notes</label>
          <input
            type="text" placeholder="Optional"
            value={form.notes}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            className={inputClass}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-3">
        <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs text-grey-700 hover:text-grey-900 rounded-md hover:bg-white transition-colors">Cancel</button>
        <button type="submit" disabled={submitting} className="px-4 py-1.5 bg-green-500 text-white rounded-md font-semibold text-xs hover:bg-green-700 disabled:opacity-50 transition-colors">
          {submitting ? 'Adding...' : 'Add Skip'}
        </button>
      </div>
    </form>
  );
}

/* ───── Edit Skip Panel ───── */
function EditSkipPanel({ asset, wasteStreams, onClose, onSuccess }) {
  const [form, setForm] = useState({
    skip_type: asset.skip_type,
    waste_stream_id: asset.waste_stream_id || asset.waste_stream?.id || '',
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
        waste_stream_id: form.waste_stream_id || null,
        estimated_volume_m3: form.estimated_volume_m3 ? Number(form.estimated_volume_m3) : null,
        notes: form.notes || null,
      });
      toast.success('Skip updated');
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-grey-50 rounded-md p-3 space-y-2">
      <p className="text-xs font-mono font-bold text-grey-900">{asset.asset_label}</p>
      <div className="grid grid-cols-2 gap-2">
        <select value={form.skip_type} onChange={(e) => setForm((p) => ({ ...p, skip_type: e.target.value }))} required className="w-full px-2.5 py-1.5 rounded-md border border-grey-300 text-xs text-grey-900 bg-white focus:border-green-500 outline-none">
          {SKIP_TYPES.map((t) => <option key={t} value={t}>{SKIP_LABELS[t]}</option>)}
        </select>
        <select value={form.waste_stream_id} onChange={(e) => setForm((p) => ({ ...p, waste_stream_id: e.target.value }))} className="w-full px-2.5 py-1.5 rounded-md border border-grey-300 text-xs text-grey-900 bg-white focus:border-green-500 outline-none">
          <option value="">Select waste stream...</option>
          {wasteStreams.map((ws) => <option key={ws.id} value={ws.id}>{ws.name_en} ({ws.code})</option>)}
        </select>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="px-2.5 py-1 text-xs text-grey-700 hover:text-grey-900 rounded-md hover:bg-white transition-colors">Cancel</button>
        <button type="submit" disabled={submitting} className="px-2.5 py-1 bg-green-500 text-white rounded-md font-semibold text-xs hover:bg-green-700 disabled:opacity-50 transition-colors">
          {submitting ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  );
}

/* ───── Manual Weighing Dialog ───── */
function ManualWeighingDialog({ weightType, inboundId, onSuccess, onClose }) {
  const [form, setForm] = useState({ weight_kg: '', reason: '' });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data } = await manualWeighingApi(inboundId, {
        weight_type: weightType,
        weight_kg: Number(form.weight_kg),
        reason: form.reason,
      });
      toast.success(`Manual ${weightType.toLowerCase()} weight recorded`);
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
        <span className="text-sm font-semibold text-grey-900">Manual {weightType} Weight Entry</span>
      </div>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
        <div className="flex items-end gap-2">
          <button type="button" onClick={onClose} className="h-10 px-3 text-xs text-grey-700 hover:text-grey-900 rounded-md hover:bg-white transition-colors">Cancel</button>
          <button type="submit" disabled={submitting} className="h-10 px-4 bg-orange-500 text-white rounded-md font-semibold text-xs hover:bg-orange-600 disabled:opacity-50 transition-colors">
            {submitting ? 'Recording...' : `Record ${weightType}`}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ───── Override Dialog ───── */
function OverrideDialog({ inboundId, inbound, onClose, onSuccess }) {
  const [form, setForm] = useState({ weight_type: 'GROSS', weight_kg: '', reason_code: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await overrideWeight(inboundId, { ...form, weight_kg: Number(form.weight_kg) });
      toast.success('Pfister weight overridden');
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
          <h2 className="text-lg font-semibold text-grey-900">Override Pfister Weight</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-grey-50 text-grey-400">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-grey-700 mb-1.5">Weight Type</label>
            <div className="flex gap-4">
              {['GROSS', 'TARE'].map((t) => (
                <label key={t} className="flex items-center gap-2 text-sm text-grey-900">
                  <input type="radio" name="weight_type" value={t} checked={form.weight_type === t}
                    onChange={(e) => setForm((p) => ({ ...p, weight_type: e.target.value }))}
                    disabled={t === 'GROSS' ? !inbound.gross_ticket : !inbound.tare_ticket}
                    className="accent-green-500" />
                  {t}
                </label>
              ))}
            </div>
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
