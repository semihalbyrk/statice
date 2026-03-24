import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import Breadcrumb from '../../components/ui/Breadcrumb';
import PenaltySelectModal from '../../components/contracts/PenaltySelectModal';
import useMasterDataStore from '../../store/masterDataStore';
import { createContract, getContract, updateContract } from '../../api/contracts';
import { listFees } from '../../api/fees';
import { getSettings } from '../../api/admin';

const INVOICING_FREQUENCIES = ['PER_ORDER', 'WEEKLY', 'MONTHLY', 'QUARTERLY'];
const FREQ_LABELS = { PER_ORDER: 'Per Order', WEEKLY: 'Weekly', MONTHLY: 'Monthly', QUARTERLY: 'Quarterly' };
const CURRENCIES = [
  { code: 'EUR', symbol: '\u20AC', label: 'EUR (\u20AC)' },
  { code: 'USD', symbol: '$', label: 'USD ($)' },
  { code: 'GBP', symbol: '\u00A3', label: 'GBP (\u00A3)' },
];
const PRICING_MODELS = ['WEIGHT', 'QUANTITY'];
const PRICING_LABELS = { WEIGHT: 'Per Weight', QUANTITY: 'Per Quantity' };

const PROCESSING_METHODS = [
  'R1: Main use as fuel or other energy generation',
  'R2: Recovery of solvents',
  'R3: Recycling/recovery of organic substances not used as solvents',
  'R4: Recycling/recovery of metals and metal compounds',
  'R5: Recycling/recovery of other inorganic substances',
  'R6: Recovery of acids or bases',
  'R7: Recovery of components used to combat pollution',
  'R8: Recovery of components from catalysts',
  'R9: Rerefinement of oil and other reuse of oil',
  'R10: Agricultural or ecological improvement',
  'R11: Use of waste resulting from R1-R10 treatments',
  'R12: Exchange of waste for R1-R11 treatments',
  'R13: Storage of waste for R1-R12 treatments',
  'D1: Landfill (on or in land)',
  'D2: Land treatment (spreading for biodegradation)',
  'D3: Deep injection (into wells, salt domes)',
  'D4: Surface water impoundment (lagoons, ponds)',
  'D5: Specially engineered landfill',
  'D6: Release to water bodies (excluding seas/oceans)',
  'D7: Release into seas/oceans including seabed placement',
  'D8: Biological treatment not specified elsewhere',
  'D9: Physico-chemical treatment not specified elsewhere',
  'D10: Incineration on land',
  'D11: Incineration at sea',
  'D12: Permanent storage (e.g., placement in mines)',
  'D13: Blending before D1-D12 treatment',
  'D14: Repackaging before D1-D13 treatment',
  'D15: Storage pending D1-D14 treatment',
];

const FEE_TYPE_LABELS = {
  CONTAMINATION_SURCHARGE: 'Contamination Surcharge',
  CONTAMINATION_FLAT: 'Contamination Flat Fee',
  CONTAMINATION_PERCENTAGE: 'Contamination Percentage',
  SORTING_SURCHARGE: 'Sorting Surcharge',
  HAZARDOUS_MATERIAL: 'Hazardous Material',
  REJECTION_FEE: 'Rejection Fee',
};
const RATE_TYPE_LABELS = { FIXED: 'Fixed', PERCENTAGE: '%', PER_KG: '/kg', PER_HOUR: '/hr' };

const inputClass = 'w-full h-10 px-3.5 rounded-md border border-grey-300 text-sm text-grey-900 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors';
const selectClass = `${inputClass} bg-white`;

