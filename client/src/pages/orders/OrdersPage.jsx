import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, ArrowUpDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import useOrdersStore from '../../store/ordersStore';
import useOutboundOrdersStore from '../../store/outboundOrdersStore';
import useAuthStore from '../../store/authStore';
import ClickableStatusBadge from '../../components/ui/ClickableStatusBadge';
import SupplierTypeBadge from '../../components/ui/SupplierTypeBadge';
import { updateOrder } from '../../api/orders';
import { updateOutboundOrderStatus } from '../../api/outboundOrders';
import { format } from 'date-fns';

const INBOUND_STATUSES = ['', 'PLANNED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'DISPUTE', 'INVOICED', 'CANCELLED'];
const INBOUND_TRANSITIONS = {
  PLANNED: ['ARRIVED', 'CANCELLED'],
  ARRIVED: ['IN_PROGRESS', 'DISPUTE', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'DISPUTE', 'CANCELLED'],
  DISPUTE: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  COMPLETED: ['INVOICED'],
  INVOICED: [],
  CANCELLED: ['PLANNED'],
};

const OUTBOUND_STATUSES = ['', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'INVOICED', 'CANCELLED'];
const OUTBOUND_TRANSITIONS = {
  PLANNED: ['CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  INVOICED: [],
  CANCELLED: [],
};
const SHIPMENT_LABELS = { DOMESTIC_NL: 'Domestic NL', EU_CROSS_BORDER: 'EU Cross-Border' };
const SHIPMENT_COLORS = {
  DOMESTIC_NL: 'bg-blue-50 text-blue-700 border-blue-200',
  EU_CROSS_BORDER: 'bg-purple-50 text-purple-700 border-purple-200',
};

export default function OrdersPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation(['orders', 'outboundOrders', 'common']);
  const user = useAuthStore((state) => state.user);
  const canCreate = ['ADMIN', 'LOGISTICS_PLANNER'].includes(user?.role);

  const initialTab = searchParams.get('tab') === 'outbound' ? 'outbound' : 'inbound';
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    const current = searchParams.get('tab');
    if (activeTab === 'outbound' && current !== 'outbound') {
      setSearchParams({ tab: 'outbound' }, { replace: true });
    } else if (activeTab === 'inbound' && current) {
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const TABS = [
    { key: 'inbound', label: t('orders:tabs.inboundOrders') },
    { key: 'outbound', label: t('orders:tabs.outboundOrders') },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-grey-900">{t('orders:title')}</h1>
        {canCreate && (
          <button
            onClick={() => navigate(`/orders/new?type=${activeTab === 'outbound' ? 'OUTGOING' : 'INCOMING'}`)}
            className="flex items-center gap-2 h-9 px-4 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-700 transition-colors"
          >
            <Plus size={16} strokeWidth={2} />
            {t('orders:createOrder')}
          </button>
        )}
      </div>

      <div className="flex items-center gap-1 mb-4 border-b border-grey-200">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'text-green-500 border-green-500'
                : 'text-grey-500 border-transparent hover:text-grey-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'inbound' ? <InboundOrdersList canCreate={canCreate} /> : <OutboundOrdersList canCreate={canCreate} />}
    </div>
  );
}

function InboundOrdersList({ canCreate }) {
  const navigate = useNavigate();
  const { t } = useTranslation(['orders', 'common']);
  const { orders, totalCount, filters, loading, fetchOrders, setFilters } = useOrdersStore();
  const [searchInput, setSearchInput] = useState(filters.search);
  const totalPages = Math.ceil(totalCount / filters.limit);

  useEffect(() => {
    fetchOrders();
  }, [filters.status, filters.search, filters.page, filters.limit, filters.date_from, filters.date_to, fetchOrders]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        setFilters({ search: searchInput });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, filters.search, setFilters]);

  async function handleStatusTransition(orderId, newStatus) {
    try {
      await updateOrder(orderId, { status: newStatus });
      toast.success(t('orders:toast.statusUpdated', { status: newStatus.replace(/_/g, ' ') }));
      fetchOrders();
    } catch (err) {
      toast.error(err.response?.data?.error || t('orders:toast.statusFailed'));
    }
  }

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-grey-400" />
          <input
            type="text"
            placeholder={t('orders:searchPlaceholder')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full h-10 pl-9 pr-3 rounded-md border border-grey-300 text-sm text-grey-900 placeholder:text-grey-400 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors"
          />
        </div>
        <select
          value={filters.status}
          onChange={(e) => setFilters({ status: e.target.value })}
          className="app-list-filter-select"
        >
          <option value="">{t('orders:allStatuses')}</option>
          {INBOUND_STATUSES.filter(Boolean).map((s) => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-lg border border-grey-200 shadow-sm overflow-visible">
        <table className="w-full min-w-[1000px] text-sm">
          <thead>
            <tr className="bg-grey-50 border-b border-grey-200">
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide"><span className="inline-flex items-center gap-1">{t('orders:table.orderName')} <ArrowUpDown size={12} className="text-grey-400" /></span></th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide"><span className="inline-flex items-center gap-1">{t('orders:table.status')} <ArrowUpDown size={12} className="text-grey-400" /></span></th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('orders:table.vehiclePlate')}</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('orders:table.carrier')}</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('orders:table.supplier')}</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('orders:table.wasteStream')}</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide"><span className="inline-flex items-center gap-1">{t('orders:table.plannedDate')} <ArrowUpDown size={12} className="text-grey-400" /></span></th>
              <th className="text-right px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('orders:table.parcels')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-grey-400">
                  {t('common:table.loading')}
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-grey-400">
                  {t('orders:empty.noOrders')}
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr
                  key={order.id}
                  onClick={() => navigate(`/orders/${order.id}`)}
                  className="border-b border-grey-100 hover:bg-grey-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className="text-green-500 font-medium hover:underline">{order.order_number}</span>
                  </td>
                  <td className="px-4 py-3">
                    <ClickableStatusBadge
                      status={order.status}
                      allowedTransitions={canCreate ? (INBOUND_TRANSITIONS[order.status] || []) : []}
                      onTransition={(newStatus) => handleStatusTransition(order.id, newStatus)}
                    />
                  </td>
                  <td className="px-4 py-3 font-mono text-grey-700">{order.vehicle_plate || '\u2014'}</td>
                  <td className="px-4 py-3 text-grey-700">{order.carrier?.name}</td>
                  <td className="px-4 py-3 text-grey-700">
                    <div className="flex items-center gap-1.5">
                      <span>{order.supplier?.name || '\u2014'}</span>
                      <SupplierTypeBadge type={order.supplier?.supplier_type} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-grey-700">
                    {order.waste_streams?.length > 0
                      ? order.waste_streams.map((ows) => ows.waste_stream?.name).filter(Boolean).join(', ') || order.waste_stream?.name
                      : order.waste_stream?.name}
                  </td>
                  <td className="px-4 py-3 text-grey-700">
                    {format(new Date(order.planned_date), 'dd MMM yyyy')}
                  </td>
                  <td className="px-4 py-3 text-right text-grey-700">{order.expected_skip_count ?? '\u2014'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {totalCount > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-grey-200">
            <div className="flex items-center gap-2 text-sm text-grey-600">
              <span>{t('common:table.rowsPerPage')}:</span>
              <select
                value={filters.limit}
                onChange={(e) => setFilters({ limit: Number(e.target.value), page: 1 })}
                className="h-8 px-2 rounded-md border border-grey-300 text-sm bg-white focus:border-green-500 outline-none"
              >
                {[10, 20, 50].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <span className="ml-2">
                {t('common:table.showingRange', {
                  from: (filters.page - 1) * filters.limit + 1,
                  to: Math.min(filters.page * filters.limit, totalCount),
                  total: totalCount,
                })}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                disabled={filters.page <= 1}
                onClick={() => setFilters({ page: filters.page - 1 })}
                className="h-8 px-3 rounded-md border border-grey-300 text-sm text-grey-700 hover:bg-grey-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {t('common:table.previous')}
              </button>
              <span className="px-3 text-sm text-grey-600">
                {filters.page} / {totalPages || 1}
              </span>
              <button
                disabled={filters.page >= totalPages}
                onClick={() => setFilters({ page: filters.page + 1 })}
                className="h-8 px-3 rounded-md border border-grey-300 text-sm text-grey-700 hover:bg-grey-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {t('common:table.next')}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function OutboundOrdersList({ canCreate }) {
  const navigate = useNavigate();
  const { t } = useTranslation(['outboundOrders', 'common']);
  const { outboundOrders, totalCount, filters, loading, fetchOutboundOrders, setFilters } = useOutboundOrdersStore();
  const [searchInput, setSearchInput] = useState(filters.search);
  const totalPages = Math.ceil(totalCount / filters.limit);

  useEffect(() => {
    fetchOutboundOrders();
  }, [filters.status, filters.search, filters.page, filters.limit, fetchOutboundOrders]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        setFilters({ search: searchInput });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, filters.search, setFilters]);

  async function handleStatusTransition(orderId, newStatus) {
    try {
      await updateOutboundOrderStatus(orderId, newStatus);
      toast.success(t('outboundOrders:toast.statusUpdated', { status: newStatus.replace(/_/g, ' ') }));
      fetchOutboundOrders();
    } catch (err) {
      toast.error(err.response?.data?.error || t('outboundOrders:toast.statusFailed'));
    }
  }

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-grey-400" />
          <input
            type="text"
            placeholder={t('outboundOrders:searchPlaceholder')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full h-10 pl-9 pr-3 rounded-md border border-grey-300 text-sm text-grey-900 placeholder:text-grey-400 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors"
          />
        </div>
        <select
          value={filters.status}
          onChange={(e) => setFilters({ status: e.target.value })}
          className="app-list-filter-select"
        >
          <option value="">{t('outboundOrders:allStatuses')}</option>
          {OUTBOUND_STATUSES.filter(Boolean).map((s) => (
            <option key={s} value={s}>{t(`outboundOrders:status.${s}`)}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-lg border border-grey-200 shadow-sm overflow-visible">
        <table className="w-full min-w-[1000px] text-sm">
          <thead>
            <tr className="bg-grey-50 border-b border-grey-200">
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">
                <span className="inline-flex items-center gap-1">{t('outboundOrders:fields.orderNumber')} <ArrowUpDown size={12} className="text-grey-400" /></span>
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">
                <span className="inline-flex items-center gap-1">{t('outboundOrders:fields.status')} <ArrowUpDown size={12} className="text-grey-400" /></span>
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('outboundOrders:fields.buyer')}</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('outboundOrders:fields.shipmentType')}</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('outboundOrders:fields.agreementTransporter')}</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">
                <span className="inline-flex items-center gap-1">{t('outboundOrders:fields.plannedDate')} <ArrowUpDown size={12} className="text-grey-400" /></span>
              </th>
              <th className="text-right px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('outboundOrders:fields.expectedOutbounds')}</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('outboundOrders:fields.outbounds')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-grey-400">
                  {t('common:table.loading')}
                </td>
              </tr>
            ) : outboundOrders.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-grey-400">
                  {t('outboundOrders:empty')}
                </td>
              </tr>
            ) : (
              outboundOrders.map((order) => (
                <tr
                  key={order.id}
                  onClick={() => navigate(`/outbound-orders/${order.id}`)}
                  className="border-b border-grey-100 hover:bg-grey-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className="font-medium text-green-700 hover:underline">{order.order_number}</span>
                  </td>
                  <td className="px-4 py-3">
                    <ClickableStatusBadge
                      status={order.status}
                      allowedTransitions={canCreate ? (OUTBOUND_TRANSITIONS[order.status] || []) : []}
                      onTransition={(newStatus) => handleStatusTransition(order.id, newStatus)}
                    />
                  </td>
                  <td className="px-4 py-3 text-grey-700">{order.buyer?.company_name || '\u2014'}</td>
                  <td className="px-4 py-3">
                    {order.shipment_type ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${SHIPMENT_COLORS[order.shipment_type] || 'bg-grey-50 text-grey-700 border-grey-200'}`}>
                        {SHIPMENT_LABELS[order.shipment_type] || order.shipment_type}
                      </span>
                    ) : '\u2014'}
                  </td>
                  <td className="px-4 py-3 text-grey-700">{order.agreement_transporter?.company_name || '\u2014'}</td>
                  <td className="px-4 py-3 text-grey-700">
                    {order.planned_date ? format(new Date(order.planned_date), 'dd MMM yyyy') : '\u2014'}
                  </td>
                  <td className="px-4 py-3 text-right text-grey-700">{order.expected_outbound_count ?? '\u2014'}</td>
                  <td className="px-4 py-3 text-right text-grey-700">
                    {order.outbounds ? `${order.outbounds.length}/${order.expected_outbound_count || 0}` : '\u2014'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {totalCount > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-grey-200">
            <div className="flex items-center gap-2 text-sm text-grey-600">
              <span>{t('common:table.rowsPerPage')}:</span>
              <select
                value={filters.limit}
                onChange={(e) => setFilters({ limit: Number(e.target.value), page: 1 })}
                className="h-8 px-2 rounded-md border border-grey-300 text-sm bg-white focus:border-green-500 outline-none"
              >
                {[10, 20, 50].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <span className="ml-2">
                {t('common:table.showingRange', {
                  from: (filters.page - 1) * filters.limit + 1,
                  to: Math.min(filters.page * filters.limit, totalCount),
                  total: totalCount,
                })}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                disabled={filters.page <= 1}
                onClick={() => setFilters({ page: filters.page - 1 })}
                className="h-8 px-3 rounded-md border border-grey-300 text-sm text-grey-700 hover:bg-grey-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {t('common:table.previous')}
              </button>
              <span className="px-3 text-sm text-grey-600">
                {filters.page} / {totalPages || 1}
              </span>
              <button
                disabled={filters.page >= totalPages}
                onClick={() => setFilters({ page: filters.page + 1 })}
                className="h-8 px-3 rounded-md border border-grey-300 text-sm text-grey-700 hover:bg-grey-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {t('common:table.next')}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
