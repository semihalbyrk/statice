import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Loader2, Plus, Pencil, Trash2, AlertTriangle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import useSortingStore from '../../store/sortingStore';
import useAuthStore from '../../store/authStore';
import useMasterDataStore from '../../store/masterDataStore';
import StatusBadge from '../../components/ui/StatusBadge';
import {
  submitSession as submitSessionApi,
  reopenSession as reopenSessionApi,
  createLine as createLineApi,
  updateLine as updateLineApi,
  deleteLine as deleteLineApi,
  getCategoryDefaults,
} from '../../api/sorting';
import { format } from 'date-fns';
import { getSortingName } from '../../utils/entityNames';

const SKIP_LABELS = { OPEN_TOP: 'Open Top', CLOSED_TOP: 'Closed Top', GITTERBOX: 'Gitterbox', PALLET: 'Pallet', OTHER: 'Other' };

const inputClass = "w-full h-10 px-3.5 rounded-md border border-grey-300 text-sm text-grey-900 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors";
const selectClass = `${inputClass} bg-white`;

export default function SortingPage() {
  const { sessionId } = useParams();
  const user = useAuthStore((s) => s.user);
  const { productCategories, wasteStreams } = useMasterDataStore();
  const {
    currentSession: session, isLoading, isSubmitting, activeAssetId,
    fetchSession, setActiveAssetId, setSubmitting, clearSession,
    lineForm, setLineForm, clearLineForm,
    addLineToStore, updateLineInStore, removeLineFromStore,
  } = useSortingStore();

  const isAdmin = user?.role === 'ADMIN';
  const canOperate = ['ADMIN', 'GATE_OPERATOR', 'SORTING_EMPLOYEE'].includes(user?.role);

  useEffect(() => {
    fetchSession(sessionId);
    return () => clearSession();
  }, [sessionId, fetchSession, clearSession]);

  if (isLoading || !session) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-grey-400" size={24} />
      </div>
    );
  }

  const order = session.inbound?.order;
  const assets = session.inbound?.assets || [];
  const lines = session.sorting_lines || [];
  const isDraft = session.status === 'PLANNED';

  return (
    <div>
      <PageHeader
        session={session}
        order={order}
        isDraft={isDraft}
        isAdmin={isAdmin}
        canOperate={canOperate}
        isSubmitting={isSubmitting}
        sessionId={sessionId}
        setSubmitting={setSubmitting}
        fetchSession={fetchSession}
        lines={lines}
        assets={assets}
      />

      {assets.length > 0 && (
        <>
          <SkipTabs
            assets={assets}
            lines={lines}
            activeAssetId={activeAssetId}
            onSelect={setActiveAssetId}
          />

          <ActiveSkipPanel
            session={session}
            assets={assets}
            activeAssetId={activeAssetId}
            lines={lines}
            isDraft={isDraft}
            canOperate={canOperate}
            sessionId={sessionId}
            lineForm={lineForm}
            setLineForm={setLineForm}
            clearLineForm={clearLineForm}
            addLineToStore={addLineToStore}
            updateLineInStore={updateLineInStore}
            removeLineFromStore={removeLineFromStore}
            fetchSession={fetchSession}
            productCategories={productCategories}
            wasteStreams={wasteStreams}
          />
        </>
      )}

      {assets.length === 0 && (
        <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-8 text-center text-grey-400 text-sm">
          No skips found on this weighing event
        </div>
      )}
    </div>
  );
}

