import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getEntity, updateEntity } from '../../../api/entities';
import EntityForm from '../../../components/entities/EntityForm';
import Breadcrumb from '../../../components/ui/Breadcrumb';
import toast from 'react-hot-toast';

export default function EntityEditPage() {
  const { id } = useParams();
  const { t } = useTranslation(['entities', 'common']);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [loadingEntity, setLoadingEntity] = useState(true);
  const [form, setForm] = useState({
    company_name: '',
    street_and_number: '',
    postal_code: '',
    city: '',
    country: 'NL',
    kvk_number: '',
    btw_number: '',
    iban: '',
    vihb_number: '',
    environmental_permit_number: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    is_supplier: false,
    is_transporter: false,
    is_disposer: false,
    is_receiver: false,
    supplier_type: '',
    supplier_roles: [],
    pro_registration_number: '',
    is_also_site: false,
  });

  useEffect(() => {
    setLoadingEntity(true);
    getEntity(id)
      .then(({ data }) => {
        const e = data.data;
        setForm({
          company_name: e.company_name || '',
          street_and_number: e.street_and_number || '',
          postal_code: e.postal_code || '',
          city: e.city || '',
          country: e.country || 'NL',
          kvk_number: e.kvk_number || '',
          btw_number: e.btw_number || '',
          iban: e.iban || '',
          vihb_number: e.vihb_number || '',
          environmental_permit_number: e.environmental_permit_number || '',
          contact_name: e.contact_name || '',
          contact_email: e.contact_email || '',
          contact_phone: e.contact_phone || '',
          is_supplier: e.is_supplier || false,
          is_transporter: e.is_transporter || false,
          is_disposer: e.is_disposer || false,
          is_receiver: e.is_receiver || false,
          supplier_type: e.supplier_type || '',
          supplier_roles: e.supplier_roles || [],
          pro_registration_number: e.pro_registration_number || '',
          is_also_site: e.is_also_site || false,
        });
      })
      .catch(() => {
        toast.error(t('common:toast.failed', { action: 'load entity' }));
        navigate('/admin/entities');
      })
      .finally(() => setLoadingEntity(false));
  }, [id, navigate, t]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateEntity(id, form);
      toast.success(t('common:toast.updated', { entity: t('entities:title') }));
      navigate(`/admin/entities/${id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || t('common:toast.failed', { action: 'update' }));
    } finally {
      setLoading(false);
    }
  };

  if (loadingEntity) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="text-center py-12 text-grey-400">{t('common:buttons.loading')}</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Breadcrumb items={[
        { label: t('entities:title'), to: '/admin/entities' },
        { label: form.company_name || t('entities:editEntity'), to: `/admin/entities/${id}` },
        { label: t('entities:editEntity') },
      ]} />
      <h1 className="text-xl font-semibold text-grey-900 mb-6">{t('entities:editEntity')}</h1>
      <EntityForm form={form} setForm={setForm} onSubmit={handleSubmit} isEdit loading={loading} />
    </div>
  );
}
