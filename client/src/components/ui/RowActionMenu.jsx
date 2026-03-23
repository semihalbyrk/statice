import { useState, useRef, useEffect } from 'react';
import { MoreVertical } from 'lucide-react';

export default function RowActionMenu({ actions = [] }) {
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

  if (actions.length === 0) return null;

  return (
    <div className="relative inline-flex justify-end" ref={ref}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="p-1.5 rounded-md hover:bg-grey-100 transition-colors text-grey-400 hover:text-grey-600"
      >
        <MoreVertical size={16} />
      </button>

      {open && (
        <div className="absolute z-50 right-0 top-full mt-1 bg-white rounded-lg border border-grey-200 shadow-lg py-1 min-w-[180px]">
          {actions.map((action) => {
            const Icon = action.icon;
            const isDanger = action.variant === 'danger';
            return (
              <button
                key={action.label}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  action.onClick();
                }}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                  isDanger
                    ? 'text-red-600 hover:bg-red-50'
                    : 'text-grey-700 hover:bg-grey-50'
                }`}
              >
                {Icon && <Icon size={14} />}
                {action.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
