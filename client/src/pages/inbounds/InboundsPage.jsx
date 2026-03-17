import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { useInboundsListStore } from '../../store/weighingStore';
import { updateInboundStatus } from '../../api/weighingEvents';
import ClickableStatusBadge from '../../components/ui/ClickableStatusBadge';
import SupplierTypeBadge from '../../components/ui/SupplierTypeBadge';
import { format } from 'date-fns';

const STATUSES = ['', 'ARRIVED', 'WEIGHED_IN', 'WEIGHED_OUT', 'READY_FOR_SORTING', 'SORTED'];

const INBOUND_TRANSITIONS = {
  ARRIVED: [],
  WEIGHED_IN: [],
  WEIGHED_OUT: ['READY_FOR_SORTING'],
  READY_FOR_SORTING: [],
  SORTED: [],
};

export default function InboundsPage() {
  const navigate = useNavigate();
  const { inbounds, totalCount, filters, loading, fetchInbounds, setFilters } = useInboundsListStore();
  const [searchInput, setSearchInput] = useState(filters.search);

  const totalPages = Math.ceil(totalCount / filters.limit);

  useEffect(() => {
    fetchInbounds();
  }, [filters.status, filters.search, filters.page, filters.limit, fetchInbounds]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        setFilters({ search: searchInput });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, filters.search, setFilters]);

  async function handleStatusTransition(inboundId, newStatus) {
    try {
      await updateInboundStatus(inboundId, newStatus);
      toast.success('Inbound status updated');
      fetchInbounds();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update status');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-grey-900">Inbounds</h1>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-grey-400" />
          <input
            type="text"
            placeholder="Search by inbound name"
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
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-lg border border-grey-200 shadow-sm overflow-x-auto">
        <table className="w-full min-w-[1180px] text-sm">
          <thead>
            <tr className="bg-grey-50 border-b border-grey-200">
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide"><span className="inline-flex items-center gap-1">Inbound Name <ArrowUpDown size={12} className="text-grey-400" /></span></th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide"><span className="inline-flex items-center gap-1">Status <ArrowUpDown size={12} className="text-grey-400" /></span></th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Linked Order</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Vehicle Plate</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Carrier</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Supplier</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Waste Stream</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide"><span className="inline-flex items-center gap-1">Arrived At <ArrowUpDown size={12} className="text-grey-400" /></span></th>
              <th className="text-right px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Parcels</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Total Net Weight</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-grey-400">
                  Loading...
                </td>
              </tr>
            ) : inbounds.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-grey-400">
                  No inbounds found
                </td>
              </tr>
            ) : (
              inbounds.map((inbound) => (
                <tr
                  key={inbound.id}
                  onClick={() => navigate(`/inbounds/${inbound.id}`)}
                  className="border-b border-grey-100 hover:bg-grey-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-2.5">
                    <span className="text-sm font-medium text-green-600">
                      {inbound.inbound_number || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <ClickableStatusBadge
                      status={inbound.status}
                      allowedTransitions={INBOUND_TRANSITIONS[inbound.status] || []}
                      onTransition={(newStatus) => handleStatusTransition(inbound.id, newStatus)}
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-sm font-medium text-green-600">
                      {inbound.order?.order_number || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-grey-700">
                    {inbound.vehicle?.registration_plate}
                  </td>
                  <td className="px-4 py-2.5 text-grey-700">{inbound.order?.carrier?.name}</td>
                  <td className="px-4 py-2.5 text-grey-700">
                    <div className="flex items-center gap-1.5">
                      <span>{inbound.order?.supplier?.name || '—'}</span>
                      <SupplierTypeBadge type={inbound.order?.supplier?.supplier_type} />
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-grey-700">{inbound.order?.waste_stream?.name_en}</td>
                  <td className="px-4 py-2.5 text-grey-700">
                    {inbound.arrived_at ? format(new Date(inbound.arrived_at), 'dd MMM yyyy HH:mm') : '-'}
                  </td>
                  <td className="px-4 py-2.5 text-right text-grey-700">
                    {inbound.skip_count ?? '-'}
                  </td>
                  <td className="px-4 py-2.5 text-right text-grey-700">
                    {inbound.net_weight != null ? `${Number(inbound.net_weight).toLocaleString()} kg` : '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-grey-200 text-sm text-grey-500">
            <span>{totalCount} total inbounds</span>
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
