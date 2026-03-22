import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Download, History, Loader2, Plus, RefreshCcw, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import useSortingStore from '../../store/sortingStore';
import useMasterDataStore from '../../store/masterDataStore';
import useAuthStore from '../../store/authStore';
import StatusBadge from '../../components/ui/StatusBadge';
import {
  createCatalogueEntry,
  deleteCatalogueEntry,
  updateCatalogueEntry,
  listReusableItems,
  updateReusableItem,
} from '../../api/catalogue';
import {
  confirmAssetProcessing,
  createProcessingOutcome,
  deleteProcessingOutcome,
  finalizeAssetProcessing,
  getProcessingHistory,
  reopenAssetProcessing,
  updateProcessingOutcome,
} from '../../api/processing';
import { listProcessors } from '../../api/processors';
import { generateReport, getReports, downloadReport } from '../../api/reports';
import { getSortingName } from '../../utils/entityNames';

const inputClass = 'w-full h-10 px-3.5 rounded-md border border-grey-300 text-sm text-grey-900 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors';
const selectClass = `${inputClass} bg-white`;
const textareaClass = 'w-full min-h-[92px] px-3.5 py-2.5 rounded-md border border-grey-300 text-sm text-grey-900 placeholder:text-grey-400 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors resize-vertical';

const CONTAINER_TYPE_LABELS = {
  OPEN_TOP: 'Open Top',
  CLOSED_TOP: 'Closed Top',
  GITTERBOX: 'Gitterbox',
  PALLET: 'Pallet',
  OTHER: 'Other',
};

function emptyCatalogueForm() {
  return {
    material_id: '',
    weight_kg: '',
    is_reusable: false,
    reuse_eligible_quantity: '0',
    notes: '',
  };
}

function emptyOutcomeForm() {
  return {
    fraction_id: '',
    weight_kg: '',
    process_description: '',
    prepared_for_reuse_pct: '0',
    recycling_pct: '100',
    other_material_recovery_pct: '0',
    energy_recovery_pct: '0',
    thermal_disposal_pct: '0',
    landfill_disposal_pct: '0',
    notes: '',
  };
}

function buildOutcomeFormFromFraction(fraction, currentForm = emptyOutcomeForm()) {
  if (!fraction) return currentForm;
  return {
    ...currentForm,
    fraction_id: fraction.id,
    process_description: fraction.default_process_description || '',
    prepared_for_reuse_pct: String(fraction.prepared_for_reuse_pct_default ?? 0),
    recycling_pct: String(fraction.recycling_pct_default ?? 0),
    other_material_recovery_pct: String(fraction.other_material_recovery_pct_default ?? 0),
    energy_recovery_pct: String(fraction.energy_recovery_pct_default ?? 0),
    thermal_disposal_pct: String(fraction.thermal_disposal_pct_default ?? 0),
    landfill_disposal_pct: String(fraction.landfill_disposal_pct_default ?? 0),
  };
}

function percentageSum(form) {
  return [
    form.prepared_for_reuse_pct,
    form.recycling_pct,
    form.other_material_recovery_pct,
    form.energy_recovery_pct,
    form.thermal_disposal_pct,
    form.landfill_disposal_pct,
  ].reduce((sum, value) => sum + Number(value || 0), 0);
}

function sumOutcomeWeight(records = []) {
  return Math.round(records.reduce((sum, record) => sum + (record.outcomes || []).reduce((inner, outcome) => inner + Number(outcome.weight_kg || 0), 0), 0) * 100) / 100;
}

