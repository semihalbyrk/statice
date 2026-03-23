import { useState, useRef, useEffect } from 'react';
import { STATUS_CONFIG } from './StatusBadge';

const TRANSITION_LABELS = {
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  ARRIVED: 'Arrived',
  WEIGHED_IN: 'Weigh In',
  WEIGHED_OUT: 'Weigh Out',
  PLANNED: 'Planned',
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  DISPUTE: 'Dispute',
  INVOICED: 'Invoiced',
  EXPIRED: 'Expired',
  DRAFT: 'Draft',
};

export default function ClickableStatusBadge({ status, allowedTransitions = [], onTransition, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const config = STATUS_CONFIG[status] || { label: status, className: 'bg-grey-100 text-grey-700 border-grey-300' };
  const canClick = allowedTransitions.length > 0 && !disabled;

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (canClick) setOpen(!open);
        }}
        className={`inline-flex h-7 w-fit max-w-full shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 text-[13px] font-medium shadow-[0_1px_0_rgba(16,24,40,0.02)] ${config.className} ${
          canClick ? 'cursor-pointer hover:brightness-[0.98]' : 'cursor-default'
        } transition`}
      >
        {config.label}
        {canClick && (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute z-50 mt-1 left-0 bg-white rounded-lg border border-grey-200 shadow-lg py-1 min-w-[160px]">
          {allowedTransitions.map((nextStatus) => {
            const nextConfig = STATUS_CONFIG[nextStatus] || { label: nextStatus };
            return (
              <button
                key={nextStatus}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  onTransition(nextStatus);
                }}
                className="w-full text-left px-3 py-2 text-sm text-grey-700 hover:bg-grey-50 transition-colors"
              >
                {TRANSITION_LABELS[nextStatus] || nextConfig.label || nextStatus.replace(/_/g, ' ')}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