export default function ContractCreatePage() {
  const { id: editId } = useParams();
  const isEdit = !!editId;
  const navigate = useNavigate();
  const { suppliers, carriers, wasteStreams, materials, loadAll } = useMasterDataStore();
  const [facilityName, setFacilityName] = useState('Statice B.V.');
  const [loadingContract, setLoadingContract] = useState(false);

  useEffect(() => {
    if (suppliers.length === 0 || carriers.length === 0 || wasteStreams.length === 0 || materials.length === 0) {
      loadAll();
    }
  }, [suppliers.length, carriers.length, wasteStreams.length, materials.length, loadAll]);

  // Auto-select single supplier (create mode only)
  useEffect(() => {
    if (!isEdit && suppliers.length === 1 && !form.supplier_id) {
      setForm((f) => ({ ...f, supplier_id: suppliers[0].id }));
    }
  }, [suppliers, isEdit]);

  // Auto-select single carrier (create mode only)
  useEffect(() => {
    if (!isEdit && carriers.length === 1 && !form.carrier_id) {
      setForm((f) => ({ ...f, carrier_id: carriers[0].id }));
    }
  }, [carriers, isEdit]);

  // Fetch facility name for Receiver field
  useEffect(() => {
    getSettings()
      .then(({ data }) => {
        if (data.data?.facility_name) setFacilityName(data.data.facility_name);
      })
      .catch(() => {});
  }, []);

  // --- Form state ---
  const [form, setForm] = useState({
    supplier_id: '',
    carrier_id: '',
    name: '',
    effective_date: '',
    expiry_date: '',
    payment_term_days: 30,
    invoicing_frequency: 'MONTHLY',
    currency: 'EUR',
    invoice_delivery_method: '',
    contamination_tolerance_pct: 0,
  });

  // Waste stream cards: array of { id (temp), waste_stream_id, afvalstroomnummer, expanded, rate_lines: [] }
  const [wsCards, setWsCards] = useState([]);
  const [selectedPenaltyIds, setSelectedPenaltyIds] = useState([]);
  const [showPenaltyModal, setShowPenaltyModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [allFees, setAllFees] = useState([]);

  // Fetch all fees for display
  useEffect(() => {
    listFees({ active: 'true' })
      .then(({ data }) => setAllFees(data.data))
      .catch(() => {});
  }, []);

  // Fetch contract for edit mode
  useEffect(() => {
    if (!editId) return;
    setLoadingContract(true);
    getContract(editId)
      .then(({ data }) => {
        const c = data.data;
        setForm({
          supplier_id: c.supplier_id || c.supplier?.id || '',
          carrier_id: c.carrier_id || c.carrier?.id || '',
          name: c.name || '',
          effective_date: c.effective_date ? c.effective_date.slice(0, 10) : '',
          expiry_date: c.expiry_date ? c.expiry_date.slice(0, 10) : '',
          payment_term_days: c.payment_term_days ?? 30,
          invoicing_frequency: c.invoicing_frequency || 'MONTHLY',
          currency: c.currency || 'EUR',
          invoice_delivery_method: c.invoice_delivery_method || '',
          contamination_tolerance_pct: c.contamination_tolerance_pct ?? 0,
        });
        if (c.receiver_name) setFacilityName(c.receiver_name);
        // Pre-fill waste stream cards
        if (c.contract_waste_streams?.length > 0) {
          setWsCards(c.contract_waste_streams.map((cws) => ({
            id: cws.id,
            waste_stream_id: cws.waste_stream?.id || cws.waste_stream_id,
            afvalstroomnummer: cws.afvalstroomnummer || '',
            expanded: true,
            rate_lines: (cws.rate_lines || []).map((rl) => {
              const mat = materials.find((m) => m.id === (rl.material?.id || rl.material_id));
              return {
                id: rl.id,
                material_id: rl.material?.id || rl.material_id,
                pricing_model: rl.pricing_model,
                unit_rate: rl.unit_rate ?? '',
                btw_rate: rl.btw_rate ?? 21,
                processing_method: rl.processing_method || '',
                eural_code: mat?.eural_code || rl.material?.eural_code || '',
              };
            }),
          })));
        }
        // Pre-fill penalties
        if (c.contamination_penalties?.length > 0) {
          setSelectedPenaltyIds(c.contamination_penalties.map((p) => p.fee?.id || p.fee_id));
        }
      })
      .catch(() => {
        toast.error('Failed to load contract');
        navigate('/contracts');
      })
      .finally(() => setLoadingContract(false));
  }, [editId, navigate, materials]);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  }

  // --- Waste Stream management ---
  function addWasteStreamCard() {
    setWsCards((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        waste_stream_id: '',
        afvalstroomnummer: '',
        expanded: true,
        rate_lines: [],
      },
    ]);
  }

  function updateWsCard(cardId, updates) {
    setWsCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, ...updates } : c)));
  }

  function removeWsCard(cardId) {
    setWsCards((prev) => prev.filter((c) => c.id !== cardId));
  }

  function addRateLineToCard(cardId) {
    setWsCards((prev) =>
      prev.map((c) =>
        c.id === cardId
          ? {
              ...c,
              rate_lines: [
                ...c.rate_lines,
                { id: crypto.randomUUID(), material_id: '', pricing_model: 'WEIGHT', unit_rate: '', btw_rate: 21, processing_method: '', eural_code: '' },
              ],
            }
          : c
      )
    );
  }

  function updateRateLine(cardId, lineId, updates) {
    setWsCards((prev) =>
      prev.map((c) =>
        c.id === cardId
          ? {
              ...c,
              rate_lines: c.rate_lines.map((rl) => {
                if (rl.id !== lineId) return rl;
                const updated = { ...rl, ...updates };
                // Auto-fill eural_code when material changes
                if (updates.material_id && updates.material_id !== rl.material_id) {
                  const mat = materials.find((m) => m.id === updates.material_id);
                  updated.eural_code = mat?.eural_code || '';
                }
                return updated;
              }),
            }
          : c
      )
    );
  }

  function removeRateLine(cardId, lineId) {
    setWsCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, rate_lines: c.rate_lines.filter((rl) => rl.id !== lineId) } : c))
    );
  }

  // IDs of waste streams already used
  const usedWsIds = wsCards.map((c) => c.waste_stream_id).filter(Boolean);

  // Materials fully used in card (both WEIGHT + QUANTITY added)
  function fullyUsedMaterialIds(card) {
    const combos = {};
    for (const rl of card.rate_lines) {
      if (!rl.material_id) continue;
      if (!combos[rl.material_id]) combos[rl.material_id] = new Set();
      combos[rl.material_id].add(rl.pricing_model);
    }
    return Object.entries(combos)
      .filter(([, models]) => models.size >= PRICING_MODELS.length)
      .map(([id]) => id);
  }

  // --- Submit ---
  async function handleSubmit(e) {
    e.preventDefault();

    // Validate at least one waste stream with at least one rate line
    const validCards = wsCards.filter((c) => c.waste_stream_id && c.afvalstroomnummer);
    if (validCards.length === 0) {
      toast.error('Add at least one waste stream with an Afvalstroomnummer');
      return;
    }
    for (const card of validCards) {
      if (card.rate_lines.length === 0) {
        const ws = wasteStreams.find((w) => w.id === card.waste_stream_id);
        toast.error(`Add at least one material to "${ws?.name || 'waste stream'}"`);
        return;
      }
      for (const rl of card.rate_lines) {
        if (!rl.material_id || !rl.unit_rate) {
          toast.error('All material lines must have a material and unit rate');
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        ...form,
        payment_term_days: parseInt(form.payment_term_days, 10),
        contamination_tolerance_pct: parseFloat(form.contamination_tolerance_pct),
        invoice_delivery_method: form.invoice_delivery_method || null,
        expiry_date: form.expiry_date || null,
        contract_waste_streams: validCards.map((c) => ({
          waste_stream_id: c.waste_stream_id,
          afvalstroomnummer: c.afvalstroomnummer,
          rate_lines: c.rate_lines
            .filter((rl) => rl.material_id && rl.unit_rate)
            .map((rl) => ({
              material_id: rl.material_id,
              pricing_model: rl.pricing_model,
              unit_rate: parseFloat(rl.unit_rate),
              btw_rate: parseFloat(rl.btw_rate),
              processing_method: rl.processing_method || null,
            })),
        })),
        penalty_fee_ids: selectedPenaltyIds,
      };

      if (isEdit) {
        await updateContract(editId, payload);
        toast.success('Contract updated');
        navigate(`/contracts/${editId}`);
      } else {
        await createContract(payload);
        toast.success('Contract created');
        navigate('/contracts');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save contract');
    } finally {
      setSubmitting(false);
    }
  }

  const currencySymbol = CURRENCIES.find((c) => c.code === form.currency)?.symbol || '\u20AC';

  return (
    <div>
      <Breadcrumb items={[{ label: 'Contracts', to: '/contracts' }, ...(isEdit ? [{ label: form.name || 'Edit', to: `/contracts/${editId}` }, { label: 'Edit' }] : [{ label: 'New Contract' }])]} />
      <h1 className="text-xl font-semibold text-grey-900 mb-6">{isEdit ? 'Edit Contract' : 'New Contract'}</h1>
      {loadingContract && <div className="text-center py-12 text-grey-400">Loading...</div>}

      <form onSubmit={handleSubmit}>
        {/* === TOP ROW: 3 columns === */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Contract Details */}
          <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-grey-900 mb-4">Contract Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-grey-700 mb-1.5">Contract Name <span className="text-red-500">*</span></label>
                <input name="name" value={form.name} onChange={handleChange} required placeholder="e.g. 2026 WEEE Processing Agreement" className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-grey-700 mb-1.5">Supplier <span className="text-red-500">*</span></label>
                <select name="supplier_id" value={form.supplier_id} onChange={handleChange} required disabled={isEdit} className={`${selectClass} ${isEdit ? 'opacity-60 cursor-not-allowed' : ''}`}>
                  <option value="">Select supplier...</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-grey-700 mb-1.5">Carrier <span className="text-red-500">*</span></label>
                <select name="carrier_id" value={form.carrier_id} onChange={handleChange} required className={selectClass}>
                  <option value="">Select carrier...</option>
                  {carriers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-grey-700 mb-1.5">Effective Date <span className="text-red-500">*</span></label>
                  <input name="effective_date" type="date" value={form.effective_date} onChange={handleChange} required className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-grey-700 mb-1.5">Expiry Date</label>
                  <input name="expiry_date" type="date" value={form.expiry_date} onChange={handleChange} className={inputClass} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-grey-700 mb-1.5">Receiver</label>
                <div className="h-10 bg-grey-50 border border-grey-200 rounded-md px-3.5 text-sm text-grey-700 flex items-center">
                  {facilityName}
                </div>
              </div>
            </div>
          </div>

          {/* Payment Details */}
          <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-grey-900 mb-4">Payment Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-grey-700 mb-1.5">Payment Term (days)</label>
                <input name="payment_term_days" type="number" min="0" value={form.payment_term_days} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-grey-700 mb-1.5">Invoicing Frequency</label>
                <select name="invoicing_frequency" value={form.invoicing_frequency} onChange={handleChange} className={selectClass}>
                  {INVOICING_FREQUENCIES.map((f) => <option key={f} value={f}>{FREQ_LABELS[f]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-grey-700 mb-1.5">Currency</label>
                <select name="currency" value={form.currency} onChange={handleChange} className={selectClass}>
                  {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-grey-700 mb-1.5">Invoice Delivery</label>
                <input name="invoice_delivery_method" value={form.invoice_delivery_method} onChange={handleChange} placeholder="e.g. EMAIL" className={inputClass} />
              </div>
            </div>
          </div>

          {/* Contamination Details */}
          <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-grey-900">Contamination Details</h2>
              <button type="button" onClick={() => setShowPenaltyModal(true)}
                className="h-8 px-3 bg-white text-grey-700 border border-grey-300 rounded-md text-xs font-semibold hover:bg-grey-50 transition-colors">
                Manage Penalties ({selectedPenaltyIds.length})
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-grey-700 mb-1.5">Tolerance (%)</label>
                <input name="contamination_tolerance_pct" type="number" step="0.1" min="0" max="100" value={form.contamination_tolerance_pct} onChange={handleChange} className={inputClass} />
              </div>
              {selectedPenaltyIds.length > 0 && (
                <div className="border-t border-grey-200 pt-3">
                  <p className="text-xs font-medium text-grey-500 uppercase tracking-wide mb-2">Selected Penalties</p>
                  <div className="space-y-1.5">
                    {selectedPenaltyIds.map((feeId) => {
                      const fee = allFees.find((f) => f.id === feeId);
                      if (!fee) return null;
                      return (
                        <div key={feeId} className="flex items-center justify-between py-1.5 px-2.5 rounded bg-grey-50 border border-grey-200">
                          <span className="text-xs font-medium text-grey-900">{FEE_TYPE_LABELS[fee.fee_type] || fee.fee_type}</span>
                          <span className="text-xs text-grey-600">
                            {fee.rate_type === 'PERCENTAGE' ? `${fee.rate_value}%` : `\u20AC${Number(fee.rate_value).toFixed(2)}${RATE_TYPE_LABELS[fee.rate_type]}`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* === FULL WIDTH: Waste Streams === */}
        <div className="bg-white rounded-lg border border-grey-200 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-grey-200">
            <h2 className="text-sm font-semibold text-grey-900">Waste Streams</h2>
            <button type="button" onClick={addWasteStreamCard}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-500 hover:text-green-700 transition-colors">
              <Plus size={16} strokeWidth={2} /> Add Waste Stream
            </button>
          </div>

          <div className="p-5 space-y-4">
            {wsCards.length === 0 && (
              <p className="text-sm text-grey-400 text-center py-6">No waste streams added yet</p>
            )}

            {wsCards.map((card) => {
              const wsInfo = wasteStreams.find((w) => w.id === card.waste_stream_id);
              const usedMats = fullyUsedMaterialIds(card);
              const filteredMaterials = card.waste_stream_id
                ? materials.filter((m) => m.waste_stream_id === card.waste_stream_id)
                : materials;

              return (
                <div key={card.id} className="border border-grey-200 rounded-lg overflow-hidden">
                  {/* Card Header */}
                  <div
                    className="flex items-center justify-between px-4 py-3 bg-grey-25 cursor-pointer hover:bg-grey-50 transition-colors"
                    onClick={() => updateWsCard(card.id, { expanded: !card.expanded })}
                  >
                    <div className="flex items-center gap-2">
                      {card.expanded ? <ChevronDown size={16} className="text-grey-500" /> : <ChevronRight size={16} className="text-grey-500" />}
                      <span className="text-sm font-semibold text-grey-900">
                        {wsInfo ? `${wsInfo.name} \u2014 ${wsInfo.code}` : 'Select waste stream...'}
                      </span>
                      {card.afvalstroomnummer && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-25 text-green-700 border border-green-300">
                          ASN: {card.afvalstroomnummer}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeWsCard(card.id); }}
                      className="p-1 text-grey-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* Card Body */}
                  {card.expanded && (
                    <div className="px-4 py-4 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-grey-700 mb-1.5">Waste Stream <span className="text-red-500">*</span></label>
                          <select
                            value={card.waste_stream_id}
                            onChange={(e) => updateWsCard(card.id, { waste_stream_id: e.target.value, rate_lines: [] })}
                            className={selectClass}
                          >
                            <option value="">Select...</option>
                            {wasteStreams
                              .filter((ws) => ws.id === card.waste_stream_id || !usedWsIds.includes(ws.id))
                              .map((ws) => <option key={ws.id} value={ws.id}>{ws.name} ({ws.code})</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-grey-700 mb-1.5">Afvalstroomnummer <span className="text-red-500">*</span></label>
                          <input
                            value={card.afvalstroomnummer}
                            onChange={(e) => updateWsCard(card.id, { afvalstroomnummer: e.target.value })}
                            placeholder="e.g. AVR1234567"
                            className={inputClass}
                          />
                        </div>
                      </div>

                      {/* Rate Lines Table */}
                      {card.waste_stream_id && (
                        <>
                          <div className="text-xs font-medium text-grey-500 uppercase tracking-wide">Material Lines</div>
                          {card.rate_lines.length > 0 && (
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs min-w-[1050px]">
                                <thead>
                                  <tr className="border-b border-grey-200">
                                    <th className="text-left py-2 pr-2 text-xs font-medium text-grey-500 w-[200px]">Material</th>
                                    <th className="text-left py-2 px-2 text-xs font-medium text-grey-500 w-[100px]">EURAL Code</th>
                                    <th className="text-left py-2 px-2 text-xs font-medium text-grey-500 max-w-[280px]">Processing Method</th>
                                    <th className="text-left py-2 px-2 text-xs font-medium text-grey-500 w-[130px]">Pricing</th>
                                    <th className="text-left py-2 px-2 text-xs font-medium text-grey-500 w-[120px]">Unit Rate</th>
                                    <th className="text-left py-2 px-2 text-xs font-medium text-grey-500 w-[80px]">BTW %</th>
                                    <th className="w-7 py-2"></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {card.rate_lines.map((rl) => (
                                    <tr key={rl.id} className="border-b border-grey-100">
                                      <td className="py-1.5 pr-2">
                                        <select
                                          value={rl.material_id}
                                          onChange={(e) => updateRateLine(card.id, rl.id, { material_id: e.target.value })}
                                          className={`${selectClass} h-9 text-xs`}
                                        >
                                          <option value="">Material...</option>
                                          {filteredMaterials
                                            .filter((m) => m.id === rl.material_id || !usedMats.includes(m.id))
                                            .map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                                        </select>
                                      </td>
                                      <td className="py-1.5 px-2">
                                        <div className="h-9 bg-grey-50 border border-grey-200 rounded-md px-2.5 text-xs text-grey-600 flex items-center">
                                          {rl.eural_code || '\u2014'}
                                        </div>
                                      </td>
                                      <td className="py-1.5 px-2">
                                        <select
                                          value={rl.processing_method}
                                          onChange={(e) => updateRateLine(card.id, rl.id, { processing_method: e.target.value })}
                                          className={`${selectClass} h-9 text-xs`}
                                        >
                                          <option value="">Select...</option>
                                          {PROCESSING_METHODS.map((pm) => <option key={pm} value={pm}>{pm}</option>)}
                                        </select>
                                      </td>
                                      <td className="py-1.5 px-2">
                                        <select
                                          value={rl.pricing_model}
                                          onChange={(e) => updateRateLine(card.id, rl.id, { pricing_model: e.target.value })}
                                          className={`${selectClass} h-9 text-xs`}
                                        >
                                          {PRICING_MODELS.map((p) => <option key={p} value={p}>{PRICING_LABELS[p]}</option>)}
                                        </select>
                                      </td>
                                      <td className="py-1.5 px-2">
                                        <div className="relative">
                                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-grey-400 pointer-events-none">{currencySymbol}</span>
                                          <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={rl.unit_rate}
                                            onChange={(e) => updateRateLine(card.id, rl.id, { unit_rate: e.target.value })}
                                            placeholder="Rate"
                                            className={`${inputClass} h-9 text-xs pl-7`}
                                          />
                                        </div>
                                      </td>
                                      <td className="py-1.5 px-2">
                                        <input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          value={rl.btw_rate}
                                          onChange={(e) => updateRateLine(card.id, rl.id, { btw_rate: e.target.value })}
                                          placeholder="BTW %"
                                          className={`${inputClass} h-9 text-xs`}
                                        />
                                      </td>
                                      <td className="py-1.5 pl-2">
                                        <button
                                          type="button"
                                          onClick={() => removeRateLine(card.id, rl.id)}
                                          className="p-1 text-grey-400 hover:text-red-500 transition-colors"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => addRateLineToCard(card.id)}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-500 hover:text-green-700 transition-colors"
                          >
                            <Plus size={14} /> Add Material
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions — full width, right-aligned */}
        <div className="flex justify-end gap-3 mt-6">
          <button type="button" onClick={() => navigate(isEdit ? `/contracts/${editId}` : '/contracts')}
            className="h-9 px-4 bg-white text-grey-700 border border-grey-300 rounded-md text-sm font-semibold hover:bg-grey-50 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={submitting}
            className="h-9 px-4 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors">
            {submitting ? 'Saving...' : isEdit ? 'Update Contract' : 'Create Contract'}
          </button>
        </div>
      </form>

      {showPenaltyModal && (
        <PenaltySelectModal
          contractId={null}
          currentPenalties={selectedPenaltyIds.map((id) => ({ fee: { id } }))}
          onClose={() => setShowPenaltyModal(false)}
          onSuccess={(ids) => {
            setSelectedPenaltyIds(ids || []);
            setShowPenaltyModal(false);
          }}
        />
      )}
    </div>
  );
}
