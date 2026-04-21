import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import Breadcrumb from '../../components/ui/Breadcrumb';
import StatusBadge from '../../components/ui/StatusBadge';
import { getOutgoingParcel } from '../../api/parcels';

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

export default function OutgoingParcelDetailPage() {
  const { id } = useParams();
  const { t } = useTranslation(['parcels', 'outboundParcels', 'common']);
  const [parcel, setParcel] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const { data } = await getOutgoingParcel(id);
        setParcel(data.data);
      } catch (error) {
        toast.error(error.response?.data?.error || t('parcels:toast.detailFailed'));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id, t]);

  if (loading || !parcel) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-grey-400" size={24} /></div>;
  }

  const outbound = parcel.outbound;
  const order = outbound?.outbound_order;

  return (
    <div>
      <Breadcrumb items={[
        { label: t('parcels:title'), to: '/parcels?tab=outgoing' },
        { label: parcel.parcel_label || t('parcels:outgoingDetail.title') },
      ]} />

      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-xl font-semibold text-grey-900">{parcel.parcel_label}</h1>
        <StatusBadge status={parcel.status} />
      </div>

      <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-5 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <InfoField label={t('outboundParcels:fields.material')} value={parcel.material?.name} />
          <InfoField label={t('outboundParcels:fields.containerType')} value={parcel.container_type ? t(`common:containerTypes.${parcel.container_type}`, { defaultValue: parcel.container_type }) : '—'} />
          <InfoField label={t('outboundParcels:fields.volumeM3')} value={parcel.volume_m3 != null ? `${Number(parcel.volume_m3).toLocaleString()} m³` : '—'} />
          <InfoField label={t('outboundParcels:fields.tareWeightKg')} value={parcel.tare_weight_kg != null ? `${Number(parcel.tare_weight_kg).toLocaleString()} kg` : '—'} />
          <InfoField label={t('outboundParcels:fields.description')} value={parcel.description} />
          <InfoField label={t('outboundParcels:fields.notes')} value={parcel.notes} />
          <InfoField label={t('common:fields.createdAt')} value={formatDateTime(parcel.created_at)} />
          <InfoField label={t('common:fields.updatedAt')} value={formatDateTime(parcel.updated_at)} />
        </div>
      </div>

      {outbound ? (
        <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-5">
          <h2 className="text-base font-semibold text-grey-900 mb-3">{t('parcels:outgoingDetail.outboundContext')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <InfoField label={t('outboundParcels:fields.outbound')}>
              <Link to={`/outbounds/${outbound.id}`} className="text-green-700 hover:underline">
                {outbound.outbound_number}
              </Link>
            </InfoField>
            <InfoField label={t('common:fields.status')}><StatusBadge status={outbound.status} /></InfoField>
            <InfoField label={t('outboundParcels:fields.buyer')} value={order?.buyer?.company_name || order?.buyer?.name} />
            <InfoField label={t('outbounds:table.netWeight')} value={outbound.net_weight_kg != null ? `${Number(outbound.net_weight_kg).toLocaleString()} kg` : '—'} />
            <InfoField label={t('outbounds:table.orderNumber')}>
              {order?.id ? <Link to={`/outbound-orders/${order.id}`} className="text-green-700 hover:underline">{order.order_number}</Link> : '—'}
            </InfoField>
            <InfoField label={t('outbounds:detail.transporter')} value={order?.transporter?.company_name || order?.transporter?.name} />
            <InfoField label={t('outbounds:table.vehiclePlate')} value={outbound.vehicle_plate || order?.vehicle_plate} />
            <InfoField label={t('outbounds:table.departedAt')} value={formatDateTime(outbound.departed_at)} />
          </div>
        </div>
      ) : (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-4 py-3 text-sm">
          {t('parcels:outgoingDetail.notAssigned')}
        </div>
      )}
    </div>
  );
}
