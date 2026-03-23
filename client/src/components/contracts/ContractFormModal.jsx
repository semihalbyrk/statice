import { useState } from 'react';
import toast from 'react-hot-toast';
import useMasterDataStore from '../../store/masterDataStore';
import { createContract, updateContract } from '../../api/contracts';

const INVOICING_FREQUENCIES = ['PER_ORDER', 'WEEKLY', 'MONTHLY', 'QUARTERLY'];
const FREQ_LABELS = { PER_ORDER: 'Per Order', WEEKLY: 'Weekly', MONTHLY: 'Monthly', QUARTERLY: 'Quarterly' };

const CURRENCIES = [
  { code: 'EUR', symbol: '\u20AC', label: 'EUR (\u20AC)' },
  { code: 'USD', symbol: '$', label: 'USD ($)' },
  { code: 'GBP', symbol: '\u00A3', label: 'GBP (\u00A3)' },
];

const inputClass = "w-full h-10 px-3.5 rounded-md border border-grey-300 text-sm text-grey-900 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors";
const selectClass = `${inputClass} bg-white`;

export default function ContractFormModal({ contract, onClose, onSuccess }) {
  const isEdit = !!contract;
  const suppliers = useMasterDataStore((s) => s.suppliers);

  const [form, setForm] = useState({
    supplier_id: contract?.supplier_id || contract?.supplier?.id || '',
    name: contract?.name || '',
    effective_date: contract?.effective_date ? contract.effective_date.slice(0, 10) : '',
    expiry_date: contract?.expiry_date ? contract.expiry_date.slice(0, 10) : '',
    payment_term_days: contract?.payment_term_days ?? 30,
    invoicing_frequency: contract?.invoicing_frequency || 'MONTHLY',
    currency: contract?.currency || 'EUR',
    invoice_delivery_method: contract?.invoice_delivery_method || '',
    contamination_tolerance_pct: contract?.contamination_tolerance_pct ?? 0,
    requires_finance_review: contract?.requires_finance_review ?? false,
  });
  const [submitting, setSubmitting] = useState(false);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        payment_term_days: parseInt(form.payment_term_days, 10),
        contamination_tolerance_pct: parseFloat(form.contamination_tolerance_pct),
        invoice_delivery_method: form.invoice_delivery_method || null,
        expiry_date: form.expiry_date || null,
      };
      if (isEdit) {
        await updateContract(contract.id, payload);
        toast.success('Contract updated');
      } else {
        await createContract(payload);
        toast.success('Contract created');
      }
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save contract');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app-modal-overlay">
      <div className="app-modal-panel max-w-lg">
        <div className="flex items-center justify-between px-5 py-3 border-b border-grey-200">
          <h2 className="text-lg font-semibold text-grey-900">{isEdit ? 'Edit Contract' : 'New Contract'}</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-grey-50 transition-colors text-grey-400">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Basic Info */}
          <div>
            <label className="block text-sm font-medium text-grey-700 mb-1.5">Supplier <span className="text-red-500">*</span></label>
            <select name="supplier_id" value={form.supplier_id} onChange={handleChange} required disabled={isEdit} className={selectClass}>
              <option value="">Select supplier...</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-grey-700 mb-1.5">Contract Name <span className="text-red-500">*</span></label>
            <input name="name" value={form.name} onChange={handleChange} required placeholder="e.g. 2026 WEEE Processing Agreement" className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">Effective Date <span className="text-red-500">*</span></label>
              <input name="effective_date" type="date" value={form.effective_date} onChange={handleChange} required className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">Expiry Date</label>
              <input name="expiry_date" type="date" value={form.expiry_date} onChange={handleChange} className={inputClass} />
            </div>
          </div>

          {/* Payment Terms */}
          <div className="border-t border-grey-200 pt-4">
            <p className="text-sm font-semibold text-grey-900 mb-3">Payment Terms</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-grey-700 mb-1.5">Payment Term (days)</label>
                <input name="payment_term_days" type="number" min="0" value={form.payment_term_days} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-grey-700 mb-1.5">Invoicing Frequency</label>
                <select name="invoicing_frequency" value={form.invoicing_frequency} onChange={handleChange} className={selectClass}>
                  {INVOICING_FREQUENCIES.map((f) => (
                    <option key={f} value={f}>{FREQ_LABELS[f]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-grey-700 mb-1.5">Currency</label>
                <select name="currency" value={form.currency} onChange={handleChange} className={selectClass}>
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-grey-700 mb-1.5">Invoice Delivery</label>
                <input name="invoice_delivery_method" value={form.invoice_delivery_method} onChange={handleChange} placeholder="e.g. EMAIL" className={inputClass} />
              </div>
            </div>
          </div>

          {/* Contamination */}
          <div className="border-t border-grey-200 pt-4">
            <p className="text-sm font-semibold text-grey-900 mb-3">Contamination</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-grey-700 mb-1.5">Tolerance (%)</label>
                <input name="contamination_tolerance_pct" type="number" step="0.1" min="0" max="100" value={form.contamination_tolerance_pct} onChange={handleChange} className={inputClass} />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-sm text-grey-700 cursor-pointer">
                  <input name="requires_finance_review" type="checkbox" checked={form.requires_finance_review} onChange={handleChange}
                    className="h-4 w-4 rounded border-grey-300 text-green-500 focus:ring-green-500/15" />
                  Requires finance review
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="h-9 px-4 bg-white text-grey-700 border border-grey-300 rounded-md text-sm font-semibold hover:bg-grey-50 transition-colors">Cancel</button>
            <button type="submit" disabled={submitting}
              className="h-9 px-4 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors">
              {submitting ? 'Saving...' : isEdit ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
