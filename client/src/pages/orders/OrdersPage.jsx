import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';
import toast from 'react-hot-toast';
import useOrdersStore from '../../store/ordersStore';
import useAuthStore from '../../store/authStore';
import ClickableStatusBadge from '../../components/ui/ClickableStatusBadge';
import SupplierTypeBadge from '../../components/ui/SupplierTypeBadge';
import { updateOrder } from '../../api/orders';
import { format } from 'date-fns';

const STATUSES = ['', 'PLANNED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'DISPUTE', 'INVOICED', 'CANCELLED'];
const TABS = [
  { key: 'all', label: 'All Orders' },
  { key: 'today', label: 'Today' },
];
const ORDER_TRANSITIONS = {
  PLANNED: ['ARRIVED', 'CANCELLED'],
  ARRIVED: ['IN_PROGRESS', 'DISPUTE', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'DISPUTE', 'CANCELLED'],
  DISPUTE: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  COMPLETED: ['INVOICED'],
  INVOICED: [],
  CANCELLED: ['PLANNED'],
};

export default function OrdersPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const { orders, totalCount, filters, loading, fetchOrders, setFilters } = useOrdersStore();
  const [searchInput, setSearchInput] = useState(filters.search);
  const [activeTab, setActiveTab] = useState('all');

  const canCreate = ['ADMIN', 'LOGISTICS_PLANNER'].includes(user?.role);
  const totalPages = Math.ceil(totalCount / filters.limit);

  function handleTabChange(tab) {
    setActiveTab(tab);
    if (tab === 'today') {
      const today = new Date().toISOString().split('T')[0];
      setFilters({ date_from: today, date_to: today, page: 1 });
    } else {
      setFilters({ date_from: '', date_to: '', page: 1 });
    }
  }

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
      toast.success(`Order status updated to ${newStatus.replace(/_/g, ' ')}`);
      fetchOrders();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update order status');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-grey-900">Orders</h1>
        {canCreate && (
          <button
            onClick={() => navigate('/orders/new')}
            className="flex items-center gap-2 h-9 px-4 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-700 transition-colors"
          >
            <Plus size={16} strokeWidth={2} />
            New Order
          </button>
        )}
      </div>

      <div className="flex items-center gap-1 mb-4 border-b border-grey-200">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
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

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-grey-400" />
          <input
            type="text"
            placeholder="Search by order name..."
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
          <option value="">All statuses</option>
          {STATUSES.filter(Boolean).map((s) => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-lg border border-grey-200 shadow-sm overflow-x-auto">
        <table className="w-full min-w-[1000px] text-sm">
          <thead>
            <tr className="bg-grey-50 border-b border-grey-200">
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide"><span className="inline-flex items-center gap-1">Order # <ArrowUpDown size={12} className="text-grey-400" /></span></th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide"><span className="inline-flex items-center gap-1">Status <ArrowUpDown size={12} className="text-grey-400" /></span></th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Vehicle Plate</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Carrier</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Supplier</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Waste Stream</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide"><span className="inline-flex items-center gap-1">Planned Date <ArrowUpDown size={12} className="text-grey-400" /></span></th>
              <th className="text-right px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Parcels</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-grey-400">
                  Loading...
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-grey-400">
                  No orders found
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
                      allowedTransitions={canCreate ? (ORDER_TRANSITIONS[order.status] || []) : []}
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

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-grey-200 text-sm text-grey-500">
            <span>{totalCount} total orders</span>
            <div className="flex items-center gap-3">
              <select
                value={filters.limit}
                onChange={(e) => setFilters({ limit: Number(e.target.value), page: 1 })}
                className="h-8 px-2 text-xs rounded-md border border-grey-300 text-grey-700 focus:border-green-500 outline-none"
              >
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
              </select>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFilters({ page: Math.max(1, filters.page - 1) })}
                  disabled={filters.page <= 1}
                  className="p-1.5 rounded-md hover:bg-grey-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <span>
                  Page {filters.page} of {totalPages}
                </span>
                <button
                  onClick={() => setFilters({ page: Math.min(totalPages, filters.page + 1) })}
                  disabled={filters.page >= totalPages}
                  className="p-1.5 rounded-md hover:bg-grey-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
