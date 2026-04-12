import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { createDisposerSite, updateDisposerSite } from '../../api/entities';

const inputClass = 'w-full h-10 px-3.5 rounded-md border border-grey-300 text-sm text-grey-900 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors';
const selectClass = `${inputClass} bg-white`;
const labelClass = 'block text-sm font-medium text-grey-700 mb-1.5';

const COUNTRIES = [
  { code: 'NL', label: 'Netherlands' },
  { code: 'BE', label: 'Belgium' },
  { code: 'DE', label: 'Germany' },
  { code: 'FR', label: 'France' },
  { code: 'UK', label: 'United Kingdom' },
];

const EMPTY_FORM = {
  site_name: '',
  street_and_number: '',
  postal_code: '',
  city: '',
  country: 'NL',
  environmental_permit_number: '',
};

export default function DisposerSiteForm({ entityId, site = null, onSaved, onCancel }) {
  const { t } = useTranslation(['entities', 'common']);
  const isEdit = !!site;
  const [form, setForm] = useState(
    site
      ? {
          site_name: site.site_name || '',
          street_and_number: site.street_and_number || '',
          postal_code: site.postal_code || '',
          city: site.city || '',
          country: site.country || 'NL',
          environmental_permit_number: site.environmental_permit_number || '',
        }
      : { ...EMPTY_FORM },
  );
  const [saving, setSaving] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit) {
        await updateDisposerSite(entityId, site.id, form);
        toast.success(t('entities:disposerSites.updated'));
      } else {
        await createDisposerSite(entityId, form);
        toast.success(t('entities:disposerSites.created'));
      }
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.error || t('entities:disposerSites.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-grey-50 border border-grey-200 rounded-lg p-4 mb-4">
      <h3 className="text-sm font-semibold text-grey-900 mb-3">
        {isEdit ? t('entities:disposerSites.editSite') : t('entities:disposerSites.addSite')}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className={labelClass}>
            {t('entities:disposerSites.siteName')} <span className="text-red-500">*</span>
          </label>
          <input name="site_name" value={form.site_name} onChange={handleChange} required className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>
            {t('entities:fields.streetAndNumber')} <span className="text-red-500">*</span>
          </label>
          <input name="street_and_number" value={form.street_and_number} onChange={handleChange} required className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>
            {t('entities:fields.postalCode')} <span className="text-red-500">*</span>
          </label>
          <input name="postal_code" value={form.postal_code} onChange={handleChange} required className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>
            {t('entities:fields.city')} <span className="text-red-500">*</span>
          </label>
          <input name="city" value={form.city} onChange={handleChange} required className={inputClass} />
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
            {t('entities:fields.environmentalPermitNumber')} <span className="text-red-500">*</span>
          </label>
          <input name="environmental_permit_number" value={form.environmental_permit_number} onChange={handleChange} required className={inputClass} />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 h-9 rounded-md border border-grey-300 text-sm text-grey-700 hover:bg-grey-100 transition-colors"
        >
          {t('common:buttons.cancel')}
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 h-9 rounded-md bg-green-500 text-sm text-white font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {saving ? t('common:buttons.saving') : t('common:buttons.save')}
        </button>
      </div>
    </form>
  );
}
