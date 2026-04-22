import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { getEntity, toggleEntityStatus } from '../../../api/entities';
import ClickableStatusBadge from '../../../components/ui/ClickableStatusBadge';
import RowActionMenu from '../../../components/ui/RowActionMenu';
import DisposerSiteList from '../../../components/entities/DisposerSiteList';
import useAuthStore from '../../../store/authStore';
import { formatDate } from '../../../utils/formatDate';

const SUPPLIER_TYPE_LABELS = {
  PRO: 'PRO',
  COMMERCIAL: 'Commercial',
  AD_HOC: 'Ad-hoc',
};

export default function EntityDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation(['entities', 'common']);
  const userRole = useAuthStore((s) => s.user?.role);
  const canWrite = ['ADMIN'].includes(userRole);

  const [entity, setEntity] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchEntity = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getEntity(id);
      setEntity(data.data);
    } catch {
      toast.error(t('entities:loadFailed'));
      navigate('/admin/entities');
    } finally {
      setLoading(false);
    }
  }, [id, navigate, t]);

  useEffect(() => { fetchEntity(); }, [fetchEntity]);

  async function handleStatusTransition(newStatus) {
    try {
      await toggleEntityStatus(id);
      toast.success(
        newStatus === 'ACTIVE' ? t('entities:entityActivated') : t('entities:entityDeactivated'),
      );
      fetchEntity();
    } catch (err) {
      toast.error(err.response?.data?.error || t('entities:failedUpdateStatus'));
    }
  }

  if (loading) return <div className="text-center py-12 text-grey-400">{t('common:table.loading')}</div>;
  if (!entity) return null;

  const status = entity.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE';
  const contracts = [
    ...(entity.contracts_as_supplier || []).map((c) => ({ ...c, role: t('entities:roles.supplier') })),
    ...(entity.contracts_as_transporter || []).map((c) => ({ ...c, role: t('entities:roles.transporter') })),
  ];

  return (
    <div>
      {/* Breadcrumb + Header */}
      <div className="mb-6">
        <Link to="/admin/entities" className="inline-flex items-center gap-1.5 text-sm text-grey-500 hover:text-grey-700 mb-3">
          <ArrowLeft size={14} /> {t('entities:title')}
        </Link>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-grey-900">{entity.company_name}</h1>
            <ClickableStatusBadge
              status={status}
              allowedTransitions={canWrite ? (entity.status === 'ACTIVE' ? ['INACTIVE'] : ['ACTIVE']) : []}
              onTransition={handleStatusTransition}
            />
          </div>
          <div className="flex items-center gap-2">
            {canWrite && (
              <Link
                to={`/admin/entities/${id}/edit`}
                className="flex items-center gap-1.5 h-9 px-4 bg-white text-grey-700 border border-grey-300 rounded-md text-sm font-semibold hover:bg-grey-50 transition-colors"
              >
                <Pencil size={14} /> {t('common:buttons.edit')}
              </Link>
            )}
            {canWrite && (
              <RowActionMenu actions={[
                {
                  label: t('common:buttons.edit'),
                  icon: Pencil,
                  onClick: () => navigate(`/admin/entities/${id}/edit`),
                },
                {
                  label: entity.status === 'ACTIVE' ? t('entities:deactivate') : t('entities:activate'),
                  onClick: () => handleStatusTransition(entity.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'),
                },
              ]} />
            )}
          </div>
        </div>
      </div>

      {/* Info Grid */}
      <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-5 mb-6">
        <h2 className="text-sm font-semibold text-grey-900 mb-4">{t('entities:detail.companyInfo')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-y-4 gap-x-6 text-sm">
          <Field label={t('entities:fields.streetAndNumber')} value={entity.street_and_number} />
          <Field label={t('entities:fields.postalCode') + ' + ' + t('entities:fields.city')} value={[entity.postal_code, entity.city].filter(Boolean).join(' ')} />
          <Field label={t('entities:fields.country')} value={entity.country} />
          <Field label={t('entities:fields.kvkNumber')} value={entity.kvk_number} />
          <Field label={t('entities:fields.btwNumber')} value={entity.btw_number} />
          <Field label={t('entities:fields.iban')} value={entity.iban} />
          <Field label={t('entities:fields.vihbNumber')} value={entity.vihb_number} />
          <Field label={t('entities:fields.environmentalPermitNumber')} value={entity.environmental_permit_number} />
          <Field label={t('entities:fields.contactName')} value={entity.contact_name} />
          <Field label={t('entities:fields.contactEmail')} value={entity.contact_email} />
          <Field label={t('entities:fields.contactPhone')} value={entity.contact_phone} />
        </div>
      </div>

      {/* Roles */}
      <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-5 mb-6">
        <h2 className="text-sm font-semibold text-grey-900 mb-3">{t('entities:roles.label')}</h2>
        <div className="flex gap-2">
          {entity.is_supplier && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{t('entities:roles.supplier')}</span>}
          {entity.is_transporter && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">{t('entities:roles.transporter')}</span>}
          {entity.is_disposer && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">{t('entities:roles.disposer')}</span>}
          {entity.is_receiver && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">{t('entities:roles.receiver')}</span>}
        </div>
      </div>

      {/* Supplier Info (conditional) */}
      {entity.is_supplier && (
        <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-5 mb-6">
          <h2 className="text-sm font-semibold text-grey-900 mb-4">{t('entities:detail.supplierInfo')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-y-4 gap-x-6 text-sm">
            <Field label={t('entities:detail.supplierType')} value={SUPPLIER_TYPE_LABELS[entity.supplier_type] || entity.supplier_type} />
            <Field label={t('entities:detail.proRegistration')} value={entity.pro_registration_number} />
            <div className="col-span-2">
              <p className="text-grey-500 mb-1">{t('entities:detail.supplierRoles')}</p>
              <div className="flex gap-2 flex-wrap">
                {(entity.supplier_roles || []).length > 0
                  ? entity.supplier_roles.map((role) => (
                      <span key={role} className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        {t(`entities:supplierRoles.${role}`, role)}
                      </span>
                    ))
                  : <span className="text-grey-900">{'\u2014'}</span>
                }
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Disposer Section (conditional) */}
      {entity.is_disposer && (
        <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-5 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-sm font-semibold text-grey-900">{t('entities:detail.disposerInfo')}</h2>
          </div>
          <DisposerSiteList
            entityId={entity.id}
            sites={entity.disposer_sites || []}
            onRefresh={fetchEntity}
          />
        </div>
      )}

      {/* Contracts */}
      <div className="bg-white rounded-lg border border-grey-200 shadow-sm mb-6">
        <div className="px-5 py-3 border-b border-grey-200">
          <h2 className="text-sm font-semibold text-grey-900">{t('entities:detail.contracts')}</h2>
        </div>
        {contracts.length === 0 ? (
          <p className="text-sm text-grey-400 text-center py-6">{t('entities:detail.noContracts')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-grey-50 border-b border-grey-200">
                  <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('entities:detail.contractNumber')}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('entities:detail.contractName')}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('common:table.status')}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('entities:detail.effectiveDate')}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('entities:detail.contractRole')}</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((c) => (
                  <tr key={c.id} className="border-b border-grey-100 hover:bg-grey-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link to={`/contracts/${c.id}`} className="font-medium text-green-700 hover:underline">
                        {c.contract_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-grey-900">{c.name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        c.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                        c.status === 'DRAFT' ? 'bg-grey-100 text-grey-700' :
                        c.status === 'EXPIRED' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-grey-700">{formatDate(c.effective_date)}</td>
                    <td className="px-4 py-3 text-grey-700">{c.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-grey-500 mb-0.5">{label}</p>
      <p className="text-grey-900 font-medium">{value || '\u2014'}</p>
    </div>
  );
}
