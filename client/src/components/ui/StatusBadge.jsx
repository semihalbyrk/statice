import { useTranslation } from 'react-i18next';

const STATUS_CONFIG = {
  // Order statuses
  PLANNED: { className: 'bg-grey-50 text-grey-700 border-grey-300' },
  IN_PROGRESS: { className: 'bg-orange-25 text-orange-700 border-orange-300' },
  COMPLETED: { className: 'bg-green-25 text-green-700 border-green-400' },
  CANCELLED: { className: 'bg-red-25 text-red-700 border-red-300' },
  // Inbound statuses
  ARRIVED: { className: 'bg-blue-25 text-blue-700 border-blue-300' },
  WEIGHED_IN: { className: 'bg-blue-25 text-blue-700 border-blue-300' },
  WEIGHED_OUT: { className: 'bg-purple-25 text-purple-700 border-purple-300' },
  READY_FOR_SORTING: { className: 'bg-orange-25 text-orange-700 border-orange-300' },
  SORTED: { className: 'bg-green-25 text-green-700 border-green-400' },
  ACTIVE: { className: 'bg-green-25 text-green-700 border-green-400' },
  INACTIVE: { className: 'bg-grey-50 text-grey-600 border-grey-300' },
  // Order lifecycle statuses
  DISPUTE: { className: 'bg-red-25 text-red-700 border-red-300' },
  INVOICED: { className: 'bg-purple-25 text-purple-700 border-purple-300' },
  NOT_STARTED: { className: 'bg-grey-50 text-grey-700 border-grey-300' },
  FINALIZED: { className: 'bg-orange-25 text-orange-700 border-orange-300' },
  CONFIRMED: { className: 'bg-green-25 text-green-700 border-green-400' },
  SUPERSEDED: { className: 'bg-grey-100 text-grey-600 border-grey-300' },
  RECYCLED: { className: 'bg-blue-25 text-blue-700 border-blue-300' },
  REUSED: { className: 'bg-green-25 text-green-700 border-green-300' },
  DISPOSED: { className: 'bg-red-25 text-red-700 border-red-300' },
  LANDFILL: { className: 'bg-orange-25 text-orange-700 border-orange-300' },
  // Outbound statuses
  CREATED: { className: 'bg-grey-50 text-grey-700 border-grey-300' },
  LOADING: { className: 'bg-blue-50 text-blue-700 border-blue-300' },
  WEIGHED: { className: 'bg-purple-50 text-purple-700 border-purple-300' },
  DOCUMENTS_READY: { className: 'bg-amber-50 text-amber-700 border-amber-300' },
  DEPARTED: { className: 'bg-cyan-50 text-cyan-700 border-cyan-300' },
  DELIVERED: { className: 'bg-green-25 text-green-700 border-green-300' },
  AVAILABLE: { className: 'bg-grey-50 text-grey-700 border-grey-300' },
  ASSIGNED: { className: 'bg-blue-50 text-blue-700 border-blue-300' },
  SHIPPED: { className: 'bg-green-25 text-green-700 border-green-300' },
  // Contract statuses
  DRAFT: { className: 'bg-grey-50 text-grey-700 border-grey-300' },
  EXPIRED: { className: 'bg-orange-25 text-orange-700 border-orange-300' },
  // TERMINATED removed — now uses INACTIVE (line 14)
};

export default function StatusBadge({ status }) {
  const { t } = useTranslation('common');
  const config = STATUS_CONFIG[status] || { className: 'bg-grey-100 text-grey-700 border-grey-300' };
  const label = t('status.' + status, { defaultValue: status });
  return (
    <span className={`inline-flex h-7 w-fit max-w-full shrink-0 items-center whitespace-nowrap rounded-md border px-2.5 text-[13px] font-medium shadow-[0_1px_0_rgba(16,24,40,0.02)] ${config.className}`}>
      {label}
    </span>
  );
}

export { STATUS_CONFIG };
