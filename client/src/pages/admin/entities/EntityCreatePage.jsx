import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { createEntity } from '../../../api/entities';
import EntityForm from '../../../components/entities/EntityForm';
import Breadcrumb from '../../../components/ui/Breadcrumb';
import toast from 'react-hot-toast';

const INITIAL_FORM = {
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
};

export default function EntityCreatePage() {
  const { t } = useTranslation(['entities', 'common']);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await createEntity(form);
      toast.success(t('common:toast.created', { entity: t('entities:title') }));
      navigate(`/admin/entities/${data.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || t('common:toast.failed', { action: 'create' }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Breadcrumb items={[
        { label: t('entities:title'), to: '/admin/entities' },
        { label: t('entities:createEntity') },
      ]} />
      <h1 className="text-xl font-semibold text-grey-900 mb-6">{t('entities:createEntity')}</h1>
      <EntityForm form={form} setForm={setForm} onSubmit={handleSubmit} loading={loading} />
    </div>
  );
}
