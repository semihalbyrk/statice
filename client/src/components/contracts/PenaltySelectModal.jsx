import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { listFees } from '../../api/fees';
import { syncContractPenalties } from '../../api/contracts';

const RATE_TYPE_LABELS = { FIXED: 'Fixed', PERCENTAGE: '%', PER_KG: '/kg', PER_HOUR: '/hr' };
const FEE_TYPE_LABELS = {
  CONTAMINATION_SURCHARGE: 'Contamination Surcharge',
  CONTAMINATION_FLAT: 'Contamination Flat Fee',
  CONTAMINATION_PERCENTAGE: 'Contamination Percentage',
  SORTING_SURCHARGE: 'Sorting Surcharge',
  HAZARDOUS_MATERIAL: 'Hazardous Material',
  REJECTION_FEE: 'Rejection Fee',
};

export default function PenaltySelectModal({ contractId, currentPenalties = [], onClose, onSuccess }) {
  const { t } = useTranslation(['contracts', 'common']);
  const [fees, setFees] = useState([]);
  const [selected, setSelected] = useState(new Set(currentPenalties.map((p) => p.fee_id || p.fee?.id)));
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listFees({ active: 'true' })
      .then(({ data }) => setFees(data.data))
      .catch(() => toast.error(t('contracts:toast.penaltiesLoadFailed')))
      .finally(() => setLoading(false));
  }, [t]);

  function toggleFee(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    const selectedIds = [...selected];
    if (contractId) {
      // Detail page mode: sync via API
      setSubmitting(true);
      try {
        await syncContractPenalties(contractId, selectedIds);
        toast.success(t('contracts:toast.penaltiesUpdated'));
        onSuccess(selectedIds);
      } catch (err) {
        toast.error(err.response?.data?.error || t('contracts:toast.penaltiesUpdateFailed'));
      } finally {
        setSubmitting(false);
      }
    } else {
      // Create/edit form mode: just return selected IDs, no API call
      onSuccess(selectedIds);
    }
  }

  return (
    <div className="app-modal-overlay">
      <div className="app-modal-panel max-w-md">
        <div className="flex items-center justify-between px-5 py-3 border-b border-grey-200">
          <h2 className="text-lg font-semibold text-grey-900">{t('contracts:penaltyModal.title')}</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-grey-50 transition-colors text-grey-400">&times;</button>
        </div>
        <div className="px-5 py-4 max-h-[50vh] overflow-y-auto">
          {loading ? (
            <p className="text-sm text-grey-400 text-center py-4">{t('contracts:penaltyModal.loadingFees')}</p>
          ) : fees.length === 0 ? (
            <p className="text-sm text-grey-400 text-center py-4">{t('contracts:penaltyModal.noActiveFees')}</p>
          ) : (
            <div className="space-y-2">
              {fees.map((f) => (
                <label key={f.id} className="flex items-start gap-3 p-3 rounded-md border border-grey-200 hover:bg-grey-50 cursor-pointer transition-colors">
                  <input type="checkbox" checked={selected.has(f.id)} onChange={() => toggleFee(f.id)}
                    className="mt-0.5 h-4 w-4 rounded border-grey-300 text-green-500 focus:ring-green-500/15" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-grey-900">{FEE_TYPE_LABELS[f.fee_type] || f.fee_type}</p>
                    <p className="text-xs text-grey-500 mt-0.5">{f.description}</p>
                    <p className="text-xs font-medium text-grey-700 mt-1">
                      {f.rate_type === 'PERCENTAGE' && `${f.rate_value}% of order value`}
                      {f.rate_type === 'FIXED' && `\u20AC${Number(f.rate_value).toFixed(2)} fixed`}
                      {f.rate_type === 'PER_KG' && `\u20AC${Number(f.rate_value).toFixed(2)}/kg`}
                      {f.rate_type === 'PER_HOUR' && `\u20AC${Number(f.rate_value).toFixed(2)}/hr`}
                      {f.min_cap != null && ` \u00B7 min \u20AC${Number(f.min_cap).toFixed(0)}`}
                      {f.max_cap != null && ` \u00B7 max \u20AC${Number(f.max_cap).toFixed(0)}`}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 px-5 py-3 border-t border-grey-200">
          <button onClick={onClose}
            className="h-9 px-4 bg-white text-grey-700 border border-grey-300 rounded-md text-sm font-semibold hover:bg-grey-50 transition-colors">
            {t('contracts:penaltyModal.buttons.cancel')}
          </button>
          <button onClick={handleSave} disabled={submitting}
            className="h-9 px-4 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors">
            {submitting
              ? t('contracts:penaltyModal.buttons.saving')
              : t('contracts:penaltyModal.buttons.save', { count: selected.size })}
          </button>
        </div>
      </div>
    </div>
  );
}
