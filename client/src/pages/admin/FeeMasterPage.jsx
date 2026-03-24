import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import RowActionMenu from '../../components/ui/RowActionMenu';
import toast from 'react-hot-toast';
import { listFees, createFee, updateFee, deleteFee } from '../../api/fees';

const RATE_TYPES = ['FIXED', 'PERCENTAGE', 'PER_KG', 'PER_HOUR'];
const RATE_TYPE_LABELS = { FIXED: 'Fixed', PERCENTAGE: 'Percentage', PER_KG: 'Per kg', PER_HOUR: 'Per hour' };
const FEE_TYPE_LABELS = {
  CONTAMINATION_SURCHARGE: 'Contamination Surcharge',
  CONTAMINATION_FLAT: 'Contamination Flat Fee',
  CONTAMINATION_PERCENTAGE: 'Contamination Percentage',
  SORTING_SURCHARGE: 'Sorting Surcharge',
  HAZARDOUS_MATERIAL: 'Hazardous Material',
  REJECTION_FEE: 'Rejection Fee',
};

const inputClass = "w-full h-10 px-3.5 rounded-md border border-grey-300 text-sm text-grey-900 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors";
const selectClass = `${inputClass} bg-white`;

function FeeFormModal({ fee, onClose, onSuccess }) {
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
        toast.success('Fee updated');
      } else {
        await createFee(payload);
        toast.success('Fee created');
      }
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save fee');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app-modal-overlay">
      <div className="app-modal-panel max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-grey-200 shrink-0">
          <h2 className="text-lg font-semibold text-grey-900">{isEdit ? 'Edit Fee' : 'New Fee'}</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-grey-50 transition-colors text-grey-400">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-grey-700 mb-1.5">Fee Type <span className="text-red-500">*</span></label>
            <input name="fee_type" value={form.fee_type} onChange={handleChange} required placeholder="e.g. CONTAMINATION_SURCHARGE" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-grey-700 mb-1.5">Description <span className="text-red-500">*</span></label>
            <input name="description" value={form.description} onChange={handleChange} required className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-grey-700 mb-1.5">Rate Type <span className="text-red-500">*</span></label>
            <select name="rate_type" value={form.rate_type} onChange={handleChange} required className={selectClass}>
              <option value="">Select rate type...</option>
              {RATE_TYPES.map((t) => (
                <option key={t} value={t}>{RATE_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-grey-700 mb-1.5">Rate Value <span className="text-red-500">*</span></label>
            <input name="rate_value" type="number" step="0.01" value={form.rate_value} onChange={handleChange} required className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">Min Cap</label>
              <input name="min_cap" type="number" step="0.01" value={form.min_cap} onChange={handleChange} placeholder="Optional" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">Max Cap</label>
              <input name="max_cap" type="number" step="0.01" value={form.max_cap} onChange={handleChange} placeholder="Optional" className={inputClass} />
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

export default function FeeMasterPage() {
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
      toast.error('Failed to load fees');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(fetchData, 300);
    return () => clearTimeout(timer);
  }, [fetchData]);

  async function handleDelete(id) {
    if (!window.confirm('Deactivate this fee?')) return;
    try {
      await deleteFee(id);
      toast.success('Fee deactivated');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to deactivate fee');
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
        <h1 className="text-xl font-semibold text-grey-900">Fee Master</h1>
        <button onClick={() => { setEditFee(null); setShowModal(true); }}
          className="flex items-center gap-2 h-9 px-4 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-700 transition-colors">
          <Plus size={16} strokeWidth={2} /> Add Fee
        </button>
      </div>

      <div className="relative max-w-xs mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-grey-400" />
        <input type="text" placeholder="Search fees..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 pl-9 pr-3 rounded-md border border-grey-300 text-sm text-grey-900 placeholder:text-grey-400 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors" />
      </div>

      <div className="bg-white rounded-lg border border-grey-200 shadow-sm overflow-visible">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-grey-50 border-b border-grey-200">
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Fee Type</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Description</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Rate Type</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Rate Value</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Min Cap</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Max Cap</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Status</th>
              <th className="w-10 px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-grey-400">Loading...</td></tr>
            ) : fees.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-grey-400">No fees found</td></tr>
            ) : fees.map((f) => (
              <tr key={f.id} className="border-b border-grey-100 hover:bg-grey-50 transition-colors">
                <td className="px-4 py-3 font-medium text-grey-900">{FEE_TYPE_LABELS[f.fee_type] || f.fee_type}</td>
                <td className="px-4 py-3 text-grey-700 max-w-[200px] truncate">{f.description}</td>
                <td className="px-4 py-3 text-grey-700">{RATE_TYPE_LABELS[f.rate_type] || f.rate_type}</td>
                <td className="px-4 py-3 text-right text-grey-900 font-medium">{formatValue(f)}</td>
                <td className="px-4 py-3 text-right text-grey-700">{formatCap(f.min_cap)}</td>
                <td className="px-4 py-3 text-right text-grey-700">{formatCap(f.max_cap)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${f.is_active ? 'bg-green-25 text-green-700 border-green-300' : 'bg-grey-100 text-grey-500 border-grey-300'}`}>
                    {f.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <RowActionMenu actions={[
                    { label: 'Edit', icon: Pencil, onClick: () => { setEditFee(f); setShowModal(true); } },
                    ...(f.is_active ? [{ label: 'Deactivate', icon: Trash2, onClick: () => handleDelete(f.id), variant: 'danger' }] : []),
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
