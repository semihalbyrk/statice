import { useState } from 'react';

const LOSS_REASONS = [
  { value: 'MOISTURE', label: 'Moisture loss' },
  { value: 'DUST', label: 'Dust / fines' },
  { value: 'MEASUREMENT_VARIANCE', label: 'Measurement variance' },
  { value: 'SPILLAGE', label: 'Spillage' },
  { value: 'CONTAMINATION_REMOVED', label: 'Contamination removed' },
  { value: 'OTHER', label: 'Other' },
];

export default function BalanceWarningDialog({
  open,
  gapKg,
  gapRatio,
  threshold = 0.05,
  onConfirm,
  onCancel,
  submitting = false,
}) {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  if (!open) return null;

  const absRatio = Math.abs(gapRatio || 0);
  const aboveThreshold = absRatio > threshold;
  const confirmDisabled = submitting || (aboveThreshold && !reason);
  const ratioPct = (absRatio * 100).toFixed(1);
  const thresholdPct = (threshold * 100).toFixed(0);

  return (
    <div className="app-modal-overlay">
      <div className="app-modal-panel max-w-md">
        <div className="flex items-center justify-between px-5 py-3 border-b border-grey-200">
          <h2 className="text-lg font-semibold text-grey-900">Mark as Sorted</h2>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded-md hover:bg-grey-50 transition-colors text-grey-400"
          >
            &times;
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-grey-700">
            Fase 1 balance gap: <strong>{Number(gapKg || 0).toFixed(1)} kg</strong>{' '}
            ({ratioPct}%) vs. tolerance {thresholdPct}%.
          </p>
          {aboveThreshold ? (
            <p className="text-sm text-orange-700 font-medium">
              Above tolerance — a loss reason is required.
            </p>
          ) : (
            <p className="text-sm text-grey-600">Within tolerance — reason is optional.</p>
          )}
          <div>
            <label className="block text-sm font-medium text-grey-700 mb-1.5">
              Loss reason {aboveThreshold && <span className="text-red-500">*</span>}
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-grey-300 text-sm"
            >
              <option value="">— none —</option>
              {LOSS_REASONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-grey-700 mb-1.5">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-md border border-grey-300 text-sm"
              placeholder="Optional context for the loss..."
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-grey-200">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 px-4 rounded-md border border-grey-300 text-sm font-medium text-grey-700 hover:bg-grey-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={confirmDisabled}
            onClick={() => onConfirm({
              reason: reason || null,
              notes: notes || null,
              lossKg: gapKg,
            })}
            className="h-9 px-4 rounded-md bg-green-500 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50"
          >
            {submitting ? 'Working…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
