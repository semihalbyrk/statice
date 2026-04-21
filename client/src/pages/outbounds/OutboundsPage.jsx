import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useOutboundsStore } from '../../store/outboundsStore';
import { confirmDeparture, confirmDelivery } from '../../api/outbounds';
import ClickableStatusBadge from '../../components/ui/ClickableStatusBadge';
import { format } from 'date-fns';

const STATUSES = ['', 'CREATED', 'LOADING', 'WEIGHED', 'DOCUMENTS_READY', 'DEPARTED', 'DELIVERED'];

const ALLOWED_TRANSITIONS = {
  CREATED: [],
  LOADING: [],
  WEIGHED: [],
  DOCUMENTS_READY: ['DEPARTED'],
  DEPARTED: ['DELIVERED'],
  DELIVERED: [],
};

export default function OutboundsPage() {
  const { t } = useTranslation(['outbounds', 'common']);
  const navigate = useNavigate();
  const { outbounds, totalCount, filters, loading, fetchOutbounds, setFilters } = useOutboundsStore();
  const [searchInput, setSearchInput] = useState(filters.search);

  const totalPages = Math.ceil(totalCount / filters.limit);

  useEffect(() => {
    fetchOutbounds();
  }, [filters.status, filters.search, filters.page, filters.limit, fetchOutbounds]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        setFilters({ search: searchInput });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, filters.search, setFilters]);

  async function handleStatusTransition(outboundId, newStatus) {
    try {
      if (newStatus === 'DEPARTED') {
        await confirmDeparture(outboundId);
      } else if (newStatus === 'DELIVERED') {
        await confirmDelivery(outboundId);
      }
      toast.success(t('outbounds:toast.statusUpdated'));
      fetchOutbounds();
    } catch (err) {
      toast.error(err.response?.data?.error || t('outbounds:toast.statusFailed'));
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-grey-900">{t('outbounds:title')}</h1>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-grey-400" />
          <input
            type="text"
            placeholder={t('outbounds:searchPlaceholder')}
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
          <option value="">{t('outbounds:allStatuses')}</option>
          {STATUSES.filter(Boolean).map((s) => (
            <option key={s} value={s}>{t(`outbounds:status.${s}`)}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-lg border border-grey-200 shadow-sm overflow-visible">
        <table className="w-full min-w-[1000px] text-sm">
          <thead>
            <tr className="bg-grey-50 border-b border-grey-200">
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">
                <span className="inline-flex items-center gap-1">{t('outbounds:table.outboundNumber')} <ArrowUpDown size={12} className="text-grey-400" /></span>
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">
                <span className="inline-flex items-center gap-1">{t('outbounds:table.status')} <ArrowUpDown size={12} className="text-grey-400" /></span>
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('outbounds:table.orderNumber')}</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('outbounds:table.buyer')}</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('outbounds:table.vehiclePlate')}</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('outbounds:table.netWeight')}</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">
                <span className="inline-flex items-center gap-1">{t('outbounds:table.departedAt')} <ArrowUpDown size={12} className="text-grey-400" /></span>
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-grey-400">
                  {t('common:table.loading')}
                </td>
              </tr>
            ) : outbounds.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-grey-400">
                  {t('outbounds:empty')}
                </td>
              </tr>
            ) : (
              outbounds.map((outbound) => {
                return (
                  <tr
                    key={outbound.id}
                    onClick={() => navigate(`/outbounds/${outbound.id}`)}
                    className="border-b border-grey-100 hover:bg-grey-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-green-700">
                        {outbound.outbound_number || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <ClickableStatusBadge
                        status={outbound.status}
                        allowedTransitions={ALLOWED_TRANSITIONS[outbound.status] || []}
                        onTransition={(newStatus) => handleStatusTransition(outbound.id, newStatus)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/outbound-orders/${outbound.outbound_order_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-sm font-medium text-green-700 hover:underline"
                      >
                        {outbound.outbound_order?.order_number || '—'}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-grey-700">
                      {outbound.outbound_order?.buyer?.company_name || outbound.outbound_order?.buyer?.name || '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-grey-700">
                      {outbound.vehicle_plate || outbound.outbound_order?.vehicle_plate || '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-grey-700">
                      {outbound.net_weight_kg != null
                        ? `${Number(outbound.net_weight_kg).toLocaleString()} kg`
                        : outbound.net_weight != null
                          ? `${Number(outbound.net_weight).toLocaleString()} kg`
                          : '—'}
                    </td>
                    <td className="px-4 py-3 text-grey-700">
                      {outbound.departed_at ? format(new Date(outbound.departed_at), 'dd MMM yyyy HH:mm') : '—'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-grey-200 text-sm text-grey-500">
            <span>{t('outbounds:totalCount', { count: totalCount })}</span>
            <div className="flex items-center gap-3">
              <select
                value={filters.limit}
                onChange={(e) => setFilters({ limit: Number(e.target.value), page: 1 })}
                className="h-8 px-2 text-xs rounded-md border border-grey-300 text-grey-700 focus:border-green-500 outline-none"
              >
                <option value={10}>{t('common:table.perPage', { count: 10 })}</option>
                <option value={20}>{t('common:table.perPage', { count: 20 })}</option>
                <option value={50}>{t('common:table.perPage', { count: 50 })}</option>
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
                  {t('common:table.pageOf', { page: filters.page, total: totalPages })}
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
