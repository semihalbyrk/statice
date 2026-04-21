import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { STATUS_CONFIG } from './StatusBadge';

export default function ClickableStatusBadge({ status, allowedTransitions = [], onTransition, disabled }) {
  const { t } = useTranslation('common');
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const MENU_WIDTH = 180;
    const viewportWidth = window.innerWidth;
    let left = rect.left;
    if (left + MENU_WIDTH > viewportWidth - 8) {
      left = Math.max(8, rect.right - MENU_WIDTH);
    }
    setMenuPos({ top: rect.bottom + 4, left, width: rect.width });
  }, [open]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        menuRef.current && !menuRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    function handleScroll() { setOpen(false); }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleScroll);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [open]);

  const config = STATUS_CONFIG[status] || { className: 'bg-grey-100 text-grey-700 border-grey-300' };
  const label = t('status.' + status, { defaultValue: status.replace(/_/g, ' ') });
  const canClick = allowedTransitions.length > 0 && !disabled;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (canClick) setOpen(!open);
        }}
        className={`inline-flex h-7 w-fit max-w-full shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 text-[13px] font-medium shadow-[0_1px_0_rgba(16,24,40,0.02)] ${config.className} ${
          canClick ? 'cursor-pointer hover:brightness-[0.98]' : 'cursor-default'
        } transition`}
      >
        {label}
        {canClick && (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 9999 }}
          className="bg-white rounded-lg border border-grey-200 shadow-lg py-1 min-w-[180px]"
        >
          {allowedTransitions.map((nextStatus) => (
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
              {t('status.' + nextStatus, { defaultValue: nextStatus.replace(/_/g, ' ') })}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}
