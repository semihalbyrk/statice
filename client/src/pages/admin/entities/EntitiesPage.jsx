import { useEffect, useState, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Pencil } from 'lucide-react';
import useEntitiesStore from '../../../store/entitiesStore';
import { toggleEntityStatus } from '../../../api/entities';
import ClickableStatusBadge from '../../../components/ui/ClickableStatusBadge';
import RowActionMenu from '../../../components/ui/RowActionMenu';
import toast from 'react-hot-toast';

const TABS = [
  { key: 'all', role: '' },
  { key: 'suppliers', role: 'supplier' },
  { key: 'transporters', role: 'transporter' },
  { key: 'disposers', role: 'disposer' },
  { key: 'receivers', role: 'receiver' },
];

const SUPPLIER_TYPE_LABELS = {
  PRO: 'PRO',
  COMMERCIAL: 'Commercial',
  AD_HOC: 'Ad-hoc',
};

function RolePills({ entity, t }) {
  const roles = [];
  if (entity.is_supplier) roles.push({ key: 'supplier', color: 'bg-blue-100 text-blue-800' });
  if (entity.is_transporter) roles.push({ key: 'transporter', color: 'bg-teal-100 text-teal-800' });
  if (entity.is_disposer) roles.push({ key: 'disposer', color: 'bg-orange-100 text-orange-800' });
  if (entity.is_receiver) roles.push({ key: 'receiver', color: 'bg-amber-100 text-amber-800' });
  return (
    <div className="flex gap-1 flex-wrap">
      {roles.map(r => (
        <span key={r.key} className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.color}`}>
          {t(`entities:roles.${r.key}`)}
        </span>
      ))}
    </div>
  );
}

export default function EntitiesPage() {
  const { t } = useTranslation(['admin', 'entities', 'common']);
  const [searchParams, setSearchParams] = useSearchParams();
  const { entities, totalCount, filters, loading, setFilters, fetchEntities } = useEntitiesStore();
  const [search, setSearch] = useState('');
  const debounceRef = useRef(null);

  // Sync tab from URL on mount
  const tabParam = searchParams.get('tab') || 'all';
  const activeTab = TABS.find(tab => tab.key === tabParam) || TABS[0];

  // Initialize role filter from URL on mount
  useEffect(() => {
    setFilters({ role: activeTab.role });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setFilters({ search: search || '', page: 1 });
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [search, setFilters]);

  // Fetch when filters change
  useEffect(() => {
    fetchEntities();
  }, [filters, fetchEntities]);

  function handleTabChange(tab) {
    setSearchParams({ tab: tab.key });
    setFilters({ role: tab.role, page: 1 });
  }

  async function handleStatusTransition(entityId, newStatus) {
    try {
      await toggleEntityStatus(entityId);
      toast.success(newStatus === 'ACTIVE' ? t('entities:entityActivated') : t('entities:entityDeactivated'));
      fetchEntities();
    } catch (err) {
      toast.error(err.response?.data?.error || t('entities:failedUpdateStatus'));
    }
  }

  const totalPages = Math.ceil(totalCount / filters.limit);
  const showSupplierType = activeTab.key === 'all' || activeTab.key === 'suppliers';

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-grey-900">{t('entities:title')}</h1>
        <Link to="/admin/entities/new"
          className="flex items-center gap-2 h-9 px-4 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-700 transition-colors">
          <Plus size={16} strokeWidth={2} /> {t('entities:createEntity')}
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-grey-200 mb-4">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab)}
            className={`pb-2 text-sm transition-colors ${
              activeTab.key === tab.key
                ? 'border-b-2 border-green-500 text-green-700 font-medium'
                : 'text-grey-500 hover:text-grey-700'
            }`}
          >
            {t(`entities:tabs.${tab.key}`)}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-xs mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-grey-400" />
        <input
          type="text"
          placeholder={t('entities:searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 pl-9 pr-3 rounded-md border border-grey-300 text-sm text-grey-900 placeholder:text-grey-400 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-grey-200 shadow-sm overflow-visible">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="bg-grey-50 border-b border-grey-200">
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('entities:companyName')}</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('common:table.status')}</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('entities:roles.label')}</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('entities:city')}</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('entities:country')}</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('entities:vihbNumber')}</th>
              {showSupplierType && (
                <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('entities:supplierType')}</th>
              )}
              <th className="w-10 px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={showSupplierType ? 8 : 7} className="px-4 py-8 text-center text-grey-400">{t('common:table.loading')}</td></tr>
            ) : entities.length === 0 ? (
              <tr><td colSpan={showSupplierType ? 8 : 7} className="px-4 py-8 text-center text-grey-400">{t('entities:noEntitiesFound')}</td></tr>
            ) : entities.map((entity) => (
              <tr key={entity.id} className="border-b border-grey-100 hover:bg-grey-50 transition-colors">
                <td className="px-4 py-3">
                  <Link to={`/admin/entities/${entity.id}`} className="font-medium text-green-700 hover:underline">
                    {entity.company_name}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <ClickableStatusBadge
                    status={entity.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE'}
                    allowedTransitions={entity.status === 'ACTIVE' ? ['INACTIVE'] : ['ACTIVE']}
                    onTransition={(newStatus) => handleStatusTransition(entity.id, newStatus)}
                  />
                </td>
                <td className="px-4 py-3">
                  <RolePills entity={entity} t={t} />
                </td>
                <td className="px-4 py-3 text-grey-700">{entity.city || '\u2014'}</td>
                <td className="px-4 py-3 text-grey-700">{entity.country || '\u2014'}</td>
                <td className="px-4 py-3 text-grey-700">{entity.vihb_number || '\u2014'}</td>
                {showSupplierType && (
                  <td className="px-4 py-3 text-grey-700">
                    {entity.is_supplier ? (SUPPLIER_TYPE_LABELS[entity.supplier_type] || '\u2014') : '\u2014'}
                  </td>
                )}
                <td className="px-4 py-3 text-right">
                  <RowActionMenu actions={[
                    {
                      label: t('common:buttons.edit'),
                      icon: Pencil,
                      onClick: () => window.location.href = `/admin/entities/${entity.id}`,
                    },
                    {
                      label: entity.status === 'ACTIVE' ? t('entities:deactivate') : t('entities:activate'),
                      onClick: () => handleStatusTransition(entity.id, entity.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'),
                    },
                  ]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalCount > 0 && (
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-2 text-sm text-grey-600">
            <span>{t('common:table.rowsPerPage')}:</span>
            <select
              value={filters.limit}
              onChange={(e) => setFilters({ limit: Number(e.target.value), page: 1 })}
              className="h-8 px-2 rounded-md border border-grey-300 text-sm bg-white focus:border-green-500 outline-none"
            >
              {[10, 20, 50].map(n => (
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
              {filters.page} / {totalPages}
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
  );
}
