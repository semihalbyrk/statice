import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowUpDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation(['inbounds', 'common']);
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
      toast.success(t('inbounds:toast.statusUpdated'));
      fetchInbounds();
    } catch (err) {
      toast.error(err.response?.data?.error || t('inbounds:toast.statusUpdateFailed'));
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-grey-900">{t('inbounds:title')}</h1>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-grey-400" />
          <input
            type="text"
            placeholder={t('inbounds:searchPlaceholder')}
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
          <option value="">{t('inbounds:allStatuses')}</option>
          {STATUSES.filter(Boolean).map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-lg border border-grey-200 shadow-sm overflow-visible">
        <table className="w-full min-w-[1000px] text-sm">
          <thead>
            <tr className="bg-grey-50 border-b border-grey-200">
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide"><span className="inline-flex items-center gap-1">{t('inbounds:table.inboundName')} <ArrowUpDown size={12} className="text-grey-400" /></span></th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide"><span className="inline-flex items-center gap-1">{t('inbounds:table.status')} <ArrowUpDown size={12} className="text-grey-400" /></span></th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('inbounds:table.linkedOrder')}</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('inbounds:table.vehiclePlate')}</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('inbounds:table.carrier')}</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('inbounds:table.supplier')}</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('inbounds:table.wasteStream')}</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide"><span className="inline-flex items-center gap-1">{t('inbounds:table.arrivedAt')} <ArrowUpDown size={12} className="text-grey-400" /></span></th>
              <th className="text-right px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('inbounds:table.parcels')}</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('inbounds:table.totalNetWeight')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-grey-400">
                  {t('common:table.loading')}
                </td>
              </tr>
            ) : inbounds.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-grey-400">
                  {t('inbounds:empty')}
                </td>
              </tr>
            ) : (
              inbounds.map((inbound) => (
                <tr
                  key={inbound.id}
                  onClick={() => navigate(`/inbounds/${inbound.id}`)}
                  className="border-b border-grey-100 hover:bg-grey-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-green-600">
                      {inbound.inbound_number || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <ClickableStatusBadge
                      status={inbound.status}
                      allowedTransitions={INBOUND_TRANSITIONS[inbound.status] || []}
                      onTransition={(newStatus) => handleStatusTransition(inbound.id, newStatus)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-green-600">
                      {inbound.order?.order_number || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-grey-700">
                    {inbound.vehicle?.registration_plate}
                  </td>
                  <td className="px-4 py-3 text-grey-700">{inbound.order?.carrier?.name}</td>
                  <td className="px-4 py-3 text-grey-700">
                    <div className="flex items-center gap-1.5">
                      <span>{inbound.order?.supplier?.name || '—'}</span>
                      <SupplierTypeBadge type={inbound.order?.supplier?.supplier_type} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-grey-700">{inbound.order?.waste_stream?.name}</td>
                  <td className="px-4 py-3 text-grey-700">
                    {inbound.arrived_at ? format(new Date(inbound.arrived_at), 'dd MMM yyyy HH:mm') : '-'}
                  </td>
                  <td className="px-4 py-3 text-right text-grey-700">
                    {inbound.skip_count ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-right text-grey-700">
                    {inbound.net_weight != null ? `${Number(inbound.net_weight).toLocaleString()} kg` : '-'}
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
    </div>
  );
}
