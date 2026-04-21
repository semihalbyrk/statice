import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { toggleDisposerSiteStatus } from '../../api/entities';
import ClickableStatusBadge from '../ui/ClickableStatusBadge';
import RowActionMenu from '../ui/RowActionMenu';
import DisposerSiteForm from './DisposerSiteForm';

export default function DisposerSiteList({ entityId, sites = [], onRefresh }) {
  const { t } = useTranslation(['entities', 'common']);
  const [showForm, setShowForm] = useState(false);
  const [editingSite, setEditingSite] = useState(null);

  async function handleStatusToggle(siteId, newStatus) {
    try {
      await toggleDisposerSiteStatus(entityId, siteId);
      toast.success(
        newStatus === 'ACTIVE'
          ? t('entities:disposerSites.activated')
          : t('entities:disposerSites.deactivated'),
      );
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.error || t('entities:disposerSites.statusFailed'));
    }
  }

  function handleSaved() {
    setShowForm(false);
    setEditingSite(null);
    onRefresh();
  }

  function handleEditClick(site) {
    setEditingSite(site);
    setShowForm(true);
  }

  function handleCancel() {
    setShowForm(false);
    setEditingSite(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-grey-900">{t('entities:disposerSites.title')}</h3>
        {!showForm && (
          <button
            onClick={() => { setEditingSite(null); setShowForm(true); }}
            className="flex items-center gap-1.5 h-8 px-3 bg-green-500 text-white rounded-md text-xs font-semibold hover:bg-green-700 transition-colors"
          >
            <Plus size={14} /> {t('entities:disposerSites.addSite')}
          </button>
        )}
      </div>

      {showForm && (
        <DisposerSiteForm
          entityId={entityId}
          site={editingSite}
          onSaved={handleSaved}
          onCancel={handleCancel}
        />
      )}

      {sites.length === 0 ? (
        <p className="text-sm text-grey-400 text-center py-6">{t('entities:disposerSites.empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="bg-grey-50 border-b border-grey-200">
                <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('entities:disposerSites.siteName')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('common:table.status')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('entities:disposerSites.address')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('entities:country')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('entities:disposerSites.permitNumber')}</th>
                <th className="w-10 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {sites.map((site) => (
                <tr key={site.id} className="border-b border-grey-100 hover:bg-grey-50 transition-colors">
                  <td className="px-4 py-3 text-green-700 font-medium">{site.site_name}</td>
                  <td className="px-4 py-3">
                    <ClickableStatusBadge
                      status={site.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE'}
                      allowedTransitions={site.status === 'ACTIVE' ? ['INACTIVE'] : ['ACTIVE']}
                      onTransition={(newStatus) => handleStatusToggle(site.id, newStatus)}
                    />
                  </td>
                  <td className="px-4 py-3 text-grey-700">
                    {[site.street_and_number, site.city].filter(Boolean).join(', ') || '\u2014'}
                  </td>
                  <td className="px-4 py-3 text-grey-700">{site.country || '\u2014'}</td>
                  <td className="px-4 py-3 text-grey-700">{site.environmental_permit_number || '\u2014'}</td>
                  <td className="px-4 py-3 text-right">
                    <RowActionMenu actions={[
                      { label: t('common:buttons.edit'), icon: Pencil, onClick: () => handleEditClick(site) },
                    ]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
