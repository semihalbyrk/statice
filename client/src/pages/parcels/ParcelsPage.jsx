import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import StatusBadge from '../../components/ui/StatusBadge';
import { listIncomingParcels } from '../../api/parcels';

function formatDateTime(value) {
  return value ? format(new Date(value), 'dd MMM yyyy HH:mm') : '—';
}

export default function ParcelsPage() {
  const { t } = useTranslation(['parcels', 'common']);
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [incoming, setIncoming] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handle = setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      if (search) next.set('search', search);
      else next.delete('search');
      setSearchParams(next, { replace: true });
    }, 250);
    return () => clearTimeout(handle);
  }, [search, searchParams, setSearchParams]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const query = searchParams.get('search') || '';
        const incomingRes = await listIncomingParcels({ search: query, page: 1, limit: 100 });

        const mappedIncoming = (incomingRes.data.data || []).map((asset) => ({
          id: asset.id,
          label: asset.asset_label,
          containerLabel: asset.container_label,
          status: asset.inbound?.status,
          containerType: asset.container_type,
          wasteStreamName: asset.waste_stream?.name,
          inboundNumber: asset.inbound?.inbound_number,
          inboundId: asset.inbound?.id,
          orderNumber: asset.inbound?.order?.order_number,
          orderId: asset.inbound?.order?.id,
          supplierName: asset.inbound?.order?.supplier?.name || asset.inbound?.order?.supplier?.company_name,
          netWeightKg: asset.net_weight_kg || asset.net_weight,
          createdAt: asset.created_at,
          raw: asset,
        }));

        setIncoming(mappedIncoming);
      } catch (error) {
        toast.error(error.response?.data?.error || t('toast.loadFailed'));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [searchParams, t]);

  const rows = useMemo(
    () => [...incoming].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)),
    [incoming],
  );

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="text-xl font-semibold text-grey-900">{t('title')}</h1>
      </div>

      <div className="relative max-w-sm mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-grey-400" />
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('searchPlaceholder')}
          className="w-full h-10 pl-9 pr-3 rounded-md border border-grey-300 text-sm text-grey-900 placeholder:text-grey-400 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors"
        />
      </div>

      <div className="bg-white rounded-lg border border-grey-200 shadow-sm overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-grey-500">
            <Loader2 className="animate-spin" size={20} />
          </div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-16 text-center text-grey-500">
            {t('empty.incoming')}
          </div>
        ) : (
          <table className="w-full min-w-[1100px] text-sm">
            <thead>
              <tr className="bg-grey-50 border-b border-grey-200">
                <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('columns.label')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('columns.status')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('columns.containerType')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('columns.containerLabel')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('columns.wasteStream')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('columns.inbound')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('columns.order')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('columns.supplier')}</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('columns.netWeight')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('columns.createdAt')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`incoming-${row.id}`} className="border-b border-grey-100">
                  <td className="px-4 py-3 font-medium text-green-700">
                    <Link to={`/parcels/incoming/${row.id}`} className="hover:underline">
                      {row.label}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{row.status ? <StatusBadge status={row.status} /> : '—'}</td>
                  <td className="px-4 py-3 text-grey-700">{row.containerType ? t(`common:containerTypes.${row.containerType}`, { defaultValue: row.containerType }) : '—'}</td>
                  <td className="px-4 py-3 text-grey-700 font-mono">{row.containerLabel || '—'}</td>
                  <td className="px-4 py-3 text-grey-700">{row.wasteStreamName || '—'}</td>
                  <td className="px-4 py-3 text-grey-700">
                    {row.inboundId ? <Link to={`/inbounds/${row.inboundId}`} className="text-green-700 hover:underline">{row.inboundNumber || '—'}</Link> : '—'}
                  </td>
                  <td className="px-4 py-3 text-grey-700">
                    {row.orderId ? <Link to={`/orders/${row.orderId}`} className="text-green-700 hover:underline">{row.orderNumber || '—'}</Link> : (row.orderNumber || '—')}
                  </td>
                  <td className="px-4 py-3 text-grey-700">{row.supplierName || '—'}</td>
                  <td className="px-4 py-3 text-right text-grey-700">{row.netWeightKg != null ? Number(row.netWeightKg).toLocaleString() : '—'}</td>
                  <td className="px-4 py-3 text-grey-700">{formatDateTime(row.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
