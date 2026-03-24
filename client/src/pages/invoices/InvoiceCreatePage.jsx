import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Breadcrumb from '../../components/ui/Breadcrumb';
import StatusBadge from '../../components/ui/StatusBadge';
import useMasterDataStore from '../../store/masterDataStore';
import { generateSupplierInvoice, getCompletedOrdersForInvoicing } from '../../api/invoices';

const inputClass = 'w-full h-10 px-3.5 rounded-md border border-grey-300 text-sm text-grey-900 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors';
const selectClass = `${inputClass} bg-white`;

const formatDate = (dateStr) => {
  if (!dateStr) return '\u2014';
  const d = new Date(dateStr);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

const getOrderNetWeight = (order) => {
  if (!order.inbounds?.length) return '\u2014';
  const total = order.inbounds.reduce((sum, ib) => sum + Number(ib.net_weight_kg || 0), 0);
  return total > 0 ? `${total.toLocaleString('nl-NL', { maximumFractionDigits: 1 })} kg` : '\u2014';
};

export default function InvoiceCreatePage() {
  const navigate = useNavigate();
  const { suppliers, fetchSuppliers } = useMasterDataStore();

  const [supplierId, setSupplierId] = useState('');
  const [orders, setOrders] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const activeSuppliers = suppliers.filter((s) => s.is_active);

  // Fetch completed orders when supplier changes
  useEffect(() => {
    if (!supplierId) {
      setOrders([]);
      setSelectedIds(new Set());
      return;
    }
    setLoadingOrders(true);
    getCompletedOrdersForInvoicing(supplierId)
      .then((res) => setOrders(res.data.data || []))
      .catch(() => toast.error('Failed to load orders'))
      .finally(() => setLoadingOrders(false));
  }, [supplierId]);

  const toggleOrder = (orderId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === orders.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(orders.map((o) => o.id)));
  };

  const handleGenerate = async () => {
    if (selectedIds.size === 0) {
      toast.error('Select at least one order');
      return;
    }
    setGenerating(true);
    try {
      const res = await generateSupplierInvoice({ order_ids: Array.from(selectedIds) });
      toast.success('Invoice created');
      navigate(`/invoices/${res.data.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate invoice');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      <Breadcrumb items={[{ label: 'Invoices', to: '/invoices' }, { label: 'Create Invoice' }]} />
      <h1 className="text-xl font-semibold text-grey-900 mb-6">Create Invoice</h1>

      {/* Step 1: Select Supplier */}
      <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-5 mb-6">
        <h2 className="text-sm font-semibold text-grey-900 mb-4">Select Supplier</h2>
        <div className="max-w-md">
          <label className="block text-sm font-medium text-grey-700 mb-1.5">Supplier</label>
          {suppliers.length === 0 ? (
            <div className="text-sm text-grey-400 py-2">Loading...</div>
          ) : (
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className={selectClass}
            >
              <option value="">Select supplier...</option>
              {activeSuppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Step 2: Completed Orders */}
      {supplierId && (
        <div className="bg-white rounded-lg border border-grey-200 shadow-sm mb-6">
          <div className="px-5 py-4 border-b border-grey-200">
            <h2 className="text-sm font-semibold text-grey-900">Completed Orders</h2>
          </div>

          {loadingOrders ? (
            <div className="text-center py-12 text-sm text-grey-400">Loading orders...</div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12 text-sm text-grey-400">
              No completed orders found for this supplier.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-grey-200">
                    <th className="text-left py-3 px-5 w-10">
                      <input
                        type="checkbox"
                        checked={orders.length > 0 && selectedIds.size === orders.length}
                        onChange={toggleAll}
                        className="h-4 w-4 rounded border-grey-300 text-green-500 focus:ring-green-500/15"
                      />
                    </th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Order Number</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Planned Date</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Waste Stream</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Net Weight</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b border-grey-100 hover:bg-grey-25 transition-colors cursor-pointer"
                      onClick={() => toggleOrder(order.id)}
                    >
                      <td className="py-3 px-5">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(order.id)}
                          onChange={() => toggleOrder(order.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-4 w-4 rounded border-grey-300 text-green-500 focus:ring-green-500/15"
                        />
                      </td>
                      <td className="py-3 px-3 font-medium text-grey-900">{order.order_number}</td>
                      <td className="py-3 px-3 text-grey-600">{formatDate(order.planned_date)}</td>
                      <td className="py-3 px-3 text-grey-600">{order.waste_stream?.name || '\u2014'}</td>
                      <td className="py-3 px-3 text-grey-600">{getOrderNetWeight(order)}</td>
                      <td className="py-3 px-3">
                        <StatusBadge status={order.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Generate */}
      {supplierId && (
        <div className="flex items-center justify-end gap-3">
          {selectedIds.size > 0 && (
            <span className="text-sm text-grey-600 mr-auto">
              {selectedIds.size} {selectedIds.size === 1 ? 'order' : 'orders'} selected
            </span>
          )}
          <button
            type="button"
            onClick={() => navigate('/invoices')}
            className="h-9 px-4 bg-white text-grey-700 border border-grey-300 rounded-md text-sm font-semibold hover:bg-grey-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || selectedIds.size === 0}
            className="h-9 px-4 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {generating ? 'Generating...' : 'Generate Invoice'}
          </button>
        </div>
      )}
    </div>
  );
}
