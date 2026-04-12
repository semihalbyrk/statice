import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, CalendarDays, AlertTriangle, Truck as TruckIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { format, addDays, subDays, isToday } from 'date-fns';
import { getPlanningBoard } from '../../api/orders';
import useMasterDataStore from '../../store/masterDataStore';
import StatusBadge from '../../components/ui/StatusBadge';
import SupplierTypeBadge from '../../components/ui/SupplierTypeBadge';

const BOARD_STATUSES = ['', 'PLANNED', 'ARRIVED', 'IN_PROGRESS', 'DISPUTE', 'COMPLETED'];
const SUPPLIER_TYPES = ['', 'PRO', 'THIRD_PARTY', 'PRIVATE_INDIVIDUAL'];

function formatTimeWindow(order) {
  if (order.planned_time_window_start && order.planned_time_window_end) {
    return `${format(new Date(order.planned_time_window_start), 'HH:mm')} - ${format(new Date(order.planned_time_window_end), 'HH:mm')}`;
  }
  if (order.planned_time_window_start) {
    return format(new Date(order.planned_time_window_start), 'HH:mm');
  }
  if (order.planned_time_window_end) {
    return `until ${format(new Date(order.planned_time_window_end), 'HH:mm')}`;
  }
  return null;
}

function groupByTimeWindow(orders, noTimeWindowLabel) {
  const groups = {};
  for (const order of orders) {
    const key = formatTimeWindow(order) || noTimeWindowLabel;
    if (!groups[key]) groups[key] = [];
    groups[key].push(order);
  }
  return groups;
}

