import { useEffect, useState, useCallback, Fragment } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Loader2, Scale, Download, Check, ExternalLink, FileText, Truck, Package, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import {
  getOutbound as getOutboundApi,
  recordWeighing,
  generateBgl,
  confirmDeparture,
  confirmDelivery,
  downloadDocument,
} from '../../api/outbounds';
import {
  listOutboundLines,
  createOutboundLine,
  updateOutboundLine,
  deleteOutboundLine,
} from '../../api/outboundLines';
import useMasterDataStore from '../../store/masterDataStore';
import ClickableStatusBadge from '../../components/ui/ClickableStatusBadge';
import StatusBadge from '../../components/ui/StatusBadge';
import Breadcrumb from '../../components/ui/Breadcrumb';
import RowActionMenu from '../../components/ui/RowActionMenu';
import { format } from 'date-fns';

const inputClass = 'w-full h-10 px-3.5 rounded-md border border-grey-300 text-sm text-grey-900 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors';
const selectClass = `${inputClass} bg-white`;

const MANUAL_TRANSITIONS = {
  DOCUMENTS_READY: ['DEPARTED'],
  DEPARTED: ['DELIVERED'],
};

function formatDateTime(value, pattern = 'dd MMM yyyy HH:mm') {
  return value ? format(new Date(value), pattern) : '—';
}

