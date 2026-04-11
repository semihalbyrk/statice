import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ExternalLink, Loader2, MoreVertical, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import useOrdersStore from '../../store/ordersStore';
import useAuthStore from '../../store/authStore';
import ClickableStatusBadge from '../../components/ui/ClickableStatusBadge';
import SupplierTypeBadge from '../../components/ui/SupplierTypeBadge';
import OrderFormModal from '../../components/orders/OrderFormModal';
import { updateOrder, setOrderIncident } from '../../api/orders';
import { format } from 'date-fns';
import Breadcrumb from '../../components/ui/Breadcrumb';

const SKIP_TYPE_LABELS = {
  OPEN_TOP: 'Open Top',
  CLOSED_TOP: 'Closed Top',
  GITTERBOX: 'Gitterbox',
  PALLET: 'Pallet',
  OTHER: 'Other',
};

const ORDER_TRANSITIONS = {
  PLANNED: ['ARRIVED', 'CANCELLED'],
  ARRIVED: ['IN_PROGRESS', 'DISPUTE', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'DISPUTE', 'CANCELLED'],
  DISPUTE: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  COMPLETED: ['INVOICED'],
  INVOICED: [],
  CANCELLED: ['PLANNED'],
};

const ACTION_LABELS = {
  CANCELLED: 'Cancel',
};

function formatInboundTimestamp(timestamp) {
  return timestamp ? format(new Date(timestamp), 'dd MMM yyyy HH:mm') : '—';
}

