import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, ChevronDown, CheckCircle, AlertTriangle, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import Breadcrumb from '../../components/ui/Breadcrumb';
import useMasterDataStore from '../../store/masterDataStore';
import useAuthStore from '../../store/authStore';
import { createOrder } from '../../api/orders';
import { createOutboundOrder } from '../../api/outboundOrders';
import { listContracts, matchContractForOrder } from '../../api/contracts';

const inputClass = 'w-full h-10 px-3.5 rounded-md border border-grey-300 text-sm text-grey-900 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors';
const selectClass = `${inputClass} bg-white`;
const readOnlyClass = 'w-full h-10 px-3.5 rounded-md border border-grey-200 bg-grey-50 text-sm text-grey-600 cursor-not-allowed';

const VALID_ORDER_TYPES = ['INCOMING', 'OUTGOING'];

const SHIPMENT_COLORS = {
  DOMESTIC_NL: 'bg-blue-50 text-blue-700 border-blue-200',
  EU_CROSS_BORDER: 'bg-purple-50 text-purple-700 border-purple-200',
};
const SHIPMENT_LABELS = { DOMESTIC_NL: 'Domestic NL', EU_CROSS_BORDER: 'EU Cross-Border' };

export default function OrderCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation(['orders', 'common', 'outboundOrders']);

  // Determine initial order type from URL param
  const initialType = VALID_ORDER_TYPES.includes(searchParams.get('type'))
    ? searchParams.get('type')
    : 'INCOMING';
  const [orderType, setOrderType] = useState(initialType);

  // ── Master data ──────────────────────────────────────────────────────────
  const { carriers, suppliers, entities, loadAll } = useMasterDataStore();
  const accessToken = useAuthStore((s) => s.accessToken);
  const transporterEntities = useMasterDataStore((s) => s.getTransporterEntities());
  const supplierEntities = useMasterDataStore((s) => s.getSupplierEntities());
  const allSuppliers = useMasterDataStore((s) => s.suppliers);

  const transporterOptions = transporterEntities.length > 0
    ? transporterEntities
    : carriers.map((c) => ({ id: c.id, company_name: c.name }));
  const supplierOptions = supplierEntities.length > 0
    ? supplierEntities
    : allSuppliers.map((s) => ({ id: s.id, company_name: s.name }));

  useEffect(() => {
    if (!accessToken) return;
    if (carriers.length === 0 || allSuppliers.length === 0 || entities.length === 0) {
      loadAll();
    }
  }, [accessToken, carriers.length, allSuppliers.length, entities.length, loadAll]);

  // ── INCOMING form state ───────────────────────────────────────────────────
  const [inForm, setInForm] = useState({
    supplier_id: '',
    transporter_id: '',
    waste_stream_ids: [],
    planned_amounts: {},
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
  const [supplierContracts, setSupplierContracts] = useState([]);
  const [supplierContractsLoading, setSupplierContractsLoading] = useState(false);
  const [contractLoading, setContractLoading] = useState(false);
  const [contractWasteStreams, setContractWasteStreams] = useState([]);
  const [transporterFromContract, setTransporterFromContract] = useState(false);
  const [wsDropdownOpen, setWsDropdownOpen] = useState(false);
  const wsDropdownRef = useRef(null);

  const selectedEntitySupplier = supplierEntities.find((s) => s.id === inForm.supplier_id) || null;
  const selectedLegacySupplier = allSuppliers.find((s) => s.id === inForm.supplier_id) || null;
  const selectedSupplier = selectedEntitySupplier || selectedLegacySupplier;
  const selectedSupplierType = selectedSupplier?.supplier_type;
  const selectedEntityTransporter = transporterEntities.find((t) => t.id === inForm.transporter_id) || null;
  const selectedLegacyTransporter = carriers.find((c) => c.id === inForm.transporter_id) || null;

  const contractTransporterOptions = supplierContracts
    .filter((c) => c.agreement_transporter?.id)
    .reduce((acc, c) => {
      if (!acc.some((t) => t.id === c.agreement_transporter.id)) acc.push(c.agreement_transporter);
      return acc;
    }, []);
  const availableTransporterOptions = selectedSupplierType === 'THIRD_PARTY'
    ? transporterOptions
    : contractTransporterOptions;

  // ── OUTGOING form state ───────────────────────────────────────────────────
  const [outContracts, setOutContracts] = useState([]);
  const [outContractsLoading, setOutContractsLoading] = useState(false);
  const [selectedOutContract, setSelectedOutContract] = useState(null);
  const [useOutsourced, setUseOutsourced] = useState(false);
  const [wasteStreamRows, setWasteStreamRows] = useState([]);

  const [outForm, setOutForm] = useState({
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

  // ── Shared ────────────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);

  // ── INCOMING effects ──────────────────────────────────────────────────────
  useEffect(() => {
    function handleClickOutside(e) {
      if (wsDropdownRef.current && !wsDropdownRef.current.contains(e.target)) {
        setWsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (supplierOptions.length === 1 && !inForm.supplier_id) {
      setInForm((f) => ({ ...f, supplier_id: supplierOptions[0].id }));
    }
  }, [inForm.supplier_id, supplierOptions]);

  useEffect(() => {
    if (!inForm.supplier_id) {
      setSupplierContracts([]);
      setMatchedContract(null);
      setContractWasteStreams([]);
      setTransporterFromContract(false);
      setInForm((prev) => ({ ...prev, transporter_id: '', waste_stream_ids: [] }));
      return;
    }

    let cancelled = false;
    setSupplierContractsLoading(true);
    listContracts({
      contract_type: 'INCOMING',
      status: 'ACTIVE',
      ...(selectedEntitySupplier ? { entity_supplier_id: inForm.supplier_id } : { supplier_id: inForm.supplier_id }),
      limit: 200,
    })
      .then(({ data }) => { if (!cancelled) setSupplierContracts(data.data || []); })
      .catch(() => { if (!cancelled) setSupplierContracts([]); })
      .finally(() => { if (!cancelled) setSupplierContractsLoading(false); });

    return () => { cancelled = true; };
  }, [inForm.supplier_id, selectedEntitySupplier]);

  useEffect(() => {
    if (!inForm.supplier_id) return;
    if (availableTransporterOptions.length === 1 && !inForm.transporter_id) {
      setInForm((f) => ({ ...f, transporter_id: availableTransporterOptions[0].id }));
      return;
    }
    if (inForm.transporter_id && !availableTransporterOptions.some((t) => t.id === inForm.transporter_id)) {
      setInForm((prev) => ({ ...prev, transporter_id: '', waste_stream_ids: [] }));
      setMatchedContract(null);
      setContractWasteStreams([]);
      setTransporterFromContract(false);
    }
  }, [availableTransporterOptions, inForm.supplier_id, inForm.transporter_id]);

  useEffect(() => {
    if (!inForm.supplier_id || !inForm.transporter_id) {
      setMatchedContract(null);
      setContractWasteStreams([]);
      setTransporterFromContract(false);
      setInForm((prev) => ({ ...prev, waste_stream_ids: [] }));
      return;
    }

    let cancelled = false;
    setContractLoading(true);
    matchContractForOrder({
      supplier_id: inForm.supplier_id,
      carrier_id: selectedEntityTransporter?.id || selectedLegacyTransporter?.id || inForm.transporter_id,
      date: inForm.planned_date || new Date().toISOString().split('T')[0],
    })
      .then(({ data }) => {
        if (cancelled) return;
        setMatchedContract(data.data);
        const cws = data.data?.contract_waste_streams || [];
        setContractWasteStreams(cws);
        if (data.data?.agreement_transporter_id && data.data.agreement_transporter_id !== inForm.transporter_id) {
          setInForm((prev) => ({ ...prev, transporter_id: data.data.agreement_transporter_id }));
          setTransporterFromContract(true);
        }
        if (cws.length === 1) {
          const wsId = cws[0].waste_stream?.id || cws[0].waste_stream_id;
          setInForm((prev) => ({ ...prev, waste_stream_ids: [wsId] }));
        } else {
          setInForm((prev) => ({ ...prev, waste_stream_ids: [] }));
        }
      })
      .catch(() => {
        if (cancelled) return;
        setMatchedContract(null);
        setContractWasteStreams([]);
        setTransporterFromContract(false);
        setInForm((prev) => ({ ...prev, waste_stream_ids: [] }));
      })
      .finally(() => { if (!cancelled) setContractLoading(false); });

    return () => { cancelled = true; };
  }, [inForm.supplier_id, inForm.transporter_id, inForm.planned_date, selectedEntityTransporter, selectedLegacyTransporter]);

  // ── OUTGOING effects ──────────────────────────────────────────────────────
  useEffect(() => {
    if (orderType !== 'OUTGOING') return;
    let cancelled = false;
    setOutContractsLoading(true);
    listContracts({ contract_type: 'OUTGOING', status: 'ACTIVE', limit: 200 })
      .then(({ data }) => { if (!cancelled) setOutContracts(data.data || []); })
      .catch(() => { if (!cancelled) setOutContracts([]); })
      .finally(() => { if (!cancelled) setOutContractsLoading(false); });
    return () => { cancelled = true; };
  }, [orderType]);

  const buyerOptions = outContracts
    .filter((c) => c.buyer?.id)
    .reduce((acc, c) => {
      if (!acc.some((b) => b.id === c.buyer.id)) acc.push(c.buyer);
      return acc;
    }, []);

  const filteredContracts = outForm.buyer_id
    ? outContracts.filter((c) => c.buyer?.id === outForm.buyer_id)
    : [];

  useEffect(() => {
    if (!outForm.contract_id) {
      setSelectedOutContract(null);
      setWasteStreamRows([]);
      return;
    }
    const contract = outContracts.find((c) => c.id === outForm.contract_id);
    setSelectedOutContract(contract || null);
    if (contract?.buyer?.id && contract.buyer.id !== outForm.buyer_id) {
      setOutForm((prev) => ({ ...prev, buyer_id: contract.buyer.id }));
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
  }, [outForm.contract_id, outForm.buyer_id, outContracts]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleInChange(e) {
    const { name, value } = e.target;
    setInForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleOutChange(e) {
    const { name, value } = e.target;
    setOutForm((prev) => {
      if (name === 'buyer_id') return { ...prev, buyer_id: value, contract_id: '' };
      return { ...prev, [name]: value };
    });
  }

  function toggleWasteStream(wsId) {
    setInForm((prev) => {
      const current = prev.waste_stream_ids;
      const next = current.includes(wsId)
        ? current.filter((id) => id !== wsId)
        : [...current, wsId];
      return { ...prev, waste_stream_ids: next };
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

  const asnPreview = inForm.waste_stream_ids
    .map((wsId) => {
      const cws = contractWasteStreams.find((c) => c.waste_stream?.id === wsId || c.waste_stream_id === wsId);
      return cws ? { name: cws.waste_stream?.name, code: cws.waste_stream?.code, asn: cws.afvalstroomnummer } : null;
    })
    .filter(Boolean);

  // ── Submit handlers ───────────────────────────────────────────────────────
  async function handleSubmitIncoming(e) {
    e.preventDefault();
    if (inForm.waste_stream_ids.length === 0) {
      toast.error(t('orders:create.validation.selectWasteStream'));
      return;
    }
    if (!inForm.vehicle_plate) {
      toast.error(t('orders:create.validation.vehiclePlateRequired'));
      return;
    }

    setSubmitting(true);
    try {
      await createOrder({
        ...inForm,
        contract_id: matchedContract?.id || null,
        vehicle_plate: inForm.vehicle_plate,
        supplier_id: selectedEntitySupplier ? inForm.supplier_id : selectedLegacySupplier?.id || inForm.supplier_id,
        entity_supplier_id: selectedEntitySupplier?.id || null,
        transporter_id: selectedEntityTransporter?.id || null,
        carrier_id: selectedLegacyTransporter?.id || null,
        planned_amounts: inForm.planned_amounts,
      });
      toast.success(t('orders:toast.created'));
      navigate('/orders');
    } catch (err) {
      toast.error(err.response?.data?.error || t('orders:toast.createFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitOutgoing(e) {
    e.preventDefault();
    if (!outForm.contract_id) {
      toast.error('Please select a contract');
      return;
    }
    if (!outForm.planned_date) {
      toast.error('Planned date is required');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        contract_id: outForm.contract_id,
        outsourced_transporter_id: useOutsourced && outForm.outsourced_transporter_id ? outForm.outsourced_transporter_id : null,
        vehicle_plate: outForm.vehicle_plate || null,
        planned_date: outForm.planned_date,
        time_window_start: outForm.time_window_start || null,
        time_window_end: outForm.time_window_end || null,
        expected_outbound_count: Number(outForm.expected_outbound_count) || 1,
        notes: outForm.notes || null,
        waste_streams: wasteStreamRows.map((row) => ({
          contract_waste_stream_id: row.contract_waste_stream_id,
          waste_stream_id: row.waste_stream_id,
          planned_amount_kg: row.planned_amount_kg ? Number(row.planned_amount_kg) : null,
        })),
      };
      await createOutboundOrder(payload);
      toast.success(t('outboundOrders:toast.created'));
      navigate('/orders?tab=outbound');
    } catch (err) {
      toast.error(err.response?.data?.error || t('outboundOrders:toast.createFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  // ── Segmented control ─────────────────────────────────────────────────────
  function OrderTypeToggle() {
    return (
      <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-5">
        <label className="block text-sm font-medium text-grey-700 mb-2">{t('orders:orderType')}</label>
        <div className="inline-flex rounded-md border border-grey-300 overflow-hidden">
          <button
            type="button"
            onClick={() => setOrderType('INCOMING')}
            className={`h-9 px-5 text-sm font-semibold transition-colors ${
              orderType === 'INCOMING'
                ? 'bg-green-500 text-white'
                : 'bg-white text-grey-700 hover:bg-grey-50'
            }`}
          >
            {t('orders:orderTypeIncoming')}
          </button>
          <button
            type="button"
            onClick={() => setOrderType('OUTGOING')}
            className={`h-9 px-5 text-sm font-semibold border-l border-grey-300 transition-colors ${
              orderType === 'OUTGOING'
                ? 'bg-green-500 text-white'
                : 'bg-white text-grey-700 hover:bg-grey-50'
            }`}
          >
            {t('orders:orderTypeOutgoing')}
          </button>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      <Breadcrumb items={[{ label: t('orders:title'), to: '/orders' }, { label: t('orders:create.breadcrumb') }]} />
      <h1 className="text-xl font-semibold text-grey-900 mb-6">{t('orders:create.title')}</h1>

      {/* INCOMING form */}
      {orderType === 'INCOMING' && (
        <form onSubmit={handleSubmitIncoming} className="space-y-6">
          <OrderTypeToggle />

          {/* Contract & Parties */}
          <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-grey-900 uppercase tracking-wide mb-4">Contract &amp; Parties</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('orders:create.fields.supplier')} <span className="text-red-500">*</span></label>
                <select name="supplier_id" value={inForm.supplier_id} onChange={handleInChange} required className={selectClass}>
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
                <select
                  name="transporter_id"
                  value={inForm.transporter_id}
                  onChange={(e) => { handleInChange(e); setTransporterFromContract(false); }}
                  required
                  disabled={!inForm.supplier_id || supplierContractsLoading}
                  className={selectClass}
                >
                  <option value="">
                    {!inForm.supplier_id
                      ? t('orders:create.fields.transporterPlaceholder')
                      : supplierContractsLoading
                        ? t('orders:create.fields.searchingContract')
                        : availableTransporterOptions.length === 0
                          ? 'No contract transporters available'
                          : t('orders:create.fields.transporterPlaceholder')}
                  </option>
                  {availableTransporterOptions.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                </select>
              </div>
            </div>

            {/* Contract Match Banner */}
            {inForm.supplier_id && inForm.transporter_id && (
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

          {/* Waste Streams */}
          <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-grey-900 uppercase tracking-wide mb-4">Waste Streams</h2>
            <div ref={wsDropdownRef} className="relative">
              <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('orders:create.fields.wasteStreams')} <span className="text-red-500">*</span></label>
              <button
                type="button"
                onClick={() => setWsDropdownOpen((v) => !v)}
                disabled={contractWasteStreams.length === 0}
                className={`${selectClass} flex items-center justify-between text-left ${
                  inForm.waste_stream_ids.length === 0 ? 'text-grey-400' : 'text-grey-900'
                } ${contractWasteStreams.length === 0 ? 'bg-grey-50 cursor-not-allowed' : ''}`}
              >
                <span className="truncate">
                  {contractWasteStreams.length === 0
                    ? t('orders:create.fields.noWasteStreams')
                    : inForm.waste_stream_ids.length === 0
                      ? t('orders:create.fields.selectWasteStreams')
                      : t('orders:create.fields.nSelected', { count: inForm.waste_stream_ids.length })}
                </span>
                <ChevronDown size={16} className={`text-grey-400 transition-transform flex-shrink-0 ${wsDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {wsDropdownOpen && contractWasteStreams.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-grey-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {contractWasteStreams.map((cws) => {
                    const wsId = cws.waste_stream?.id || cws.waste_stream_id;
                    const checked = inForm.waste_stream_ids.includes(wsId);
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
                        <span className="ml-auto text-xs text-grey-400">Afvalstroomnummer: {cws.afvalstroomnummer || '—'}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ASN Preview + Planned Amount */}
            {asnPreview.length > 0 && (
              <div className="mt-4 p-3 bg-grey-50 rounded-md border border-grey-200">
                <div className="space-y-2">
                  {asnPreview.map((item, i) => {
                    const wsId = inForm.waste_stream_ids[i];
                    const cws = contractWasteStreams.find((c) => c.waste_stream?.id === wsId || c.waste_stream_id === wsId);
                    return (
                      <div key={i} className="flex items-center gap-3 text-sm">
                        <div className="flex-1 min-w-0">
                          <span className="text-grey-700">{item.name} ({item.code})</span>
                          <span className="ml-2 text-xs text-grey-500">Afvalstroomnummer: {item.asn}</span>
                          {cws?.rate_lines?.[0]?.processing_method && (
                            <span className="ml-2 text-xs text-grey-500">· Processing: {cws.rate_lines[0].processing_method}</span>
                          )}
                        </div>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Planned kg"
                          value={inForm.planned_amounts[wsId] || ''}
                          onChange={(e) => setInForm((prev) => ({
                            ...prev,
                            planned_amounts: { ...prev.planned_amounts, [wsId]: e.target.value },
                          }))}
                          className="w-28 h-8 px-2.5 rounded-md border border-grey-300 text-xs text-grey-900 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Dates + Vehicle */}
          <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-5 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('orders:create.fields.plannedDate')} <span className="text-red-500">*</span></label>
                <input type="date" name="planned_date" value={inForm.planned_date} onChange={handleInChange} required className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('orders:create.fields.timeWindowStart')}</label>
                <input type="datetime-local" name="planned_time_window_start" value={inForm.planned_time_window_start} onChange={handleInChange} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('orders:create.fields.timeWindowEnd')}</label>
                <input type="datetime-local" name="planned_time_window_end" value={inForm.planned_time_window_end} onChange={handleInChange} className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('orders:create.fields.vehiclePlate')} <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  name="vehicle_plate"
                  value={inForm.vehicle_plate}
                  onChange={(e) => setInForm((p) => ({ ...p, vehicle_plate: e.target.value.toUpperCase() }))}
                  placeholder={t('orders:create.fields.vehiclePlatePlaceholder')}
                  className={`${inputClass} font-mono tracking-wider`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('orders:create.fields.expectedParcels')}</label>
                <input type="number" name="expected_skip_count" value={inForm.expected_skip_count} onChange={handleInChange} min={1} className={inputClass} />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-sm text-grey-700 cursor-pointer">
                  <input type="checkbox" checked={inForm.is_lzv} onChange={(e) => setInForm((p) => ({ ...p, is_lzv: e.target.checked }))}
                    className="h-4 w-4 rounded border-grey-300 text-green-500 focus:ring-green-500/15" />
                  {t('orders:create.fields.lzvLabel')}
                </label>
              </div>
            </div>

            {selectedSupplierType === 'THIRD_PARTY' && (
              <div>
                <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('orders:create.fields.clientReference')}</label>
                <input type="text" value={inForm.client_reference} onChange={(e) => setInForm((p) => ({ ...p, client_reference: e.target.value }))} className={inputClass} placeholder={t('orders:create.fields.clientRefPlaceholder')} />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('orders:create.fields.notes')}</label>
              <textarea
                name="notes"
                value={inForm.notes}
                onChange={handleInChange}
                rows={3}
                placeholder={t('orders:create.fields.notesPlaceholder')}
                className="w-full min-h-[80px] px-3.5 py-2.5 rounded-md border border-grey-300 text-sm text-grey-900 placeholder:text-grey-400 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors resize-vertical"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => navigate('/orders')}
              className="h-9 px-4 bg-white text-grey-700 border border-grey-300 rounded-md text-sm font-semibold hover:bg-grey-50 transition-colors">
              {t('orders:create.buttons.cancel')}
            </button>
            <button type="submit" disabled={submitting}
              className="h-9 px-4 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors">
              {submitting ? t('orders:create.buttons.creating') : t('orders:createOrder')}
            </button>
          </div>
        </form>
      )}

      {/* OUTGOING form */}
      {orderType === 'OUTGOING' && (
        <form onSubmit={handleSubmitOutgoing} className="space-y-6">
          <OrderTypeToggle />

          {/* Contract & Parties */}
          <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-grey-900 uppercase tracking-wide mb-4">{t('outboundOrders:sections.contractParties')}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('outboundOrders:fields.buyer')} <span className="text-red-500">*</span></label>
                <select
                  name="buyer_id"
                  value={outForm.buyer_id}
                  onChange={handleOutChange}
                  required
                  disabled={outContractsLoading}
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
                  value={outForm.contract_id}
                  onChange={handleOutChange}
                  required
                  disabled={outContractsLoading || !outForm.buyer_id}
                  className={selectClass}
                >
                  <option value="">{outContractsLoading ? 'Loading contracts...' : outForm.buyer_id ? t('outboundOrders:selectContract') : t('outboundOrders:selectBuyerFirst')}</option>
                  {filteredContracts.map((c) => (
                    <option key={c.id} value={c.id}>{c.contract_number} — {c.name}</option>
                  ))}
                </select>
              </div>

              {selectedOutContract && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('outboundOrders:fields.buyer')}</label>
                    <input type="text" readOnly value={selectedOutContract.buyer?.company_name || '\u2014'} className={readOnlyClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('outboundOrders:fields.sender')}</label>
                    <input type="text" readOnly value={selectedOutContract.sender?.company_name || '\u2014'} className={readOnlyClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('outboundOrders:fields.disposer')}</label>
                    <input type="text" readOnly value={selectedOutContract.disposer?.company_name || '\u2014'} className={readOnlyClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('outboundOrders:fields.disposerSite')}</label>
                    <input type="text" readOnly value={selectedOutContract.disposer_site?.company_name || selectedOutContract.disposer_site?.name || '\u2014'} className={readOnlyClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('outboundOrders:fields.shipmentType')}</label>
                    <div className="mt-1">
                      {selectedOutContract.shipment_type ? (
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${SHIPMENT_COLORS[selectedOutContract.shipment_type] || 'bg-grey-50 text-grey-700 border-grey-200'}`}>
                          {SHIPMENT_LABELS[selectedOutContract.shipment_type] || selectedOutContract.shipment_type}
                        </span>
                      ) : '\u2014'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Transport */}
          <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-grey-900 uppercase tracking-wide mb-4">{t('outboundOrders:sections.transport')}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('outboundOrders:fields.agreementTransporter')}</label>
                <input type="text" readOnly value={selectedOutContract?.agreement_transporter?.company_name || '\u2014'} className={readOnlyClass} />
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
                    value={outForm.outsourced_transporter_id}
                    onChange={handleOutChange}
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
                  value={outForm.vehicle_plate}
                  onChange={(e) => setOutForm((p) => ({ ...p, vehicle_plate: e.target.value.toUpperCase() }))}
                  placeholder="AB-123-CD"
                  className={`${inputClass} font-mono tracking-wider`}
                />
              </div>
            </div>
          </div>

          {/* Scheduling */}
          <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-grey-900 uppercase tracking-wide mb-4">{t('outboundOrders:sections.scheduling')}</h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('outboundOrders:fields.plannedDate')} <span className="text-red-500">*</span></label>
                <input type="date" name="planned_date" value={outForm.planned_date} onChange={handleOutChange} required className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('outboundOrders:fields.timeWindowStart')}</label>
                <input type="time" name="time_window_start" value={outForm.time_window_start} onChange={handleOutChange} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('outboundOrders:fields.timeWindowEnd')}</label>
                <input type="time" name="time_window_end" value={outForm.time_window_end} onChange={handleOutChange} className={inputClass} />
              </div>
            </div>
            <div className="mt-4 max-w-xs">
              <label className="block text-sm font-medium text-grey-700 mb-1.5">{t('outboundOrders:fields.expectedOutbounds')}</label>
              <input type="number" name="expected_outbound_count" value={outForm.expected_outbound_count} onChange={handleOutChange} min={1} className={inputClass} />
            </div>
          </div>

          {/* Waste Streams */}
          <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-grey-900 uppercase tracking-wide mb-4">Waste Streams</h2>
            {wasteStreamRows.length === 0 ? (
              <p className="text-sm text-grey-400">{t('outboundOrders:noWasteStreams')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-grey-50 border-b border-grey-200">
                      <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('outboundOrders:fields.wasteStream')}</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">{t('outboundOrders:fields.receiver')}</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Afvalstroomnummer</th>
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
                        <td className="px-4 py-3 text-grey-700 text-xs">{row.asn}</td>
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

          {/* Notes */}
          <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-grey-900 uppercase tracking-wide mb-4">{t('outboundOrders:sections.notes')}</h2>
            <textarea
              name="notes"
              value={outForm.notes}
              onChange={handleOutChange}
              rows={3}
              placeholder={t('outboundOrders:notesPlaceholder')}
              className="w-full min-h-[80px] px-3.5 py-2.5 rounded-md border border-grey-300 text-sm text-grey-900 placeholder:text-grey-400 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors resize-vertical"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate('/orders?tab=outbound')}
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
      )}
    </div>
  );
}
