import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import RowActionMenu from '../../components/ui/RowActionMenu';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { listFees, createFee, updateFee, deleteFee } from '../../api/fees';

const RATE_TYPES = ['FIXED', 'PERCENTAGE', 'PER_KG', 'PER_HOUR'];

const inputClass = "w-full h-10 px-3.5 rounded-md border border-grey-300 text-sm text-grey-900 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors";
const selectClass = `${inputClass} bg-white`;

function FeeFormModal({ fee, onClose, onSuccess }) {
  const { t } = useTranslation(['admin', 'common']);
  const isEdit = !!fee;
  const [form, setForm] = useState({
    fee_type: fee?.fee_type || '',
    description: fee?.description || '',
    rate_type: fee?.rate_type || '',
    rate_value: fee?.rate_value ?? '',
    min_cap: fee?.min_cap ?? '',
    max_cap: fee?.max_cap ?? '',
  });
  const [submitting, setSubmitting] = useState(false);

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        rate_value: parseFloat(form.rate_value),
        min_cap: form.min_cap !== '' ? parseFloat(form.min_cap) : null,
        max_cap: form.max_cap !== '' ? parseFloat(form.max_cap) : null,
      };
      if (isEdit) {
        await updateFee(fee.id, payload);
        toast.success(t('fees.feeUpdated'));
      } else {
        await createFee(payload);
        toast.success(t('fees.feeCreated'));
      }
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.error || t('fees.failedSaveFee'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app-modal-overlay">
      <div className="app-modal-panel max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-grey-200 shrink-0">
          <h2 className="text-lg font-semibold text-grey-900">{isEdit ? t('fees.editFee') : t('fees.newFee')}</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-grey-50 transition-colors text-grey-400">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('fees.feeType')} <span className="text-red-500">*</span></label>
            <input name="fee_type" value={form.fee_type} onChange={handleChange} required placeholder={t('fees.feeTypePlaceholder')} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('fees.description')} <span className="text-red-500">*</span></label>
            <input name="description" value={form.description} onChange={handleChange} required className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('fees.rateType')} <span className="text-red-500">*</span></label>
            <select name="rate_type" value={form.rate_type} onChange={handleChange} required className={selectClass}>
              <option value="">{t('fees.selectRateType')}</option>
              {RATE_TYPES.map((rt) => (
                <option key={rt} value={rt}>{t(`common:rateTypes.${rt}`)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('fees.rateValue')} <span className="text-red-500">*</span></label>
            <input name="rate_value" type="number" step="0.01" value={form.rate_value} onChange={handleChange} required className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('fees.minCap')}</label>
              <input name="min_cap" type="number" step="0.01" value={form.min_cap} onChange={handleChange} placeholder={t('common:fields.optional')} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('fees.maxCap')}</label>
              <input name="max_cap" type="number" step="0.01" value={form.max_cap} onChange={handleChange} placeholder={t('common:fields.optional')} className={inputClass} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="h-9 px-4 bg-white text-grey-700 border border-grey-300 rounded-md text-sm font-semibold hover:bg-grey-50 transition-colors">{t('common:buttons.cancel')}</button>
            <button type="submit" disabled={submitting}
              className="h-9 px-4 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors">
              {submitting ? t('common:buttons.saving') : isEdit ? t('common:buttons.update') : t('common:buttons.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function FeeMasterPage() {
  const { t } = useTranslation(['admin', 'common']);
  const [fees, setFees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editFee, setEditFee] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await listFees({ search: search || undefined });
      setFees(data.data);
    } catch {
      toast.error(t('fees.failedLoadFees'));
    } finally {
      setLoading(false);
    }
  }, [search, t]);

  useEffect(() => {
    const timer = setTimeout(fetchData, 300);
    return () => clearTimeout(timer);
  }, [fetchData]);

  async function handleDelete(id) {
    if (!window.confirm(t('fees.deactivateConfirm'))) return;
    try {
      await deleteFee(id);
      toast.success(t('fees.feeDeactivated'));
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || t('fees.failedDeactivateFee'));
    }
  }

  function formatValue(fee) {
    if (fee.rate_type === 'PERCENTAGE') return `${fee.rate_value}%`;
    if (fee.rate_type === 'FIXED') return `\u20AC ${Number(fee.rate_value).toFixed(2)}`;
    if (fee.rate_type === 'PER_KG') return `\u20AC ${Number(fee.rate_value).toFixed(2)}/kg`;
    if (fee.rate_type === 'PER_HOUR') return `\u20AC ${Number(fee.rate_value).toFixed(2)}/hr`;
    return fee.rate_value;
  }

  function formatCap(val) {
    if (val == null) return '\u2014';
    return `\u20AC ${Number(val).toFixed(2)}`;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-grey-900">{t('fees.title')}</h1>
        <button onClick={() => { setEditFee(null); setShowModal(true); }}
          className="flex items-center gap-2 h-9 px-4 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-700 transition-colors">
          <Plus size={16} strokeWidth={2} /> {t('fees.addFee')}
        </button>
      </div>

      <div className="relative max-w-xs mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-grey-400" />
        <input type="text" placeholder={t('fees.searchPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 pl-9 pr-3 rounded-md border border-grey-300 text-sm text-grey-900 placeholder:text-grey-400 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors" />
      </div>

      <div className="bg-white rounded-lg border border-grey-200 shadow-sm overflow-visible">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-grey-50 border-b border-grey-200">
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('fees.feeType')}</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('fees.description')}</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('fees.rateType')}</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('fees.rateValue')}</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('fees.minCap')}</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('fees.maxCap')}</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('common:table.status')}</th>
              <th className="w-10 px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-grey-400">{t('common:table.loading')}</td></tr>
            ) : fees.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-grey-400">{t('fees.noFeesFound')}</td></tr>
            ) : fees.map((f) => (
              <tr key={f.id} className="border-b border-grey-100 hover:bg-grey-50 transition-colors">
                <td className="px-4 py-3 font-medium text-grey-900">{t(`common:feeTypes.${f.fee_type}`, { defaultValue: f.fee_type })}</td>
                <td className="px-4 py-3 text-grey-700 max-w-[200px] truncate">{f.description}</td>
                <td className="px-4 py-3 text-grey-700">{t(`common:rateTypes.${f.rate_type}`, { defaultValue: f.rate_type })}</td>
                <td className="px-4 py-3 text-right text-grey-900 font-medium">{formatValue(f)}</td>
                <td className="px-4 py-3 text-right text-grey-700">{formatCap(f.min_cap)}</td>
                <td className="px-4 py-3 text-right text-grey-700">{formatCap(f.max_cap)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${f.is_active ? 'bg-green-25 text-green-700 border-green-300' : 'bg-grey-100 text-grey-500 border-grey-300'}`}>
                    {f.is_active ? t('common:status.ACTIVE') : t('common:status.INACTIVE')}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <RowActionMenu actions={[
                    { label: t('common:buttons.edit'), icon: Pencil, onClick: () => { setEditFee(f); setShowModal(true); } },
                    ...(f.is_active ? [{ label: t('fees.deactivate'), icon: Trash2, onClick: () => handleDelete(f.id), variant: 'danger' }] : []),
                  ]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <FeeFormModal
          fee={editFee}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); fetchData(); }}
        />
      )}
    </div>
  );
}