export default function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation(['orders', 'common']);
  const user = useAuthStore((state) => state.user);
  const { currentOrder: order, loading, fetchOrder } = useOrdersStore();
  const [showEdit, setShowEdit] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [incidentCategory, setIncidentCategory] = useState('');
  const [incidentNotes, setIncidentNotes] = useState('');

  const canEdit = ['ADMIN', 'LOGISTICS_PLANNER'].includes(user?.role);
  const allowedTransitions = ORDER_TRANSITIONS[order?.status] || [];

  useEffect(() => {
    fetchOrder(id);
  }, [id, fetchOrder]);

  async function handleTransition(newStatus) {
    setTransitioning(true);
    try {
      await updateOrder(id, { status: newStatus });
      toast.success(`Order ${ACTION_LABELS[newStatus]?.toLowerCase() || 'updated'}`);
      fetchOrder(id);
    } catch (err) {
      toast.error(err.response?.data?.error || t('orders:toast.statusUpdateFailed'));
    } finally {
      setTransitioning(false);
    }
  }

  async function handleIncident() {
    try {
      await setOrderIncident(order.id, { incident_category: incidentCategory, incident_notes: incidentNotes });
      toast.success(t('orders:toast.incidentReported'));
      setIncidentCategory('');
      setIncidentNotes('');
      fetchOrder(id);
    } catch (err) {
      toast.error(err.response?.data?.error || t('orders:toast.incidentFailed'));
    }
  }

  if (loading || !order) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-grey-400" size={24} />
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb items={[{ label: t('orders:title'), to: '/orders' }, { label: order.order_number }]} />

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-grey-900">{order.order_number}</h1>
          <ClickableStatusBadge
            status={order.status}
            allowedTransitions={allowedTransitions}
            onTransition={handleTransition}
            disabled={!canEdit || transitioning}
          />
          {order.is_adhoc && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border bg-orange-50 text-orange-700 border-orange-300">
              {t('orders:detail.adHoc')}
            </span>
          )}
        </div>
        {canEdit && order.status === 'PLANNED' && (
          <div className="relative">
            <button
              onClick={() => setShowActions((v) => !v)}
              className="h-9 px-3 bg-white text-grey-700 border border-grey-300 rounded-md text-sm font-semibold hover:bg-grey-50 transition-colors inline-flex items-center gap-1.5"
            >
              {t('orders:detail.actions')} <MoreVertical size={14} />
            </button>
            {showActions && (
              <div className="absolute right-0 top-full mt-1 z-10 bg-white border border-grey-200 rounded-md shadow-md py-1 min-w-[140px]">
                <button
                  onClick={() => { setShowActions(false); setShowEdit(true); }}
                  className="w-full text-left px-3 py-2 text-sm text-grey-700 hover:bg-grey-50 flex items-center gap-2"
                >
                  <Pencil size={14} /> {t('orders:detail.editOrder')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-8">
          <div className="min-w-0">
            <span className="text-xs font-medium text-grey-500 uppercase tracking-wide">{t('orders:detail.fields.carrier')}</span>
            <p className="mt-0.5 break-words text-sm font-medium text-grey-900">{order.carrier?.name}</p>
          </div>
          <div className="min-w-0">
            <span className="text-xs font-medium text-grey-500 uppercase tracking-wide">{t('orders:detail.fields.supplier')}</span>
            <div className="mt-0.5 flex items-center gap-1.5">
              <p className="break-words text-sm font-medium text-grey-900">{order.supplier?.name}</p>
              <SupplierTypeBadge type={order.supplier?.supplier_type} />
            </div>
          </div>
          <div className="min-w-0">
            <span className="text-xs font-medium text-grey-500 uppercase tracking-wide">{t('orders:detail.fields.wasteStreams')}</span>
            {order.waste_streams?.length > 0 ? (
              <div className="mt-0.5 space-y-1">
                {order.waste_streams.map((ows) => (
                  <div key={ows.id || ows.waste_stream_id} className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-grey-900">{ows.waste_stream?.name || 'Unknown'}</span>
                    {ows.afvalstroomnummer && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-25 text-green-700 border border-green-300">
                        ASN: {ows.afvalstroomnummer}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-0.5 text-sm font-medium text-grey-900">{order.waste_stream?.name || '\u2014'}</p>
            )}
          </div>
          <div className="min-w-0">
            <span className="text-xs font-medium text-grey-500 uppercase tracking-wide">{t('orders:detail.fields.plannedDate')}</span>
            <p className="text-sm font-medium text-grey-900 mt-0.5">
              {format(new Date(order.planned_date), 'dd MMMM yyyy')}
            </p>
          </div>
          <div className="min-w-0">
            <span className="text-xs font-medium text-grey-500 uppercase tracking-wide">{t('orders:detail.fields.expectedParcels')}</span>
            <p className="text-sm font-medium text-grey-900 mt-0.5">{order.expected_skip_count}</p>
          </div>
          <div className="min-w-0">
            <span className="text-xs font-medium text-grey-500 uppercase tracking-wide">{t('orders:detail.fields.createdBy')}</span>
            <p className="mt-0.5 break-words text-sm font-medium text-grey-900">{order.created_by_user?.full_name}</p>
          </div>
          <div className="min-w-0">
            <span className="text-xs font-medium text-grey-500 uppercase tracking-wide">{t('orders:detail.fields.linkedContract')}</span>
            <div className="mt-0.5">
              {order.linked_contract ? (
                <Link to={`/contracts/${order.linked_contract.id}`} className="text-sm font-medium text-green-700 hover:underline">
                  {order.linked_contract.contract_number}
                </Link>
              ) : (
                <span className="text-sm text-grey-400">—</span>
              )}
            </div>
          </div>
          {order.vehicle_plate && (
            <div className="min-w-0">
              <span className="text-xs font-medium text-grey-500 uppercase tracking-wide">{t('orders:detail.fields.vehiclePlate')}</span>
              <p className="mt-0.5 break-all text-sm font-medium font-mono text-grey-900">{order.vehicle_plate}</p>
            </div>
          )}
          {order.afvalstroomnummer && (
            <div className="min-w-0">
              <span className="text-xs font-medium text-grey-500 uppercase tracking-wide">{t('orders:detail.fields.afvalstroomnummer')}</span>
              <p className="mt-0.5 break-words text-sm font-medium text-grey-900">{order.afvalstroomnummer}</p>
            </div>
          )}
          {order.notes && (
            <div className="min-w-0 sm:col-span-2">
              <span className="text-xs font-medium text-grey-500 uppercase tracking-wide">{t('orders:detail.fields.notes')}</span>
              <p className="mt-0.5 break-words text-sm text-grey-700">{order.notes}</p>
            </div>
          )}
          {order.client_reference && (
            <div className="min-w-0">
              <span className="text-xs font-medium text-grey-500 uppercase tracking-wide">{t('orders:detail.fields.clientReference')}</span>
              <p className="mt-0.5 break-words text-sm font-medium text-grey-900">{order.client_reference}</p>
            </div>
          )}
          {order.adhoc_person_name && (
            <div className="min-w-0">
              <span className="text-xs font-medium text-grey-500 uppercase tracking-wide">{t('orders:detail.fields.contactPerson')}</span>
              <p className="mt-0.5 break-words text-sm font-medium text-grey-900">{order.adhoc_person_name}</p>
            </div>
          )}
          {order.adhoc_id_reference && (
            <div className="min-w-0">
              <span className="text-xs font-medium text-grey-500 uppercase tracking-wide">{t('orders:detail.fields.idReference')}</span>
              <p className="mt-0.5 break-words text-sm font-medium text-grey-900">{order.adhoc_id_reference}</p>
            </div>
          )}
          {order.is_lzv && (
            <div className="min-w-0">
              <span className="text-xs font-medium text-grey-500 uppercase tracking-wide">{t('orders:detail.fields.vehicleType')}</span>
              <p className="mt-0.5 text-sm font-medium text-grey-900">LZV</p>
            </div>
          )}
          {order.incident_category && (
            <div className="min-w-0 sm:col-span-2">
              <span className="text-xs font-medium text-grey-500 uppercase tracking-wide">{t('orders:detail.fields.incident')}</span>
              <p className="mt-0.5 text-sm font-medium text-red-600">{order.incident_category.replace(/_/g, ' ')}</p>
              {order.incident_notes && (
                <p className="mt-0.5 break-words text-sm text-grey-700">{order.incident_notes}</p>
              )}
            </div>
          )}
        </div>

        {/* Incident Section */}
        {!['COMPLETED', 'INVOICED'].includes(order.status) && (
          <div className="mt-4 pt-4 border-t">
            <h4 className="text-sm font-medium text-gray-700 mb-2">{t('orders:detail.incident.title')}</h4>
            <div className="flex gap-2">
              <select
                value={incidentCategory}
                onChange={e => setIncidentCategory(e.target.value)}
                className="h-10 px-3.5 rounded-md border border-grey-300 text-sm text-grey-900 bg-white focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors"
              >
                <option value="">{t('orders:detail.incident.selectType')}</option>
                <option value="DAMAGE">{t('common:incidentTypes.DAMAGE')}</option>
                <option value="DISPUTE">{t('common:incidentTypes.DISPUTE')}</option>
                <option value="SPECIAL_HANDLING">{t('common:incidentTypes.SPECIAL_HANDLING')}</option>
                <option value="DRIVER_INSTRUCTION">{t('common:incidentTypes.DRIVER_INSTRUCTION')}</option>
              </select>
              <input
                type="text"
                placeholder={t('orders:detail.incident.notesPlaceholder')}
                value={incidentNotes}
                onChange={e => setIncidentNotes(e.target.value)}
                className="flex-1 h-10 px-3.5 rounded-md border border-grey-300 text-sm text-grey-900 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors"
              />
              <button
                onClick={handleIncident}
                disabled={!incidentCategory}
                className="h-10 px-4 bg-red-500 text-white rounded-md text-sm font-semibold hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {t('orders:detail.incident.reportBtn')}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-grey-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-grey-200">
          <div>
            <h2 className="text-base font-semibold text-grey-900">{t('orders:detail.inbounds.title')}</h2>
            <p className="text-sm text-grey-500 mt-1">{t('orders:detail.inbounds.description')}</p>
          </div>
        </div>

        <div className="p-5">
          {order.inbounds?.length > 0 ? (
            <div className="space-y-3">
              {order.inbounds.map((inbound) => (
                <div
                  key={inbound.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/inbounds/${inbound.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(`/inbounds/${inbound.id}`);
                    }
                  }}
                  className="w-full rounded-xl border border-grey-200 bg-grey-25 px-4 py-4 text-left hover:border-green-300 hover:bg-white transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-500/20"
                >
                  <div className="min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="min-w-0 break-words text-sm font-medium text-green-600">
                        {inbound.inbound_number || inbound.vehicle?.registration_plate || 'Inbound'}
                      </span>
                      <ClickableStatusBadge
                        status={inbound.status}
                        allowedTransitions={[]}
                        disabled
                      />
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-grey-500">
                        {t('orders:detail.inbounds.openInbound')}
                        <ExternalLink size={12} />
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-x-6 gap-y-3">
                      <InboundMeta label={t('orders:detail.inbounds.vehiclePlate')} value={inbound.vehicle?.registration_plate} mono />
                      <InboundMeta label={t('orders:detail.inbounds.arrivedAt')} value={formatInboundTimestamp(inbound.arrived_at)} />
                      <InboundMeta
                        label={t('orders:detail.inbounds.wasteStream')}
                        value={inbound.waste_stream?.name || order.waste_stream?.name}
                      />
                      <InboundMeta
                        label={t('orders:detail.inbounds.sorting')}
                        value={inbound.sorting_session ? t('orders:detail.inbounds.sortingAvailable') : t('orders:detail.inbounds.notStarted')}
                      />
                    </div>

                    {inbound.assets && inbound.assets.length > 0 && (
                      <div
                        className="mt-2 overflow-x-auto"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                        role="presentation"
                      >
                        <table className="min-w-full text-xs">
                          <thead>
                            <tr className="text-grey-500 text-left border-b border-grey-100">
                              <th className="py-1.5 pr-3">Parcel ID</th>
                              <th className="py-1.5 pr-3">Container ID</th>
                              <th className="py-1.5 pr-3">Type</th>
                              <th className="py-1.5 pr-3 text-right">Cargo Net</th>
                              {inbound.weighing_mode === 'DIRECT' && <th className="py-1.5 pr-3 text-right">Tare</th>}
                              <th className="py-1.5 pr-3 text-right">Material Net</th>
                              <th className="py-1.5 pr-3 text-right">Volume</th>
                              <th className="py-1.5">Notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {inbound.assets.map((asset) => (
                              <tr key={asset.id}>
                                <td className="py-1.5 pr-3 font-medium text-grey-900">{asset.asset_label}</td>
                                <td className="py-1.5 pr-3">{asset.container_label || '—'}</td>
                                <td className="py-1.5 pr-3">{SKIP_TYPE_LABELS[asset.container_type] || '—'}</td>
                                <td className="py-1.5 pr-3 text-right tabular-nums">
                                  {asset.net_weight_kg ? `${Number(asset.net_weight_kg).toLocaleString()} kg` : '—'}
                                </td>
                                {inbound.weighing_mode === 'DIRECT' && (
                                  <td className="py-1.5 pr-3 text-right tabular-nums">
                                    {asset.estimated_tare_weight_kg ? `${Number(asset.estimated_tare_weight_kg).toLocaleString()} kg` : '—'}
                                  </td>
                                )}
                                <td className="py-1.5 pr-3 text-right tabular-nums">
                                  {asset.net_weight_kg ? `${Number(asset.net_weight_kg).toLocaleString()} kg` : '—'}
                                </td>
                                <td className="py-1.5 pr-3 text-right tabular-nums">
                                  {asset.estimated_volume_m3 ? `${Number(asset.estimated_volume_m3)} m³` : '—'}
                                </td>
                                <td className="py-1.5 text-grey-500 max-w-[150px] truncate">{asset.notes || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-grey-400">{t('orders:detail.inbounds.noInbounds')}</p>
          )}
        </div>
      </div>

      {showEdit && (
        <OrderFormModal
          order={order}
          onClose={() => setShowEdit(false)}
          onSuccess={() => {
            setShowEdit(false);
            fetchOrder(id);
          }}
        />
      )}
    </div>
  );
}

function InboundMeta({ label, value, mono = false }) {
  return (
    <div className="min-w-0">
      <span className="text-xs font-medium text-grey-500 uppercase tracking-wide">{label}</span>
      <p className={`mt-1 min-w-0 break-words text-sm text-grey-900 ${mono ? 'font-mono break-all' : 'font-medium'}`}>
        {value || '—'}
      </p>
    </div>
  );
}
