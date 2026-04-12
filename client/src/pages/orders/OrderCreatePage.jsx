import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, ChevronDown, CheckCircle, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import Breadcrumb from '../../components/ui/Breadcrumb';
import useMasterDataStore from '../../store/masterDataStore';
import { createOrder } from '../../api/orders';
import { matchContractForOrder } from '../../api/contracts';

const inputClass = 'w-full h-10 px-3.5 rounded-md border border-grey-300 text-sm text-grey-900 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors';
const selectClass = `${inputClass} bg-white`;

export default function OrderCreatePage() {
  const navigate = useNavigate();
  const { t } = useTranslation(['orders', 'common']);
  const { carriers, suppliers, loadAll } = useMasterDataStore();
  const transporterEntities = useMasterDataStore((s) => s.getTransporterEntities());
  const supplierEntities = useMasterDataStore((s) => s.getSupplierEntities());
  const allSuppliers = useMasterDataStore((s) => s.suppliers);

  // Use entity-based data with fallback to legacy carriers/suppliers
  const transporterOptions = transporterEntities.length > 0 ? transporterEntities : carriers.map(c => ({ id: c.id, company_name: c.name }));
  const supplierOptions = supplierEntities.length > 0 ? supplierEntities : allSuppliers.map(s => ({ id: s.id, company_name: s.name }));

  useEffect(() => {
    if (carriers.length === 0 || allSuppliers.length === 0) {
      loadAll();
    }
  }, [carriers.length, allSuppliers.length, loadAll]);

  const [form, setForm] = useState({
    supplier_id: '',
    transporter_id: '',
    waste_stream_ids: [],
    planned_date: '',
    planned_time_window_start: '',
    planned_time_window_end: '',
    expected_skip_count: 1,
    vehicle_plate: '',
    is_lzv: false,
    notes: '',
    client_reference: '',
  });

  const [matchedContract, setMatchedContract] = useState(null);
  const [contractLoading, setContractLoading] = useState(false);
  const [contractWasteStreams, setContractWasteStreams] = useState([]);
  const [transporterFromContract, setTransporterFromContract] = useState(false);
  const [wsDropdownOpen, setWsDropdownOpen] = useState(false);
  const wsDropdownRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedSupplier = allSuppliers.find((s) => s.id === form.supplier_id);
  const selectedSupplierType = selectedSupplier?.supplier_type;

  // Close waste stream dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (wsDropdownRef.current && !wsDropdownRef.current.contains(e.target)) {
        setWsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-select single supplier
  useEffect(() => {
    if (allSuppliers.length === 1 && !form.supplier_id) {
      setForm((f) => ({ ...f, supplier_id: allSuppliers[0].id }));
    }
  }, [allSuppliers]);

  // Auto-select single transporter
  useEffect(() => {
    if (transporterOptions.length === 1 && !form.transporter_id) {
      setForm((f) => ({ ...f, transporter_id: transporterOptions[0].id }));
    }
  }, [transporterOptions]);

  // Auto-match contract when supplier + transporter change
  useEffect(() => {
    if (!form.supplier_id || !form.transporter_id) {
      setMatchedContract(null);
      setContractWasteStreams([]);
      setTransporterFromContract(false);
      setForm((prev) => ({ ...prev, waste_stream_ids: [] }));
      return;
    }

    let cancelled = false;
    setContractLoading(true);
    matchContractForOrder({
      supplier_id: form.supplier_id,
      carrier_id: form.transporter_id,
      date: form.planned_date || new Date().toISOString().split('T')[0],
    })
      .then(({ data }) => {
        if (cancelled) return;
        setMatchedContract(data.data);
        const cws = data.data?.contract_waste_streams || [];
        setContractWasteStreams(cws);
        // Auto-fill transporter from contract if available
        if (data.data?.agreement_transporter_id && data.data.agreement_transporter_id !== form.transporter_id) {
          setForm((prev) => ({ ...prev, transporter_id: data.data.agreement_transporter_id }));
          setTransporterFromContract(true);
        }
        // Reset waste stream selection, then auto-select if only one available
        if (cws.length === 1) {
          const wsId = cws[0].waste_stream?.id || cws[0].waste_stream_id;
          setForm((prev) => ({ ...prev, waste_stream_ids: [wsId] }));
        } else {
          setForm((prev) => ({ ...prev, waste_stream_ids: [] }));
        }
      })
      .catch(() => {
        if (cancelled) return;
        setMatchedContract(null);
        setContractWasteStreams([]);
        setTransporterFromContract(false);
        setForm((prev) => ({ ...prev, waste_stream_ids: [] }));
      })
      .finally(() => {
        if (!cancelled) setContractLoading(false);
      });

    return () => { cancelled = true; };
  }, [form.supplier_id, form.transporter_id, form.planned_date]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function toggleWasteStream(wsId) {
    setForm((prev) => {
      const current = prev.waste_stream_ids;
      const next = current.includes(wsId)
        ? current.filter((id) => id !== wsId)
        : [...current, wsId];
      return { ...prev, waste_stream_ids: next };
    });
  }

  // Build ASN preview from selected waste streams
  const asnPreview = form.waste_stream_ids
    .map((wsId) => {
      const cws = contractWasteStreams.find((c) => c.waste_stream?.id === wsId || c.waste_stream_id === wsId);
      return cws ? { name: cws.waste_stream?.name, code: cws.waste_stream?.code, asn: cws.afvalstroomnummer } : null;
    })
    .filter(Boolean);

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.waste_stream_ids.length === 0) {
      toast.error(t('orders:create.validation.selectWasteStream'));
      return;
    }
    if (!form.vehicle_plate) {
      toast.error(t('orders:create.validation.vehiclePlateRequired'));
      return;
    }

    setSubmitting(true);
    try {
      await createOrder({
        ...form,
        contract_id: matchedContract?.id || null,
        vehicle_plate: form.vehicle_plate,
        entity_supplier_id: form.supplier_id,
      });
      toast.success(t('orders:toast.created'));
      navigate('/orders');
    } catch (err) {
      toast.error(err.response?.data?.error || t('orders:toast.createFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <Breadcrumb items={[{ label: t('orders:title'), to: '/orders' }, { label: t('orders:create.breadcrumb') }]} />
      <h1 className="text-xl font-semibold text-grey-900 mb-6">{t('orders:create.title')}</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Supplier + Carrier */}
        <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('orders:create.fields.supplier')} <span className="text-red-500">*</span></label>
              <select name="supplier_id" value={form.supplier_id} onChange={handleChange} required className={selectClass}>
                <option value="">{t('orders:create.fields.supplierPlaceholder')}</option>
                {supplierOptions.map((s) => <option key={s.id} value={s.id}>{s.company_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">
                {t('orders:transporter')} <span className="text-red-500">*</span>
                {transporterFromContract && (
                  <span className="ml-2 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">{t('orders:fromContract')}</span>
                )}
              </label>
              <select name="transporter_id" value={form.transporter_id} onChange={(e) => { handleChange(e); setTransporterFromContract(false); }} required className={selectClass}>
                <option value="">{t('orders:create.fields.transporterPlaceholder')}</option>
                {transporterOptions.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
            </div>
          </div>

          {/* Contract Match Banner */}
          {form.supplier_id && form.transporter_id && (
            <div className={`mt-4 flex items-center gap-2 p-3 rounded-md text-sm ${
              contractLoading
                ? 'bg-grey-50 text-grey-500'
                : matchedContract
                  ? 'bg-green-25 text-green-700 border border-green-300'
                  : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {contractLoading ? (
                t('orders:create.fields.searchingContract')
              ) : matchedContract ? (
                <>
                  <CheckCircle size={16} />
                  <span className="font-medium">{matchedContract.contract_number}</span>
                  <span className="text-green-600">·</span>
                  <span>{matchedContract.name}</span>
                </>
              ) : (
                <>
                  <AlertTriangle size={16} />
                  {t('orders:create.fields.noContract')}
                </>
              )}
            </div>
          )}
        </div>

        {/* Waste Streams + ASN Preview */}
        <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-5">
          <div ref={wsDropdownRef} className="relative">
            <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('orders:create.fields.wasteStreams')} <span className="text-red-500">*</span></label>
            <button
              type="button"
              onClick={() => setWsDropdownOpen((v) => !v)}
              disabled={contractWasteStreams.length === 0}
              className={`${selectClass} flex items-center justify-between text-left ${
                form.waste_stream_ids.length === 0 ? 'text-grey-400' : 'text-grey-900'
              } ${contractWasteStreams.length === 0 ? 'bg-grey-50 cursor-not-allowed' : ''}`}
            >
              <span className="truncate">
                {contractWasteStreams.length === 0
                  ? t('orders:create.fields.noWasteStreams')
                  : form.waste_stream_ids.length === 0
                    ? t('orders:create.fields.selectWasteStreams')
                    : t('orders:create.fields.nSelected', { count: form.waste_stream_ids.length })}
              </span>
              <ChevronDown size={16} className={`text-grey-400 transition-transform flex-shrink-0 ${wsDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {wsDropdownOpen && contractWasteStreams.length > 0 && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-grey-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                {contractWasteStreams.map((cws) => {
                  const wsId = cws.waste_stream?.id || cws.waste_stream_id;
                  const checked = form.waste_stream_ids.includes(wsId);
                  return (
                    <label
                      key={cws.id}
                      onClick={() => toggleWasteStream(wsId)}
                      className="flex items-center gap-2.5 px-3 py-2 hover:bg-grey-50 cursor-pointer text-sm text-grey-900"
                    >
                      <span className={`flex items-center justify-center w-4 h-4 rounded border flex-shrink-0 ${checked ? 'bg-green-500 border-green-500' : 'border-grey-300'}`}>
                        {checked && <Check size={12} className="text-white" strokeWidth={3} />}
                      </span>
                      {cws.waste_stream?.name} ({cws.waste_stream?.code})
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* ASN Preview */}
          {asnPreview.length > 0 && (
            <div className="mt-4 p-3 bg-grey-50 rounded-md border border-grey-200">
              <p className="text-xs font-medium text-grey-500 uppercase tracking-wide mb-2">{t('orders:create.fields.afvalstroomnummer')}</p>
              <div className="space-y-1">
                {asnPreview.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-grey-700">{item.name} ({item.code})</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-25 text-green-700 border border-green-300">
                      {item.asn}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Dates + Vehicle */}
        <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-5 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('orders:create.fields.plannedDate')} <span className="text-red-500">*</span></label>
              <input type="date" name="planned_date" value={form.planned_date} onChange={handleChange} required className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('orders:create.fields.timeWindowStart')}</label>
              <input type="datetime-local" name="planned_time_window_start" value={form.planned_time_window_start} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('orders:create.fields.timeWindowEnd')}</label>
              <input type="datetime-local" name="planned_time_window_end" value={form.planned_time_window_end} onChange={handleChange} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('orders:create.fields.vehiclePlate')} <span className="text-red-500">*</span></label>
              <input
                type="text"
                name="vehicle_plate"
                value={form.vehicle_plate}
                onChange={(e) => setForm((p) => ({ ...p, vehicle_plate: e.target.value.toUpperCase() }))}
                placeholder={t('orders:create.fields.vehiclePlatePlaceholder')}
                className={`${inputClass} font-mono tracking-wider`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('orders:create.fields.expectedParcels')}</label>
              <input type="number" name="expected_skip_count" value={form.expected_skip_count} onChange={handleChange} min={1} className={inputClass} />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm text-grey-700 cursor-pointer">
                <input type="checkbox" checked={form.is_lzv} onChange={(e) => setForm((p) => ({ ...p, is_lzv: e.target.checked }))}
                  className="h-4 w-4 rounded border-grey-300 text-green-500 focus:ring-green-500/15" />
                {t('orders:create.fields.lzvLabel')}
              </label>
            </div>
          </div>

          {selectedSupplierType === 'THIRD_PARTY' && (
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('orders:create.fields.clientReference')}</label>
              <input type="text" value={form.client_reference} onChange={(e) => setForm((p) => ({ ...p, client_reference: e.target.value }))} className={inputClass} placeholder={t('orders:create.fields.clientRefPlaceholder')} />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('orders:create.fields.notes')}</label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={3}
              placeholder={t('orders:create.fields.notesPlaceholder')}
              className="w-full min-h-[80px] px-3.5 py-2.5 rounded-md border border-grey-300 text-sm text-grey-900 placeholder:text-grey-400 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors resize-vertical"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate('/orders')}
            className="h-9 px-4 bg-white text-grey-700 border border-grey-300 rounded-md text-sm font-semibold hover:bg-grey-50 transition-colors">
            {t('orders:create.buttons.cancel')}
          </button>
          <button type="submit" disabled={submitting}
            className="h-9 px-4 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors">
            {submitting ? t('orders:create.buttons.creating') : t('orders:create.buttons.createOrder')}
          </button>
        </div>
      </form>
    </div>
  );
}