export default function SortingPage() {
  const { sessionId } = useParams();
  const { user } = useAuthStore();
  const { materials, fractions, loadAll } = useMasterDataStore();
  const {
    currentSession: session,
    isLoading,
    fetchSession,
    clearSession,
  } = useSortingStore();

  const [processors, setProcessors] = useState([]);
  const [processorsLoading, setProcessorsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('catalogue');
  const [activeAssetId, setActiveAssetId] = useState(null);
  const [catalogueForm, setCatalogueForm] = useState(emptyCatalogueForm());
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [savingCatalogue, setSavingCatalogue] = useState(false);
  const [outcomeForms, setOutcomeForms] = useState({});
  const [editingOutcomeIds, setEditingOutcomeIds] = useState({});
  const [historyByRecordId, setHistoryByRecordId] = useState({});
  const [historyLoadingId, setHistoryLoadingId] = useState(null);
  const [busyAssetId, setBusyAssetId] = useState(null);
  const [reusableItems, setReusableItems] = useState([]);
  const [reusablesLoading, setReusablesLoading] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenForm, setReopenForm] = useState({ reason_code: '', reason_notes: '' });
  const [openFractionForms, setOpenFractionForms] = useState({});
  const [sessionReports, setSessionReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [generatingEntryId, setGeneratingEntryId] = useState(null);

  const canOperate = ['ADMIN', 'GATE_OPERATOR', 'SORTING_EMPLOYEE', 'COMPLIANCE_OFFICER'].includes(user?.role);
  const canConfirm = ['ADMIN', 'COMPLIANCE_OFFICER'].includes(user?.role);

  useEffect(() => {
    fetchSession(sessionId);
    loadAll();
    setProcessorsLoading(true);
    listProcessors({ active: 'true' })
      .then(({ data }) => setProcessors(data.data))
      .catch(() => {
        setProcessors([]);
        toast.error('Failed to load processors');
      })
      .finally(() => setProcessorsLoading(false));
    return () => clearSession();
  }, [sessionId, fetchSession, clearSession, loadAll]);

  useEffect(() => {
    if (!session?.inbound?.assets?.length) return;
    setActiveAssetId((current) => current || session.inbound.assets[0].id);
  }, [session]);

  const assets = session?.inbound?.assets || [];
  const activeAsset = assets.find((asset) => asset.id === activeAssetId) || null;
  const assetCatalogueEntries = activeAsset?.catalogue_entries || [];
  const assetProcessingRecords = activeAsset?.processing_records || [];
  const assetProcessedWeight = sumOutcomeWeight(assetProcessingRecords);
  const assetNetWeight = Number(activeAsset?.net_weight_kg || 0);
  const assetBalance = Math.round((assetProcessedWeight - assetNetWeight) * 100) / 100;
  const isBalanced = Math.abs(assetBalance) <= 1;

  // Sorting (catalogue) weight balance
  const sortingWeightSum = assetCatalogueEntries.reduce((sum, e) => sum + Number(e.weight_kg || 0), 0);
  const sortingBalance = Math.round((sortingWeightSum - assetNetWeight) * 100) / 100;
  const isSortingBalanced = Math.abs(sortingBalance) <= 1;

  async function refreshSession() {
    await fetchSession(sessionId);
  }

  async function fetchReusables() {
    if (!sessionId || !activeAssetId) return;
    setReusablesLoading(true);
    try {
      const { data } = await listReusableItems(sessionId, { asset_id: activeAssetId });
      setReusableItems(data.data);
    } catch {
      setReusableItems([]);
    } finally {
      setReusablesLoading(false);
    }
  }

  async function handleUpdateReusable(id, field, value) {
    try {
      await updateReusableItem(id, { [field]: value });
      await fetchReusables();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update reusable item');
    }
  }

  async function fetchSessionReports() {
    if (!sessionId) return;
    setReportsLoading(true);
    try {
      const { data } = await getReports({ type: 'RPT-DS', session_id: sessionId, limit: 50 });
      setSessionReports(data.data);
    } catch {
      setSessionReports([]);
    } finally {
      setReportsLoading(false);
    }
  }

  async function handleGenerateReport(entryId) {
    setGeneratingEntryId(entryId);
    try {
      await generateReport({
        type: 'RPT-DS',
        format: 'pdf',
        parameters: { sessionId, catalogueEntryId: entryId },
      });
      toast.success('Downstream report generated');
      await fetchSessionReports();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to generate report');
    } finally {
      setGeneratingEntryId(null);
    }
  }

  async function handleDownloadReport(reportId) {
    try {
      const response = await downloadReport(reportId, 'pdf');
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `downstream-report-${reportId.slice(0, 8)}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download report');
    }
  }

  async function handleSaveCatalogueEntry(event) {
    event.preventDefault();
    if (!activeAsset) return;
    setSavingCatalogue(true);
    try {
      if (editingEntryId) {
        await updateCatalogueEntry(editingEntryId, catalogueForm);
        toast.success('Catalogue entry updated');
      } else {
        await createCatalogueEntry(sessionId, activeAsset.id, catalogueForm);
        toast.success('Catalogue entry created');
      }
      setCatalogueForm(emptyCatalogueForm());
      setEditingEntryId(null);
      await refreshSession();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save catalogue entry');
    } finally {
      setSavingCatalogue(false);
    }
  }

  async function handleDeleteCatalogueEntry(entryId) {
    if (!window.confirm('Delete this catalogue entry?')) return;
    try {
      await deleteCatalogueEntry(entryId);
      toast.success('Catalogue entry deleted');
      if (editingEntryId === entryId) {
        setEditingEntryId(null);
        setCatalogueForm(emptyCatalogueForm());
      }
      await refreshSession();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to delete catalogue entry');
    }
  }

  async function handleSaveOutcome(recordId) {
    const form = outcomeForms[recordId] || emptyOutcomeForm();
    try {
      if (editingOutcomeIds[recordId]) {
        await updateProcessingOutcome(editingOutcomeIds[recordId], form);
        toast.success('Processing outcome updated');
      } else {
        await createProcessingOutcome(recordId, form);
        toast.success('Processing outcome added');
      }
      setOutcomeForms((current) => ({ ...current, [recordId]: emptyOutcomeForm() }));
      setEditingOutcomeIds((current) => ({ ...current, [recordId]: null }));
      await refreshSession();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save processing outcome');
    }
  }

  async function handleDeleteOutcome(outcomeId) {
    if (!window.confirm('Delete this processing outcome?')) return;
    try {
      await deleteProcessingOutcome(outcomeId);
      toast.success('Processing outcome deleted');
      await refreshSession();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to delete processing outcome');
    }
  }

  async function handleFinalizeAsset() {
    if (!activeAsset) return;
    setBusyAssetId(activeAsset.id);
    try {
      await finalizeAssetProcessing(sessionId, activeAsset.id);
      toast.success('Parcel processing finalized');
      await refreshSession();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to finalize parcel processing');
    } finally {
      setBusyAssetId(null);
    }
  }

  async function handleConfirmAsset() {
    if (!activeAsset) return;
    setBusyAssetId(activeAsset.id);
    try {
      await confirmAssetProcessing(sessionId, activeAsset.id);
      toast.success('Parcel processing confirmed');
      await refreshSession();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to confirm parcel processing');
    } finally {
      setBusyAssetId(null);
    }
  }

  async function handleReopenAsset() {
    if (!activeAsset || !reopenForm.reason_code) return;
    setBusyAssetId(activeAsset.id);
    try {
      await reopenAssetProcessing(sessionId, activeAsset.id, reopenForm);
      toast.success('Parcel processing reopened');
      setShowReopenModal(false);
      setReopenForm({ reason_code: '', reason_notes: '' });
      await refreshSession();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to reopen parcel processing');
    } finally {
      setBusyAssetId(null);
    }
  }

  async function handleLoadHistory(recordId) {
    if (historyByRecordId[recordId]) {
      setHistoryByRecordId((current) => ({ ...current, [recordId]: null }));
      return;
    }
    setHistoryLoadingId(recordId);
    try {
      const { data } = await getProcessingHistory(recordId);
      setHistoryByRecordId((current) => ({ ...current, [recordId]: data.data }));
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to load history');
    } finally {
      setHistoryLoadingId(null);
    }
  }

  if (isLoading || !session) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-grey-400" size={24} />
      </div>
    );
  }

  const order = session.inbound?.order;
  const sessionStatus = session.status;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-3 flex-wrap mb-2">
            <h1 className="text-2xl font-bold text-grey-900">{getSortingName(session)}</h1>
            <StatusBadge status={sessionStatus} />
          </div>
          <p className="text-sm text-grey-500">
            Shredding and sorting drive the process; downstream statements are generated from the material and fraction records captured here.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <InfoField label="Linked Inbound">
            <Link className="text-sm font-semibold text-green-600 hover:underline mt-0.5 inline-block" to={`/inbounds/${session.inbound_id}`}>{session.inbound?.inbound_number || '—'}</Link>
          </InfoField>
          <InfoField label="Linked Order">
            <Link className="text-sm font-semibold text-green-600 hover:underline mt-0.5 inline-block" to={`/orders/${order?.id}`}>{order?.order_number || '—'}</Link>
          </InfoField>
          <InfoField label="Supplier" value={order?.supplier?.name} />
          <InfoField label="Carrier" value={order?.carrier?.name} />
          <InfoField label="Vehicle Plate" value={session.inbound?.vehicle?.registration_plate} mono />
          <InfoField label="Waste Stream" value={order?.waste_stream?.name_en} />
          <InfoField label="Recorded" value={session.recorded_at ? format(new Date(session.recorded_at), 'dd MMM yyyy HH:mm') : '—'} />
          <InfoField label="Parcels" value={String(assets.length)} />
        </div>
      </div>

      {assets.length > 0 && (
        <>
          <div className="flex gap-2 overflow-x-auto border-b border-grey-200 mb-4">
            {assets.map((asset) => {
              const confirmed = asset.processing_records?.length > 0 && asset.processing_records.every((record) => record.status === 'CONFIRMED');
              const balance = Math.round((((asset.processing_allocated_kg || 0) - Number(asset.net_weight_kg || 0)) || 0) * 100) / 100;
              const badgeClass = confirmed
                ? 'bg-green-500'
                : Math.abs(balance) <= 1 && (asset.processing_records?.length || 0) > 0
                  ? 'bg-orange-500'
                  : 'bg-grey-300';

              return (
                <button
                  key={asset.id}
                  onClick={() => setActiveAssetId(asset.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${asset.id === activeAssetId ? 'border-green-500 text-grey-900' : 'border-transparent text-grey-500 hover:text-grey-700 hover:border-grey-300'}`}
                >
                  <span className={`w-2 h-2 rounded-full ${badgeClass}`} />
                  {asset.asset_label}
                  <span className="text-xs text-grey-400">
                    {asset.parcel_type === 'CONTAINER'
                      ? CONTAINER_TYPE_LABELS[asset.container_type] || asset.container_type
                      : 'Material'}
                  </span>
                </button>
              );
            })}
          </div>

          {activeAsset && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('catalogue')}
                    className={`h-9 px-4 rounded-md text-sm font-semibold transition-colors flex items-center gap-2 ${activeTab === 'catalogue' ? 'bg-green-500 text-white' : 'bg-white border border-grey-300 text-grey-700 hover:bg-grey-50'}`}
                  >
                    Shredding
                    {assetCatalogueEntries.length > 0 && (
                      <span className={`w-2 h-2 rounded-full ${isSortingBalanced ? (activeTab === 'catalogue' ? 'bg-white' : 'bg-green-500') : 'bg-red-500'}`} />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('processing')}
                    className={`h-9 px-4 rounded-md text-sm font-semibold transition-colors flex items-center gap-2 ${activeTab === 'processing' ? 'bg-green-500 text-white' : 'bg-white border border-grey-300 text-grey-700 hover:bg-grey-50'}`}
                  >
                    Sorting
                    {session.processing_status === 'COMPLETED' && <span className={`w-2 h-2 rounded-full ${activeTab === 'processing' ? 'bg-white' : 'bg-green-500'}`} />}
                    {session.processing_status !== 'COMPLETED' && session.processing_status === 'IN_PROGRESS' && <span className={`w-2 h-2 rounded-full ${activeTab === 'processing' ? 'bg-white/60' : 'bg-orange-400'}`} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActiveTab('reusables'); fetchReusables(); }}
                    className={`h-9 px-4 rounded-md text-sm font-semibold transition-colors ${activeTab === 'reusables' ? 'bg-green-500 text-white' : 'bg-white border border-grey-300 text-grey-700 hover:bg-grey-50'}`}
                  >
                    Reusables
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActiveTab('reports'); fetchSessionReports(); }}
                    className={`h-9 px-4 rounded-md text-sm font-semibold transition-colors ${activeTab === 'reports' ? 'bg-green-500 text-white' : 'bg-white border border-grey-300 text-grey-700 hover:bg-grey-50'}`}
                  >
                    Reports
                  </button>
                </div>
              </div>

              {activeTab === 'catalogue' ? (
                <div>
                  {/* Sorting Balance */}
                  <div className={`rounded-lg border px-4 py-2.5 text-sm mb-4 ${isSortingBalanced ? 'border-green-200 bg-green-25 text-green-700' : 'border-red-200 bg-red-25 text-red-700'}`}>
                    Shredding Balance: {sortingWeightSum.toLocaleString()} / {assetNetWeight.toLocaleString()} kg
                    <span className="ml-2 font-semibold">
                      {isSortingBalanced
                        ? 'Balanced'
                        : sortingBalance > 0
                          ? `Over by ${sortingBalance} kg`
                          : `Remaining ${Math.abs(sortingBalance)} kg`}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-4">
                  <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-base font-semibold text-grey-900">Shredding Entries</h2>
                        <p className="text-sm text-grey-500 mt-1">Capture materials and weights for {activeAsset.asset_label}.</p>
                      </div>
                      <div className="text-sm text-grey-500">{assetCatalogueEntries.length} line(s)</div>
                    </div>

                    {assetCatalogueEntries.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-grey-300 p-8 text-center text-sm text-grey-400">
                        No catalogue entries yet
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {assetCatalogueEntries.map((entry) => (
                          <div key={entry.id} className="rounded-lg border border-grey-200 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-grey-900">{(entry.material || entry.product_type).name_en || (entry.material || entry.product_type).label_en}</p>
                                <p className="text-xs text-grey-500 mt-1">
                                  {(entry.material || entry.product_type).code} | CBS {(entry.material || entry.product_type).cbs_code} | WEEE {(entry.material || entry.product_type).weee_category || (entry.material || entry.product_type).annex_iii_category}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingEntryId(entry.id);
                                    setCatalogueForm({
                                      material_id: entry.material_id || entry.product_type_id,
                                      weight_kg: String(Number(entry.weight_kg)),
                                      is_reusable: entry.reuse_eligible_quantity > 0,
                                      reuse_eligible_quantity: String(entry.reuse_eligible_quantity),
                                      notes: entry.notes || '',
                                    });
                                  }}
                                  className="h-8 px-3 rounded-md border border-grey-300 text-xs font-semibold text-grey-700 hover:bg-grey-50"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCatalogueEntry(entry.id)}
                                  className="p-2 rounded-md border border-grey-300 text-grey-500 hover:text-red-600 hover:border-red-200"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3 mt-4 text-sm">
                              <div>
                                <span className="text-xs text-grey-500 uppercase tracking-wide">Weight (kg)</span>
                                <p className="mt-1 font-semibold text-grey-900">{Number(entry.weight_kg).toLocaleString()}</p>
                              </div>
                              <div>
                                <span className="text-xs text-grey-500 uppercase tracking-wide">Reusable Qty</span>
                                <p className="mt-1 font-semibold text-grey-900">{entry.reuse_eligible_quantity}</p>
                              </div>
                              <div>
                                <span className="text-xs text-grey-500 uppercase tracking-wide">Default Afvalstroom</span>
                                <p className="mt-1 font-semibold text-grey-900">{(entry.material || entry.product_type).default_afvalstroomnummer || '—'}</p>
                              </div>
                            </div>
                            {entry.notes && <p className="mt-3 text-sm text-grey-600">{entry.notes}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-base font-semibold text-grey-900">{editingEntryId ? 'Edit Shredding Entry' : 'Add Shredding Entry'}</h2>
                        <p className="text-sm text-grey-500 mt-1">Select the material and enter its weight. Fractions are captured in the sorting tab.</p>
                      </div>
                      {editingEntryId && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingEntryId(null);
                            setCatalogueForm(emptyCatalogueForm());
                          }}
                          className="text-sm text-grey-500 hover:text-grey-700"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                    <form className="space-y-4" onSubmit={handleSaveCatalogueEntry}>
                      <div>
                        <label className="block text-sm font-medium text-grey-700 mb-1.5">Material</label>
                        <select
                          value={catalogueForm.material_id}
                          onChange={(event) => setCatalogueForm((current) => ({ ...current, material_id: event.target.value }))}
                          required
                          className={selectClass}
                        >
                          <option value="">Select material...</option>
                          {materials
                            .filter((type) => !activeAsset.waste_stream_id || type.waste_stream_id === activeAsset.waste_stream_id)
                            .map((type) => (
                              <option key={type.id} value={type.id}>
                                {type.code} - {type.name_en}
                              </option>
                            ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-grey-700 mb-1.5">Weight (kg)</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={catalogueForm.weight_kg}
                            onChange={(event) => setCatalogueForm((current) => ({ ...current, weight_kg: event.target.value }))}
                            className={inputClass}
                            required
                          />
                          {Math.abs(sortingBalance) > 1 && sortingBalance < 0 && (
                            <button
                              type="button"
                              onClick={() => setCatalogueForm((current) => ({ ...current, weight_kg: String(Math.abs(sortingBalance)) }))}
                              className="shrink-0 h-10 px-3 rounded-md border border-grey-300 text-xs font-medium text-grey-700 hover:bg-grey-50 transition-colors whitespace-nowrap"
                            >
                              Use Remaining
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center text-sm font-medium text-grey-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={catalogueForm.is_reusable}
                            onChange={(event) => setCatalogueForm((current) => ({
                              ...current,
                              is_reusable: event.target.checked,
                              reuse_eligible_quantity: event.target.checked ? (current.reuse_eligible_quantity === '0' ? '1' : current.reuse_eligible_quantity) : '0',
                            }))}
                            className="mr-2 accent-green-500"
                          />
                          Reusable
                        </label>
                        {catalogueForm.is_reusable && (
                          <div className="flex items-center gap-2">
                            <label className="text-sm font-medium text-grey-700">Quantity:</label>
                            <input
                              type="number"
                              min="1"
                              value={catalogueForm.reuse_eligible_quantity}
                              onChange={(event) => setCatalogueForm((current) => ({ ...current, reuse_eligible_quantity: event.target.value }))}
                              className="w-20 h-10 px-3 rounded-md border border-grey-300 text-sm text-grey-900 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none"
                              required
                            />
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-grey-700 mb-1.5">Notes</label>
                        <textarea
                          value={catalogueForm.notes}
                          onChange={(event) => setCatalogueForm((current) => ({ ...current, notes: event.target.value }))}
                          className={textareaClass}
                          placeholder="Optional notes, operator observations, packaging cues..."
                        />
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={savingCatalogue || !canOperate}
                          className="h-10 px-4 rounded-md bg-green-500 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                        >
                          {savingCatalogue ? <Loader2 size={16} className="animate-spin" /> : editingEntryId ? null : <Plus size={16} />}
                          {editingEntryId ? 'Update Entry' : 'Add Entry'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
                </div>
              ) : activeTab === 'processing' ? (
                <div className="space-y-4">
                  {/* Contextual action button */}
                  {(() => {
                    const allDraft = assetProcessingRecords.length > 0 && assetProcessingRecords.every((r) => r.status === 'DRAFT');
                    const allFinalized = assetProcessingRecords.length > 0 && assetProcessingRecords.every((r) => r.status === 'FINALIZED');
                    const allConfirmed = assetProcessingRecords.length > 0 && assetProcessingRecords.every((r) => r.status === 'CONFIRMED');
                    const hasRecords = assetProcessingRecords.length > 0;

                    if (!hasRecords) return null;

                    return (
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-grey-500">Finalize when all fractions balance within ±1 kg of the shredding weight.</p>
                        <div>
                          {allDraft && (
                            <button type="button" onClick={handleFinalizeAsset} disabled={!canOperate || busyAssetId === activeAsset.id}
                              className="h-9 px-5 border-2 border-green-500 text-green-700 rounded-md text-sm font-semibold hover:bg-green-25 disabled:opacity-50 transition-colors">
                              {busyAssetId === activeAsset.id ? 'Working...' : 'Finalize Parcel'}
                            </button>
                          )}
                          {allFinalized && (
                            <div className="flex gap-2">
                              {canConfirm && (
                                <button type="button" onClick={handleConfirmAsset} disabled={busyAssetId === activeAsset.id}
                                  className="h-9 px-4 rounded-md bg-green-500 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50">
                                  Confirm Compliance
                                </button>
                              )}
                              <button type="button" onClick={() => setShowReopenModal(true)} disabled={busyAssetId === activeAsset.id}
                                className="h-9 px-4 rounded-md border border-grey-300 bg-white text-sm font-semibold text-grey-700 hover:bg-grey-50 disabled:opacity-50">
                                Reopen Version
                              </button>
                            </div>
                          )}
                          {allConfirmed && canConfirm && (
                            <button type="button" onClick={() => setShowReopenModal(true)} disabled={busyAssetId === activeAsset.id}
                              className="h-9 px-4 rounded-md border border-grey-300 bg-white text-sm font-semibold text-grey-700 hover:bg-grey-50 disabled:opacity-50">
                              Reopen Version
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {assetProcessingRecords.length === 0 ? (
                    <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-8 text-center text-sm text-grey-400">
                      Add shredding entries first. Draft sorting records are created automatically from shredding.
                    </div>
                  ) : (
                    assetProcessingRecords.map((record) => {
                      const form = outcomeForms[record.id] || emptyOutcomeForm();
                      const editingOutcomeId = editingOutcomeIds[record.id];
                      const history = historyByRecordId[record.id];

                      // Per-material balance: use sorting entry weight (not inbound net weight)
                      const linkedEntry = assetCatalogueEntries.find((e) => e.id === record.catalogue_entry_id);
                      const materialTargetWeight = linkedEntry ? Number(linkedEntry.weight_kg) : 0;
                      const materialOutcomeWeight = (record.outcomes || []).reduce((sum, o) => sum + Number(o.weight_kg || 0), 0);
                      const materialDelta = Math.round((materialOutcomeWeight - materialTargetWeight) * 100) / 100;
                      const materialBalanced = Math.abs(materialDelta) <= 1;

                      return (
                        <div key={record.id} className="bg-white rounded-lg border border-grey-200 shadow-sm p-5">
                          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-base font-semibold text-grey-900">{record.material_name_snapshot || record.product_label_snapshot}</h3>
                                <StatusBadge status={record.status} />
                              </div>
                              <p className="text-xs text-grey-500 mt-1">
                                {record.material_code_snapshot || record.product_code_snapshot} | WEEE {record.weee_category_snapshot || record.annex_iii_category_snapshot} | Version {record.version_no}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleLoadHistory(record.id)}
                              className="h-8 px-3 rounded-md border border-grey-300 text-xs font-semibold text-grey-700 hover:bg-grey-50 flex items-center gap-2"
                            >
                              {historyLoadingId === record.id ? <Loader2 size={14} className="animate-spin" /> : <History size={14} />}
                              {history ? 'Hide History' : 'Show History'}
                            </button>
                          </div>

                          {history && (
                            <div className="rounded-lg border border-grey-200 bg-grey-25 p-4 mb-4">
                              <h4 className="text-sm font-semibold text-grey-900 mb-3">Version History</h4>
                              <div className="space-y-2">
                                {history.map((version) => (
                                  <div key={version.id} className="flex items-center justify-between gap-3 text-sm">
                                    <div>
                                      <span className="font-semibold text-grey-900">v{version.version_no}</span>
                                      <span className="ml-2 text-grey-500">{version.reason_code || '—'}</span>
                                    </div>
                                    <StatusBadge status={version.status} />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {materialTargetWeight > 0 && (
                            <div className={`rounded-lg border px-4 py-2 text-sm mb-4 ${materialBalanced ? 'border-green-200 bg-green-25 text-green-700' : 'border-red-200 bg-red-25 text-red-700'}`}>
                              Sorting Balance: {materialOutcomeWeight.toLocaleString()} / {materialTargetWeight.toLocaleString()} kg
                              <span className="ml-2 font-semibold">
                                {materialBalanced ? 'Balanced' : materialDelta > 0 ? `Over by ${materialDelta} kg` : `Remaining ${Math.abs(materialDelta)} kg`}
                              </span>
                            </div>
                          )}

                          <div className="overflow-x-auto mb-4">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-grey-50 border-b border-grey-200">
                                  <th className="px-3 py-2 text-left text-xs font-medium text-grey-500 uppercase tracking-wide">Fraction</th>
                                  <th className="px-3 py-2 text-right text-xs font-medium text-grey-500 uppercase tracking-wide">Weight</th>
                                  <th className="px-3 py-2 text-right text-xs font-medium text-grey-500 uppercase tracking-wide">Share</th>
                                  <th className="px-3 py-2 text-right text-xs font-medium text-grey-500 uppercase tracking-wide">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {record.outcomes.length === 0 ? (
                                  <tr>
                                    <td colSpan={4} className="px-3 py-5 text-center text-grey-400">No outcomes yet</td>
                                  </tr>
                                ) : (
                                  record.outcomes.map((outcome) => (
                                    <tr key={outcome.id} className="border-b border-grey-100">
                                      <td className="px-3 py-2.5">
                                        <div className="font-medium text-grey-900">{outcome.fraction?.name_en || outcome.material_fraction}</div>
                                      </td>
                                      <td className="px-3 py-2.5 text-right font-semibold text-grey-900">{Number(outcome.weight_kg).toLocaleString()} kg</td>
                                      <td className="px-3 py-2.5 text-right text-grey-700">{Number(outcome.share_pct || 0).toFixed(2)}%</td>
                                      <td className="px-3 py-2.5 text-right">
                                        <div className="inline-flex items-center gap-2">
                                          <button
                                            type="button"
                                            disabled={record.status !== 'DRAFT'}
                                            onClick={() => {
                                              setEditingOutcomeIds((current) => ({ ...current, [record.id]: outcome.id }));
                                              setOutcomeForms((current) => ({
                                                ...current,
                                                [record.id]: {
                                                  fraction_id: outcome.fraction_id || '',
                                                  weight_kg: String(Number(outcome.weight_kg)),
                                                  process_description: outcome.process_description || '',
                                                  prepared_for_reuse_pct: String(Number(outcome.prepared_for_reuse_pct || 0)),
                                                  recycling_pct: String(Number(outcome.recycling_pct || 0)),
                                                  other_material_recovery_pct: String(Number(outcome.other_material_recovery_pct || 0)),
                                                  energy_recovery_pct: String(Number(outcome.energy_recovery_pct || 0)),
                                                  thermal_disposal_pct: String(Number(outcome.thermal_disposal_pct || 0)),
                                                  landfill_disposal_pct: String(Number(outcome.landfill_disposal_pct || 0)),
                                                  notes: outcome.notes || '',
                                                },
                                              }));
                                            }}
                                            className="h-8 px-3 rounded-md border border-grey-300 text-xs font-semibold text-grey-700 hover:bg-grey-50 disabled:opacity-40"
                                          >
                                            Edit
                                          </button>
                                          <button
                                            type="button"
                                            disabled={record.status !== 'DRAFT'}
                                            onClick={() => handleDeleteOutcome(outcome.id)}
                                            className="p-2 rounded-md border border-grey-300 text-grey-500 hover:text-red-600 hover:border-red-200 disabled:opacity-40"
                                          >
                                            <Trash2 size={14} />
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>

                          {/* Add Fraction button (when form is closed) */}
                          {!openFractionForms[record.id] && !editingOutcomeId && record.status === 'DRAFT' && (
                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={() => setOpenFractionForms((c) => ({ ...c, [record.id]: true }))}
                                className="h-9 px-4 rounded-md bg-green-500 text-white text-sm font-semibold hover:bg-green-700 flex items-center gap-2"
                              >
                                <Plus size={14} /> Add Fraction
                              </button>
                            </div>
                          )}

                          {/* Fraction form (collapsible) */}
                          {(openFractionForms[record.id] || editingOutcomeId) && (
                          <div className="rounded-lg border border-grey-200 bg-grey-25 p-4">
                            <div className="flex items-center justify-between gap-3 mb-4">
                              <h4 className="text-sm font-semibold text-grey-900">{editingOutcomeId ? 'Edit Fraction' : 'Add Fraction'}</h4>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingOutcomeIds((current) => ({ ...current, [record.id]: null }));
                                  setOutcomeForms((current) => ({ ...current, [record.id]: emptyOutcomeForm() }));
                                  setOpenFractionForms((c) => ({ ...c, [record.id]: false }));
                                }}
                                className="text-sm text-grey-500 hover:text-grey-700 flex items-center gap-1"
                              >
                                <RefreshCcw size={14} />
                                {editingOutcomeId ? 'Cancel' : 'Close'}
                              </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mb-3">
                              <div>
                                <label className="block text-xs font-medium text-grey-700 mb-1">Fraction</label>
                                <select
                                  value={form.fraction_id}
                                  onChange={(event) => {
                                    const usedFractionIds = record.outcomes.map((o) => o.fraction_id).filter(Boolean);
                                    const availableFractions = ((record.material?.fractions || []).map((entry) => entry.fraction).filter(Boolean).length > 0
                                      ? (record.material?.fractions || []).map((entry) => entry.fraction)
                                      : fractions
                                    ).filter((f) => !usedFractionIds.includes(f.id) || f.id === editingOutcomeId);
                                    const selectedFraction = availableFractions.find((fraction) => fraction.id === event.target.value);
                                    setOutcomeForms((current) => ({
                                      ...current,
                                      [record.id]: buildOutcomeFormFromFraction(selectedFraction, { ...form, fraction_id: event.target.value }),
                                    }));
                                  }}
                                  className={selectClass}
                                  disabled={record.status !== 'DRAFT'}
                                >
                                  <option value="">Select fraction...</option>
                                  {(() => {
                                    const usedFractionIds = record.outcomes.map((o) => o.fraction_id).filter(Boolean);
                                    const editingFractionId = editingOutcomeId ? record.outcomes.find((o) => o.id === editingOutcomeId)?.fraction_id : null;
                                    return ((record.material?.fractions || []).map((entry) => entry.fraction).filter(Boolean).length > 0
                                      ? (record.material?.fractions || []).map((entry) => entry.fraction)
                                      : fractions
                                    ).filter((f) => !usedFractionIds.includes(f.id) || f.id === editingFractionId);
                                  })().map((fraction) => (
                                    <option key={fraction.id} value={fraction.id}>{fraction.code} - {fraction.name_en}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-grey-700 mb-1">Weight (kg)</label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={form.weight_kg}
                                    onChange={(event) => setOutcomeForms((current) => ({ ...current, [record.id]: { ...form, weight_kg: event.target.value } }))}
                                    className={inputClass}
                                    disabled={record.status !== 'DRAFT'}
                                  />
                                  {materialDelta < -1 && (
                                    <button
                                      type="button"
                                      onClick={() => setOutcomeForms((current) => ({ ...current, [record.id]: { ...form, weight_kg: String(Math.abs(materialDelta)) } }))}
                                      className="shrink-0 h-10 px-3 rounded-md border border-grey-300 text-xs font-medium text-grey-700 hover:bg-grey-50 transition-colors whitespace-nowrap"
                                    >
                                      Use Remaining
                                    </button>
                                  )}
                                </div>
                              </div>
                              <div className="md:col-span-2 xl:col-span-3">
                                <label className="block text-xs font-medium text-grey-700 mb-1">Process Description</label>
                                <input
                                  value={form.process_description}
                                  onChange={(event) => setOutcomeForms((current) => ({ ...current, [record.id]: { ...form, process_description: event.target.value } }))}
                                  className={inputClass}
                                  disabled={record.status !== 'DRAFT'}
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-3">
                              <PercentageInput label="% Prepared for re-use" value={form.prepared_for_reuse_pct} disabled={record.status !== 'DRAFT'} onChange={(value) => setOutcomeForms((current) => ({ ...current, [record.id]: { ...form, prepared_for_reuse_pct: value } }))} />
                              <PercentageInput label="% Recycling" value={form.recycling_pct} disabled={record.status !== 'DRAFT'} onChange={(value) => setOutcomeForms((current) => ({ ...current, [record.id]: { ...form, recycling_pct: value } }))} />
                              <PercentageInput label="% Other MR" value={form.other_material_recovery_pct} disabled={record.status !== 'DRAFT'} onChange={(value) => setOutcomeForms((current) => ({ ...current, [record.id]: { ...form, other_material_recovery_pct: value } }))} />
                              <PercentageInput label="% Energy" value={form.energy_recovery_pct} disabled={record.status !== 'DRAFT'} onChange={(value) => setOutcomeForms((current) => ({ ...current, [record.id]: { ...form, energy_recovery_pct: value } }))} />
                              <PercentageInput label="% Thermal" value={form.thermal_disposal_pct} disabled={record.status !== 'DRAFT'} onChange={(value) => setOutcomeForms((current) => ({ ...current, [record.id]: { ...form, thermal_disposal_pct: value } }))} />
                              <PercentageInput label="% Landfill" value={form.landfill_disposal_pct} disabled={record.status !== 'DRAFT'} onChange={(value) => setOutcomeForms((current) => ({ ...current, [record.id]: { ...form, landfill_disposal_pct: value } }))} />
                            </div>
                            <div className={`mb-3 rounded-md border px-3 py-2 text-xs ${Math.abs(percentageSum(form) - 100) < 0.01 ? 'border-green-200 bg-green-25 text-green-700' : 'border-orange-200 bg-orange-25 text-orange-700'}`}>
                              Recovery profile total: {percentageSum(form).toFixed(2)}%
                            </div>
                            <div className="mb-3">
                              <label className="block text-xs font-medium text-grey-700 mb-1">Notes</label>
                              <textarea
                                value={form.notes}
                                onChange={(event) => setOutcomeForms((current) => ({ ...current, [record.id]: { ...form, notes: event.target.value } }))}
                                className={textareaClass}
                                placeholder="Transfer comments, contamination notes, operator remarks..."
                                disabled={record.status !== 'DRAFT'}
                              />
                            </div>
                            <div className="flex justify-end gap-2">
                              {editingOutcomeId ? (
                                <button
                                  type="button"
                                  disabled={record.status !== 'DRAFT' || !canOperate}
                                  onClick={async () => {
                                    await handleSaveOutcome(record.id);
                                    setOpenFractionForms((c) => ({ ...c, [record.id]: false }));
                                  }}
                                  className="h-10 px-4 rounded-md bg-green-500 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50"
                                >
                                  Update Fraction
                                </button>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    disabled={record.status !== 'DRAFT' || !canOperate}
                                    onClick={async () => {
                                      await handleSaveOutcome(record.id);
                                      setOpenFractionForms((c) => ({ ...c, [record.id]: false }));
                                    }}
                                    className="h-10 px-4 rounded-md border border-grey-300 bg-white text-sm font-semibold text-grey-700 hover:bg-grey-50 disabled:opacity-50"
                                  >
                                    Submit
                                  </button>
                                  <button
                                    type="button"
                                    disabled={record.status !== 'DRAFT' || !canOperate}
                                    onClick={() => handleSaveOutcome(record.id)}
                                    className="h-10 px-4 rounded-md bg-green-500 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50"
                                  >
                                    Submit &amp; Add Another
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                          )}
                        </div>
                      );
                    })
                  )}
                  {/* Sorting overall balance */}
                  {assetProcessingRecords.length > 0 && (
                    <div className={`rounded-lg border px-4 py-2.5 text-sm ${isBalanced ? 'border-green-200 bg-green-25 text-green-700' : 'border-red-200 bg-red-25 text-red-700'}`}>
                      Sorting Balance: {assetProcessedWeight.toLocaleString()} / {sortingWeightSum.toLocaleString()} kg
                      <span className="ml-2 font-semibold">
                        {isBalanced ? 'Balanced' : `${Math.abs(assetBalance)} kg ${assetBalance > 0 ? 'over' : 'remaining'}`}
                      </span>
                      <p className="mt-1 text-xs opacity-80">All fractions must balance within ±1 kg of the total shredding weight before finalization.</p>
                    </div>
                  )}
                </div>
              ) : activeTab === 'reusables' ? (
                <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-5">
                  <h2 className="text-base font-semibold text-grey-900 mb-4">Reusable Items</h2>
                  {reusablesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="animate-spin text-grey-400" size={20} />
                    </div>
                  ) : reusableItems.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-grey-300 p-8 text-center text-sm text-grey-400">
                      No reusable items. Mark shredding entries as reusable to create items here.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {Object.entries(
                        reusableItems.reduce((groups, item) => {
                          const key = item.material?.name_en || 'Unknown';
                          if (!groups[key]) groups[key] = [];
                          groups[key].push(item);
                          return groups;
                        }, {})
                      ).map(([materialName, items]) => (
                        <div key={materialName}>
                          <h3 className="text-sm font-semibold text-grey-900 mb-2">{materialName} <span className="text-grey-400 font-normal">({items.length})</span></h3>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-grey-50 border-b border-grey-200">
                                  <th className="px-3 py-2 text-left text-xs font-medium text-grey-500 uppercase tracking-wide w-10">#</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-grey-500 uppercase tracking-wide">Brand</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-grey-500 uppercase tracking-wide">Model</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-grey-500 uppercase tracking-wide">Type</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-grey-500 uppercase tracking-wide">Serial Number</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-grey-500 uppercase tracking-wide">Condition</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-grey-500 uppercase tracking-wide">Notes</th>
                                </tr>
                              </thead>
                              <tbody>
                                {items.map((item, index) => (
                                  <tr key={item.id} className="border-b border-grey-100">
                                    <td className="px-3 py-2 text-grey-400">{index + 1}</td>
                                    <td className="px-3 py-1.5">
                                      <input type="text" defaultValue={item.brand || ''} onBlur={(e) => handleUpdateReusable(item.id, 'brand', e.target.value)} className="w-full h-8 px-2 rounded border border-grey-200 text-sm focus:border-green-500 outline-none" />
                                    </td>
                                    <td className="px-3 py-1.5">
                                      <input type="text" defaultValue={item.model_name || ''} onBlur={(e) => handleUpdateReusable(item.id, 'model_name', e.target.value)} className="w-full h-8 px-2 rounded border border-grey-200 text-sm focus:border-green-500 outline-none" />
                                    </td>
                                    <td className="px-3 py-1.5">
                                      <input type="text" defaultValue={item.type || ''} onBlur={(e) => handleUpdateReusable(item.id, 'type', e.target.value)} className="w-full h-8 px-2 rounded border border-grey-200 text-sm focus:border-green-500 outline-none" />
                                    </td>
                                    <td className="px-3 py-1.5">
                                      <input type="text" defaultValue={item.serial_number || ''} onBlur={(e) => handleUpdateReusable(item.id, 'serial_number', e.target.value)} className="w-full h-8 px-2 rounded border border-grey-200 text-sm focus:border-green-500 outline-none" />
                                    </td>
                                    <td className="px-3 py-1.5">
                                      <select defaultValue={item.condition || ''} onChange={(e) => handleUpdateReusable(item.id, 'condition', e.target.value)} className="w-full h-8 px-2 rounded border border-grey-200 text-sm bg-white focus:border-green-500 outline-none">
                                        <option value="">—</option>
                                        <option value="GOOD">Good</option>
                                        <option value="FAIR">Fair</option>
                                        <option value="POOR">Poor</option>
                                        <option value="DAMAGED">Damaged</option>
                                      </select>
                                    </td>
                                    <td className="px-3 py-1.5">
                                      <input type="text" defaultValue={item.notes || ''} onBlur={(e) => handleUpdateReusable(item.id, 'notes', e.target.value)} className="w-full h-8 px-2 rounded border border-grey-200 text-sm focus:border-green-500 outline-none" />
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : activeTab === 'reports' ? (
                <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-5">
                  <h2 className="text-base font-semibold text-grey-900 mb-4">Downstream Reports</h2>
                  {reportsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="animate-spin text-grey-400" size={20} />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {assetCatalogueEntries.map((entry) => {
                        const materialName = (entry.material || entry.product_type)?.name_en || 'Unknown';
                        const existingReport = sessionReports.find((r) => {
                          const params = typeof r.parametersJson === 'string' ? JSON.parse(r.parametersJson) : r.parametersJson;
                          return params?.catalogueEntryId === entry.id;
                        });
                        const allConfirmed = (activeAsset?.processing_records || [])
                          .filter((r) => r.catalogue_entry_id === entry.id)
                          .every((r) => r.status === 'CONFIRMED');

                        return (
                          <div key={entry.id} className="rounded-lg border border-grey-200 p-4 flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-grey-900">{materialName}</p>
                              <p className="text-xs text-grey-500 mt-0.5">{Number(entry.weight_kg).toLocaleString()} kg</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {existingReport ? (
                                <>
                                  <span className="text-xs text-grey-500">{format(new Date(existingReport.generatedAt), 'dd MMM yyyy HH:mm')}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadReport(existingReport.id)}
                                    className="h-8 px-3 rounded-md bg-green-500 text-white text-xs font-semibold hover:bg-green-700 flex items-center gap-1.5"
                                  >
                                    <Download size={12} /> Download PDF
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleGenerateReport(entry.id)}
                                    disabled={generatingEntryId === entry.id}
                                    className="h-8 px-3 rounded-md border border-grey-300 text-xs font-semibold text-grey-700 hover:bg-grey-50 disabled:opacity-50"
                                  >
                                    {generatingEntryId === entry.id ? 'Generating...' : 'Regenerate'}
                                  </button>
                                </>
                              ) : allConfirmed ? (
                                <button
                                  type="button"
                                  onClick={() => handleGenerateReport(entry.id)}
                                  disabled={generatingEntryId === entry.id}
                                  className="h-8 px-3 rounded-md bg-green-500 text-white text-xs font-semibold hover:bg-green-700 disabled:opacity-50 flex items-center gap-1.5"
                                >
                                  {generatingEntryId === entry.id ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                                  Generate Report
                                </button>
                              ) : (
                                <span className="text-xs text-grey-400">Confirm disassembly first</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {assetCatalogueEntries.length === 0 && (
                        <div className="rounded-lg border border-dashed border-grey-300 p-8 text-center text-sm text-grey-400">
                          Add shredding entries first to generate downstream reports.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : null}
            </>
          )}
        </>
      )}

      {assets.length === 0 && (
        <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-8 text-center text-grey-400 text-sm">
          No parcels found on this inbound
        </div>
      )}

      {/* Reopen Modal */}
      {showReopenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(16,24,40,0.72)', backdropFilter: 'blur(3px)' }}>
          <div className="bg-white rounded-xl border border-grey-200 shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-grey-900 mb-4">Reopen Version</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-grey-700 mb-1.5">Reason Code <span className="text-red-500">*</span></label>
                <select
                  value={reopenForm.reason_code}
                  onChange={(e) => setReopenForm((p) => ({ ...p, reason_code: e.target.value }))}
                  className={selectClass}
                  required
                >
                  <option value="">Select reason...</option>
                  <option value="BALANCE_CORRECTION">Balance Correction</option>
                  <option value="CERTIFICATE_FIX">Certificate Fix</option>
                  <option value="DATA_ENTRY_ERROR">Data Entry Error</option>
                  <option value="MATERIAL_RECLASSIFICATION">Material Reclassification</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-grey-700 mb-1.5">Notes</label>
                <textarea
                  value={reopenForm.reason_notes}
                  onChange={(e) => setReopenForm((p) => ({ ...p, reason_notes: e.target.value }))}
                  className={textareaClass}
                  placeholder="Explain why this version needs to be reopened..."
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowReopenModal(false); setReopenForm({ reason_code: '', reason_notes: '' }); }}
                  className="h-9 px-4 bg-white text-grey-700 border border-grey-300 rounded-md text-sm font-semibold hover:bg-grey-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleReopenAsset}
                  disabled={!reopenForm.reason_code || busyAssetId === activeAsset?.id}
                  className="h-9 px-4 bg-orange-500 text-white rounded-md text-sm font-semibold hover:bg-orange-600 disabled:opacity-50"
                >
                  {busyAssetId === activeAsset?.id ? 'Reopening...' : 'Reopen'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoField({ label, value, mono = false, children }) {
  return (
    <div>
      <span className="text-xs font-medium text-grey-500 uppercase tracking-wide">{label}</span>
      {children ? <div className="mt-1">{children}</div> : <p className={`mt-1 text-sm font-medium text-grey-900 ${mono ? 'font-mono' : ''}`}>{value || '—'}</p>}
    </div>
  );
}

function PercentageInput({ label, value, onChange, disabled }) {
  return (
    <div>
      <label className="block text-xs font-medium text-grey-700 mb-1">{label}</label>
      <input
        type="number"
        min="0"
        max="100"
        step="0.01"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass}
        disabled={disabled}
      />
    </div>
  );
}
