import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Loader2, ExternalLink, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import useOutboundOrdersStore from '../../store/outboundOrdersStore';
import useAuthStore from '../../store/authStore';
import ClickableStatusBadge from '../../components/ui/ClickableStatusBadge';
import StatusBadge from '../../components/ui/StatusBadge';
import Breadcrumb from '../../components/ui/Breadcrumb';
import { updateOutboundOrderStatus, cancelOutboundOrder } from '../../api/outboundOrders';
import api from '../../api/axios';
import { format } from 'date-fns';

const ALLOWED_TRANSITIONS = {
  PLANNED: ['CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  INVOICED: [],
  CANCELLED: [],
};

const SHIPMENT_COLORS = {
  DOMESTIC_NL: 'bg-blue-50 text-blue-700 border-blue-200',
  EU_CROSS_BORDER: 'bg-purple-50 text-purple-700 border-purple-200',
};
const SHIPMENT_LABELS = { DOMESTIC_NL: 'Domestic NL', EU_CROSS_BORDER: 'EU Cross-Border' };

export default function OutboundOrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation(['outboundOrders', 'common']);
  const user = useAuthStore((state) => state.user);
  const { currentOrder: order, loading, fetchOutboundOrder } = useOutboundOrdersStore();
  const [transitioning, setTransitioning] = useState(false);
  const [creatingOutbound, setCreatingOutbound] = useState(false);

  const canEdit = ['ADMIN', 'LOGISTICS_PLANNER'].includes(user?.role);

  useEffect(() => {
    fetchOutboundOrder(id);
  }, [id, fetchOutboundOrder]);

  async function handleStatusTransition(newStatus) {
    setTransitioning(true);
    try {
      await updateOutboundOrderStatus(id, newStatus);
      toast.success(t('outboundOrders:toast.statusUpdated', { status: newStatus.replace(/_/g, ' ') }));
      fetchOutboundOrder(id);
    } catch (err) {
      toast.error(err.response?.data?.error || t('outboundOrders:toast.statusFailed'));
    } finally {
      setTransitioning(false);
    }
  }

  async function handleCancel() {
    if (!window.confirm('Are you sure you want to cancel this outbound order?')) return;
    try {
      await cancelOutboundOrder(id);
      toast.success(t('outboundOrders:toast.cancelled'));
      fetchOutboundOrder(id);
    } catch (err) {
      toast.error(err.response?.data?.error || t('outboundOrders:toast.statusFailed'));
    }
  }

  async function handleCreateOutbound() {
    setCreatingOutbound(true);
    try {
      const { data } = await api.post(`/outbounds/order/${id}`);
      const outbound = data.data || data;
      toast.success(t('outboundOrders:toast.outboundCreated'));
      navigate(`/outbounds/${outbound.id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || t('outboundOrders:toast.outboundCreateFailed'));
    } finally {
      setCreatingOutbound(false);
    }
  }

  if (loading || !order) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-grey-400" size={24} />
      </div>
    );
  }

  const allowedTransitions = ALLOWED_TRANSITIONS[order.status] || [];
  const outboundCount = order.outbounds?.length || 0;
  const expectedOutbounds = order.expected_outbound_count || order.expected_outbounds || 0;
  const canCreateOutbound = ['PLANNED', 'IN_PROGRESS'].includes(order.status) && outboundCount < expectedOutbounds;

  return (
    <div>
      <Breadcrumb items={[{ label: t('outboundOrders:title'), to: '/outbound-orders' }, { label: order.order_number }]} />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-grey-900">{order.order_number}</h1>
          <ClickableStatusBadge
            status={order.status}
            allowedTransitions={allowedTransitions}
            onTransition={handleStatusTransition}
            disabled={!canEdit || transitioning}
          />
        </div>
        <div className="flex items-center gap-2">
          {canEdit && canCreateOutbound && (
            <button
              onClick={handleCreateOutbound}
              disabled={creatingOutbound}
              className="flex items-center gap-2 h-9 px-4 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              <Plus size={16} strokeWidth={2} />
              {t('outboundOrders:buttons.createOutbound')}
            </button>
          )}
          {canEdit && order.status === 'PLANNED' && (
            <>
              <button
                onClick={() => navigate(`/outbound-orders/${id}/edit`)}
                className="h-9 px-4 bg-white text-grey-700 border border-grey-300 rounded-md text-sm font-semibold hover:bg-grey-50 transition-colors"
              >
                {t('outboundOrders:buttons.edit')}
              </button>
              <button
                onClick={handleCancel}
                className="h-9 px-4 bg-white text-red-600 border border-red-200 rounded-md text-sm font-semibold hover:bg-red-50 transition-colors"
              >
                {t('outboundOrders:buttons.cancel')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Info Grid */}
      <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-8">
          <InfoField label={t('outboundOrders:fields.contract')}>
            {order.contract ? (
              <Link to={`/contracts/${order.contract.id}`} className="text-sm font-medium text-green-700 hover:underline">
                {order.contract.contract_number}
              </Link>
            ) : '\u2014'}
          </InfoField>
          <InfoField label={t('outboundOrders:fields.buyer')} value={order.buyer?.company_name} />
          <InfoField label={t('outboundOrders:fields.sender')} value={order.sender?.company_name} />
          <InfoField label={t('outboundOrders:fields.disposer')} value={order.disposer?.company_name} />
          <InfoField label={t('outboundOrders:fields.disposerSite')} value={order.disposer_site?.company_name || order.disposer_site?.name} />
          <InfoField label={t('outboundOrders:fields.agreementTransporter')} value={order.agreement_transporter?.company_name || order.transporter?.company_name} />
          <InfoField label={t('outboundOrders:fields.outsourcedTransporter')} value={order.outsourced_transporter?.company_name} />
          <InfoField label={t('outboundOrders:fields.vehiclePlate')}>
            <span className="font-mono break-all">{order.vehicle_plate || '\u2014'}</span>
          </InfoField>
          <InfoField label={t('outboundOrders:fields.plannedDate')}>
            {order.planned_date ? format(new Date(order.planned_date), 'dd MMMM yyyy') : '\u2014'}
          </InfoField>
          <InfoField label={t('outboundOrders:fields.shipmentType')}>
            {order.shipment_type ? (
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${SHIPMENT_COLORS[order.shipment_type] || 'bg-grey-50 text-grey-700 border-grey-200'}`}>
                {SHIPMENT_LABELS[order.shipment_type] || order.shipment_type}
              </span>
            ) : '\u2014'}
          </InfoField>
          <InfoField label={t('outboundOrders:fields.expectedOutbounds')} value={expectedOutbounds} />
          {order.notes && (
            <div className="min-w-0 sm:col-span-2">
              <span className="text-xs font-medium text-grey-500 uppercase tracking-wide">{t('outboundOrders:fields.notes')}</span>
              <p className="mt-0.5 break-words text-sm text-grey-700">{order.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Waste Streams Table */}
      {order.waste_streams?.length > 0 && (
        <div className="bg-white rounded-lg border border-grey-200 shadow-sm overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-grey-200">
            <h2 className="text-base font-semibold text-grey-900">{t('outboundOrders:sections.wasteStreams')}</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-grey-50 border-b border-grey-200">
                <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('outboundOrders:fields.wasteStream')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('outboundOrders:fields.receiver')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('outboundOrders:fields.asn')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('outboundOrders:fields.material')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('outboundOrders:fields.processingMethod')}</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('outboundOrders:fields.plannedAmount')}</th>
              </tr>
            </thead>
            <tbody>
              {order.waste_streams.map((ws) => (
                <tr key={ws.id} className="border-b border-grey-100">
                  <td className="px-4 py-3 font-medium text-grey-900">{ws.waste_stream?.name || '\u2014'}</td>
                  <td className="px-4 py-3 text-grey-700">{ws.receiver?.company_name || '\u2014'}</td>
                  <td className="px-4 py-3 text-grey-700">{ws.afvalstroomnummer || ws.asn || '\u2014'}</td>
                  <td className="px-4 py-3 text-grey-700">{ws.rate_lines?.[0]?.material?.name || ws.material?.name || '\u2014'}</td>
                  <td className="px-4 py-3 text-grey-700">{ws.rate_lines?.[0]?.processing_method || ws.processing_method || '\u2014'}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-grey-700">
                    {ws.planned_amount_kg ? `${Number(ws.planned_amount_kg).toLocaleString()} kg` : '\u2014'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Outbounds Section */}
      <div className="bg-white rounded-lg border border-grey-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-grey-200">
          <div>
            <h2 className="text-base font-semibold text-grey-900">{t('outboundOrders:sections.outbounds')}</h2>
            <p className="text-sm text-grey-500 mt-1">{t('outboundOrders:outboundsDescription')}</p>
          </div>
          {canEdit && canCreateOutbound && (
            <button
              onClick={handleCreateOutbound}
              disabled={creatingOutbound}
              className="flex items-center gap-2 h-9 px-4 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              <Plus size={16} strokeWidth={2} />
              {t('outboundOrders:buttons.createOutbound')}
            </button>
          )}
        </div>

        <div className="p-5">
          {order.outbounds?.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-grey-50 border-b border-grey-200">
                  <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Outbound #</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('outboundOrders:fields.status')}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('outboundOrders:fields.vehiclePlate')}</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Parcels</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('outboundOrders:fields.netWeight')}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('outboundOrders:fields.documents')}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('outboundOrders:fields.departedAt')}</th>
                </tr>
              </thead>
              <tbody>
                {order.outbounds.map((outbound) => (
                  <tr
                    key={outbound.id}
                    onClick={() => navigate(`/outbounds/${outbound.id}`)}
                    className="border-b border-grey-100 hover:bg-grey-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-green-700 hover:underline">{outbound.outbound_number || '\u2014'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={outbound.status} />
                    </td>
                    <td className="px-4 py-3 font-mono text-grey-700">{outbound.vehicle_plate || '\u2014'}</td>
                    <td className="px-4 py-3 text-right text-grey-700">{outbound._count?.parcels ?? outbound.parcels_count ?? 0}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-grey-700">
                      {outbound.net_weight_kg ? `${Number(outbound.net_weight_kg).toLocaleString()} kg` : '\u2014'}
                    </td>
                    <td className="px-4 py-3">
                      {(outbound._count?.documents ?? outbound.documents_count ?? 0) > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                          {outbound._count?.documents ?? outbound.documents_count ?? 0}
                        </span>
                      ) : '\u2014'}
                    </td>
                    <td className="px-4 py-3 text-grey-700">
                      {outbound.departed_at ? format(new Date(outbound.departed_at), 'dd MMM yyyy HH:mm') : '\u2014'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-grey-400">No outbounds yet</p>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoField({ label, value, children }) {
  return (
    <div className="min-w-0">
      <span className="text-xs font-medium text-grey-500 uppercase tracking-wide">{label}</span>
      <p className="mt-0.5 break-words text-sm font-medium text-grey-900">
        {children || value || '\u2014'}
      </p>
    </div>
  );
}
