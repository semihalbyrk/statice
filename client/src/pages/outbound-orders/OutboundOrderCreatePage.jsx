import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import Breadcrumb from '../../components/ui/Breadcrumb';
import useMasterDataStore from '../../store/masterDataStore';
import { createOutboundOrder } from '../../api/outboundOrders';
import { listContracts } from '../../api/contracts';

const inputClass = 'w-full h-10 px-3.5 rounded-md border border-grey-300 text-sm text-grey-900 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors';
const selectClass = `${inputClass} bg-white`;
const readOnlyClass = 'w-full h-10 px-3.5 rounded-md border border-grey-200 bg-grey-50 text-sm text-grey-600 cursor-not-allowed';

const SHIPMENT_COLORS = {
  DOMESTIC_NL: 'bg-blue-50 text-blue-700 border-blue-200',
  EU_CROSS_BORDER: 'bg-purple-50 text-purple-700 border-purple-200',
};
const SHIPMENT_LABELS = { DOMESTIC_NL: 'Domestic NL', EU_CROSS_BORDER: 'EU Cross-Border' };

export default function OutboundOrderCreatePage() {
  const navigate = useNavigate();
  const { t } = useTranslation(['outboundOrders', 'common']);
  const { entities, loadAll } = useMasterDataStore();
  const transporterEntities = useMasterDataStore((s) => s.getTransporterEntities());

  const [contracts, setContracts] = useState([]);
  const [contractsLoading, setContractsLoading] = useState(false);
  const [selectedContract, setSelectedContract] = useState(null);
  const [useOutsourced, setUseOutsourced] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    buyer_id: '',
    contract_id: '',
    outsourced_transporter_id: '',
    vehicle_plate: '',
    planned_date: '',
    time_window_start: '',
    time_window_end: '',
    expected_outbound_count: 1,
    notes: '',
  });

  const [wasteStreamRows, setWasteStreamRows] = useState([]);

  useEffect(() => {
    if (entities.length === 0) loadAll();
  }, [entities.length, loadAll]);

  // Fetch outgoing active contracts
  useEffect(() => {
    let cancelled = false;
    setContractsLoading(true);
    listContracts({ contract_type: 'OUTGOING', status: 'ACTIVE', limit: 200 })
      .then(({ data }) => {
        if (!cancelled) setContracts(data.data || []);
      })
      .catch(() => {
        if (!cancelled) setContracts([]);
      })
      .finally(() => {
        if (!cancelled) setContractsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const buyerOptions = contracts
    .filter((contract) => contract.buyer?.id)
    .reduce((acc, contract) => {
      if (!acc.some((buyer) => buyer.id === contract.buyer.id)) {
        acc.push(contract.buyer);
      }
      return acc;
    }, []);

  const filteredContracts = form.buyer_id
    ? contracts.filter((contract) => contract.buyer?.id === form.buyer_id)
    : [];

  // When contract changes, auto-fill fields and waste streams
  useEffect(() => {
    if (!form.contract_id) {
      setSelectedContract(null);
      setWasteStreamRows([]);
      return;
    }
    const contract = contracts.find((c) => c.id === form.contract_id);
    setSelectedContract(contract || null);

    if (contract?.buyer?.id && contract.buyer.id !== form.buyer_id) {
      setForm((prev) => ({ ...prev, buyer_id: contract.buyer.id }));
    }

    if (contract?.contract_waste_streams) {
      setWasteStreamRows(
        contract.contract_waste_streams.map((cws) => ({
          id: cws.id,
          waste_stream_name: cws.waste_stream?.name || '\u2014',
          receiver_name: cws.receiver?.company_name || '\u2014',
          asn: cws.afvalstroomnummer || '\u2014',
          material_name: cws.rate_lines?.[0]?.material?.name || '\u2014',
          processing_method: cws.rate_lines?.[0]?.processing_method || '\u2014',
          planned_amount_kg: '',
          waste_stream_id: cws.waste_stream_id,
          contract_waste_stream_id: cws.id,
        }))
      );
    } else {
      setWasteStreamRows([]);
    }
  }, [form.contract_id, form.buyer_id, contracts]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => {
      if (name === 'buyer_id') {
        return {
          ...prev,
          buyer_id: value,
          contract_id: '',
        };
      }
      return { ...prev, [name]: value };
    });
  }

  function handleWasteStreamAmountChange(index, value) {
    setWasteStreamRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], planned_amount_kg: value };
      return next;
    });
  }

  function removeWasteStreamRow(index) {
    setWasteStreamRows((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.contract_id) {
      toast.error('Please select a contract');
      return;
    }
    if (!form.planned_date) {
      toast.error('Planned date is required');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        contract_id: form.contract_id,
        outsourced_transporter_id: useOutsourced && form.outsourced_transporter_id ? form.outsourced_transporter_id : null,
        vehicle_plate: form.vehicle_plate || null,
        planned_date: form.planned_date,
        time_window_start: form.time_window_start || null,
        time_window_end: form.time_window_end || null,
        expected_outbound_count: Number(form.expected_outbound_count) || 1,
        notes: form.notes || null,
        waste_streams: wasteStreamRows.map((row) => ({
          contract_waste_stream_id: row.contract_waste_stream_id,
          waste_stream_id: row.waste_stream_id,
          planned_amount_kg: row.planned_amount_kg ? Number(row.planned_amount_kg) : null,
        })),
      };
      await createOutboundOrder(payload);
      toast.success(t('outboundOrders:toast.created'));
      navigate('/outbound-orders');
    } catch (err) {
      toast.error(err.response?.data?.error || t('outboundOrders:toast.createFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <Breadcrumb items={[{ label: t('outboundOrders:title'), to: '/outbound-orders' }, { label: t('outboundOrders:createOrder') }]} />
      <h1 className="text-xl font-semibold text-grey-900 mb-6">{t('outboundOrders:createOrder')}</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Contract & Parties */}
        <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-grey-900 uppercase tracking-wide mb-4">{t('outboundOrders:sections.contractParties')}</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('outboundOrders:fields.buyer')} <span className="text-red-500">*</span></label>
              <select
                name="buyer_id"
                value={form.buyer_id}
                onChange={handleChange}
                required
                disabled={contractsLoading}
                className={selectClass}
              >
                <option value="">{t('outboundOrders:selectBuyer')}</option>
                {buyerOptions.map((buyer) => (
                  <option key={buyer.id} value={buyer.id}>{buyer.company_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('outboundOrders:fields.contract')} <span className="text-red-500">*</span></label>
              <select
                name="contract_id"
                value={form.contract_id}
                onChange={handleChange}
                required
                disabled={contractsLoading || !form.buyer_id}
                className={selectClass}
              >
                <option value="">{contractsLoading ? 'Loading contracts...' : form.buyer_id ? t('outboundOrders:selectContract') : t('outboundOrders:selectBuyerFirst')}</option>
                {filteredContracts.map((c) => (
                  <option key={c.id} value={c.id}>{c.contract_number} — {c.name}</option>
                ))}
              </select>
            </div>

            {selectedContract && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('outboundOrders:fields.buyer')}</label>
                  <input type="text" readOnly value={selectedContract.buyer?.company_name || '\u2014'} className={readOnlyClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('outboundOrders:fields.sender')}</label>
                  <input type="text" readOnly value={selectedContract.sender?.company_name || '\u2014'} className={readOnlyClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('outboundOrders:fields.disposer')}</label>
                  <input type="text" readOnly value={selectedContract.disposer?.company_name || '\u2014'} className={readOnlyClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('outboundOrders:fields.disposerSite')}</label>
                  <input type="text" readOnly value={selectedContract.disposer_site?.company_name || selectedContract.disposer_site?.name || '\u2014'} className={readOnlyClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('outboundOrders:fields.shipmentType')}</label>
                  <div className="mt-1">
                    {selectedContract.shipment_type ? (
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${SHIPMENT_COLORS[selectedContract.shipment_type] || 'bg-grey-50 text-grey-700 border-grey-200'}`}>
                        {SHIPMENT_LABELS[selectedContract.shipment_type] || selectedContract.shipment_type}
                      </span>
                    ) : '\u2014'}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Transport */}
        <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-grey-900 uppercase tracking-wide mb-4">{t('outboundOrders:sections.transport')}</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('outboundOrders:fields.agreementTransporter')}</label>
              <input type="text" readOnly value={selectedContract?.agreement_transporter?.company_name || '\u2014'} className={readOnlyClass} />
            </div>

            <label className="flex items-center gap-2 text-sm text-grey-700 cursor-pointer">
              <input
                type="checkbox"
                checked={useOutsourced}
                onChange={(e) => setUseOutsourced(e.target.checked)}
                className="h-4 w-4 rounded border-grey-300 text-green-500 focus:ring-green-500/15"
              />
              {t('outboundOrders:useOutsourcedTransporter')}
            </label>

            {useOutsourced && (
              <div>
                <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('outboundOrders:fields.outsourcedTransporter')}</label>
                <select
                  name="outsourced_transporter_id"
                  value={form.outsourced_transporter_id}
                  onChange={handleChange}
                  className={selectClass}
                >
                  <option value="">Select transporter...</option>
                  {transporterEntities.map((e) => (
                    <option key={e.id} value={e.id}>{e.company_name}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('outboundOrders:fields.vehiclePlate')}</label>
              <input
                type="text"
                name="vehicle_plate"
                value={form.vehicle_plate}
                onChange={(e) => setForm((p) => ({ ...p, vehicle_plate: e.target.value.toUpperCase() }))}
                placeholder="AB-123-CD"
                className={`${inputClass} font-mono tracking-wider`}
              />
            </div>
          </div>
        </div>

        {/* Section 3: Scheduling */}
        <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-grey-900 uppercase tracking-wide mb-4">{t('outboundOrders:sections.scheduling')}</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('outboundOrders:fields.plannedDate')} <span className="text-red-500">*</span></label>
              <input type="date" name="planned_date" value={form.planned_date} onChange={handleChange} required className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('outboundOrders:fields.timeWindowStart')}</label>
              <input type="time" name="time_window_start" value={form.time_window_start} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('outboundOrders:fields.timeWindowEnd')}</label>
              <input type="time" name="time_window_end" value={form.time_window_end} onChange={handleChange} className={inputClass} />
            </div>
          </div>
          <div className="mt-4 max-w-xs">
            <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('outboundOrders:fields.expectedOutbounds')}</label>
            <input type="number" name="expected_outbound_count" value={form.expected_outbound_count} onChange={handleChange} min={1} className={inputClass} />
          </div>
        </div>

        {/* Section 4: Waste Streams */}
        <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-grey-900 uppercase tracking-wide mb-4">{t('outboundOrders:sections.wasteStreams')}</h2>
          {wasteStreamRows.length === 0 ? (
            <p className="text-sm text-grey-400">{t('outboundOrders:noWasteStreams')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-grey-50 border-b border-grey-200">
                    <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('outboundOrders:fields.wasteStream')}</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('outboundOrders:fields.receiver')}</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('outboundOrders:fields.asn')}</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('outboundOrders:fields.material')}</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('outboundOrders:fields.processingMethod')}</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('outboundOrders:fields.plannedAmount')}</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {wasteStreamRows.map((row, index) => (
                    <tr key={row.id} className="border-b border-grey-100">
                      <td className="px-4 py-3 text-grey-900 font-medium">{row.waste_stream_name}</td>
                      <td className="px-4 py-3 text-grey-700">{row.receiver_name}</td>
                      <td className="px-4 py-3 text-grey-700">{row.asn}</td>
                      <td className="px-4 py-3 text-grey-700">{row.material_name}</td>
                      <td className="px-4 py-3 text-grey-700">{row.processing_method}</td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min={0}
                          value={row.planned_amount_kg}
                          onChange={(e) => handleWasteStreamAmountChange(index, e.target.value)}
                          placeholder="0"
                          className="w-28 h-9 px-3 rounded-md border border-grey-300 text-sm text-grey-900 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => removeWasteStreamRow(index)}
                          className="p-1 text-grey-400 hover:text-red-500 transition-colors"
                        >
                          <X size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Section 5: Notes */}
        <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-grey-900 uppercase tracking-wide mb-4">{t('outboundOrders:sections.notes')}</h2>
          <textarea
            name="notes"
            value={form.notes}
            onChange={handleChange}
            rows={3}
            placeholder={t('outboundOrders:notesPlaceholder')}
            className="w-full min-h-[80px] px-3.5 py-2.5 rounded-md border border-grey-300 text-sm text-grey-900 placeholder:text-grey-400 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors resize-vertical"
          />
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/outbound-orders')}
            className="h-9 px-4 bg-white text-grey-700 border border-grey-300 rounded-md text-sm font-semibold hover:bg-grey-50 transition-colors"
          >
            {t('outboundOrders:buttons.cancel')}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="h-9 px-4 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? t('outboundOrders:buttons.creating') : t('outboundOrders:buttons.create')}
          </button>
        </div>
      </form>
    </div>
  );
}
