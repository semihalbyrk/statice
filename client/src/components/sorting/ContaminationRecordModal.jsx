import { useEffect, useState } from 'react';
import { AlertTriangle, Info, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { recordContaminationIncident, getContractContaminationConfig } from '../../api/contamination';
import { listContracts } from '../../api/contracts';

const inputClass = 'w-full h-10 px-3.5 rounded-md border border-grey-300 text-sm text-grey-900 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors';
const selectClass = `${inputClass} bg-white`;
const textareaClass = 'w-full min-h-[80px] px-3.5 py-2.5 rounded-md border border-grey-300 text-sm text-grey-900 placeholder:text-grey-400 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors resize-vertical';

const CONTAMINATION_TYPES = ['NON_WEEE', 'HAZARDOUS', 'EXCESSIVE_MOISTURE', 'SORTING_REQUIRED'];

function formatEUR(val) {
  if (val == null || isNaN(val)) return '—';
  return `€ ${Number(val).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ContaminationRecordModal({ isOpen, onClose, onSuccess, orderId, supplierId, sortingSessionId }) {
  const { t } = useTranslation(['sorting', 'common']);
  const [config, setConfig] = useState([]);
  const [contractId, setContractId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    contamination_type: '',
    description: '',
    weight: '',
    pct: '',
    hours: '',
    notes: '',
  });

  useEffect(() => {
    if (!isOpen) return;

    if (!supplierId) {
      setLoading(false);
      setError(t('sorting:contamination.supplierNotAvailable'));
      return;
    }

    setLoading(true);
    setError(null);
    setConfig([]);
    setContractId(null);

    (async () => {
      try {
        const contractsRes = await listContracts({ supplier_id: supplierId, status: 'ACTIVE', limit: 1 });
        const contract = contractsRes.data?.data?.[0];
        if (!contract) {
          setConfig([]);
          setContractId(null);
          setLoading(false);
          return;
        }
        setContractId(contract.id);
        const configRes = await getContractContaminationConfig(contract.id);
        const penalties = configRes.data?.data?.penalties || configRes.data?.penalties || [];
        setConfig(penalties);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load contamination configuration. Please try again.');
        setConfig([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [isOpen, supplierId]);

  if (!isOpen) return null;

  const selectedFee = config.find((c) => c.fee_type === form.contamination_type) || config[0];
  const rateType = selectedFee?.rate_type;

  const estimatedFee = (() => {
    if (!selectedFee) return null;
    let fee = 0;
    switch (selectedFee.rate_type) {
      case 'FIXED':
        fee = Number(selectedFee.rate_value);
        break;
      case 'PER_KG':
        fee = Number(form.weight || 0) * Number(selectedFee.rate_value);
        break;
      case 'PER_HOUR':
        fee = Number(form.hours || 0) * Number(selectedFee.rate_value);
        break;
      case 'PERCENTAGE':
        return null;
      default:
        return null;
    }
    if (selectedFee.min_cap != null) fee = Math.max(fee, Number(selectedFee.min_cap));
    if (selectedFee.max_cap != null) fee = Math.min(fee, Number(selectedFee.max_cap));
    return fee;
  })();

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.contamination_type) return toast.error(t('sorting:contamination.selectType'));
    if (!form.description.trim()) return toast.error(t('sorting:contamination.descriptionRequired'));

    setSubmitting(true);
    try {
      await recordContaminationIncident({
        order_id: orderId,
        sorting_session_id: sortingSessionId || null,
        contamination_type: form.contamination_type,
        description: form.description,
        contamination_weight_kg: form.weight ? Number(form.weight) : null,
        contamination_pct: form.pct ? Number(form.pct) : null,
        estimated_hours: form.hours ? Number(form.hours) : null,
        notes: form.notes || null,
      });
      toast.success(t('sorting:contamination.recorded'));
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to record incident');
    } finally {
      setSubmitting(false);
    }
  }

  const renderEmptyState = () => {
    if (error) {
      return (
        <div className="py-6 px-2">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
              <ShieldAlert size={24} className="text-red-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-grey-900 mb-1">{t('sorting:contamination.unableToLoad')}</p>
              <p className="text-sm text-grey-500">{error}</p>
            </div>
          </div>
          <div className="flex justify-end mt-6">
            <button onClick={onClose} className="px-4 py-2 rounded-md text-sm font-medium bg-white border border-grey-300 text-grey-700 hover:bg-grey-50 transition-colors">
              {t('sorting:contamination.close')}
            </button>
          </div>
        </div>
      );
    }

    if (!contractId) {
      return (
        <div className="py-6 px-2">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center">
              <Info size={24} className="text-orange-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-grey-900 mb-1">{t('sorting:contamination.noActiveContract')}</p>
              <p className="text-sm text-grey-500">{t('sorting:contamination.noActiveContractDesc')}</p>
            </div>
          </div>
          <div className="flex justify-end mt-6">
            <button onClick={onClose} className="px-4 py-2 rounded-md text-sm font-medium bg-white border border-grey-300 text-grey-700 hover:bg-grey-50 transition-colors">
              {t('sorting:contamination.close')}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="py-6 px-2">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-grey-100 flex items-center justify-center">
            <Info size={24} className="text-grey-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-grey-900 mb-1">{t('sorting:contamination.noPenalties')}</p>
            <p className="text-sm text-grey-500">{t('sorting:contamination.noPenaltiesDesc')}</p>
          </div>
        </div>
        <div className="flex justify-end mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-md text-sm font-medium bg-white border border-grey-300 text-grey-700 hover:bg-grey-50 transition-colors">
            {t('sorting:contamination.close')}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="app-modal-overlay">
      <div className="app-modal-panel max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between pb-4 border-b border-grey-200 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center">
              <AlertTriangle size={18} className="text-orange-600" />
            </div>
            <h2 className="text-lg font-semibold text-grey-900">{t('sorting:contamination.title')}</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-md flex items-center justify-center text-grey-400 hover:text-grey-600 hover:bg-grey-100 transition-colors">
            <span className="text-xl leading-none">&times;</span>
          </button>
        </div>

        {loading ? (
          <div className="py-10 text-center">
            <div className="inline-block w-6 h-6 border-2 border-grey-300 border-t-green-500 rounded-full animate-spin mb-3" />
            <p className="text-sm text-grey-500">{t('sorting:contamination.loadingConfig')}</p>
          </div>
        ) : (config.length === 0 || error || !contractId) ? (
          renderEmptyState()
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 overflow-y-auto">
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('sorting:contamination.contaminationType')}</label>
              <select name="contamination_type" value={form.contamination_type} onChange={handleChange} className={selectClass} required>
                <option value="">{t('sorting:contamination.selectType')}</option>
                {CONTAMINATION_TYPES.map((key) => (
                  <option key={key} value={key}>{t(`common:contaminationTypes.${key}`)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('sorting:contamination.description')}</label>
              <textarea name="description" value={form.description} onChange={handleChange} className={textareaClass} placeholder={t('sorting:contamination.descriptionPlaceholder')} required />
            </div>

            {rateType === 'PER_KG' && (
              <div>
                <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('sorting:contamination.weightKg')}</label>
                <input type="number" name="weight" value={form.weight} onChange={handleChange} className={inputClass} placeholder="0.00" step="0.01" min="0" />
              </div>
            )}

            {rateType === 'PERCENTAGE' && (
              <div>
                <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('sorting:contamination.percentage')}</label>
                <input type="number" name="pct" value={form.pct} onChange={handleChange} className={inputClass} placeholder="0.0" step="0.1" min="0" max="100" />
              </div>
            )}

            {rateType === 'PER_HOUR' && (
              <div>
                <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('sorting:contamination.hours')}</label>
                <input type="number" name="hours" value={form.hours} onChange={handleChange} className={inputClass} placeholder="0.0" step="0.5" min="0" />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('sorting:contamination.notesOptional')}</label>
              <textarea name="notes" value={form.notes} onChange={handleChange} className={textareaClass} placeholder={t('common:fields.notes')} />
            </div>

            {estimatedFee != null && (
              <div className="rounded-lg bg-orange-50 border border-orange-200 px-4 py-3 flex items-center gap-3">
                <AlertTriangle size={16} className="text-orange-500 shrink-0" />
                <p className="text-sm text-orange-800">
                  <span className="font-medium">{t('sorting:contamination.estimatedFee')}</span> {formatEUR(estimatedFee)}
                </p>
              </div>
            )}
            {rateType === 'PERCENTAGE' && (
              <div className="rounded-lg bg-grey-50 border border-grey-200 px-4 py-3 flex items-center gap-3">
                <Info size={16} className="text-grey-400 shrink-0" />
                <p className="text-sm text-grey-500">{t('sorting:contamination.feePercentageNote')}</p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-3 border-t border-grey-200 mt-1">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-md text-sm font-medium bg-white border border-grey-300 text-grey-700 hover:bg-grey-50 transition-colors">
                {t('sorting:contamination.cancel')}
              </button>
              <button type="submit" disabled={submitting} className="px-4 py-2 rounded-md text-sm font-medium bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 transition-colors">
                {submitting ? t('sorting:contamination.recording') : t('sorting:contamination.recordIncident')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