/* ───── Page Header ───── */
function PageHeader({ session, order, isDraft, isAdmin, canOperate, isSubmitting, sessionId, setSubmitting, fetchSession, lines, assets }) {
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showReopenDialog, setShowReopenDialog] = useState(false);
  const totalNetWeight = assets.reduce((sum, asset) => sum + (Number(asset.net_weight_kg) || 0), 0);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    try {
      await submitSessionApi(sessionId);
      toast.success('Sorting record submitted');
      setShowSubmitDialog(false);
      await fetchSession(sessionId);
    } catch (err) {
      const errorData = err.response?.data;
      if (errorData?.invalidLines) {
        toast.error(`${errorData.error}: ${errorData.invalidLines.length} line(s) have invalid recovery rates`);
      } else {
        toast.error(errorData?.error || 'Failed to submit');
      }
    } finally {
      setSubmitting(false);
    }
  }, [sessionId, setSubmitting, fetchSession]);

  return (
    <>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-grey-900">{getSortingName(session)}</h1>
            <StatusBadge status={session.status} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isDraft && canOperate && (
            <button
              onClick={() => setShowSubmitDialog(true)}
              disabled={isSubmitting}
              className="flex items-center gap-2 h-9 px-4 bg-green-500 text-white rounded-md font-semibold text-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              <CheckCircle size={16} />
              Submit Sorting Record
            </button>
          )}
          {!isDraft && isAdmin && (
            <button
              onClick={() => setShowReopenDialog(true)}
              className="h-9 px-3 text-sm text-grey-700 border border-grey-300 rounded-md hover:bg-grey-50 transition-colors"
            >
              Reopen
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-y-3 gap-x-6">
          <InfoField label="Linked Inbound">
            <Link to={`/inbounds/${session.inbound_id}`} className="inline-flex items-center text-sm font-semibold text-green-600 hover:text-green-700 hover:underline transition-colors">
              {session.inbound?.inbound_number || '—'}
            </Link>
          </InfoField>
          <InfoField label="Linked Order">
            <Link to={`/orders/${order?.id}`} className="inline-flex items-center text-sm font-semibold text-green-600 hover:text-green-700 hover:underline transition-colors">
              {order?.order_number || '—'}
            </Link>
          </InfoField>
          <InfoField label="Carrier" value={order?.carrier?.name} />
          <InfoField label="Supplier" value={order?.supplier?.name} />
          <InfoField label="Vehicle Plate" value={session.inbound?.vehicle?.registration_plate} mono />
          <InfoField label="Recorded At" value={session.recorded_at ? format(new Date(session.recorded_at), 'dd MMM yyyy HH:mm') : '—'} />
          <InfoField label="Waste Stream" value={order?.waste_stream?.name_en} />
          <InfoField label="Skip Count" value={String(assets.length)} />
          <InfoField label="Net Weight" value={totalNetWeight ? `${totalNetWeight.toLocaleString()} kg` : '—'} />
        </div>
      </div>

      {showSubmitDialog && (
        <SubmitDialog
          lineCount={lines.length}
          assets={assets}
          lines={lines}
          isSubmitting={isSubmitting}
          onConfirm={handleSubmit}
          onCancel={() => setShowSubmitDialog(false)}
        />
      )}

      {showReopenDialog && (
        <ReopenDialog
          sessionId={sessionId}
          fetchSession={fetchSession}
          onClose={() => setShowReopenDialog(false)}
        />
      )}
    </>
  );
}

function InfoField({ label, value, children, mono = false }) {
  return (
    <div>
      <span className="text-xs font-medium text-grey-500 uppercase tracking-wide">{label}</span>
      {children ? (
        <div className="mt-1">{children}</div>
      ) : (
        <p className={`mt-1 text-sm text-grey-900 ${mono ? 'font-mono' : 'font-medium'}`}>{value || '—'}</p>
      )}
    </div>
  );
}

