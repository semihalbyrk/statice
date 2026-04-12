import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';

const inputClass = 'w-full h-10 px-3.5 rounded-md border border-grey-300 text-sm text-grey-900 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors';
const selectClass = `${inputClass} bg-white`;
const labelClass = 'block text-sm font-medium text-grey-700 mb-1.5';

const SUPPLIER_TYPES = ['PRO', 'COMMERCIAL', 'AD_HOC'];
const SUPPLIER_ROLES = ['ONTDOENER', 'ONTVANGER', 'HANDELAAR', 'BEMIDDELAAR'];

export default function EntityRoleFields({ form, setForm }) {
  const { t } = useTranslation(['entities', 'common']);

  function handleSupplierRoleToggle(role) {
    setForm((prev) => {
      const roles = prev.supplier_roles.includes(role)
        ? prev.supplier_roles.filter((r) => r !== role)
        : [...prev.supplier_roles, role];
      return { ...prev, supplier_roles: roles };
    });
  }

  return (
    <>
      {/* Supplier Details */}
      {form.is_supplier && (
        <div className="bg-grey-50 rounded-lg p-4 space-y-4">
          <h4 className="text-sm font-medium text-grey-700">{t('entities:roles.supplier')} Details</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>
                {t('entities:fields.supplierType')} <span className="text-red-500">*</span>
              </label>
              <select
                value={form.supplier_type}
                onChange={(e) => setForm((prev) => ({
                  ...prev,
                  supplier_type: e.target.value,
                  pro_registration_number: e.target.value !== 'PRO' ? '' : prev.pro_registration_number,
                }))}
                className={selectClass}
              >
                <option value="">-- Select --</option>
                {SUPPLIER_TYPES.map((st) => (
                  <option key={st} value={st}>{t(`entities:supplierTypes.${st}`)}</option>
                ))}
              </select>
            </div>

            {form.supplier_type === 'PRO' && (
              <div>
                <label className={labelClass}>
                  {t('entities:fields.proRegistrationNumber')} <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.pro_registration_number}
                  onChange={(e) => setForm((prev) => ({ ...prev, pro_registration_number: e.target.value }))}
                  className={inputClass}
                />
              </div>
            )}
          </div>

          <div>
            <label className={labelClass}>
              {t('entities:fields.supplierRole')} <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-4">
              {SUPPLIER_ROLES.map((role) => (
                <label key={role} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.supplier_roles.includes(role)}
                    onChange={() => handleSupplierRoleToggle(role)}
                    className="rounded border-grey-300 text-green-500 focus:ring-green-500"
                  />
                  <span className="text-sm">{t(`entities:supplierRoles.${role}`)}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Disposer Details */}
      {form.is_disposer && (
        <div className="bg-grey-50 rounded-lg p-4 space-y-4">
          <h4 className="text-sm font-medium text-grey-700">{t('entities:roles.disposer')} Details</h4>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_also_site}
              onChange={(e) => setForm((prev) => ({ ...prev, is_also_site: e.target.checked }))}
              className="rounded border-grey-300 text-green-500 focus:ring-green-500"
            />
            <span className="text-sm">{t('entities:fields.isAlsoSite')}</span>
          </label>
          <p className="text-xs text-grey-500">{t('entities:disposerSites.isAlsoSiteNote')}</p>
        </div>
      )}

      {/* Transporter Details */}
      {form.is_transporter && (
        <div className="bg-grey-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-grey-700 mb-2">{t('entities:roles.transporter')} Details</h4>
          <div className="flex items-start gap-2 text-xs text-grey-500">
            <Info size={14} className="mt-0.5 flex-shrink-0" />
            <span>{t('entities:validation.vihbRequired')}</span>
          </div>
        </div>
      )}

      {/* Receiver Details */}
      {form.is_receiver && (
        <div className="bg-grey-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-grey-700 mb-2">{t('entities:roles.receiver')} Details</h4>
          <div className="flex items-start gap-2 text-xs text-grey-500">
            <Info size={14} className="mt-0.5 flex-shrink-0" />
            <span>{t('entities:validation.permitRequired')}</span>
          </div>
        </div>
      )}
    </>
  );
}
