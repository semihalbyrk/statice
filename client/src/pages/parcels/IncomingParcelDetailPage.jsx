import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import Breadcrumb from '../../components/ui/Breadcrumb';
import StatusBadge from '../../components/ui/StatusBadge';
import { getIncomingParcel } from '../../api/parcels';

function formatDateTime(value) {
  return value ? format(new Date(value), 'dd MMM yyyy HH:mm') : '—';
}

function InfoField({ label, children, value }) {
  return (
    <div className="min-w-0">
      <span className="text-xs font-medium text-grey-500 uppercase tracking-wide">{label}</span>
      <div className="mt-0.5 text-sm font-medium text-grey-900 break-words">{children || value || '—'}</div>
    </div>
  );
}

export default function IncomingParcelDetailPage() {
  const { id } = useParams();
  const { t } = useTranslation(['parcels', 'common']);
  const [parcel, setParcel] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const { data } = await getIncomingParcel(id);
        setParcel(data.data);
      } catch (error) {
        toast.error(error.response?.data?.error || t('toast.detailFailed'));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id, t]);

  if (loading || !parcel) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-grey-400" size={24} /></div>;
  }

  const inbound = parcel.inbound;
  const order = inbound?.order;

  return (
    <div>
      <Breadcrumb items={[
        { label: t('title'), to: '/parcels?tab=incoming' },
        { label: parcel.asset_label || t('incomingDetail.title') },
      ]} />

      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-xl font-semibold text-grey-900">{parcel.asset_label}</h1>
        {inbound?.status ? <StatusBadge status={inbound.status} /> : null}
      </div>

      <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-5 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <InfoField label={t('columns.containerType')} value={parcel.container_type ? t(`common:containerTypes.${parcel.container_type}`, { defaultValue: parcel.container_type }) : '—'} />
          <InfoField label={t('columns.material')} value={parcel.waste_stream?.name || parcel.material_category?.description_en} />
          <InfoField label={t('columns.volume')} value={parcel.estimated_volume_m3 != null ? `${Number(parcel.estimated_volume_m3).toLocaleString()} m³` : '—'} />
          <InfoField label={t('columns.netWeight')} value={parcel.net_weight_kg != null ? `${Number(parcel.net_weight_kg).toLocaleString()} kg` : (parcel.net_weight != null ? `${Number(parcel.net_weight).toLocaleString()} kg` : '—')} />
          <InfoField label={t('columns.inbound')}>
            {inbound?.id ? <Link to={`/inbounds/${inbound.id}`} className="text-green-700 hover:underline">{inbound.inbound_number || inbound.id}</Link> : '—'}
          </InfoField>
          <InfoField label={t('columns.order')}>
            {order?.id ? <Link to={`/orders/${order.id}`} className="text-green-700 hover:underline">{order.order_number || order.id}</Link> : '—'}
          </InfoField>
          <InfoField label={t('columns.supplier')} value={order?.supplier?.name || order?.supplier?.company_name} />
          <InfoField label={t('common:fields.createdAt')} value={formatDateTime(parcel.created_at)} />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-5 mb-4">
        <h2 className="text-base font-semibold text-grey-900 mb-3">{t('incomingDetail.inboundContext')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <InfoField label={t('columns.inbound')} value={inbound?.inbound_number || inbound?.id} />
          <InfoField label={t('columns.status')}>{inbound?.status ? <StatusBadge status={inbound.status} /> : '—'}</InfoField>
          <InfoField label={t('columns.order')} value={order?.order_number} />
          <InfoField label={t('columns.createdAt')} value={formatDateTime(inbound?.created_at || inbound?.arrived_at)} />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-5">
        <h2 className="text-base font-semibold text-grey-900 mb-3">{t('incomingDetail.processingHistory')}</h2>
        <p className="text-sm text-grey-500">{t('incomingDetail.notProcessed')}</p>
      </div>
    </div>
  );
}
