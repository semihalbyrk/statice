import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import Breadcrumb from '../../components/ui/Breadcrumb';
import { listMaterials } from '../../api/catalogue';
import { createOutgoingParcel } from '../../api/parcels';

const inputClass = 'w-full h-10 px-3.5 rounded-md border border-grey-300 text-sm text-grey-900 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors';
const textareaClass = 'w-full min-h-[110px] px-3.5 py-2.5 rounded-md border border-grey-300 text-sm text-grey-900 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors resize-y';

const containerTypes = ['OPEN_TOP', 'CLOSED_TOP', 'GITTERBOX', 'PALLET', 'OTHER'];

export default function OutgoingParcelCreatePage() {
  const navigate = useNavigate();
  const { t } = useTranslation(['outboundParcels', 'common']);
  const [materials, setMaterials] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    material_id: '',
    container_type: 'OPEN_TOP',
    volume_m3: '',
    tare_weight_kg: '',
    description: '',
    notes: '',
  });

  useEffect(() => {
    async function loadMaterials() {
      try {
        const { data } = await listMaterials({ active: true });
        setMaterials((data.data || []).filter((item) => item.is_active !== false));
      } catch (error) {
        toast.error(error.response?.data?.error || t('toast.loadFailed'));
      }
    }

    loadMaterials();
  }, [t]);

  const canSubmit = useMemo(() => form.material_id && form.container_type, [form]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSubmit) return;

    setSaving(true);
    try {
      const payload = {
        ...form,
        volume_m3: form.volume_m3 === '' ? undefined : Number(form.volume_m3),
        tare_weight_kg: form.tare_weight_kg === '' ? undefined : Number(form.tare_weight_kg),
      };

      const { data } = await createOutgoingParcel(payload);
      toast.success(t('toast.created'));
      navigate(`/parcels/outgoing/${data.data.id}`);
    } catch (error) {
      toast.error(error.response?.data?.error || t('toast.createFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Breadcrumb items={[
        { label: t('title'), to: '/parcels?tab=outgoing' },
        { label: t('createParcel') },
      ]} />

      <div className="mb-6">
        <h1 className="text-xl font-semibold text-grey-900">{t('createParcel')}</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-grey-200 shadow-sm p-5 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('fields.material')} *</label>
            <select
              value={form.material_id}
              onChange={(event) => setForm((current) => ({ ...current, material_id: event.target.value }))}
              className={inputClass}
              required
            >
              <option value="">{t('fields.material')}</option>
              {materials.map((material) => (
                <option key={material.id} value={material.id}>
                  {material.code} - {material.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('fields.containerType')} *</label>
            <select
              value={form.container_type}
              onChange={(event) => setForm((current) => ({ ...current, container_type: event.target.value }))}
              className={inputClass}
              required
            >
              {containerTypes.map((type) => (
                <option key={type} value={type}>
                  {t(`common:containerTypes.${type}`, { defaultValue: type })}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('fields.volumeM3')}</label>
            <input
              type="number"
              step="0.01"
              value={form.volume_m3}
              onChange={(event) => setForm((current) => ({ ...current, volume_m3: event.target.value }))}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('fields.estimatedWeightKg')}</label>
            <input
              type="number"
              step="0.01"
              value={form.tare_weight_kg}
              onChange={(event) => setForm((current) => ({ ...current, tare_weight_kg: event.target.value }))}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('fields.description')}</label>
          <input
            type="text"
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('fields.notes')}</label>
          <textarea
            value={form.notes}
            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            className={textareaClass}
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/parcels?tab=outgoing')}
            className="h-10 px-4 border border-grey-300 rounded-md text-sm font-semibold text-grey-700 hover:bg-grey-50 transition-colors"
          >
            {t('common:buttons.cancel')}
          </button>
          <button
            type="submit"
            disabled={!canSubmit || saving}
            className="h-10 px-4 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {saving ? t('common:buttons.creating') : t('createParcel')}
          </button>
        </div>
      </form>
    </div>
  );
}
