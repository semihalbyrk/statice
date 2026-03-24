import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Search } from 'lucide-react';
import RowActionMenu from '../../components/ui/RowActionMenu';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { getSuppliers, createSupplier, updateSupplier, toggleSupplierStatus } from '../../api/suppliers';
import ClickableStatusBadge from '../../components/ui/ClickableStatusBadge';
import SupplierTypeBadge from '../../components/ui/SupplierTypeBadge';

const SUPPLIER_TYPES = ['PRIVATE_INDIVIDUAL', 'PRO', 'THIRD_PARTY'];

const inputClass = "w-full h-10 px-3.5 rounded-md border border-grey-300 text-sm text-grey-900 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors";
const selectClass = `${inputClass} bg-white`;

function SupplierFormModal({ supplier, onClose, onSuccess }) {
  const { t } = useTranslation(['admin', 'common']);
  const isEdit = !!supplier;
  const [form, setForm] = useState({
    name: supplier?.name || '',
    supplier_type: supplier?.supplier_type || '',
    kvk_number: supplier?.kvk_number || '',
    contact_name: supplier?.contact_name || '',
    contact_email: supplier?.contact_email || '',
    contact_phone: supplier?.contact_phone || '',
    address: supplier?.address || '',
    btw_number: supplier?.btw_number || '',
    vihb_number: supplier?.vihb_number || '',
    pro_registration_number: supplier?.pro_registration_number || '',
  });
  const [submitting, setSubmitting] = useState(false);

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isEdit) {
        await updateSupplier(supplier.id, form);
        toast.success(t('suppliers.supplierUpdated'));
      } else {
        await createSupplier(form);
        toast.success(t('suppliers.supplierCreated'));
      }
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.error || t('suppliers.failedSaveSupplier'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app-modal-overlay">
      <div className="app-modal-panel max-w-md max-h-[90vh] flex flex-col">
        <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-grey-200">
          <h2 className="text-lg font-semibold text-grey-900">{isEdit ? t('suppliers.editSupplier') : t('suppliers.newSupplier')}</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-grey-50 transition-colors text-grey-400">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4 flex-1 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('suppliers.name')} <span className="text-red-500">*</span></label>
            <input name="name" value={form.name} onChange={handleChange} required className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('suppliers.type')} <span className="text-red-500">*</span></label>
            <select name="supplier_type" value={form.supplier_type} onChange={handleChange} required className={selectClass}>
              <option value="">{t('suppliers.selectType')}</option>
              {SUPPLIER_TYPES.map((st) => (
                <option key={st} value={st}>{t(`common:supplierTypes.${st}`)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('suppliers.kvkNumber')}</label>
            <input name="kvk_number" value={form.kvk_number} onChange={handleChange} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('suppliers.contactName')}</label>
            <input name="contact_name" value={form.contact_name} onChange={handleChange} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('suppliers.contactEmail')}</label>
            <input name="contact_email" type="email" value={form.contact_email} onChange={handleChange} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('suppliers.contactPhone')}</label>
            <input name="contact_phone" value={form.contact_phone} onChange={handleChange} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('suppliers.address')}</label>
            <input name="address" value={form.address} onChange={handleChange} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('suppliers.btwNumber')}</label>
            <input name="btw_number" value={form.btw_number} onChange={handleChange} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('suppliers.vihbNumber')}</label>
            <input name="vihb_number" value={form.vihb_number} onChange={handleChange} className={inputClass} />
          </div>
          {form.supplier_type === 'PRO' && (
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('suppliers.proRegistrationNumber')}</label>
              <input name="pro_registration_number" value={form.pro_registration_number} onChange={handleChange} className={inputClass} />
            </div>
          )}
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

export default function SuppliersPage() {
  const { t } = useTranslation(['admin', 'common']);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editSupplier, setEditSupplier] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getSuppliers({ limit: 100, search: search || undefined });
      setSuppliers(data.data);
    } catch {
      toast.error(t('suppliers.failedLoadSuppliers'));
    } finally {
      setLoading(false);
    }
  }, [search, t]);

  useEffect(() => {
    const timer = setTimeout(fetchData, 300);
    return () => clearTimeout(timer);
  }, [fetchData]);

  async function handleStatusTransition(supplierId, newStatus) {
    const isActive = newStatus === 'ACTIVE';
    try {
      await toggleSupplierStatus(supplierId, isActive);
      toast.success(isActive ? t('suppliers.supplierActivated') : t('suppliers.supplierDeactivated'));
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || t('suppliers.failedUpdateStatus'));
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-grey-900">{t('suppliers.title')}</h1>
        <button onClick={() => { setEditSupplier(null); setShowModal(true); }}
          className="flex items-center gap-2 h-9 px-4 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-700 transition-colors">
          <Plus size={16} strokeWidth={2} /> {t('suppliers.addSupplier')}
        </button>
      </div>

      <div className="relative max-w-xs mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-grey-400" />
        <input type="text" placeholder={t('suppliers.searchPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 pl-9 pr-3 rounded-md border border-grey-300 text-sm text-grey-900 placeholder:text-grey-400 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors" />
      </div>

      <div className="bg-white rounded-lg border border-grey-200 shadow-sm overflow-visible">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-grey-50 border-b border-grey-200">
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('suppliers.name')}</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('common:table.status')}</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('suppliers.type')}</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('suppliers.kvk')}</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('suppliers.contactName')}</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('suppliers.contactEmail')}</th>
              <th className="w-10 px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-grey-400">{t('common:table.loading')}</td></tr>
            ) : suppliers.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-grey-400">{t('suppliers.noSuppliersFound')}</td></tr>
            ) : suppliers.map((s) => (
              <tr key={s.id} className="border-b border-grey-100 hover:bg-grey-50 transition-colors">
                <td className="px-4 py-3 font-medium text-green-700">{s.name}</td>
                <td className="px-4 py-3">
                  <ClickableStatusBadge
                    status={s.is_active ? 'ACTIVE' : 'INACTIVE'}
                    allowedTransitions={s.is_active ? ['INACTIVE'] : ['ACTIVE']}
                    onTransition={(newStatus) => handleStatusTransition(s.id, newStatus)}
                  />
                </td>
                <td className="px-4 py-3"><SupplierTypeBadge type={s.supplier_type} /></td>
                <td className="px-4 py-3 text-grey-700">{s.kvk_number || '\u2014'}</td>
                <td className="px-4 py-3 text-grey-700">{s.contact_name || '\u2014'}</td>
                <td className="px-4 py-3 text-grey-700">{s.contact_email || '\u2014'}</td>
                <td className="px-4 py-3 text-right">
                  <RowActionMenu actions={[{ label: t('common:buttons.edit'), icon: Pencil, onClick: () => { setEditSupplier(s); setShowModal(true); } }]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <SupplierFormModal
          supplier={editSupplier}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); fetchData(); }}
        />
      )}
    </div>
  );
}
