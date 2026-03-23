import { useState } from 'react';
import toast from 'react-hot-toast';
import useMasterDataStore from '../../store/masterDataStore';
import { addRateLine, updateRateLine } from '../../api/contracts';

const PRICING_MODELS = ['WEIGHT', 'QUANTITY', 'WEIGHT_AND_QUANTITY'];
const PRICING_LABELS = { WEIGHT: 'Per Weight (kg)', QUANTITY: 'Per Quantity', WEIGHT_AND_QUANTITY: 'Per Weight and Quantity' };

const inputClass = "w-full h-10 px-3.5 rounded-md border border-grey-300 text-sm text-grey-900 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors";
const selectClass = `${inputClass} bg-white`;

export default function RateLineFormModal({ contractId, rateLine, contractWasteStreamId, contractDates, currency, onClose, onSuccess }) {
  const isEdit = !!rateLine;
  const materials = useMasterDataStore((s) => s.materials);
  const currencySymbol = currency === 'USD' ? '$' : currency === 'GBP' ? '\u00A3' : '\u20AC';

  const [form, setForm] = useState({
    material_id: rateLine?.material_id || rateLine?.material?.id || '',
    pricing_model: rateLine?.pricing_model || 'WEIGHT',
    unit_rate: rateLine?.unit_rate ?? '',
    weight_rate: '',
    quantity_rate: '',
    btw_rate: rateLine?.btw_rate ?? 21,
  });
  const [submitting, setSubmitting] = useState(false);

  const isCombo = form.pricing_model === 'WEIGHT_AND_QUANTITY';

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const baseDates = {
        valid_from: contractDates?.effective_date,
        valid_to: contractDates?.expiry_date || null,
      };
      const btwRate = parseFloat(form.btw_rate);

      if (isCombo && !isEdit) {
        // Create 2 separate rate lines
        await addRateLine(contractId, {
          material_id: form.material_id,
          pricing_model: 'WEIGHT',
          unit_rate: parseFloat(form.weight_rate),
          btw_rate: btwRate,
          contract_waste_stream_id: contractWasteStreamId || null,
          ...baseDates,
        });
        await addRateLine(contractId, {
          material_id: form.material_id,
          pricing_model: 'QUANTITY',
          unit_rate: parseFloat(form.quantity_rate),
          btw_rate: btwRate,
          contract_waste_stream_id: contractWasteStreamId || null,
          ...baseDates,
        });
        toast.success('2 rate lines added (Weight + Quantity)');
      } else {
        const payload = {
          material_id: form.material_id,
          pricing_model: form.pricing_model,
          unit_rate: parseFloat(form.unit_rate),
          btw_rate: btwRate,
          contract_waste_stream_id: contractWasteStreamId || null,
          ...baseDates,
        };
        if (isEdit) {
          await updateRateLine(rateLine.id, payload);
          toast.success('Rate line updated (previous version preserved)');
        } else {
          await addRateLine(contractId, payload);
          toast.success('Rate line added');
        }
      }
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save rate line');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app-modal-overlay">
      <div className="app-modal-panel max-w-md">
        <div className="flex items-center justify-between px-5 py-3 border-b border-grey-200">
          <h2 className="text-lg font-semibold text-grey-900">{isEdit ? 'Edit Rate Line' : 'Add Rate Line'}</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-grey-50 transition-colors text-grey-400">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-grey-700 mb-1.5">Material <span className="text-red-500">*</span></label>
            <select name="material_id" value={form.material_id} onChange={handleChange} required className={selectClass}>
              <option value="">Select material...</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-grey-700 mb-1.5">Pricing Model <span className="text-red-500">*</span></label>
            <select name="pricing_model" value={form.pricing_model} onChange={handleChange} required className={selectClass}
              disabled={isEdit}>
              {PRICING_MODELS.filter((p) => !isEdit || p !== 'WEIGHT_AND_QUANTITY').map((p) => (
                <option key={p} value={p}>{PRICING_LABELS[p]}</option>
              ))}
            </select>
          </div>
          {isCombo ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-grey-700 mb-1.5">Weight Rate ({currencySymbol}) <span className="text-red-500">*</span></label>
                <input name="weight_rate" type="number" step="0.01" min="0" value={form.weight_rate} onChange={handleChange} required className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-grey-700 mb-1.5">Quantity Rate ({currencySymbol}) <span className="text-red-500">*</span></label>
                <input name="quantity_rate" type="number" step="0.01" min="0" value={form.quantity_rate} onChange={handleChange} required className={inputClass} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-grey-700 mb-1.5">Unit Rate ({currencySymbol}) <span className="text-red-500">*</span></label>
                <input name="unit_rate" type="number" step="0.01" min="0" value={form.unit_rate} onChange={handleChange} required className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-grey-700 mb-1.5">BTW Rate (%)</label>
                <input name="btw_rate" type="number" step="0.01" min="0" value={form.btw_rate} onChange={handleChange} className={inputClass} />
              </div>
            </div>
          )}
          {isCombo && (
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">BTW Rate (%)</label>
              <input name="btw_rate" type="number" step="0.01" min="0" value={form.btw_rate} onChange={handleChange} className={inputClass} />
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="h-9 px-4 bg-white text-grey-700 border border-grey-300 rounded-md text-sm font-semibold hover:bg-grey-50 transition-colors">Cancel</button>
            <button type="submit" disabled={submitting}
              className="h-9 px-4 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors">
              {submitting ? 'Saving...' : isEdit ? 'Update' : isCombo ? 'Add Both' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
