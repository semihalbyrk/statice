import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Plus, Pencil, Trash2, AlertTriangle, CheckCircle } from 'lucide-react';
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

const SKIP_LABELS = { OPEN_TOP: 'Open Top', CLOSED_TOP: 'Closed Top', GITTERBOX: 'Gitterbox', PALLET: 'Pallet', OTHER: 'Other' };

export default function SortingPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { productCategories, wasteStreams } = useMasterDataStore();
  const {
    currentSession: session, isLoading, isSubmitting, activeAssetId,
    fetchSession, setActiveAssetId, setSubmitting, clearSession,
    lineForm, setLineForm, clearLineForm,
    addLineToStore, updateLineInStore, removeLineFromStore,
  } = useSortingStore();

  const isAdmin = user?.role === 'ADMIN';
  const canOperate = ['ADMIN', 'GATE_OPERATOR'].includes(user?.role);

  useEffect(() => {
    fetchSession(sessionId);
    return () => clearSession();
  }, [sessionId, fetchSession, clearSession]);

  if (isLoading || !session) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-text-placeholder" size={24} />
      </div>
    );
  }

  const order = session.weighing_event?.order;
  const assets = session.weighing_event?.assets || [];
  const lines = session.sorting_lines || [];
  const isDraft = session.status === 'DRAFT';

  return (
    <div className="max-w-6xl mx-auto">
      {/* Page Header */}
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
        navigate={navigate}
        lines={lines}
        assets={assets}
      />

      {/* Skip Tabs */}
      {assets.length > 0 && (
        <>
          <SkipTabs
            assets={assets}
            lines={lines}
            activeAssetId={activeAssetId}
            onSelect={setActiveAssetId}
          />

          {/* Active Skip Content */}
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
        <div className="bg-surface rounded-xl border border-border p-8 text-center text-text-placeholder text-sm">
          No skips found on this weighing event
        </div>
      )}
    </div>
  );
}

