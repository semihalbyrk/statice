const STATUS_CONFIG = {
  // Order statuses
  PLANNED: { label: 'Planned', className: 'bg-grey-100 text-grey-700' },
  ARRIVED: { label: 'Arrived', className: 'bg-blue-100 text-blue-700' },
  IN_PROGRESS: { label: 'In Progress', className: 'bg-orange-100 text-orange-700' },
  COMPLETED: { label: 'Completed', className: 'bg-green-100 text-green-700' },
  CANCELLED: { label: 'Cancelled', className: 'bg-red-100 text-red-700' },
  // Sorting session statuses
  DRAFT: { label: 'Draft', className: 'bg-orange-100 text-orange-700' },
  SUBMITTED: { label: 'Submitted', className: 'bg-green-100 text-green-700' },
  // Weighing event statuses
  PENDING_GROSS: { label: 'Pending Gross', className: 'bg-grey-100 text-grey-700' },
  GROSS_COMPLETE: { label: 'Gross Complete', className: 'bg-blue-100 text-blue-700' },
  PENDING_TARE: { label: 'Pending Tare', className: 'bg-orange-100 text-orange-700' },
  TARE_COMPLETE: { label: 'Tare Complete', className: 'bg-teal-100 text-teal-700' },
  CONFIRMED: { label: 'Confirmed', className: 'bg-green-100 text-green-700' },
};

export default function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || { label: status, className: 'bg-grey-100 text-grey-700' };
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full ${config.className}`}>
      {config.label}
    </span>
  );
}
