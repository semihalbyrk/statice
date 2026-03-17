const STATUS_CONFIG = {
  // Order statuses
  PLANNED: { label: 'Planned', className: 'bg-grey-50 text-grey-700 border-grey-300' },
  IN_PROGRESS: { label: 'In Progress', className: 'bg-orange-25 text-orange-700 border-orange-300' },
  COMPLETED: { label: 'Completed', className: 'bg-green-25 text-green-700 border-green-400' },
  CANCELLED: { label: 'Cancelled', className: 'bg-red-25 text-red-700 border-red-300' },
  // Inbound statuses
  ARRIVED: { label: 'Arrived', className: 'bg-blue-25 text-blue-700 border-blue-300' },
  WEIGHED_IN: { label: 'Weighed In', className: 'bg-blue-25 text-blue-700 border-blue-300' },
  WEIGHED_OUT: { label: 'Weighed Out', className: 'bg-purple-25 text-purple-700 border-purple-300' },
  READY_FOR_SORTING: { label: 'Ready for Sorting', className: 'bg-orange-25 text-orange-700 border-orange-300' },
  SORTED: { label: 'Sorted', className: 'bg-green-25 text-green-700 border-green-400' },
  ACTIVE: { label: 'Active', className: 'bg-green-25 text-green-700 border-green-400' },
  INACTIVE: { label: 'Inactive', className: 'bg-grey-50 text-grey-600 border-grey-300' },
  // Order lifecycle statuses
  DISPUTE: { label: 'Dispute', className: 'bg-red-25 text-red-700 border-red-300' },
  INVOICED: { label: 'Invoiced', className: 'bg-purple-25 text-purple-700 border-purple-300' },
};

export default function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || { label: status, className: 'bg-grey-100 text-grey-700 border-grey-300' };
  return (
    <span className={`inline-flex h-7 w-fit max-w-full shrink-0 items-center whitespace-nowrap rounded-md border px-2.5 text-[13px] font-medium shadow-[0_1px_0_rgba(16,24,40,0.02)] ${config.className}`}>
      {config.label}
    </span>
  );
}

export { STATUS_CONFIG };
