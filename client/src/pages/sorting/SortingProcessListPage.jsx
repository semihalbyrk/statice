import { useState, useEffect } from 'react';
import { Search, ArrowUpDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import useSortingListStore from '../../store/sortingListStore';
import StatusBadge from '../../components/ui/StatusBadge';
import { format } from 'date-fns';
import { getSortingName } from '../../utils/entityNames';
import SupplierTypeBadge from '../../components/ui/SupplierTypeBadge';

const STATUSES = ['', 'PLANNED', 'SORTED'];

export default function SortingProcessListPage() {
  const { t } = useTranslation(['sorting', 'common']);
  const { sessions, totalCount, filters, loading, fetchSessions, setFilters } = useSortingListStore();
  const [searchInput, setSearchInput] = useState(filters.search);

  const totalPages = Math.ceil(totalCount / filters.limit);

  useEffect(() => {
    fetchSessions();
  }, [filters.status, filters.search, filters.page, filters.limit, fetchSessions]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        setFilters({ search: searchInput });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, filters.search, setFilters]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-grey-900">{t('sorting:title')}</h1>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-grey-400" />
          <input
            type="text"
            placeholder={t('sorting:searchPlaceholder')}
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
          <option value="">{t('sorting:allStatuses')}</option>
          {STATUSES.filter(Boolean).map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-lg border border-grey-200 shadow-sm overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="bg-grey-50 border-b border-grey-200">
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide min-w-[180px]"><span className="inline-flex items-center gap-1">{t('sorting:table.processName')} <ArrowUpDown size={12} className="text-grey-400" /></span></th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide"><span className="inline-flex items-center gap-1">{t('sorting:table.status')} <ArrowUpDown size={12} className="text-grey-400" /></span></th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide min-w-[150px]">{t('sorting:table.linkedOrder')}</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('sorting:table.supplier')}</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide min-w-[160px]">{t('sorting:table.carrier')}</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide min-w-[120px]">{t('sorting:table.plate')}</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide min-w-[200px]">{t('sorting:table.wasteStream')}</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide min-w-[140px]"><span className="inline-flex items-center gap-1">{t('sorting:table.date')} <ArrowUpDown size={12} className="text-grey-400" /></span></th>
              <th className="text-right px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('sorting:table.parcels')}</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide min-w-[130px]">{t('sorting:table.netWeight')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-grey-400">
                  {t('common:table.loading')}
                </td>
              </tr>
            ) : sessions.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-grey-400">
                  {t('sorting:empty')}
                </td>
              </tr>
            ) : (
              sessions.map((session) => {
                const inbound = session.inbound;
                const order = inbound?.order;
                const assets = inbound?.assets || [];
                const totalNet = assets.reduce((sum, a) => sum + (Number(a.net_weight_kg) || 0), 0);
                const containerTypes = [...new Set(assets.map((a) => {
                  if (a.parcel_type === 'MATERIAL') return t('sorting:material');
                  return a.container_type ? t(`common:containerTypes.${a.container_type}`, { defaultValue: a.container_type }) : '—';
                }))].join(', ');
                const wasteStreams = [...new Set(assets.map((a) => a.waste_stream?.name).filter(Boolean))].join(', ');

                return (
                  <tr key={session.id} className="border-b border-grey-100 hover:bg-grey-50 transition-colors">
                    <td className="px-4 py-2.5">
                      <Link
                        to={`/sorting/${session.id}`}
                        className="text-sm font-medium text-green-600 hover:underline"
                      >
                        {getSortingName(session)}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={session.status} />
                    </td>
                    <td className="px-4 py-2.5 text-sm text-grey-700">{order?.order_number || '—'}</td>
                    <td className="px-4 py-2.5 text-grey-700">
                      <div className="flex items-center gap-1.5">
                        {order?.supplier?.name || '—'}
                        <SupplierTypeBadge type={order?.supplier?.supplier_type} />
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-grey-700">{order?.carrier?.name || '—'}</td>
                    <td className="px-4 py-2.5 font-mono text-grey-700">{inbound?.vehicle?.registration_plate || '—'}</td>
                    <td className="px-4 py-2.5 text-grey-700">{wasteStreams || order?.waste_stream?.name || '—'}</td>
                    <td className="px-4 py-2.5 text-grey-700">
                      {session.recorded_at ? format(new Date(session.recorded_at), 'dd MMM yyyy') : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right text-grey-700">{assets.length}</td>
                    <td className="px-4 py-2.5 text-right text-grey-700">
                      {totalNet > 0 ? `${totalNet.toLocaleString()} kg` : '—'}
                    </td>
                  </tr>
                );
              })
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
