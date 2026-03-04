import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import useOrdersStore from '../../store/ordersStore';
import useAuthStore from '../../store/authStore';
import StatusBadge from '../../components/ui/StatusBadge';
import OrderFormModal from '../../components/orders/OrderFormModal';
import { format } from 'date-fns';

const STATUSES = ['', 'PLANNED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

export default function OrdersPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const { orders, totalCount, filters, loading, fetchOrders, setFilters } = useOrdersStore();
  const [showCreate, setShowCreate] = useState(false);
  const [searchInput, setSearchInput] = useState(filters.search);

  const canCreate = ['ADMIN', 'LOGISTICS_PLANNER'].includes(user?.role);
  const totalPages = Math.ceil(totalCount / filters.limit);

  useEffect(() => {
    fetchOrders();
  }, [filters.status, filters.search, filters.page, fetchOrders]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        setFilters({ search: searchInput });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, filters.search, setFilters]);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-h-xs font-bold text-foreground">Orders</h1>
        {canCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:bg-primary-hover transition"
          >
            <Plus size={16} />
            New Order
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-placeholder" />
          <input
            type="text"
            placeholder="Search by order number..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-input text-sm text-foreground placeholder-text-placeholder focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition"
          />
        </div>
        <select
          value={filters.status}
          onChange={(e) => setFilters({ status: e.target.value })}
          className="px-3 py-2 rounded-lg border border-input text-sm text-foreground bg-surface focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition"
        >
          <option value="">All statuses</option>
          {STATUSES.filter(Boolean).map((s) => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted">
                <th className="text-left px-4 py-3 font-medium text-text-secondary">Order #</th>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">Carrier</th>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">Supplier</th>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">Waste Stream</th>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">Planned Date</th>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-text-placeholder">
                    Loading...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-text-placeholder">
                    No orders found
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => navigate(`/orders/${order.id}`)}
                    className="hover:bg-muted cursor-pointer transition"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">{order.order_number}</td>
                    <td className="px-4 py-3 text-text-secondary">{order.carrier?.name}</td>
                    <td className="px-4 py-3 text-text-secondary">{order.supplier?.name}</td>
                    <td className="px-4 py-3 text-text-secondary">{order.waste_stream?.name_en}</td>
                    <td className="px-4 py-3 text-text-secondary">
                      {format(new Date(order.planned_date), 'dd MMM yyyy')}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={order.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-sm text-text-secondary">
              {totalCount} total orders
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilters({ page: Math.max(1, filters.page - 1) })}
                disabled={filters.page <= 1}
                className="p-1.5 rounded-md hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm text-text-secondary">
                Page {filters.page} of {totalPages}
              </span>
              <button
                onClick={() => setFilters({ page: Math.min(totalPages, filters.page + 1) })}
                disabled={filters.page >= totalPages}
                className="p-1.5 rounded-md hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {showCreate && (
        <OrderFormModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false);
            fetchOrders();
          }}
        />
      )}
    </div>
  );
}
