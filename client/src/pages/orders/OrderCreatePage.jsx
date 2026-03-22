import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Breadcrumb from '../../components/ui/Breadcrumb';
import OrderFormModal from '../../components/orders/OrderFormModal';
import useMasterDataStore from '../../store/masterDataStore';

export default function OrderCreatePage() {
  const navigate = useNavigate();
  const { carriers, suppliers, wasteStreams, loadAll } = useMasterDataStore();

  useEffect(() => {
    if (carriers.length === 0 || suppliers.length === 0 || wasteStreams.length === 0) {
      loadAll();
    }
  }, [carriers.length, suppliers.length, wasteStreams.length, loadAll]);

  return (
    <div>
      <Breadcrumb items={[{ label: 'Orders', to: '/orders' }, { label: 'New Order' }]} />
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-grey-900">New Order</h1>
        <p className="mt-1 text-sm text-grey-500">The creation flow now uses the shared multi-stream order form.</p>
      </div>
      <OrderFormModal
        onClose={() => navigate('/orders')}
        onSuccess={() => navigate('/orders')}
      />
    </div>
  );
}
