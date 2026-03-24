import React, { useState, useEffect, useCallback } from 'react';
import { Search, ChevronDown, ChevronRight, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { getAuditLogs, getUsers } from '../../api/admin';

const ENTITY_TYPES = ['User', 'InboundOrder', 'Inbound', 'Asset', 'SortingSession', 'SortingLine', 'Carrier', 'Supplier', 'WasteStream', 'ProductCategory', 'Report', 'ReportSchedule', 'SystemSetting'];
const ACTION_TYPES = ['CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'WEIGHT_OVERRIDE', 'PASSWORD_RESET'];
const ACTION_COLORS = {
  CREATE: 'bg-green-50 text-green-700',
  UPDATE: 'bg-blue-50 text-blue-700',
  DELETE: 'bg-red-50 text-red-700',
  STATUS_CHANGE: 'bg-orange-50 text-orange-700',
  WEIGHT_OVERRIDE: 'bg-red-100 text-red-800',
  PASSWORD_RESET: 'bg-purple-50 text-purple-700',
};

const selectClass = 'h-10 px-3 rounded-md border border-grey-300 text-sm text-grey-900 bg-white focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors';

function formatTimestamp(ts) {
  const d = new Date(ts);
  return d.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function DiffView({ diff, t }) {
  if (!diff) return <span className="text-grey-400 text-xs">{t('audit.noChangesRecorded')}</span>;

  const before = diff.before || {};
  const after = diff.after || {};
  const allKeys = [...new Set([...Object.keys(before), ...Object.keys(after)])];

  if (allKeys.length === 0) return <span className="text-grey-400 text-xs">{t('audit.noDetails')}</span>;

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
      <div className="text-grey-500 font-medium border-b border-grey-200 pb-1">{t('audit.before')}</div>
      <div className="text-grey-500 font-medium border-b border-grey-200 pb-1">{t('audit.after')}</div>
      {allKeys.map((key) => {
        const bVal = before[key] !== undefined ? JSON.stringify(before[key]) : '\u2014';
        const aVal = after[key] !== undefined ? JSON.stringify(after[key]) : '\u2014';
        return (
          <div key={key} className="contents">
            <div className="text-grey-600"><span className="font-medium text-grey-700">{key}:</span> {bVal}</div>
            <div className="text-grey-600"><span className="font-medium text-grey-700">{key}:</span> {aVal}</div>
          </div>
        );
      })}
    </div>
  );
}

function changeSummary(action, diff, t) {
  if (!diff) return '';
  if (action === 'CREATE') return t('audit.recordCreated');
  if (action === 'DELETE') return t('audit.recordDeleted');
  if (action === 'PASSWORD_RESET') return diff.after?.note || t('audit.passwordReset');
  const after = diff.after || {};
  const keys = Object.keys(after);
  if (keys.length === 0) return '';
  const shown = keys.slice(0, 2).map((k) => `${k}: ${JSON.stringify(after[k])}`).join(', ');
  return keys.length > 2 ? `${shown} ${t('audit.moreChanges', { count: keys.length - 2 })}` : shown;
}

export default function AuditLogPage() {
  const { t } = useTranslation(['admin', 'common']);
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState(null);

  // Filters
  const [userId, setUserId] = useState('');
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');

  // Users for filter dropdown
  const [allUsers, setAllUsers] = useState([]);

  useEffect(() => {
    getUsers({ limit: 999 }).then(({ data }) => setAllUsers(data.users)).catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page, limit: 50,
        user_id: userId || undefined,
        entity_type: entityType || undefined,
        action: action || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        search: search || undefined,
      };
      const { data } = await getAuditLogs(params);
      setEntries(data.entries);
      setTotal(data.total);
    } catch {
      toast.error(t('audit.failedLoadAuditLogs'));
    } finally {
      setLoading(false);
    }
  }, [page, userId, entityType, action, dateFrom, dateTo, search, t]);

  useEffect(() => {
    const timer = setTimeout(fetchData, 300);
    return () => clearTimeout(timer);
  }, [fetchData]);

  function clearFilters() {
    setUserId('');
    setEntityType('');
    setAction('');
    setDateFrom('');
    setDateTo('');
    setSearch('');
    setPage(1);
  }

  const hasFilters = userId || entityType || action || dateFrom || dateTo || search;
  const totalPages = Math.ceil(total / 50);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-grey-900">{t('audit.title')}</h1>
        <p className="text-sm text-grey-500 mt-0.5">{t('audit.entries', { count: total })}</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label className="block text-xs font-medium text-grey-500 mb-1">{t('audit.user')}</label>
          <select value={userId} onChange={(e) => { setUserId(e.target.value); setPage(1); }} className="app-list-filter-select w-44">
            <option value="">{t('audit.allUsers')}</option>
            {allUsers.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-grey-500 mb-1">{t('audit.objectType')}</label>
          <select value={entityType} onChange={(e) => { setEntityType(e.target.value); setPage(1); }} className="app-list-filter-select w-40">
            <option value="">{t('audit.allTypes')}</option>
            {ENTITY_TYPES.map((et) => <option key={et} value={et}>{et}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-grey-500 mb-1">{t('audit.action')}</label>
          <select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className="app-list-filter-select w-40">
            <option value="">{t('audit.allActions')}</option>
            {ACTION_TYPES.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-grey-500 mb-1">{t('audit.from')}</label>
          <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className={`w-36 ${selectClass}`} />
        </div>
        <div>
          <label className="block text-xs font-medium text-grey-500 mb-1">{t('audit.to')}</label>
          <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className={`w-36 ${selectClass}`} />
        </div>
        <div className="relative">
          <label className="block text-xs font-medium text-grey-500 mb-1">{t('audit.search')}</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-grey-400" />
            <input type="text" placeholder={t('audit.searchPlaceholder')} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className={`w-40 pl-8 ${selectClass}`} />
          </div>
        </div>
        {hasFilters && (
          <button onClick={clearFilters} className="h-10 px-3 text-xs font-medium text-green-600 hover:text-green-800 flex items-center gap-1">
            <X size={14} /> {t('audit.clear')}
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-grey-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-grey-50 border-b border-grey-200">
              <th className="w-8 px-3 py-3"></th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('audit.timestamp')}</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('audit.user')}</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('audit.action')}</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('audit.object')}</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('audit.changes')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-grey-400">{t('common:table.loading')}</td></tr>
            ) : entries.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-grey-400">{t('audit.noEntriesFound')}</td></tr>
            ) : entries.map((e) => (
              <React.Fragment key={e.id}>
                <tr
                  className="border-b border-grey-100 hover:bg-grey-50 transition-colors cursor-pointer"
                  onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}
                >
                  <td className="px-3 py-3 text-grey-400">
                    {expandedId === e.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </td>
                  <td className="px-4 py-3 text-grey-600 whitespace-nowrap text-xs">{formatTimestamp(e.timestamp)}</td>
                  <td className="px-4 py-3">
                    <div className="text-grey-900 text-sm">{e.user?.full_name || '\u2014'}</div>
                    <div className="text-grey-400 text-xs">{e.user?.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ACTION_COLORS[e.action] || 'bg-grey-100 text-grey-600'}`}>
                      {e.action}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-grey-900 text-sm">{e.entity_type}</div>
                    <div className="text-grey-400 text-xs font-mono">{e.entity_id?.slice(0, 8)}</div>
                  </td>
                  <td className="px-4 py-3 text-grey-500 text-xs max-w-[300px] truncate">
                    {changeSummary(e.action, e.diff_json, t)}
                  </td>
                </tr>
                {expandedId === e.id && (
                  <tr className="bg-grey-50">
                    <td colSpan={6} className="px-8 py-4">
                      <DiffView diff={e.diff_json} t={t} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-grey-500">{t('pagination.pageOf', { page, total: totalPages })}</p>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}
              className="h-8 px-3 text-xs font-medium rounded-md border border-grey-300 text-grey-700 hover:bg-grey-50 disabled:opacity-50 disabled:cursor-not-allowed">{t('pagination.previous')}</button>
            <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}
              className="h-8 px-3 text-xs font-medium rounded-md border border-grey-300 text-grey-700 hover:bg-grey-50 disabled:opacity-50 disabled:cursor-not-allowed">{t('pagination.next')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