export default function PlanningBoardPage() {
  const navigate = useNavigate();
  const { t } = useTranslation(['orders', 'common']);
  const { carriers, suppliers, wasteStreams, loadAll } = useMasterDataStore();
  const transporterEntities = useMasterDataStore((s) => s.getTransporterEntities());
  const transporterOptions = transporterEntities.length > 0 ? transporterEntities : carriers.map(c => ({ id: c.id, company_name: c.name }));

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [carrierId, setCarrierId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [supplierType, setSupplierType] = useState('');
  const [wasteStreamId, setWasteStreamId] = useState('');
  const [status, setStatus] = useState('');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (carriers.length === 0 || suppliers.length === 0 || wasteStreams.length === 0) {
      loadAll();
    }
  }, [carriers.length, suppliers.length, wasteStreams.length, loadAll]);

  const fetchBoard = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        date: format(selectedDate, 'yyyy-MM-dd'),
      };
      if (carrierId) params.carrier_id = carrierId;
      if (supplierId) params.supplier_id = supplierId;
      if (supplierType) params.supplier_type = supplierType;
      if (wasteStreamId) params.waste_stream_id = wasteStreamId;
      if (status) params.status = status;

      const { data } = await getPlanningBoard(params);
      setOrders(data);
    } catch (err) {
      toast.error(err.response?.data?.error || t('orders:toast.boardFailed'));
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, carrierId, supplierId, supplierType, wasteStreamId, status, t]);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-grey-900">{t('orders:planningBoard.title')}</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedDate((d) => subDays(d, 1))}
            className="p-2 rounded-md hover:bg-grey-100 transition-colors"
          >
            <ChevronLeft size={18} className="text-grey-600" />
          </button>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-white border border-grey-300 text-sm font-medium text-grey-900">
            <CalendarDays size={16} className="text-grey-500" />
            {format(selectedDate, 'EEEE, dd MMM yyyy')}
          </div>
          <button
            onClick={() => setSelectedDate((d) => addDays(d, 1))}
            className="p-2 rounded-md hover:bg-grey-100 transition-colors"
          >
            <ChevronRight size={18} className="text-grey-600" />
          </button>
          {!isToday(selectedDate) && (
            <button
              onClick={() => setSelectedDate(new Date())}
              className="h-9 px-4 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-700 transition-colors"
            >
              {t('orders:planningBoard.todayBtn')}
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select
          value={carrierId}
          onChange={(e) => setCarrierId(e.target.value)}
          className="app-list-filter-select"
        >
          <option value="">{t('orders:allTransporters')}</option>
          {transporterOptions.map((c) => (
            <option key={c.id} value={c.id}>{c.company_name}</option>
          ))}
        </select>
        <select
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
          className="app-list-filter-select"
        >
          <option value="">{t('orders:allSuppliers')}</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select
          value={supplierType}
          onChange={(e) => setSupplierType(e.target.value)}
          className="app-list-filter-select"
        >
          <option value="">{t('orders:allSupplierTypes')}</option>
          {SUPPLIER_TYPES.filter(Boolean).map((st) => (
            <option key={st} value={st}>{st.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <select
          value={wasteStreamId}
          onChange={(e) => setWasteStreamId(e.target.value)}
          className="app-list-filter-select"
        >
          <option value="">{t('orders:allWasteStreams')}</option>
          {wasteStreams.map((ws) => (
            <option key={ws.id} value={ws.id}>{ws.name}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="app-list-filter-select"
        >
          <option value="">{t('orders:allStatuses')}</option>
          {BOARD_STATUSES.filter(Boolean).map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      {/* Board Content */}
      {loading ? (
        <div className="bg-white rounded-lg border border-grey-200 shadow-sm px-4 py-8 text-center text-grey-400">
          {t('common:table.loading')}
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-lg border border-grey-200 shadow-sm px-4 py-12 text-center">
          <CalendarDays size={40} className="mx-auto mb-3 text-grey-300" />
          <p className="text-sm text-grey-400">{t('orders:planningBoard.empty.noDeliveries')}</p>
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {orders.map((order) => {
              const wasteStreamLabel = order.waste_streams?.length > 0
                ? order.waste_streams.map((ows) => ows.waste_stream?.name).filter(Boolean).join(', ')
                : order.waste_stream?.name;
              const timeWindow = formatTimeWindow(order);

              return (
                <div
                  key={order.id}
                  onClick={() => navigate(`/orders/${order.id}`)}
                  className="bg-white rounded-lg border border-grey-200 shadow-sm p-5 cursor-pointer hover:border-green-400 hover:shadow-md transition-all"
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-green-500 font-semibold text-sm hover:underline">
                      {order.order_number}
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      {order.is_lzv && (
                        <span className="inline-flex h-6 items-center px-2 rounded-md bg-purple-25 text-purple-700 border border-purple-300 text-[11px] font-semibold uppercase">
                          LZV
                        </span>
                      )}
                      {order.incident_category && (
                        <span className="inline-flex h-6 items-center gap-1 px-2 rounded-md bg-red-25 text-red-700 border border-red-300 text-[11px] font-semibold">
                          <AlertTriangle size={12} />
                          {t('orders:planningBoard.card.incident')}
                        </span>
                      )}
                      <StatusBadge status={order.status} />
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="space-y-3 text-sm">
                    {timeWindow && (
                      <div className="flex items-center justify-between gap-3 min-w-0">
                        <span className="text-grey-500 flex-shrink-0">{t('orders:planningBoard.card.timeWindow')}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-25 text-blue-700 border border-blue-200 font-medium truncate" title={timeWindow}>
                          {timeWindow}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-3 min-w-0">
                      <span className="text-grey-500 flex-shrink-0">{t('orders:planningBoard.card.transporter')}</span>
                      <span className="text-grey-900 font-medium text-right truncate" title={order.transporter?.company_name || order.carrier?.name || '—'}>{order.transporter?.company_name || order.carrier?.name || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 min-w-0">
                      <span className="text-grey-500 flex-shrink-0">{t('orders:planningBoard.card.supplier')}</span>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-grey-900 font-medium truncate" title={order.supplier?.name || '—'}>{order.supplier?.name || '—'}</span>
                        <SupplierTypeBadge type={order.supplier?.supplier_type} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 min-w-0">
                      <span className="text-grey-500 flex-shrink-0">{t('orders:planningBoard.card.wasteStream')}</span>
                      <span className="text-grey-900 font-medium text-right truncate" title={wasteStreamLabel || '—'}>{wasteStreamLabel || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 min-w-0">
                      <span className="text-grey-500 flex-shrink-0">{t('orders:planningBoard.card.expectedParcels')}</span>
                      <span className="text-grey-900 font-medium text-right truncate">{order.expected_skip_count ?? '—'}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 min-w-0">
                      <span className="text-grey-500 flex-shrink-0">{t('orders:planningBoard.card.completedInbounds')}</span>
                      <span className="text-grey-900 font-medium text-right truncate">
                        {order.inbound_count} / {order.expected_skip_count ?? '?'}
                      </span>
                    </div>
                    {order.total_net_weight_kg > 0 && (
                      <div className="flex items-center justify-between gap-3 min-w-0">
                        <span className="text-grey-500 flex-shrink-0">{t('orders:planningBoard.card.totalNetWeight')}</span>
                        <span className="text-grey-900 font-medium text-right truncate">
                          {Number(order.total_net_weight_kg).toLocaleString('nl-NL', { maximumFractionDigits: 0 })} kg
                        </span>
                      </div>
                    )}
                    {order.vehicle_plate && (
                      <div className="flex items-center justify-between gap-3 min-w-0">
                        <span className="text-grey-500 flex-shrink-0">{t('orders:planningBoard.card.vehiclePlate')}</span>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <TruckIcon size={14} className="text-grey-400 flex-shrink-0" />
                          <span className="font-mono text-grey-900 truncate" title={order.vehicle_plate}>{order.vehicle_plate}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary footer */}
          <div className="text-xs text-grey-400 text-right pt-4">
            {orders.length !== 1
              ? t('orders:planningBoard.summaryPlural', { count: orders.length, date: format(selectedDate, 'dd MMM yyyy') })
              : t('orders:planningBoard.summary', { count: orders.length, date: format(selectedDate, 'dd MMM yyyy') })}
          </div>
        </div>
      )}
    </div>
  );
}
