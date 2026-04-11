import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { getContainers, createContainer, updateContainer, deleteContainer } from '../../api/containers';
import ClickableStatusBadge from '../../components/ui/ClickableStatusBadge';
import RowActionMenu from '../../components/ui/RowActionMenu';

const inputClass = "w-full h-10 px-3.5 rounded-md border border-grey-300 text-sm text-grey-900 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors";

const SKIP_TYPE_LABELS = {
  OPEN_TOP: 'Open Top',
  CLOSED_TOP: 'Closed Top',
  GITTERBOX: 'Gitterbox',
  PALLET: 'Pallet',
  OTHER: 'Other',
};

function ContainerFormModal({ container, onClose, onSuccess }) {
  const { t } = useTranslation(['admin', 'common']);
  const isEdit = !!container;
  const [form, setForm] = useState({
    container_label: container?.container_label || '',
    container_type: container?.container_type || '',
    tare_weight_kg: container?.tare_weight_kg ?? '',
    volume_m3: container?.volume_m3 ?? '',
    notes: container?.notes || '',
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
        container_label: form.container_label,
        container_type: form.container_type,
        tare_weight_kg: parseFloat(form.tare_weight_kg),
        volume_m3: form.volume_m3 !== '' ? parseFloat(form.volume_m3) : null,
        notes: form.notes || null,
      };
      if (isEdit) {
        await updateContainer(container.id, payload);
        toast.success(t('containers.containerUpdated'));
      } else {
        await createContainer(payload);
        toast.success(t('containers.containerCreated'));
      }
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.error || t('containers.failedSaveContainer'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app-modal-overlay">
      <div className="app-modal-panel max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-grey-200 shrink-0">
          <h2 className="text-lg font-semibold text-grey-900">
            {isEdit ? t('containers.editContainer') : t('containers.newContainer')}
          </h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-grey-50 transition-colors text-grey-400">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4 flex-1 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-grey-700 mb-1.5">
              {t('containers.containerLabel')} <span className="text-red-500">*</span>
            </label>
            <input
              name="container_label"
              value={form.container_label}
              onChange={handleChange}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-grey-700 mb-1.5">
              {t('containers.containerType')} <span className="text-red-500">*</span>
            </label>
            <select
              name="container_type"
              value={form.container_type}
              onChange={handleChange}
              required
              className={inputClass}
            >
              <option value="">{t('containers.selectType')}</option>
              {Object.entries(SKIP_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-grey-700 mb-1.5">
              {t('containers.tareWeight')} <span className="text-red-500">*</span>
            </label>
            <input
              name="tare_weight_kg"
              type="number"
              step="0.01"
              min="0"
              value={form.tare_weight_kg}
              onChange={handleChange}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-grey-700 mb-1.5">
              {t('containers.volume')}
            </label>
            <input
              name="volume_m3"
              type="number"
              step="0.01"
              min="0"
              value={form.volume_m3}
              onChange={handleChange}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-grey-700 mb-1.5">
              {t('containers.notes')}
            </label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={3}
              className="w-full px-3.5 py-2.5 rounded-md border border-grey-300 text-sm text-grey-900 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 bg-white text-grey-700 border border-grey-300 rounded-md text-sm font-semibold hover:bg-grey-50 transition-colors"
            >
              {t('common:buttons.cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-9 px-4 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? t('common:buttons.saving') : isEdit ? t('common:buttons.update') : t('common:buttons.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ContainerRegistryPage() {
  const { t } = useTranslation(['admin', 'common']);
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editContainer, setEditContainer] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getContainers({ limit: 100, search: search || undefined });
      setContainers(data.data);
    } catch {
      toast.error(t('containers.failedLoadContainers'));
    } finally {
      setLoading(false);
    }
  }, [search, t]);

  useEffect(() => {
    const timer = setTimeout(fetchData, 300);
    return () => clearTimeout(timer);
  }, [fetchData]);

  async function handleStatusTransition(containerId, newStatus) {
    const isActive = newStatus === 'ACTIVE';
    const container = containers.find((c) => c.id === containerId);
    if (!container) return;
    try {
      await updateContainer(containerId, { ...container, is_active: isActive });
      toast.success(isActive ? t('containers.containerActivated') : t('containers.containerDeactivated'));
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || t('containers.failedUpdateStatus'));
    }
  }

  async function handleDelete(container) {
    try {
      await deleteContainer(container.id);
      toast.success(t('containers.containerDeleted'));
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || t('containers.failedDeleteContainer'));
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-grey-900">{t('containers.title')}</h1>
        <button
          onClick={() => { setEditContainer(null); setShowModal(true); }}
          className="flex items-center gap-2 h-9 px-4 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-700 transition-colors"
        >
          <Plus size={16} strokeWidth={2} /> {t('containers.addContainer')}
        </button>
      </div>

      <div className="relative max-w-xs mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-grey-400" />
        <input
          type="text"
          placeholder={t('containers.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 pl-9 pr-3 rounded-md border border-grey-300 text-sm text-grey-900 placeholder:text-grey-400 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors"
        />
      </div>

      <div className="bg-white rounded-lg border border-grey-200 shadow-sm overflow-visible">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="bg-grey-50 border-b border-grey-200">
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('containers.containerLabel')}</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('common:table.status')}</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('containers.containerType')}</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('containers.tareWeight')}</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('containers.volume')}</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('containers.notes')}</th>
              <th className="w-10 px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-grey-400">{t('common:table.loading')}</td></tr>
            ) : containers.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-grey-400">{t('containers.noContainersFound')}</td></tr>
            ) : containers.map((c) => (
              <tr key={c.id} className="border-b border-grey-100 hover:bg-grey-50 transition-colors">
                <td className="px-4 py-3 font-medium text-grey-900">{c.container_label}</td>
                <td className="px-4 py-3">
                  <ClickableStatusBadge
                    status={c.is_active ? 'ACTIVE' : 'INACTIVE'}
                    allowedTransitions={c.is_active ? ['INACTIVE'] : ['ACTIVE']}
                    onTransition={(newStatus) => handleStatusTransition(c.id, newStatus)}
                  />
                </td>
                <td className="px-4 py-3 text-grey-700">{SKIP_TYPE_LABELS[c.container_type] || c.container_type}</td>
                <td className="px-4 py-3 text-right tabular-nums text-grey-700">
                  {c.tare_weight_kg != null ? `${Number(c.tare_weight_kg).toLocaleString()} kg` : '\u2014'}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-grey-700">
                  {c.volume_m3 != null ? `${Number(c.volume_m3).toLocaleString()} m\u00B3` : '\u2014'}
                </td>
                <td className="px-4 py-3 text-grey-700 max-w-[200px] truncate">
                  {c.notes || '\u2014'}
                </td>
                <td className="px-4 py-3">
                  <RowActionMenu actions={[
                    {
                      label: t('common:buttons.edit'),
                      icon: Pencil,
                      onClick: () => { setEditContainer(c); setShowModal(true); },
                    },
                    {
                      label: t('common:buttons.delete'),
                      icon: Trash2,
                      variant: 'danger',
                      onClick: () => handleDelete(c),
                    },
                  ]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <ContainerFormModal
          container={editContainer}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); fetchData(); }}
        />
      )}
    </div>
  );
}