function SubmitDialog({ lineCount, assets, lines, isSubmitting, onConfirm, onCancel }) {
  const emptySkips = assets.filter((a) => !lines.some((l) => l.asset_id === a.id));

  return (
    <div className="app-modal-overlay">
      <div className="app-modal-panel max-w-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={20} className="text-orange-500" />
          <h3 className="text-lg font-semibold text-grey-900">Submit Sorting Record</h3>
        </div>
        {emptySkips.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-md p-3 mb-3 text-sm text-orange-700">
            {emptySkips.map((a) => a.asset_label).join(', ')} {emptySkips.length === 1 ? 'has' : 'have'} no material lines.
          </div>
        )}
        <p className="text-sm text-grey-600 mb-5">
          Once submitted, this record cannot be edited without administrator access.
          All {lineCount} material line{lineCount !== 1 ? 's' : ''} will be locked.
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="h-9 px-4 bg-white text-grey-700 border border-grey-300 rounded-md text-sm font-semibold hover:bg-grey-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isSubmitting}
            className="h-9 px-4 bg-green-500 text-white rounded-md font-semibold text-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReopenDialog({ sessionId, fetchSession, onClose }) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleReopen() {
    setSubmitting(true);
    try {
      await reopenSessionApi(sessionId, { reason });
      toast.success('Session reopened');
      onClose();
      await fetchSession(sessionId);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reopen');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app-modal-overlay">
      <div className="app-modal-panel max-w-sm p-6">
        <h3 className="text-lg font-semibold text-grey-900 mb-3">Reopen Sorting Record</h3>
        <label className="block text-sm font-medium text-grey-700 mb-1.5">Reason</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          required
          placeholder="Reason for reopening..."
          className="w-full min-h-[80px] px-3.5 py-2.5 rounded-md border border-grey-300 text-sm text-grey-900 placeholder:text-grey-400 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors resize-vertical mb-4"
        />
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="h-9 px-4 bg-white text-grey-700 border border-grey-300 rounded-md text-sm font-semibold hover:bg-grey-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleReopen} disabled={submitting || !reason.trim()} className="h-9 px-4 bg-green-500 text-white rounded-md font-semibold text-sm hover:bg-green-700 disabled:opacity-50 transition-colors">
            {submitting ? 'Reopening...' : 'Reopen'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───── Skip Tabs ───── */
function SkipTabs({ assets, lines, activeAssetId, onSelect }) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-grey-200 mb-4 pb-0">
      {assets.map((asset) => {
        const assetLines = lines.filter((l) => l.asset_id === asset.id);
        const hasLines = assetLines.length > 0;
        const totalAllocated = assetLines.reduce((s, l) => s + Number(l.net_weight_kg), 0);
        const isOver = totalAllocated > Number(asset.net_weight_kg);
        const isActive = asset.id === activeAssetId;

        let dotColor = 'bg-grey-300';
        if (hasLines && !isOver) dotColor = 'bg-green-500';
        if (hasLines && isOver) dotColor = 'bg-orange-500';

        return (
          <button
            key={asset.id}
            onClick={() => onSelect(asset.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
              isActive
                ? 'border-green-500 text-grey-900'
                : 'border-transparent text-grey-500 hover:text-grey-600 hover:border-grey-300'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${dotColor}`} />
            {asset.asset_label}
          </button>
        );
      })}
    </div>
  );
}

/* ───── Active Skip Panel ───── */
function ActiveSkipPanel({
  session, assets, activeAssetId, lines, isDraft, canOperate,
  sessionId, lineForm, setLineForm, clearLineForm,
  addLineToStore, updateLineInStore, removeLineFromStore, fetchSession,
  productCategories, wasteStreams,
}) {
  const asset = assets.find((a) => a.id === activeAssetId);
  if (!asset) return null;

  const assetLines = lines.filter((l) => l.asset_id === asset.id);
  const netWeight = Number(asset.net_weight_kg) || 0;
  const totalAllocated = Math.round(assetLines.reduce((s, l) => s + Number(l.net_weight_kg), 0) * 100) / 100;
  const remaining = Math.round((netWeight - totalAllocated) * 100) / 100;
  const allocPct = netWeight > 0 ? Math.min((totalAllocated / netWeight) * 100, 100) : 0;
  const isOver = totalAllocated > netWeight;

  return (
    <div>
      {/* Skip Summary Bar */}
      <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-4 mb-4">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-grey-900">{asset.asset_label}</span>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-300">
              {SKIP_LABELS[asset.skip_type] || asset.skip_type}
            </span>
            {asset.waste_stream && (
              <span className="text-xs text-grey-500">{asset.waste_stream.name_en}</span>
            )}
          </div>
          <div className="flex items-center gap-6 text-sm">
            <div>
              <span className="text-grey-500">Net Weight: </span>
              <span className="font-semibold text-grey-900">{netWeight.toLocaleString()} kg</span>
            </div>
            <div>
              <span className="text-grey-500">Allocated: </span>
              <span className="font-semibold text-grey-900">{totalAllocated.toLocaleString()} kg</span>
            </div>
            <div>
              <span className="text-grey-500">Remaining: </span>
              <span className={`font-semibold ${isOver ? 'text-red-600' : remaining > 0 ? 'text-grey-900' : 'text-green-600'}`}>
                {remaining.toLocaleString()} kg
              </span>
            </div>
          </div>
        </div>
        {/* Progress bar */}
        <div className="w-full h-2 rounded-full bg-grey-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${isOver ? 'bg-red-500' : 'bg-green-500'}`}
            style={{ width: `${Math.min(allocPct, 100)}%` }}
          />
        </div>
      </div>

      {/* Sorting Lines Table */}
      <div className="bg-white rounded-lg border border-grey-200 shadow-sm overflow-hidden mb-4">
        {assetLines.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-grey-50 border-b border-grey-200">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-grey-500 uppercase tracking-wide">Category</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-grey-500 uppercase tracking-wide">Weight (kg)</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-grey-500 uppercase tracking-wide">Notes</th>
                  {isDraft && canOperate && <th className="text-right px-4 py-2.5 text-xs font-medium text-grey-500 uppercase tracking-wide">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {assetLines.map((line) => (
                  <tr key={line.id} className="border-b border-grey-100 hover:bg-grey-50 transition-colors">
                    <td className="px-4 py-2.5 text-grey-900">
                      <span className="font-medium">{line.category?.code_cbs}</span>
                      <span className="text-grey-500 ml-1.5 text-xs">{line.category?.description_en}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-grey-900 font-medium">{Number(line.net_weight_kg).toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-grey-600 max-w-[200px] truncate">{line.notes || '—'}</td>
                    {isDraft && canOperate && (
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => setLineForm({
                            mode: 'edit',
                            lineId: line.id,
                            fields: {
                              category_id: line.category?.id || line.category_id,
                              net_weight_kg: String(Number(line.net_weight_kg)),
                              notes: line.notes || '',
                            },
                          })}
                          className="p-1.5 rounded-md hover:bg-grey-50 transition-colors text-grey-500 hover:text-grey-900"
                        >
                          <Pencil size={14} />
                        </button>
                        <DeleteLineButton
                          sessionId={sessionId}
                          lineId={line.id}
                          removeLineFromStore={removeLineFromStore}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-sm text-grey-400 mb-3">No materials recorded for this skip yet</p>
            {isDraft && canOperate && (
              <button
                onClick={() => setLineForm({ mode: 'add', lineId: null, fields: defaultLineFields() })}
                className="inline-flex items-center gap-2 h-9 px-4 bg-green-500 text-white rounded-md font-semibold text-sm hover:bg-green-700 transition-colors"
              >
                <Plus size={16} /> Add Material Line
              </button>
            )}
          </div>
        )}
      </div>

      {/* Add button (when table has lines) */}
      {isDraft && canOperate && assetLines.length > 0 && !lineForm && (
        <button
          onClick={() => setLineForm({ mode: 'add', lineId: null, fields: defaultLineFields() })}
          className="flex items-center gap-2 h-9 px-4 bg-green-500 text-white rounded-md font-semibold text-sm hover:bg-green-700 transition-colors mb-4"
        >
          <Plus size={16} /> Add Material Line
        </button>
      )}

      {/* Inline Line Form */}
      {lineForm && lineForm.mode && (
        <LineForm
          sessionId={sessionId}
          assetId={activeAssetId}
          form={lineForm}
          setLineForm={setLineForm}
          clearLineForm={clearLineForm}
          addLineToStore={addLineToStore}
          updateLineInStore={updateLineInStore}
          remaining={remaining}
          productCategories={productCategories}
          wasteStreams={wasteStreams}
          fetchSession={fetchSession}
        />
      )}
    </div>
  );
}

function defaultLineFields() {
  return {
    category_id: '',
    net_weight_kg: '',
    notes: '',
  };
}

function DeleteLineButton({ sessionId, lineId, removeLineFromStore }) {
  async function handleDelete() {
    if (!window.confirm('Delete this material line?')) return;
    try {
      await deleteLineApi(sessionId, lineId);
      removeLineFromStore(lineId);
      toast.success('Line deleted');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete line');
    }
  }

  return (
    <button onClick={handleDelete} className="p-1.5 rounded-md hover:bg-grey-50 transition-colors text-grey-500 hover:text-red-600 ml-1">
      <Trash2 size={14} />
    </button>
  );
}

/* ───── Line Form (Add/Edit) ───── */
function LineForm({
  sessionId, assetId, form, setLineForm, clearLineForm,
  addLineToStore, updateLineInStore, remaining,
  productCategories, wasteStreams, fetchSession,
}) {
  const fields = form.fields;
  const isEdit = form.mode === 'edit';
  const [submitting, setSubmitting] = useState(false);
  const [catSearch, setCatSearch] = useState('');

  function updateField(field, value) {
    setLineForm({ ...form, fields: { ...fields, [field]: value } });
  }

  const filteredCategories = useMemo(() => {
    if (!catSearch) return productCategories;
    const q = catSearch.toLowerCase();
    return productCategories.filter(
      (c) => c.code_cbs.toLowerCase().includes(q) || c.description_en.toLowerCase().includes(q)
    );
  }, [productCategories, catSearch]);

  const groupedCategories = useMemo(() => {
    const groups = {};
    for (const cat of filteredCategories) {
      const wsId = cat.waste_stream_id;
      if (!groups[wsId]) {
        const ws = wasteStreams.find((w) => w.id === wsId);
        groups[wsId] = { name: ws?.name_en || 'Unknown', categories: [] };
      }
      groups[wsId].categories.push(cat);
    }
    return Object.values(groups);
  }, [filteredCategories, wasteStreams]);

  function handleUseRemaining() {
    updateField('net_weight_kg', String(Math.max(0, remaining)));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);

    // Fetch category defaults for recovery rates
    let recycled_pct = 75, reused_pct = 15, disposed_pct = 8, landfill_pct = 2;
    if (fields.category_id) {
      try {
        const { data } = await getCategoryDefaults(fields.category_id);
        const d = data.data;
        recycled_pct = Number(d.recycled_pct_default);
        reused_pct = Number(d.reused_pct_default);
        disposed_pct = Number(d.disposed_pct_default);
        landfill_pct = Number(d.landfill_pct_default);
      } catch {
        // Use defaults if fetch fails
      }
    }

    const payload = {
      asset_id: assetId,
      category_id: fields.category_id,
      net_weight_kg: Number(fields.net_weight_kg),
      recycled_pct,
      reused_pct,
      disposed_pct,
      landfill_pct,
      notes: fields.notes || null,
    };

    try {
      if (isEdit) {
        const { data } = await updateLineApi(sessionId, form.lineId, payload);
        updateLineInStore(form.lineId, data.data);
        if (data.warning) toast(data.warning, { icon: '⚠️' });
        toast.success('Line updated');
      } else {
        const { data } = await createLineApi(sessionId, payload);
        addLineToStore(data.data);
        if (data.warning) toast(data.warning, { icon: '⚠️' });
        toast.success('Line added');
      }
      clearLineForm();
      await fetchSession(sessionId);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save line');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-grey-200 shadow-sm p-5 mb-4 space-y-4">
      <h3 className="text-sm font-semibold text-grey-900">{isEdit ? 'Edit Material Line' : 'Add Material Line'}</h3>

      {/* Category */}
      <div>
        <label className="block text-xs font-medium text-grey-700 mb-1">Product Category</label>
        <input
          type="text"
          placeholder="Search categories..."
          value={catSearch}
          onChange={(e) => setCatSearch(e.target.value)}
          className="w-full px-3 py-1.5 rounded-md border border-grey-300 text-xs text-grey-900 placeholder:text-grey-400 mb-1 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors"
        />
        <select
          value={fields.category_id}
          onChange={(e) => updateField('category_id', e.target.value)}
          required
          size={5}
          className="w-full px-3 py-1 rounded-md border border-grey-300 text-xs text-grey-900 bg-white focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors"
        >
          <option value="">Select category...</option>
          {groupedCategories.map((group) => (
            <optgroup key={group.name} label={group.name}>
              {group.categories.map((c) => (
                <option key={c.id} value={c.id}>{c.code_cbs} — {c.description_en}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Weight */}
      <div>
        <label className="block text-xs font-medium text-grey-700 mb-1">Weight (kg)</label>
        <div className="flex gap-2 items-center">
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={fields.net_weight_kg}
            onChange={(e) => updateField('net_weight_kg', e.target.value)}
            required
            className={`flex-1 ${inputClass}`}
          />
          <button
            type="button"
            onClick={handleUseRemaining}
            className="h-9 px-3 text-xs font-medium text-green-500 hover:text-green-700 border border-grey-300 rounded-md hover:bg-grey-50 transition-colors whitespace-nowrap"
          >
            Use remaining ({Math.max(0, remaining).toLocaleString()} kg)
          </button>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-medium text-grey-700 mb-1">Notes</label>
        <textarea
          value={fields.notes}
          onChange={(e) => updateField('notes', e.target.value)}
          maxLength={300}
          rows={2}
          placeholder="Optional notes..."
          className="w-full min-h-[64px] px-3.5 py-2.5 rounded-md border border-grey-300 text-sm text-grey-900 placeholder:text-grey-400 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors resize-vertical"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <button type="button" onClick={clearLineForm} className="h-9 px-4 bg-white text-grey-700 border border-grey-300 rounded-md text-sm font-semibold hover:bg-grey-50 transition-colors">
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="h-9 px-4 bg-green-500 text-white rounded-md font-semibold text-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Saving...' : isEdit ? 'Update Line' : 'Save Line'}
        </button>
      </div>
    </form>
  );
}