/* ───── Page Header ───── */
function PageHeader({ session, order, isDraft, isAdmin, canOperate, isSubmitting, sessionId, setSubmitting, fetchSession, navigate, lines, assets }) {
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showReopenDialog, setShowReopenDialog] = useState(false);

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
      <Link
        to={`/weighing-events/${session.weighing_event_id}`}
        className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-foreground mb-4 transition"
      >
        <ArrowLeft size={16} /> Back to Weighing Event
      </Link>

      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-h-xs font-bold text-foreground">Sorting Record</h1>
            <StatusBadge status={session.status} />
          </div>
          <p className="text-sm text-text-secondary">
            Order {order?.order_number} — {order?.carrier?.name} — {session.weighing_event?.vehicle?.registration_plate}
            {session.recorded_at && ` — ${format(new Date(session.recorded_at), 'dd MMM yyyy')}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isDraft && canOperate && (
            <button
              onClick={() => setShowSubmitDialog(true)}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold text-sm hover:bg-green-700 disabled:opacity-50 transition"
            >
              <CheckCircle size={16} />
              Submit Sorting Record
            </button>
          )}
          {!isDraft && isAdmin && (
            <button
              onClick={() => setShowReopenDialog(true)}
              className="px-3 py-1.5 text-sm text-text-secondary hover:text-foreground border border-border rounded-lg hover:bg-muted transition"
            >
              Reopen
            </button>
          )}
        </div>
      </div>

      {/* Submit Confirmation Dialog */}
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

      {/* Reopen Dialog */}
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

function SubmitDialog({ lineCount, assets, lines, isSubmitting, onConfirm, onCancel }) {
  // Check for empty skips
  const emptySkips = assets.filter((a) => !lines.some((l) => l.asset_id === a.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-overlay/50">
      <div className="bg-surface rounded-2xl border border-border shadow-xl w-full max-w-sm mx-4 p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={20} className="text-orange-500" />
          <h3 className="text-lg font-semibold text-foreground">Submit Sorting Record</h3>
        </div>
        {emptySkips.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-3 text-sm text-orange-700">
            {emptySkips.map((a) => a.asset_label).join(', ')} {emptySkips.length === 1 ? 'has' : 'have'} no material lines.
          </div>
        )}
        <p className="text-sm text-text-secondary mb-5">
          Once submitted, this record cannot be edited without administrator access.
          All {lineCount} material line{lineCount !== 1 ? 's' : ''} will be locked.
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-text-secondary hover:text-foreground rounded-lg hover:bg-muted transition">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isSubmitting}
            className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold text-sm hover:bg-green-700 disabled:opacity-50 transition"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-overlay/50">
      <div className="bg-surface rounded-2xl border border-border shadow-xl w-full max-w-sm mx-4 p-6">
        <h3 className="text-lg font-semibold text-foreground mb-3">Reopen Sorting Record</h3>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">Reason</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          required
          placeholder="Reason for reopening..."
          className="w-full px-3 py-2.5 rounded-lg border border-input text-sm text-foreground placeholder-text-placeholder focus:outline-none focus:ring-2 focus:ring-ring transition resize-none mb-4"
        />
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-text-secondary hover:text-foreground rounded-lg hover:bg-muted transition">
            Cancel
          </button>
          <button onClick={handleReopen} disabled={submitting || !reason.trim()} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:bg-primary-hover disabled:opacity-50 transition">
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
    <div className="flex gap-1 overflow-x-auto border-b border-border mb-4 pb-0">
      {assets.map((asset) => {
        const assetLines = lines.filter((l) => l.asset_id === asset.id);
        const hasLines = assetLines.length > 0;
        const totalAllocated = assetLines.reduce((s, l) => s + Number(l.net_weight_kg), 0);
        const isOver = totalAllocated > Number(asset.net_weight_kg);
        const isActive = asset.id === activeAssetId;

        let dotColor = 'bg-grey-300'; // grey = no lines
        if (hasLines && !isOver) dotColor = 'bg-green-500'; // green
        if (hasLines && isOver) dotColor = 'bg-orange-500'; // amber

        return (
          <button
            key={asset.id}
            onClick={() => onSelect(asset.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition border-b-2 -mb-px ${
              isActive
                ? 'border-primary text-foreground'
                : 'border-transparent text-text-tertiary hover:text-text-secondary hover:border-border'
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
      <div className="bg-surface rounded-xl border border-border p-4 mb-4">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <div className="flex items-center gap-3">
            <span className="font-mono font-bold text-foreground">{asset.asset_label}</span>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
              {SKIP_LABELS[asset.skip_type] || asset.skip_type}
            </span>
            {asset.material_category && (
              <span className="text-xs text-text-tertiary">{asset.material_category.code_cbs}</span>
            )}
          </div>
          <div className="flex items-center gap-6 text-sm">
            <div>
              <span className="text-text-tertiary">Net Weight: </span>
              <span className="font-semibold text-foreground">{netWeight.toLocaleString()} kg</span>
            </div>
            <div>
              <span className="text-text-tertiary">Allocated: </span>
              <span className="font-semibold text-foreground">{totalAllocated.toLocaleString()} kg</span>
            </div>
            <div>
              <span className="text-text-tertiary">Remaining: </span>
              <span className={`font-semibold ${isOver ? 'text-red-600' : remaining > 0 ? 'text-foreground' : 'text-green-600'}`}>
                {remaining.toLocaleString()} kg
              </span>
            </div>
          </div>
        </div>
        {/* Progress bar */}
        <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${isOver ? 'bg-red-500' : 'bg-green-500'}`}
            style={{ width: `${Math.min(allocPct, 100)}%` }}
          />
        </div>
      </div>

      {/* Sorting Lines Table */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden mb-4">
        {assetLines.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted">
                  <th className="text-left px-4 py-2.5 font-medium text-text-secondary">Category</th>
                  <th className="text-right px-4 py-2.5 font-medium text-text-secondary">Weight (kg)</th>
                  <th className="text-right px-4 py-2.5 font-medium text-text-secondary">Recycled %</th>
                  <th className="text-right px-4 py-2.5 font-medium text-text-secondary">Reused %</th>
                  <th className="text-right px-4 py-2.5 font-medium text-text-secondary">Disposed %</th>
                  <th className="text-right px-4 py-2.5 font-medium text-text-secondary">Landfill %</th>
                  <th className="text-left px-4 py-2.5 font-medium text-text-secondary">Processor</th>
                  {isDraft && canOperate && <th className="text-right px-4 py-2.5 font-medium text-text-secondary">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {assetLines.map((line) => (
                  <tr key={line.id} className="hover:bg-muted transition">
                    <td className="px-4 py-2.5 text-foreground">
                      <span className="font-medium">{line.category?.code_cbs}</span>
                      <span className="text-text-tertiary ml-1.5 text-xs">{line.category?.description_en}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-foreground font-medium">{Number(line.net_weight_kg).toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right text-text-secondary">{Number(line.recycled_pct)}</td>
                    <td className="px-4 py-2.5 text-right text-text-secondary">{Number(line.reused_pct)}</td>
                    <td className="px-4 py-2.5 text-right text-text-secondary">{Number(line.disposed_pct)}</td>
                    <td className="px-4 py-2.5 text-right text-text-secondary">{Number(line.landfill_pct)}</td>
                    <td className="px-4 py-2.5 text-text-secondary">{line.downstream_processor || '—'}</td>
                    {isDraft && canOperate && (
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => setLineForm({
                            mode: 'edit',
                            lineId: line.id,
                            fields: {
                              category_id: line.category?.id || line.category_id,
                              net_weight_kg: String(Number(line.net_weight_kg)),
                              recycled_pct: String(Number(line.recycled_pct)),
                              reused_pct: String(Number(line.reused_pct)),
                              disposed_pct: String(Number(line.disposed_pct)),
                              landfill_pct: String(Number(line.landfill_pct)),
                              downstream_processor: line.downstream_processor || '',
                              notes: line.notes || '',
                            },
                          })}
                          className="p-1.5 rounded-md hover:bg-muted transition text-text-tertiary hover:text-foreground"
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
            <p className="text-sm text-text-placeholder mb-3">No materials recorded for this skip yet</p>
            {isDraft && canOperate && (
              <button
                onClick={() => setLineForm({ mode: 'add', lineId: null, fields: defaultLineFields() })}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:bg-primary-hover transition"
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
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:bg-primary-hover transition mb-4"
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
    recycled_pct: '',
    reused_pct: '',
    disposed_pct: '',
    landfill_pct: '',
    downstream_processor: '',
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
    <button onClick={handleDelete} className="p-1.5 rounded-md hover:bg-muted transition text-text-tertiary hover:text-red-600 ml-1">
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

  // Pct sum computation
  const pctSum = useMemo(() => {
    return Math.round(
      (Number(fields.recycled_pct || 0) + Number(fields.reused_pct || 0) +
       Number(fields.disposed_pct || 0) + Number(fields.landfill_pct || 0)) * 100
    ) / 100;
  }, [fields.recycled_pct, fields.reused_pct, fields.disposed_pct, fields.landfill_pct]);

  const pctValid = pctSum === 100;

  // Category filter
  const filteredCategories = useMemo(() => {
    if (!catSearch) return productCategories;
    const q = catSearch.toLowerCase();
    return productCategories.filter(
      (c) => c.code_cbs.toLowerCase().includes(q) || c.description_en.toLowerCase().includes(q)
    );
  }, [productCategories, catSearch]);

  // Group categories by waste stream
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

  // Auto-fill defaults when category changes
  async function handleCategoryChange(categoryId) {
    updateField('category_id', categoryId);
    if (!categoryId) return;
    try {
      const { data } = await getCategoryDefaults(categoryId);
      const d = data.data;
      setLineForm({
        ...form,
        fields: {
          ...fields,
          category_id: categoryId,
          recycled_pct: String(Number(d.recycled_pct_default)),
          reused_pct: String(Number(d.reused_pct_default)),
          disposed_pct: String(Number(d.disposed_pct_default)),
          landfill_pct: String(Number(d.landfill_pct_default)),
        },
      });
    } catch {
      // Defaults fetch failed — keep fields as-is
    }
  }

  function handleAutoAdjust() {
    const vals = [
      Number(fields.recycled_pct || 0),
      Number(fields.reused_pct || 0),
      Number(fields.disposed_pct || 0),
      Number(fields.landfill_pct || 0),
    ];
    const sum = vals.reduce((a, b) => a + b, 0);
    if (sum === 0) {
      // All zeros: distribute 25 each
      setLineForm({
        ...form,
        fields: { ...fields, recycled_pct: '25', reused_pct: '25', disposed_pct: '25', landfill_pct: '25' },
      });
      return;
    }
    // Proportional scale to 100
    const scaled = vals.map((v) => Math.round((v / sum) * 100 * 100) / 100);
    // Adjust largest to absorb rounding error
    const scaledSum = scaled.reduce((a, b) => a + b, 0);
    const diff = Math.round((100 - scaledSum) * 100) / 100;
    const maxIdx = scaled.indexOf(Math.max(...scaled));
    scaled[maxIdx] = Math.round((scaled[maxIdx] + diff) * 100) / 100;

    setLineForm({
      ...form,
      fields: {
        ...fields,
        recycled_pct: String(scaled[0]),
        reused_pct: String(scaled[1]),
        disposed_pct: String(scaled[2]),
        landfill_pct: String(scaled[3]),
      },
    });
  }

  function handleUseRemaining() {
    updateField('net_weight_kg', String(Math.max(0, remaining)));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!pctValid) return;
    setSubmitting(true);

    const payload = {
      asset_id: assetId,
      category_id: fields.category_id,
      net_weight_kg: Number(fields.net_weight_kg),
      recycled_pct: Number(fields.recycled_pct),
      reused_pct: Number(fields.reused_pct),
      disposed_pct: Number(fields.disposed_pct),
      landfill_pct: Number(fields.landfill_pct),
      downstream_processor: fields.downstream_processor || null,
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
      // Refresh to get updated allocation fields
      await fetchSession(sessionId);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save line');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-surface rounded-xl border border-border p-5 mb-4 space-y-4">
      <h3 className="text-sm font-semibold text-foreground">{isEdit ? 'Edit Material Line' : 'Add Material Line'}</h3>

      {/* Category */}
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1">Product Category</label>
        <input
          type="text"
          placeholder="Search categories..."
          value={catSearch}
          onChange={(e) => setCatSearch(e.target.value)}
          className="w-full px-3 py-1.5 rounded-lg border border-input text-xs text-foreground placeholder-text-placeholder mb-1 focus:outline-none focus:ring-2 focus:ring-ring transition"
        />
        <select
          value={fields.category_id}
          onChange={(e) => handleCategoryChange(e.target.value)}
          required
          size={5}
          className="w-full px-3 py-1 rounded-lg border border-input text-xs text-foreground bg-surface focus:outline-none focus:ring-2 focus:ring-ring transition"
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
        <label className="block text-xs font-medium text-text-secondary mb-1">Weight (kg)</label>
        <div className="flex gap-2 items-center">
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={fields.net_weight_kg}
            onChange={(e) => updateField('net_weight_kg', e.target.value)}
            required
            className="flex-1 px-3 py-2 rounded-lg border border-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
          />
          <button
            type="button"
            onClick={handleUseRemaining}
            className="px-3 py-2 text-xs font-medium text-primary hover:text-primary-hover border border-border rounded-lg hover:bg-muted transition whitespace-nowrap"
          >
            Use remaining ({Math.max(0, remaining).toLocaleString()} kg)
          </button>
        </div>
      </div>

      {/* Recovery Rates */}
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1">Recovery Rates (%)</label>
        <div className="grid grid-cols-2 gap-3">
          {[
            { field: 'recycled_pct', label: 'Recycled' },
            { field: 'reused_pct', label: 'Reused' },
            { field: 'disposed_pct', label: 'Disposed' },
            { field: 'landfill_pct', label: 'Landfill' },
          ].map(({ field, label }) => (
            <div key={field}>
              <label className="block text-xs text-text-tertiary mb-0.5">{label} %</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={fields[field]}
                onChange={(e) => updateField(field, e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg border border-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
              />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className={`text-xs font-medium ${pctValid ? 'text-green-600' : 'text-red-600'}`}>
            Total: {pctSum}% {!pctValid && '— Must equal 100%'}
          </span>
          <button
            type="button"
            onClick={handleAutoAdjust}
            className="text-xs text-primary hover:text-primary-hover underline transition"
          >
            Auto-adjust to 100%
          </button>
        </div>
      </div>

      {/* Downstream Processor */}
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1">Downstream Processor</label>
        <input
          type="text"
          value={fields.downstream_processor}
          onChange={(e) => updateField('downstream_processor', e.target.value)}
          placeholder="Name of receiving facility"
          className="w-full px-3 py-2 rounded-lg border border-input text-sm text-foreground placeholder-text-placeholder focus:outline-none focus:ring-2 focus:ring-ring transition"
        />
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1">Notes</label>
        <textarea
          value={fields.notes}
          onChange={(e) => updateField('notes', e.target.value)}
          maxLength={300}
          rows={2}
          placeholder="Optional notes..."
          className="w-full px-3 py-2 rounded-lg border border-input text-sm text-foreground placeholder-text-placeholder focus:outline-none focus:ring-2 focus:ring-ring transition resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <button type="button" onClick={clearLineForm} className="px-4 py-2 text-sm text-text-secondary hover:text-foreground rounded-lg hover:bg-muted transition">
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting || !pctValid}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:bg-primary-hover disabled:opacity-50 transition"
        >
          {submitting ? 'Saving...' : isEdit ? 'Update Line' : 'Save Line'}
        </button>
      </div>
    </form>
  );
}
