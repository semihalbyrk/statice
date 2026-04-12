import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import EntityRoleFields from './EntityRoleFields';

const inputClass = 'w-full h-10 px-3.5 rounded-md border border-grey-300 text-sm text-grey-900 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors';
const selectClass = `${inputClass} bg-white`;
const labelClass = 'block text-sm font-medium text-grey-700 mb-1.5';

const COUNTRIES = [
  { code: 'NL', label: 'Netherlands' },
  { code: 'BE', label: 'Belgium' },
  { code: 'DE', label: 'Germany' },
  { code: 'FR', label: 'France' },
  { code: 'UK', label: 'United Kingdom' },
  { code: 'Other', label: 'Other' },
];

export default function EntityForm({ form, setForm, onSubmit, isEdit = false, loading = false }) {
  const { t } = useTranslation(['entities', 'common']);
  const navigate = useNavigate();
  const [roleError, setRoleError] = useState('');

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleRoleToggle(role) {
    setForm((prev) => {
      const toggled = !prev[role];
      const updates = { ...prev, [role]: toggled };

      // Clear role-specific fields when toggling off
      if (!toggled) {
        if (role === 'is_supplier') {
          updates.supplier_type = '';
          updates.supplier_roles = [];
          updates.pro_registration_number = '';
        }
        if (role === 'is_disposer') {
          updates.is_also_site = false;
        }
      }

      return updates;
    });
    setRoleError('');
  }

  function handleSubmit(e) {
    e.preventDefault();

    // Validate at least one role
    if (!form.is_supplier && !form.is_transporter && !form.is_disposer && !form.is_receiver) {
      setRoleError(t('entities:validation.atLeastOneRole'));
      return;
    }

    setRoleError('');
    onSubmit(e);
  }

  const kvkRequired = form.is_supplier || form.is_disposer;
  const vihbRequired = form.is_transporter;
  const permitRequired = form.is_disposer || form.is_receiver;

  return (
    <form onSubmit={handleSubmit}>
      {/* Section 1: Company Information */}
      <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-5 mb-6">
        <h2 className="text-sm font-semibold text-grey-900 mb-4">{t('entities:fields.companyName').replace(' Name', '')} Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <label className={labelClass}>
              {t('entities:fields.companyName')} <span className="text-red-500">*</span>
            </label>
            <input name="company_name" value={form.company_name} onChange={handleChange} required className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>
              {t('entities:fields.streetAndNumber')} <span className="text-red-500">*</span>
            </label>
            <input name="street_and_number" value={form.street_and_number} onChange={handleChange} required placeholder="e.g. De Oude Kooien 15" className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>
              {t('entities:fields.postalCode')} <span className="text-red-500">*</span>
            </label>
            <input name="postal_code" value={form.postal_code} onChange={handleChange} required placeholder="e.g. 5986 PJ" className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>
              {t('entities:fields.city')} <span className="text-red-500">*</span>
            </label>
            <input name="city" value={form.city} onChange={handleChange} required placeholder="e.g. Beringe" className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>
              {t('entities:fields.country')} <span className="text-red-500">*</span>
            </label>
            <select name="country" value={form.country} onChange={handleChange} required className={selectClass}>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>
              {t('entities:fields.kvkNumber')} {kvkRequired && <span className="text-red-500">*</span>}
            </label>
            <input name="kvk_number" value={form.kvk_number} onChange={handleChange} required={kvkRequired} className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>
              {t('entities:fields.btwNumber')}
            </label>
            <input name="btw_number" value={form.btw_number} onChange={handleChange} className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>
              {t('entities:fields.iban')}
            </label>
            <input name="iban" value={form.iban} onChange={handleChange} className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>
              {t('entities:fields.vihbNumber')} {vihbRequired && <span className="text-red-500">*</span>}
            </label>
            <input name="vihb_number" value={form.vihb_number} onChange={handleChange} required={vihbRequired} className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>
              {t('entities:fields.environmentalPermitNumber')} {permitRequired && <span className="text-red-500">*</span>}
            </label>
            <input name="environmental_permit_number" value={form.environmental_permit_number} onChange={handleChange} required={permitRequired} className={inputClass} />
          </div>
        </div>
      </div>

      {/* Section 2: Contact Information */}
      <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-5 mb-6">
        <h2 className="text-sm font-semibold text-grey-900 mb-4">Contact Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>{t('entities:fields.contactName')}</label>
            <input name="contact_name" value={form.contact_name} onChange={handleChange} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>{t('entities:fields.contactEmail')}</label>
            <input name="contact_email" type="email" value={form.contact_email} onChange={handleChange} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>{t('entities:fields.contactPhone')}</label>
            <input name="contact_phone" type="tel" value={form.contact_phone} onChange={handleChange} className={inputClass} />
          </div>
        </div>
      </div>

      {/* Section 3: Roles */}
      <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-5 mb-6">
        <h2 className="text-sm font-semibold text-grey-900 mb-4">Roles</h2>
        <div className="flex flex-wrap gap-6 mb-4">
          {['is_supplier', 'is_transporter', 'is_disposer', 'is_receiver'].map((role) => {
            const roleKey = role.replace('is_', '');
            return (
              <label key={role} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form[role]}
                  onChange={() => handleRoleToggle(role)}
                  className="rounded border-grey-300 text-green-500 focus:ring-green-500"
                />
                <span className="text-sm">{t(`entities:roles.${roleKey}`)}</span>
              </label>
            );
          })}
        </div>
        {roleError && (
          <p className="text-sm text-red-500 mb-4">{roleError}</p>
        )}

        {/* Role-specific sections */}
        <EntityRoleFields form={form} setForm={setForm} />
      </div>

      {/* Form Footer */}
      <div className="flex justify-end gap-3 pt-6 border-t border-grey-200">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="px-4 h-10 rounded-md border border-grey-300 text-sm text-grey-700 hover:bg-grey-50"
        >
          {t('common:buttons.cancel')}
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 h-10 rounded-md bg-green-500 text-sm text-white hover:bg-green-700 disabled:opacity-50"
        >
          {loading
            ? t('common:buttons.saving')
            : isEdit
              ? t('entities:editEntity')
              : t('entities:createEntity')
          }
        </button>
      </div>
    </form>
  );
}