export default function OutboundDetailPage() {
  const { outboundId } = useParams();
  const { t } = useTranslation(['outbounds', 'common', 'outboundLines', 'nav']);

  const [outbound, setOutbound] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Weighing dialog
  const [weighDialog, setWeighDialog] = useState(null); // null | 'TARE' | 'GROSS'
  const [weighSource, setWeighSource] = useState('SCALE');
  const [weighDevice, setWeighDevice] = useState('WB_1');
  const [weighManualKg, setWeighManualKg] = useState('');
  const [weighNotes, setWeighNotes] = useState('');
  const [isRecordingWeight, setIsRecordingWeight] = useState(false);

  // BGL generation
  const [isGeneratingBgl, setIsGeneratingBgl] = useState(false);

  // Outbound lines
  const [lines, setLines] = useState([]);
  const [editingLineId, setEditingLineId] = useState(null);
  const [isAddingLine, setIsAddingLine] = useState(false);
  const [isMutatingLine, setIsMutatingLine] = useState(false);
  const materialsRaw = useMasterDataStore((state) => state.materials);
  const materials = Array.isArray(materialsRaw) ? materialsRaw : [];

  // Confirmation dialogs
  const [confirmDialog, setConfirmDialog] = useState(null); // null | 'DEPARTURE' | 'DELIVERY'
  const [isConfirming, setIsConfirming] = useState(false);

  const progressSteps = [
    { key: 'CREATED', label: t('progress.created') },
    { key: 'LOADING', label: t('progress.loading') },
    { key: 'WEIGHED', label: t('progress.weighed') },
    { key: 'DOCUMENTS_READY', label: t('progress.documentsReady') },
    { key: 'DEPARTED', label: t('progress.departed') },
    { key: 'DELIVERED', label: t('progress.delivered') },
  ];

  const fetchOutbound = useCallback(async (id) => {
    setIsLoading(true);
    try {
      const { data } = await getOutboundApi(id);
      setOutbound(data.data);
    } catch (err) {
      toast.error(err.response?.data?.error || t('toast.failedToLoad'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchOutbound(outboundId);
  }, [outboundId, fetchOutbound]);

  const fetchLines = useCallback(async (id) => {
    try {
      const { data } = await listOutboundLines(id);
      setLines(data.data || []);
    } catch (err) {
      toast.error(err.response?.data?.error || t('outboundLines:toast.loadFailed'));
    }
  }, [t]);

  useEffect(() => {
    if (outboundId) fetchLines(outboundId);
  }, [outboundId, fetchLines]);

  const handleStatusChange = useCallback(async (newStatus) => {
    if (newStatus === 'DEPARTED') {
      setConfirmDialog('DEPARTURE');
    } else if (newStatus === 'DELIVERED') {
      setConfirmDialog('DELIVERY');
    }
  }, []);

  const handleRecordWeighing = async () => {
    setIsRecordingWeight(true);
    try {
      const payload = {
        weighingType: weighDialog,
        source: weighSource,
        notes: weighNotes || undefined,
        ...(weighSource === 'SCALE' && { deviceId: weighDevice }),
      };
      if (weighSource === 'MANUAL') {
        payload.weightKg = Number(weighManualKg);
      }
      const { data } = await recordWeighing(outboundId, payload);
      setOutbound(data.data);
      toast.success(t('toast.weighingRecorded'));
      closeWeighDialog();
    } catch (err) {
      toast.error(err.response?.data?.error || t('toast.weighingFailed'));
    } finally {
      setIsRecordingWeight(false);
    }
  };

  const handleGenerateBgl = async () => {
    setIsGeneratingBgl(true);
    try {
      const { data } = await generateBgl(outboundId);
      setOutbound(data.data);
      toast.success(t('toast.bglGenerated'));
    } catch (err) {
      toast.error(err.response?.data?.error || t('toast.bglFailed'));
    } finally {
      setIsGeneratingBgl(false);
    }
  };

  const handleConfirmAction = async () => {
    setIsConfirming(true);
    try {
      if (confirmDialog === 'DEPARTURE') {
        const { data } = await confirmDeparture(outboundId);
        setOutbound(data.data);
        toast.success(t('toast.departed'));
      } else if (confirmDialog === 'DELIVERY') {
        const { data } = await confirmDelivery(outboundId);
        setOutbound(data.data);
        toast.success(t('toast.delivered'));
      }
      setConfirmDialog(null);
    } catch (err) {
      const msg = confirmDialog === 'DEPARTURE'
        ? t('toast.departureFailed')
        : t('toast.deliveryFailed');
      toast.error(err.response?.data?.error || msg);
    } finally {
      setIsConfirming(false);
    }
  };

  const handleDownloadDocument = async (docId, fileName) => {
    try {
      const response = await downloadDocument(outboundId, docId);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName || 'begeleidingsbrief.pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error(t('toast.bglFailed'));
    }
  };

  function closeWeighDialog() {
    setWeighDialog(null);
    setWeighSource('SCALE');
    setWeighManualKg('');
    setWeighNotes('');
  }

  const handleStartAdd = () => {
    setEditingLineId(null);
    setIsAddingLine(true);
  };

  const handleStartEdit = (line) => {
    setIsAddingLine(false);
    setEditingLineId(line.id);
  };

  const handleCancelEdit = () => {
    setEditingLineId(null);
    setIsAddingLine(false);
  };

  const handleCreateLine = async (payload) => {
    setIsMutatingLine(true);
    try {
      await createOutboundLine(outboundId, payload);
      toast.success(t('outboundLines:toast.created'));
      setIsAddingLine(false);
      await fetchLines(outboundId);
    } catch (err) {
      toast.error(err.response?.data?.error || t('outboundLines:toast.saveFailed'));
    } finally {
      setIsMutatingLine(false);
    }
  };

  const handleSaveEditLine = async (lineId, payload) => {
    setIsMutatingLine(true);
    try {
      await updateOutboundLine(outboundId, lineId, payload);
      toast.success(t('outboundLines:toast.updated'));
      setEditingLineId(null);
      await fetchLines(outboundId);
    } catch (err) {
      toast.error(err.response?.data?.error || t('outboundLines:toast.saveFailed'));
    } finally {
      setIsMutatingLine(false);
    }
  };

  const handleDeleteLine = async (lineId) => {
    if (!window.confirm(t('outboundLines:confirmDelete'))) return;
    setIsMutatingLine(true);
    try {
      await deleteOutboundLine(outboundId, lineId);
      toast.success(t('outboundLines:toast.deleted'));
      await fetchLines(outboundId);
    } catch (err) {
      toast.error(err.response?.data?.error || t('outboundLines:toast.deleteFailed'));
    } finally {
      setIsMutatingLine(false);
    }
  };

  if (isLoading || !outbound) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-grey-400" size={24} />
      </div>
    );
  }

  const order = outbound.outbound_order;
  const wasteStreams = order?.waste_streams || [];
  const documents = outbound.documents || [];
  const allowedManual = MANUAL_TRANSITIONS[outbound.status] || [];
  const tareWeight = outbound.tare_weight_kg ?? outbound.tare_weight;
  const grossWeight = outbound.gross_weight_kg ?? outbound.gross_weight;
  const netWeightValue = outbound.net_weight_kg ?? outbound.net_weight;
  const hasTare = tareWeight != null;
  const hasGross = grossWeight != null;
  const netWeight = netWeightValue != null
    ? Number(netWeightValue)
    : (hasTare && hasGross ? Number(grossWeight) - Number(tareWeight) : null);
  const bglDoc = documents.find((d) => (d.document_type || d.type) === 'BEGELEIDINGSBRIEF');
  const canMutateLines = ['CREATED', 'LOADING'].includes(outbound.status);

  return (
    <div>
      <Breadcrumb items={[
        { label: t('nav:outboundOrders'), to: '/outbound-orders' },
        { label: order?.order_number || 'Order', to: `/outbound-orders/${order?.id}` },
        { label: outbound.outbound_number || 'Outbound' },
      ]} />

      {/* Title + Status */}
      <div className="flex items-center mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-semibold text-grey-900">{outbound.outbound_number || 'Outbound'}</h1>
          <ClickableStatusBadge
            status={outbound.status}
            allowedTransitions={allowedManual}
            onTransition={handleStatusChange}
          />
        </div>
      </div>

      {/* Progress Bar */}
      <ProgressBar status={outbound.status} steps={progressSteps} />

      {/* Details Card */}
      <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-y-3 gap-x-6">
          <InfoField label={t('detail.order')}>
            <Link
              to={`/outbound-orders/${order?.id}`}
              className="inline-flex items-center gap-1 text-sm font-semibold text-green-600 hover:text-green-700 transition-colors"
            >
              {order?.order_number || '—'}
              <ExternalLink size={12} />
            </Link>
          </InfoField>
          <InfoField label={t('detail.buyer')}>
            <p className="text-sm font-medium text-grey-900 mt-0.5 truncate">{order?.buyer?.company_name || order?.buyer?.name || '—'}</p>
          </InfoField>
          <InfoField label={t('detail.sender')}>
            <p className="text-sm font-medium text-grey-900 mt-0.5 truncate">{order?.sender?.company_name || order?.sender?.name || 'Statice'}</p>
          </InfoField>
          <InfoField label={t('detail.transporter')}>
            <p className="text-sm font-medium text-grey-900 mt-0.5 truncate">{order?.agreement_transporter?.company_name || order?.agreement_transporter?.name || order?.transporter?.company_name || order?.transporter?.name || '—'}</p>
          </InfoField>
          <InfoField label={t('detail.outsourced')}>
            <p className="text-sm font-medium text-grey-900 mt-0.5 truncate">{order?.outsourced_transporter?.company_name || order?.outsourced_transporter?.name || '—'}</p>
          </InfoField>
          <InfoField label={t('detail.vehicle')}>
            <p className="text-sm font-medium text-grey-900 mt-0.5">{outbound.vehicle_plate || order?.vehicle_plate || '—'}</p>
          </InfoField>
          <InfoField label={t('detail.shipment')}>
            {order?.shipment_type ? (
              <StatusBadge status={order.shipment_type} />
            ) : (
              <p className="text-sm text-grey-400 mt-0.5">—</p>
            )}
          </InfoField>
          <InfoField label={t('detail.plannedDate')}>
            <p className="text-sm font-medium text-grey-900 mt-0.5">{formatDateTime(order?.planned_date, 'dd MMM yyyy')}</p>
          </InfoField>
        </div>
      </div>

      {/* Lines Section */}
      <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-4 mb-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-sm font-semibold text-grey-900">{t('outboundLines:title')}</h2>
          {canMutateLines && !isAddingLine && editingLineId === null && (
            <button
              type="button"
              onClick={handleStartAdd}
              className="h-9 px-4 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-700 transition-colors"
            >
              + {t('outboundLines:addLine')}
            </button>
          )}
        </div>

        {lines.length === 0 && !isAddingLine ? (
          <p className="text-sm text-grey-500">{t('outboundLines:empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-grey-200">
                  <th className="text-left py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('outboundLines:fields.material')}</th>
                  <th className="text-left py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('outboundLines:fields.containerType')}</th>
                  <th className="text-right py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('outboundLines:fields.volume')}</th>
                  <th className="text-left py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('outboundLines:fields.uom')}</th>
                  <th className="py-3 w-12"></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  editingLineId === line.id ? (
                    <LineEditRow
                      key={line.id}
                      initial={line}
                      materials={materials}
                      isBusy={isMutatingLine}
                      onCancel={handleCancelEdit}
                      onSave={(payload) => handleSaveEditLine(line.id, payload)}
                      t={t}
                    />
                  ) : (
                    <LineViewRow
                      key={line.id}
                      line={line}
                      canMutate={canMutateLines && editingLineId === null && !isAddingLine}
                      onEdit={() => handleStartEdit(line)}
                      onDelete={() => handleDeleteLine(line.id)}
                      t={t}
                    />
                  )
                ))}
                {isAddingLine && (
                  <LineEditRow
                    initial={null}
                    materials={materials}
                    isBusy={isMutatingLine}
                    onCancel={handleCancelEdit}
                    onSave={handleCreateLine}
                    t={t}
                  />
                )}
              </tbody>
            </table>

            {lines.length > 0 && (
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-grey-200 text-sm text-grey-700">
                <span>{t('common:total')}</span>
                <span>{t('outboundLines:totals', { count: lines.length })}</span>
              </div>
            )}
          </div>
        )}
      </div>


      {/* Weighing + Waste Streams grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Weighing Section */}
        <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-4 self-start">
          <h2 className="text-sm font-semibold text-grey-900 mb-3">{t('weighing.title')}</h2>

          {/* Tare */}
          <div className="mb-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-grey-500 uppercase tracking-wide">{t('weighing.tare')}</span>
              {hasTare ? (
                <span className="text-sm font-semibold text-grey-900">{Number(tareWeight).toLocaleString()} kg</span>
              ) : (
                <span className="text-sm text-grey-400">—</span>
              )}
            </div>
            {!hasTare && !['WEIGHED', 'DOCUMENTS_READY', 'DEPARTED', 'DELIVERED'].includes(outbound.status) && (
              <button
                onClick={() => setWeighDialog('TARE')}
                className="mt-2 h-10 w-full px-4 flex items-center justify-center gap-2 bg-green-500 text-white rounded-md font-semibold text-sm hover:bg-green-700 transition-colors"
              >
                <Scale size={16} />
                {t('weighing.recordTare')}
              </button>
            )}
          </div>

          {/* Gross */}
          <div className="mb-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-grey-500 uppercase tracking-wide">{t('weighing.gross')}</span>
              {hasGross ? (
                <span className="text-sm font-semibold text-grey-900">{Number(grossWeight).toLocaleString()} kg</span>
              ) : (
                <span className="text-sm text-grey-400">—</span>
              )}
            </div>
            {hasTare && !hasGross && !['DOCUMENTS_READY', 'DEPARTED', 'DELIVERED'].includes(outbound.status) && (
              <button
                onClick={() => setWeighDialog('GROSS')}
                className="mt-2 h-10 w-full px-4 flex items-center justify-center gap-2 bg-green-500 text-white rounded-md font-semibold text-sm hover:bg-green-700 transition-colors"
              >
                <Scale size={16} />
                {t('weighing.recordGross')}
              </button>
            )}
          </div>

          {/* Net */}
          <div className="pt-3 border-t border-grey-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-grey-500 uppercase tracking-wide">{t('weighing.net')}</span>
              {netWeight != null ? (
                <span className="text-base font-bold text-green-600">{netWeight.toLocaleString()} kg</span>
              ) : (
                <span className="text-sm text-grey-400">—</span>
              )}
            </div>
          </div>
        </div>

        {/* Waste Streams & Weights */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-grey-200 shadow-sm p-4 self-start">
          <h2 className="text-sm font-semibold text-grey-900 mb-3">{t('detail.wasteStreams')}</h2>

          {wasteStreams.length === 0 ? (
            <p className="text-sm text-grey-400">—</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-grey-200">
                    <th className="text-left py-2 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('detail.stream')}</th>
                    <th className="text-left py-2 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('detail.asn')}</th>
                    <th className="text-right py-2 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('detail.plannedWeight')}</th>
                    <th className="text-right py-2 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('detail.actualWeight')}</th>
                  </tr>
                </thead>
                <tbody>
                  {wasteStreams.map((ws, idx) => (
                    <tr key={idx} className="border-b border-grey-100">
                      <td className="py-2 text-grey-900">{ws.waste_stream?.name || ws.name || '—'}</td>
                      <td className="py-2 text-grey-700 font-mono text-xs">{ws.waste_stream?.asn || ws.asn || '—'}</td>
                      <td className="py-2 text-right text-grey-700">
                        {ws.planned_amount_kg != null ? `${Number(ws.planned_amount_kg).toLocaleString()} kg` : '—'}
                      </td>
                      <td className="py-2 text-right text-grey-700">
                        {ws.actual_weight_kg != null ? `${Number(ws.actual_weight_kg).toLocaleString()} kg` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {netWeight != null && (
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-grey-200">
                  <span className="text-sm font-semibold text-grey-900">{t('detail.netWeight')}</span>
                  <span className="text-base font-bold text-green-600">{netWeight.toLocaleString()} kg</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Documents Section */}
      <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-4 mb-4">
        <h2 className="text-sm font-semibold text-grey-900 mb-3">{t('documents.title')}</h2>

        <table className="w-full text-sm mb-3">
          <thead>
            <tr className="border-b border-grey-200">
              <th className="text-left py-2 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('documents.type')}</th>
              <th className="text-left py-2 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('documents.status')}</th>
              <th className="text-left py-2 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('documents.generatedAt')}</th>
              <th className="text-right py-2 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('documents.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {bglDoc ? (
              <tr className="border-b border-grey-100">
                <td className="py-2 text-grey-900">{t('documents.begeleidingsbrief')}</td>
                <td className="py-2">
                  <DocumentStatusBadge status={bglDoc.status} t={t} />
                </td>
                <td className="py-2 text-grey-700">{formatDateTime(bglDoc.generated_at)}</td>
                <td className="py-2 text-right">
                  {bglDoc.status === 'GENERATED' && (
                    <button
                      onClick={() => handleDownloadDocument(bglDoc.id, `bgl-${outbound.outbound_number}.pdf`)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-700 border border-green-300 rounded-md hover:bg-green-25 transition-colors"
                    >
                      <Download size={12} />
                      {t('documents.download')}
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              <tr className="border-b border-grey-100">
                <td className="py-2 text-grey-900">{t('documents.begeleidingsbrief')}</td>
                <td className="py-2">
                  <DocumentStatusBadge status="PENDING" t={t} />
                </td>
                <td className="py-2 text-grey-400">—</td>
                <td className="py-2 text-right">—</td>
              </tr>
            )}
          </tbody>
        </table>

        <button
          onClick={handleGenerateBgl}
          disabled={outbound.status !== 'WEIGHED' || isGeneratingBgl}
          className="h-10 px-5 flex items-center gap-2 bg-green-500 text-white rounded-md font-semibold text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isGeneratingBgl ? <Loader2 className="animate-spin" size={16} /> : <FileText size={16} />}
          {t('documents.generate')}
        </button>
      </div>

      {/* Actions Bar */}
      <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-4">
        <div className="flex items-center gap-3 flex-wrap">
          {outbound.status === 'DOCUMENTS_READY' && (
            <button
              onClick={() => setConfirmDialog('DEPARTURE')}
              className="h-10 px-5 flex items-center gap-2 bg-green-500 text-white rounded-md font-semibold text-sm hover:bg-green-700 transition-colors"
            >
              <Truck size={16} />
              {t('actions.confirmDeparture')}
            </button>
          )}

          {outbound.status === 'DEPARTED' && (
            <button
              onClick={() => setConfirmDialog('DELIVERY')}
              className="h-10 px-5 flex items-center gap-2 bg-green-500 text-white rounded-md font-semibold text-sm hover:bg-green-700 transition-colors"
            >
              <Package size={16} />
              {t('actions.confirmDelivery')}
            </button>
          )}

          {bglDoc?.status === 'GENERATED' && (
            <button
              onClick={() => handleDownloadDocument(bglDoc.id, `bgl-${outbound.outbound_number}.pdf`)}
              className="h-10 px-5 flex items-center gap-2 border border-grey-300 text-grey-700 rounded-md font-semibold text-sm hover:bg-grey-50 transition-colors"
            >
              <Download size={16} />
              {t('actions.downloadBgl')}
            </button>
          )}

          {!['DOCUMENTS_READY', 'DEPARTED'].includes(outbound.status) && !bglDoc?.status && (
            <p className="text-sm text-grey-400">{t('common:empty')}</p>
          )}
        </div>
      </div>

      {/* Weighing Dialog */}
      {weighDialog && (
        <WeighingDialog
          type={weighDialog}
          source={weighSource}
          setSource={setWeighSource}
          device={weighDevice}
          setDevice={setWeighDevice}
          manualKg={weighManualKg}
          setManualKg={setWeighManualKg}
          notes={weighNotes}
          setNotes={setWeighNotes}
          isRecording={isRecordingWeight}
          onRecord={handleRecordWeighing}
          onClose={closeWeighDialog}
          t={t}
        />
      )}

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <ConfirmDialog
          type={confirmDialog}
          isConfirming={isConfirming}
          onConfirm={handleConfirmAction}
          onClose={() => setConfirmDialog(null)}
          t={t}
        />
      )}
    </div>
  );
}

/* ---- Progress Bar ---- */
function ProgressBar({ status, steps }) {
  const currentIndex = steps.findIndex((s) => s.key === status);

  return (
    <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-4 mb-4">
      <div className="flex items-center gap-2">
        {steps.map((step, i) => (
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
            {i < steps.length - 1 && (
              <div className={`flex-1 h-[2px] ${i < currentIndex ? 'bg-green-500' : 'bg-grey-200'}`} />
            )}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

/* ---- Info Field ---- */
function InfoField({ label, value, children, className = '' }) {
  return (
    <div className={`min-w-0 overflow-hidden ${className}`}>
      <span className="text-xs font-medium text-grey-500 uppercase tracking-wide">{label}</span>
      {children ? <div className="mt-0.5 min-w-0">{children}</div> : <p className="text-sm font-medium text-grey-900 mt-0.5 break-words">{value ?? '—'}</p>}
    </div>
  );
}

/* ---- Document Status Badge ---- */
function DocumentStatusBadge({ status, t }) {
  const config = {
    PENDING: 'bg-grey-50 text-grey-600 border-grey-300',
    GENERATED: 'bg-green-25 text-green-700 border-green-300',
    FAILED: 'bg-red-25 text-red-700 border-red-300',
  };

  return (
    <span className={`inline-flex h-7 w-fit items-center whitespace-nowrap rounded-md border px-2.5 text-[13px] font-medium shadow-[0_1px_0_rgba(16,24,40,0.02)] ${config[status] || config.PENDING}`}>
      {t(`documents.docStatus.${status}`)}
    </span>
  );
}

/* ---- Weighing Dialog ---- */
function WeighingDialog({ type, source, setSource, device, setDevice, manualKg, setManualKg, notes, setNotes, isRecording, onRecord, onClose, t }) {
  const title = type === 'TARE' ? t('weighing.recordTare') : t('weighing.recordGross');
  const canSubmit = source === 'SCALE' || (source === 'MANUAL' && Number(manualKg) > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl border border-grey-200 w-full max-w-md mx-4 p-6">
        <h3 className="text-lg font-semibold text-grey-900 mb-4">{title}</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-grey-700 mb-1">{t('weighing.source')}</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className={selectClass}
            >
              <option value="SCALE">{t('weighing.scale')}</option>
              <option value="MANUAL">{t('weighing.manual')}</option>
            </select>
          </div>

          {source === 'SCALE' && (
            <div>
              <label className="block text-xs font-medium text-grey-700 mb-1">{t('weighing.device', { defaultValue: 'Weighbridge' })}</label>
              <select
                value={device}
                onChange={(e) => setDevice(e.target.value)}
                className={selectClass}
              >
                <option value="WB_1">WB 1</option>
                <option value="WB_2">WB 2</option>
                <option value="WB_3">WB 3</option>
              </select>
            </div>
          )}

          {source === 'MANUAL' && (
            <div>
              <label className="block text-xs font-medium text-grey-700 mb-1">{t('weighing.weight')}</label>
              <input
                type="number"
                min="0"
                step="1"
                value={manualKg}
                onChange={(e) => setManualKg(e.target.value)}
                className={inputClass}
                placeholder="0"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-grey-700 mb-1">{t('weighing.notes')}</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder={t('weighing.notesPlaceholder')}
              className="w-full px-3.5 py-2.5 rounded-md border border-grey-300 text-sm text-grey-900 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="h-10 px-4 border border-grey-300 text-grey-700 rounded-md text-sm font-medium hover:bg-grey-50 transition-colors"
          >
            {t('common:buttons.cancel')}
          </button>
          <button
            onClick={onRecord}
            disabled={!canSubmit || isRecording}
            className="h-10 px-5 flex items-center gap-2 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {isRecording ? <Loader2 className="animate-spin" size={16} /> : <Scale size={16} />}
            {t('weighing.record')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---- Confirm Dialog ---- */
function ConfirmDialog({ type, isConfirming, onConfirm, onClose, t }) {
  const message = type === 'DEPARTURE'
    ? t('actions.departureConfirmation')
    : t('actions.deliveryConfirmation');
  const label = type === 'DEPARTURE'
    ? t('actions.confirmDeparture')
    : t('actions.confirmDelivery');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl border border-grey-200 w-full max-w-sm mx-4 p-6">
        <h3 className="text-lg font-semibold text-grey-900 mb-2">{t('common:confirm.areYouSure')}</h3>
        <p className="text-sm text-grey-600 mb-6">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="h-10 px-4 border border-grey-300 text-grey-700 rounded-md text-sm font-medium hover:bg-grey-50 transition-colors"
          >
            {t('common:buttons.cancel')}
          </button>
          <button
            onClick={onConfirm}
            disabled={isConfirming}
            className="h-10 px-5 flex items-center gap-2 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {isConfirming && <Loader2 className="animate-spin" size={16} />}
            {label}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---- Line View Row ---- */
function LineViewRow({ line, canMutate, onEdit, onDelete, t }) {
  const actions = [];
  if (canMutate) {
    actions.push({ label: t('outboundLines:actions.edit'), icon: Pencil, onClick: onEdit });
    actions.push({ label: t('outboundLines:actions.delete'), icon: Trash2, onClick: onDelete, variant: 'danger' });
  }
  return (
    <tr className="border-b border-grey-100">
      <td className="py-3 text-grey-900 font-medium">{line.material?.name || '—'}</td>
      <td className="py-3 text-grey-700">
        {line.container_type
          ? t(`outboundLines:containerTypes.${line.container_type}`, { defaultValue: line.container_type })
          : '—'}
      </td>
      <td className="py-3 text-right text-grey-700">
        {line.volume != null ? Number(line.volume).toLocaleString() : '—'}
      </td>
      <td className="py-3 text-grey-700">
        {line.volume_uom
          ? t(`outboundLines:uoms.${line.volume_uom}`, { defaultValue: line.volume_uom })
          : '—'}
      </td>
      <td className="py-3 text-right">
        {canMutate ? <RowActionMenu actions={actions} /> : null}
      </td>
    </tr>
  );
}

/* ---- Line Edit Row (also used for Add) ---- */
function LineEditRow({ initial, materials, isBusy, onCancel, onSave, t }) {
  const [draft, setDraft] = useState({
    material_id: initial?.material_id || '',
    container_type: initial?.container_type || 'OPEN_TOP',
    volume: initial?.volume != null ? String(initial.volume) : '',
    volume_uom: initial?.volume_uom || 'M3',
  });

  const activeMaterials = (materials || []).filter((m) => m?.is_active !== false);

  const canSubmit =
    !!draft.material_id &&
    !!draft.container_type &&
    !!draft.volume_uom &&
    Number(draft.volume) > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSave({
      material_id: draft.material_id,
      container_type: draft.container_type,
      volume: Number(draft.volume),
      volume_uom: draft.volume_uom,
    });
  };

  return (
    <tr className="border-b border-grey-100 bg-grey-25">
      <td className="py-3 pr-3 align-top">
        <select
          value={draft.material_id}
          onChange={(e) => setDraft({ ...draft, material_id: e.target.value })}
          className={selectClass}
          aria-label={t('outboundLines:fields.material')}
        >
          <option value="">—</option>
          {activeMaterials.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </td>
      <td className="py-3 pr-3 align-top">
        <select
          value={draft.container_type}
          onChange={(e) => setDraft({ ...draft, container_type: e.target.value })}
          className={selectClass}
          aria-label={t('outboundLines:fields.containerType')}
        >
          <option value="OPEN_TOP">{t('outboundLines:containerTypes.OPEN_TOP')}</option>
          <option value="CLOSED_TOP">{t('outboundLines:containerTypes.CLOSED_TOP')}</option>
          <option value="GITTERBOX">{t('outboundLines:containerTypes.GITTERBOX')}</option>
          <option value="PALLET">{t('outboundLines:containerTypes.PALLET')}</option>
          <option value="OTHER">{t('outboundLines:containerTypes.OTHER')}</option>
        </select>
      </td>
      <td className="py-3 pr-3 align-top">
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={draft.volume}
          onChange={(e) => setDraft({ ...draft, volume: e.target.value })}
          className={inputClass}
          aria-label={t('outboundLines:fields.volume')}
        />
      </td>
      <td className="py-3 pr-3 align-top">
        <select
          value={draft.volume_uom}
          onChange={(e) => setDraft({ ...draft, volume_uom: e.target.value })}
          className={selectClass}
          aria-label={t('outboundLines:fields.uom')}
        >
          <option value="M3">{t('outboundLines:uoms.M3')}</option>
          <option value="L">{t('outboundLines:uoms.L')}</option>
        </select>
      </td>
      <td className="py-3 align-top">
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isBusy}
            className="h-9 px-3 border border-grey-300 text-grey-700 rounded-md text-sm font-medium hover:bg-grey-50 disabled:opacity-50 transition-colors"
          >
            {t('outboundLines:cancel')}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || isBusy}
            className="h-9 px-4 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {isBusy && <Loader2 className="animate-spin" size={14} />}
            {t('outboundLines:save')}
          </button>
        </div>
      </td>
    </tr>
  );
}
