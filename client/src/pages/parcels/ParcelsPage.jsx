import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Loader2, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import StatusBadge from '../../components/ui/StatusBadge';
import { listIncomingParcels, listOutgoingParcels } from '../../api/parcels';

const tabs = ['all', 'incoming', 'outgoing'];

function formatDateTime(value) {
  return value ? format(new Date(value), 'dd MMM yyyy HH:mm') : '—';
}

function renderMaterialLabel(row) {
  return row.materialName || row.wasteStreamName || '—';
}

export default function ParcelsPage() {
  const { t } = useTranslation(['parcels', 'common']);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = tabs.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'all';
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
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
        const [incomingRes, outgoingRes] = await Promise.all([
          listIncomingParcels({ search: query, page: 1, limit: 100 }),
          listOutgoingParcels({ search: query, page: 1, limit: 100 }),
        ]);

        const mappedIncoming = (incomingRes.data.data || []).map((asset) => ({
          id: asset.id,
          type: 'incoming',
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

        const mappedOutgoing = (outgoingRes.data.data || []).map((parcel) => ({
          id: parcel.id,
          type: 'outgoing',
          label: parcel.parcel_label,
          status: parcel.status,
          containerType: parcel.container_type,
          materialName: parcel.material?.name,
          volumeM3: parcel.volume_m3,
          tareWeightKg: parcel.tare_weight_kg,
          outboundNumber: parcel.outbound?.outbound_number,
          outboundId: parcel.outbound?.id,
          buyerName:
            parcel.outbound?.outbound_order?.buyer?.company_name ||
            parcel.outbound?.outbound_order?.buyer?.name ||
            parcel.outbound?.buyer?.company_name ||
            parcel.outbound?.buyer?.name,
          createdAt: parcel.created_at,
          raw: parcel,
        }));

        setIncoming(mappedIncoming);
        setOutgoing(mappedOutgoing);
      } catch (error) {
        toast.error(error.response?.data?.error || t('toast.loadFailed'));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [searchParams, t]);

  const rows = useMemo(() => {
    if (activeTab === 'incoming') return incoming;
    if (activeTab === 'outgoing') return outgoing;
    return [...incoming, ...outgoing].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [activeTab, incoming, outgoing]);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="text-xl font-semibold text-grey-900">{t('title')}</h1>
        {(activeTab === 'outgoing' || activeTab === 'all') && (
          <button
            type="button"
            onClick={() => navigate('/parcels/outgoing/new')}
            className="inline-flex items-center gap-2 h-10 px-4 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-700 transition-colors"
          >
            <Plus size={16} />
            {t('createOutgoing')}
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 mb-4">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              next.set('tab', tab);
              setSearchParams(next);
            }}
            className={`h-10 px-4 rounded-md text-sm font-semibold transition-colors ${
              activeTab === tab
                ? 'bg-green-500 text-white'
                : 'bg-white text-grey-700 border border-grey-300 hover:bg-grey-50'
            }`}
          >
            {t(`tabs.${tab}`)}
          </button>
        ))}
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
            {t(`empty.${activeTab}`)}
          </div>
        ) : (
          <table className="w-full min-w-[1100px] text-sm">
            <thead>
              <tr className="bg-grey-50 border-b border-grey-200">
                <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('columns.label')}</th>
                {activeTab === 'all' && (
                  <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('columns.type')}</th>
                )}
                <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('columns.status')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('columns.containerType')}</th>
                {activeTab === 'incoming' && (
                  <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('columns.containerLabel')}</th>
                )}
                <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">
                  {activeTab === 'incoming' ? t('columns.wasteStream') : t('columns.material')}
                </th>
                {activeTab !== 'outgoing' && (
                  <>
                    <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('columns.inbound')}</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('columns.order')}</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('columns.supplier')}</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('columns.netWeight')}</th>
                  </>
                )}
                {activeTab !== 'incoming' && (
                  <>
                    <th className="text-right px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('columns.volume')}</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('columns.tareWeight')}</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('columns.outbound')}</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('columns.buyer')}</th>
                  </>
                )}
                <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('columns.createdAt')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.type}-${row.id}`} className="border-b border-grey-100">
                  <td className="px-4 py-3 font-medium text-green-700">
                    <Link to={`/parcels/${row.type}/${row.id}`} className="hover:underline">
                      {row.label}
                    </Link>
                  </td>
                  {activeTab === 'all' && (
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                        row.type === 'incoming'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-orange-50 text-orange-700 border border-orange-200'
                      }`}>
                        {t(`type.${row.type}`)}
                      </span>
                    </td>
                  )}
                  <td className="px-4 py-3">{row.status ? <StatusBadge status={row.status} /> : '—'}</td>
                  <td className="px-4 py-3 text-grey-700">{row.containerType ? t(`common:containerTypes.${row.containerType}`, { defaultValue: row.containerType }) : '—'}</td>
                  {activeTab === 'incoming' && (
                    <td className="px-4 py-3 text-grey-700 font-mono">{row.containerLabel || '—'}</td>
                  )}
                  <td className="px-4 py-3 text-grey-700">{renderMaterialLabel(row)}</td>
                  {activeTab !== 'outgoing' && (
                    <>
                      <td className="px-4 py-3 text-grey-700">
                        {row.inboundId ? <Link to={`/inbounds/${row.inboundId}`} className="text-green-700 hover:underline">{row.inboundNumber || '—'}</Link> : '—'}
                      </td>
                      <td className="px-4 py-3 text-grey-700">
                        {row.orderId ? <Link to={`/orders/${row.orderId}`} className="text-green-700 hover:underline">{row.orderNumber || '—'}</Link> : (row.orderNumber || '—')}
                      </td>
                      <td className="px-4 py-3 text-grey-700">{row.supplierName || '—'}</td>
                      <td className="px-4 py-3 text-right text-grey-700">{row.netWeightKg != null ? Number(row.netWeightKg).toLocaleString() : '—'}</td>
                    </>
                  )}
                  {activeTab !== 'incoming' && (
                    <>
                      <td className="px-4 py-3 text-right text-grey-700">{row.volumeM3 != null ? Number(row.volumeM3).toLocaleString() : '—'}</td>
                      <td className="px-4 py-3 text-right text-grey-700">{row.tareWeightKg != null ? Number(row.tareWeightKg).toLocaleString() : '—'}</td>
                      <td className="px-4 py-3 text-grey-700">
                        {row.outboundId ? <Link to={`/outbounds/${row.outboundId}`} className="text-green-700 hover:underline">{row.outboundNumber}</Link> : '—'}
                      </td>
                      <td className="px-4 py-3 text-grey-700">{row.buyerName || '—'}</td>
                    </>
                  )}
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
