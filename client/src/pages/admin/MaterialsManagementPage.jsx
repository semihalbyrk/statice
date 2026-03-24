import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Search, ChevronDown, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import ClickableStatusBadge from '../../components/ui/ClickableStatusBadge';
import StatusBadge from '../../components/ui/StatusBadge';
import RowActionMenu from '../../components/ui/RowActionMenu';
import useMasterDataStore from '../../store/masterDataStore';
import { getWasteStreams, createWasteStream, updateWasteStream } from '../../api/wasteStreams';
import { listMaterials, createMaterial, updateMaterial, listFractions, createFraction, updateFraction, replaceMaterialFractions } from '../../api/catalogue';

const inputClass = "w-full h-10 px-3.5 rounded-md border border-grey-300 text-sm text-grey-900 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors";
const selectClass = `${inputClass} bg-white`;
const TABS = ['Waste Streams', 'Materials', 'Fractions'];

const WEEE_CATEGORIES = [
  'Cat. 1 — Large Household Appliances',
  'Cat. 2 — Small Household Appliances',
  'Cat. 3 — IT and Telecommunications Equipment',
  'Cat. 4 — Consumer Equipment',
  'Cat. 5 — Lighting Equipment',
  'Cat. 6 — Electrical and Electronic Tools',
  'Cat. 7 — Toys, Leisure and Sports Equipment',
  'Cat. 8 — Medical Devices',
  'Cat. 9 — Monitoring and Control Instruments',
  'Cat. 10 — Automatic Dispensers',
];

// --- Waste Stream Form ---
function WasteStreamFormModal({ stream, onClose, onSuccess }) {
  const isEdit = !!stream;
  const [form, setForm] = useState({
    name: stream?.name || '', code: stream?.code || '',
    cbs_code: stream?.cbs_code || '', weeelabex_code: stream?.weeelabex_code || '', ewc_code: stream?.ewc_code || '',
  });
  const [submitting, setSubmitting] = useState(false);
  function handleChange(e) { setForm((p) => ({ ...p, [e.target.name]: e.target.value })); }
  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isEdit) { await updateWasteStream(stream.id, form); toast.success('Waste stream updated'); }
      else { await createWasteStream(form); toast.success('Waste stream created'); }
      onSuccess();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to save'); }
    finally { setSubmitting(false); }
  }
  return (
    <div className="app-modal-overlay">
      <div className="app-modal-panel max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-grey-200 shrink-0">
          <h2 className="text-lg font-semibold text-grey-900">{isEdit ? 'Edit Waste Stream' : 'New Waste Stream'}</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-grey-50 transition-colors text-grey-400">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4 flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium text-grey-700 mb-1.5">Code <span className="text-red-500">*</span></label>
              <input name="code" value={form.code} onChange={handleChange} required className={inputClass} /></div>
            <div><label className="block text-sm font-medium text-grey-700 mb-1.5">EWC Code</label>
              <input name="ewc_code" value={form.ewc_code} onChange={handleChange} className={inputClass} /></div>
          </div>
          <div><label className="block text-sm font-medium text-grey-700 mb-1.5">Name <span className="text-red-500">*</span></label>
            <input name="name" value={form.name} onChange={handleChange} required className={inputClass} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium text-grey-700 mb-1.5">CBS Code</label>
              <input name="cbs_code" value={form.cbs_code} onChange={handleChange} className={inputClass} /></div>
            <div><label className="block text-sm font-medium text-grey-700 mb-1.5">WEEELABEX Code</label>
              <input name="weeelabex_code" value={form.weeelabex_code} onChange={handleChange} className={inputClass} /></div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="h-9 px-4 bg-white text-grey-700 border border-grey-300 rounded-md text-sm font-semibold hover:bg-grey-50 transition-colors">Cancel</button>
            <button type="submit" disabled={submitting} className="h-9 px-4 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors">
              {submitting ? 'Saving...' : isEdit ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- Material Form ---
function MaterialFormModal({ material, wasteStreams, allFractions, onClose, onSuccess }) {
  const isEdit = !!material;
  const [form, setForm] = useState({
    code: material?.code || '', name: material?.name || '',
    waste_stream_id: material?.waste_stream_id || '',
    cbs_code: material?.cbs_code || '', weeelabex_group: material?.weeelabex_group || '',
    eural_code: material?.eural_code || '', weee_category: material?.weee_category || '',
    default_process_description: material?.default_process_description || '',
    is_active: material?.is_active ?? true,
    fraction_ids: material?.fractions?.map((e) => e.fraction_id) || [],
  });
  const [submitting, setSubmitting] = useState(false);
  const [fracSearch, setFracSearch] = useState('');
  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((p) => ({ ...p, [name]: type === 'checkbox' ? checked : value }));
  }
  function toggleFraction(id) {
    setForm((p) => ({ ...p, fraction_ids: p.fraction_ids.includes(id) ? p.fraction_ids.filter((x) => x !== id) : [...p.fraction_ids, id] }));
  }
  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { fraction_ids, ...payload } = form;
      if (isEdit) {
        await updateMaterial(material.id, payload);
        await replaceMaterialFractions(material.id, { fraction_ids });
        toast.success('Material updated');
      } else {
        const { data } = await createMaterial(payload);
        if (fraction_ids.length > 0) await replaceMaterialFractions(data.data.id, { fraction_ids });
        toast.success('Material created');
      }
      onSuccess();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to save'); }
    finally { setSubmitting(false); }
  }

  const filteredFractions = allFractions.filter((f) => {
    if (!fracSearch) return true;
    const q = fracSearch.toLowerCase();
    return f.code.toLowerCase().includes(q) || f.name.toLowerCase().includes(q);
  });

  return (
    <div className="app-modal-overlay">
      <div className="app-modal-panel max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-grey-200 shrink-0">
          <h2 className="text-lg font-semibold text-grey-900">{isEdit ? 'Edit Material' : 'New Material'}</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-grey-50 transition-colors text-grey-400">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4 flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium text-grey-700 mb-1.5">Code <span className="text-red-500">*</span></label>
              <input name="code" value={form.code} onChange={handleChange} required className={inputClass} /></div>
            <div><label className="block text-sm font-medium text-grey-700 mb-1.5">Waste Stream <span className="text-red-500">*</span></label>
              <select name="waste_stream_id" value={form.waste_stream_id} onChange={handleChange} required className={selectClass}>
                <option value="">Select...</option>
                {wasteStreams.map((ws) => <option key={ws.id} value={ws.id}>{ws.code} — {ws.name}</option>)}
              </select></div>
          </div>
          <div>
            <label className="block text-sm font-medium text-grey-700 mb-1.5">Name <span className="text-red-500">*</span></label>
            <input name="name" value={form.name} onChange={handleChange} required className={inputClass} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="block text-sm font-medium text-grey-700 mb-1.5">CBS Code</label>
              <input name="cbs_code" value={form.cbs_code} onChange={handleChange} className={inputClass} /></div>
            <div><label className="block text-sm font-medium text-grey-700 mb-1.5">WEEELABEX Group</label>
              <input name="weeelabex_group" value={form.weeelabex_group} onChange={handleChange} className={inputClass} /></div>
            <div><label className="block text-sm font-medium text-grey-700 mb-1.5">EURAL Code</label>
              <input name="eural_code" value={form.eural_code} onChange={handleChange} className={inputClass} /></div>
          </div>
          <div>
            <label className="block text-sm font-medium text-grey-700 mb-1.5">WEEE Category</label>
            <select name="weee_category" value={form.weee_category} onChange={handleChange} className={selectClass}>
              <option value="">Select...</option>
              {WEEE_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm text-grey-700 cursor-pointer">
              <input name="is_active" type="checkbox" checked={form.is_active} onChange={handleChange}
                className="h-4 w-4 rounded border-grey-300 text-green-500 focus:ring-green-500/15" /> Active
            </label>
          </div>
          {allFractions.length > 0 && (
            <div className="border-t border-grey-200 pt-4">
              <p className="text-sm font-semibold text-grey-900 mb-2">Linked Fractions ({form.fraction_ids.length})</p>
              <input type="text" placeholder="Search fractions..." value={fracSearch} onChange={(e) => setFracSearch(e.target.value)}
                className="w-full h-8 px-3 rounded-md border border-grey-300 text-xs text-grey-900 placeholder:text-grey-400 focus:border-green-500 outline-none mb-2" />
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {filteredFractions.map((f) => (
                  <label key={f.id} className="flex items-center gap-2 p-2 rounded border border-grey-200 hover:bg-grey-50 cursor-pointer text-sm">
                    <input type="checkbox" checked={form.fraction_ids.includes(f.id)} onChange={() => toggleFraction(f.id)}
                      className="h-4 w-4 rounded border-grey-300 text-green-500 focus:ring-green-500/15" />
                    <span className="text-grey-700">{f.code} — {f.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="h-9 px-4 bg-white text-grey-700 border border-grey-300 rounded-md text-sm font-semibold hover:bg-grey-50 transition-colors">Cancel</button>
            <button type="submit" disabled={submitting} className="h-9 px-4 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors">
              {submitting ? 'Saving...' : isEdit ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- Fraction Form ---
function FractionFormModal({ fraction, onClose, onSuccess }) {
  const isEdit = !!fraction;
  const [form, setForm] = useState({
    code: fraction?.code || '', name: fraction?.name || '',
    eural_code: fraction?.eural_code || '', default_process_description: fraction?.default_process_description || '',
    is_active: fraction?.is_active ?? true,
  });
  const [submitting, setSubmitting] = useState(false);
  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((p) => ({ ...p, [name]: type === 'checkbox' ? checked : value }));
  }
  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isEdit) { await updateFraction(fraction.id, form); toast.success('Fraction updated'); }
      else { await createFraction(form); toast.success('Fraction created'); }
      onSuccess();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to save'); }
    finally { setSubmitting(false); }
  }
  return (
    <div className="app-modal-overlay">
      <div className="app-modal-panel max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-grey-200 shrink-0">
          <h2 className="text-lg font-semibold text-grey-900">{isEdit ? 'Edit Fraction' : 'New Fraction'}</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-grey-50 transition-colors text-grey-400">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4 flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium text-grey-700 mb-1.5">Code <span className="text-red-500">*</span></label>
              <input name="code" value={form.code} onChange={handleChange} required className={inputClass} /></div>
            <div><label className="block text-sm font-medium text-grey-700 mb-1.5">EURAL Code</label>
              <input name="eural_code" value={form.eural_code} onChange={handleChange} className={inputClass} /></div>
          </div>
          <div><label className="block text-sm font-medium text-grey-700 mb-1.5">Name <span className="text-red-500">*</span></label>
            <input name="name" value={form.name} onChange={handleChange} required className={inputClass} /></div>
          <div>
            <label className="flex items-center gap-2 text-sm text-grey-700 cursor-pointer">
              <input name="is_active" type="checkbox" checked={form.is_active} onChange={handleChange}
                className="h-4 w-4 rounded border-grey-300 text-green-500 focus:ring-green-500/15" /> Active
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="h-9 px-4 bg-white text-grey-700 border border-grey-300 rounded-md text-sm font-semibold hover:bg-grey-50 transition-colors">Cancel</button>
            <button type="submit" disabled={submitting} className="h-9 px-4 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors">
              {submitting ? 'Saving...' : isEdit ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- Main Page ---
export default function MaterialsManagementPage() {
  const syncMasterData = useMasterDataStore((s) => s.fetchMaterials);

  const [wasteStreams, setWasteStreams] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [fractions, setFractions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [search, setSearch] = useState('');
  const [wsFilter, setWsFilter] = useState('');

  // Accordion (inline expansion)
  const [expandedWs, setExpandedWs] = useState({});
  const [expandedMat, setExpandedMat] = useState({});

  // Modals
  const [wsModal, setWsModal] = useState({ open: false, stream: null });
  const [matModal, setMatModal] = useState({ open: false, material: null });
  const [fracModal, setFracModal] = useState({ open: false, fraction: null });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [wsRes, matRes, fracRes] = await Promise.all([
        getWasteStreams(),
        listMaterials(),
        listFractions(),
      ]);
      setWasteStreams(wsRes.data.data);
      setMaterials(matRes.data.data);
      setFractions(fracRes.data.data);
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function handleSuccess() {
    await fetchAll();
    await syncMasterData();
  }

  async function handleWsStatusTransition(ws, newStatus) {
    const isActive = newStatus === 'ACTIVE';
    try {
      await updateWasteStream(ws.id, { ...ws, is_active: isActive });
      toast.success(isActive ? 'Waste stream activated' : 'Waste stream deactivated');
      await handleSuccess();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update status');
    }
  }

  async function handleMatStatusTransition(mat, newStatus) {
    const isActive = newStatus === 'ACTIVE';
    try {
      await updateMaterial(mat.id, { code: mat.code, name: mat.name, waste_stream_id: mat.waste_stream_id, is_active: isActive });
      toast.success(isActive ? 'Material activated' : 'Material deactivated');
      await handleSuccess();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update status');
    }
  }

  async function handleFracStatusTransition(frac, newStatus) {
    const isActive = newStatus === 'ACTIVE';
    try {
      await updateFraction(frac.id, { code: frac.code, name: frac.name, is_active: isActive });
      toast.success(isActive ? 'Fraction activated' : 'Fraction deactivated');
      await handleSuccess();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update status');
    }
  }

  // Group materials by waste_stream_id
  const matCountByWs = {};
  const matByWs = {};
  for (const m of materials) {
    matCountByWs[m.waste_stream_id] = (matCountByWs[m.waste_stream_id] || 0) + 1;
    if (!matByWs[m.waste_stream_id]) matByWs[m.waste_stream_id] = [];
    matByWs[m.waste_stream_id].push(m);
  }

  // Waste stream name lookup
  const wsNameMap = {};
  for (const ws of wasteStreams) {
    wsNameMap[ws.id] = `${ws.code} — ${ws.name}`;
  }

  // Search filter
  const q = search.toLowerCase();

  const filteredWasteStreams = wasteStreams.filter((ws) => {
    if (!q) return true;
    return ws.name.toLowerCase().includes(q) || ws.code.toLowerCase().includes(q) || (ws.ewc_code || '').toLowerCase().includes(q);
  });

  const filteredMaterials = materials.filter((m) => {
    if (wsFilter && m.waste_stream_id !== wsFilter) return false;
    if (!q) return true;
    return m.code.toLowerCase().includes(q) || m.name.toLowerCase().includes(q) || (m.weee_category || '').toLowerCase().includes(q);
  });

  const filteredFractions = fractions.filter((f) => {
    if (!q) return true;
    return f.code.toLowerCase().includes(q) || f.name.toLowerCase().includes(q) || (f.eural_code || '').toLowerCase().includes(q);
  });

  function getAddButton() {
    if (activeTab === 0) return (
      <button onClick={() => setWsModal({ open: true, stream: null })}
        className="flex items-center gap-2 h-9 px-4 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-700 transition-colors">
        <Plus size={16} strokeWidth={2} /> Waste Stream
      </button>
    );
    if (activeTab === 1) return (
      <button onClick={() => setMatModal({ open: true, material: null })}
        className="flex items-center gap-2 h-9 px-4 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-700 transition-colors">
        <Plus size={16} strokeWidth={2} /> Material
      </button>
    );
    return (
      <button onClick={() => setFracModal({ open: true, fraction: null })}
        className="flex items-center gap-2 h-9 px-4 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-700 transition-colors">
        <Plus size={16} strokeWidth={2} /> Fraction
      </button>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-grey-900">Materials Management</h1>
        {getAddButton()}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        {TABS.map((tab, i) => (
          <button key={tab} onClick={() => { setActiveTab(i); setSearch(''); setWsFilter(''); }}
            className={`h-8 px-3 rounded-md text-xs font-medium transition-colors ${activeTab === i
              ? 'bg-green-500 text-white'
              : 'bg-grey-100 text-grey-600 hover:bg-grey-200'
            }`}>
            {tab}
          </button>
        ))}
      </div>

      {/* Search + Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-grey-400" />
          <input type="text" placeholder={`Search ${TABS[activeTab].toLowerCase()}...`} value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-3 rounded-md border border-grey-300 text-sm text-grey-900 placeholder:text-grey-400 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors" />
        </div>
        {activeTab === 1 && (
          <select value={wsFilter} onChange={(e) => setWsFilter(e.target.value)} className="app-list-filter-select">
            <option value="">All Waste Streams</option>
            {wasteStreams.map((ws) => <option key={ws.id} value={ws.id}>{ws.code} — {ws.name}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-8 text-center text-grey-400 text-sm">Loading...</div>
      ) : (
        <div className="bg-white rounded-lg border border-grey-200 shadow-sm overflow-visible">
          {/* Waste Streams Tab */}
          {activeTab === 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-grey-50 border-b border-grey-200">
                  <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Code</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">EWC Code</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Materials</th>
                  <th className="w-10 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filteredWasteStreams.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-grey-400">No waste streams found</td></tr>
                ) : filteredWasteStreams.map((ws) => (
                  <React.Fragment key={ws.id}>
                    <tr className="border-b border-grey-100 hover:bg-grey-50 transition-colors cursor-pointer"
                      onClick={() => setExpandedWs((p) => ({ ...p, [ws.id]: !p[ws.id] }))}>
                      <td className="px-4 py-3 font-medium text-green-700">
                        <span className="inline-flex items-center gap-1.5">
                          {(matCountByWs[ws.id] || 0) > 0
                            ? (expandedWs[ws.id] ? <ChevronDown size={14} className="text-grey-400" /> : <ChevronRight size={14} className="text-grey-400" />)
                            : <span className="w-3.5" />}
                          {ws.code}
                        </span>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <ClickableStatusBadge
                          status={ws.is_active ? 'ACTIVE' : 'INACTIVE'}
                          allowedTransitions={ws.is_active ? ['INACTIVE'] : ['ACTIVE']}
                          onTransition={(newStatus) => handleWsStatusTransition(ws, newStatus)}
                        />
                      </td>
                      <td className="px-4 py-3 text-grey-900">{ws.name}</td>
                      <td className="px-4 py-3 text-grey-700">{ws.ewc_code || '\u2014'}</td>
                      <td className="px-4 py-3 text-right text-grey-700">{matCountByWs[ws.id] || 0}</td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <RowActionMenu actions={[
                          { label: 'Edit', icon: Pencil, onClick: () => setWsModal({ open: true, stream: ws }) },
                        ]} />
                      </td>
                    </tr>
                    {expandedWs[ws.id] && (matByWs[ws.id] || []).length > 0 && (
                      <tr>
                        <td colSpan={6} className="p-0">
                          <div className="bg-grey-25 border-b border-grey-200">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-grey-200">
                                  <th className="pl-12 pr-4 py-2 text-left text-xs font-medium text-grey-500 uppercase tracking-wide">Code</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-grey-500 uppercase tracking-wide">Status</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-grey-500 uppercase tracking-wide">Name</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-grey-500 uppercase tracking-wide">Category</th>
                                  <th className="px-4 py-2 text-right text-xs font-medium text-grey-500 uppercase tracking-wide">Fractions</th>
                                  <th className="w-10"></th>
                                </tr>
                              </thead>
                              <tbody>
                                {(matByWs[ws.id] || []).map((mat) => (
                                  <tr key={mat.id} className="border-b border-grey-100 last:border-b-0">
                                    <td className="pl-12 pr-4 py-2 font-medium text-grey-900 text-xs">{mat.code}</td>
                                    <td className="px-4 py-2 text-xs">
                                      <StatusBadge status={mat.is_active ? 'ACTIVE' : 'INACTIVE'} />
                                    </td>
                                    <td className="px-4 py-2 text-xs text-grey-700">{mat.name}</td>
                                    <td className="px-4 py-2 text-xs text-grey-700">{mat.weee_category || '\u2014'}</td>
                                    <td className="px-4 py-2 text-right text-xs text-grey-500">{mat.fractions?.length || 0}</td>
                                    <td className="w-10"></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}

          {/* Materials Tab */}
          {activeTab === 1 && (
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1000px]">
              <thead>
                <tr className="bg-grey-50 border-b border-grey-200">
                  <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Code</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Waste Stream</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">CBS Code</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">WEEELABEX</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">EURAL Code</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">WEEE Category</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Fractions</th>
                  <th className="w-10 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filteredMaterials.length === 0 ? (
                  <tr><td colSpan={10} className="px-4 py-8 text-center text-grey-400">No materials found</td></tr>
                ) : filteredMaterials.map((m) => (
                  <React.Fragment key={m.id}>
                    <tr className="border-b border-grey-100 hover:bg-grey-50 transition-colors cursor-pointer"
                      onClick={() => setExpandedMat((p) => ({ ...p, [m.id]: !p[m.id] }))}>
                      <td className="px-4 py-3 font-medium text-green-700">
                        <span className="inline-flex items-center gap-1.5">
                          {(m.fractions?.length || 0) > 0
                            ? (expandedMat[m.id] ? <ChevronDown size={14} className="text-grey-400" /> : <ChevronRight size={14} className="text-grey-400" />)
                            : <span className="w-3.5" />}
                          {m.code}
                        </span>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <ClickableStatusBadge
                          status={m.is_active ? 'ACTIVE' : 'INACTIVE'}
                          allowedTransitions={m.is_active ? ['INACTIVE'] : ['ACTIVE']}
                          onTransition={(newStatus) => handleMatStatusTransition(m, newStatus)}
                        />
                      </td>
                      <td className="px-4 py-3 text-grey-900">{m.name}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-grey-100 text-grey-700 border border-grey-200">
                          {wsNameMap[m.waste_stream_id] || '\u2014'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-grey-700 text-xs">{m.cbs_code || '\u2014'}</td>
                      <td className="px-4 py-3 text-grey-700 text-xs">{m.weeelabex_group || '\u2014'}</td>
                      <td className="px-4 py-3 text-grey-700 text-xs">{m.eural_code || '\u2014'}</td>
                      <td className="px-4 py-3 text-grey-700">{m.weee_category || '\u2014'}</td>
                      <td className="px-4 py-3 text-right text-grey-700">{m.fractions?.length || 0}</td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <RowActionMenu actions={[
                          { label: 'Edit', icon: Pencil, onClick: () => setMatModal({ open: true, material: m }) },
                        ]} />
                      </td>
                    </tr>
                    {expandedMat[m.id] && (m.fractions?.length || 0) > 0 && (
                      <tr>
                        <td colSpan={10} className="p-0">
                          <div className="bg-grey-25 border-b border-grey-200">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-grey-200">
                                  <th className="pl-12 pr-4 py-2 text-left text-xs font-medium text-grey-500 uppercase tracking-wide">Code</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-grey-500 uppercase tracking-wide">Status</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-grey-500 uppercase tracking-wide">Name</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-grey-500 uppercase tracking-wide">EURAL Code</th>
                                  <th className="w-10"></th>
                                </tr>
                              </thead>
                              <tbody>
                                {(m.fractions || []).map((mf) => {
                                  const frac = mf.fraction || mf;
                                  return (
                                    <tr key={mf.id || frac.id} className="border-b border-grey-100 last:border-b-0">
                                      <td className="pl-12 pr-4 py-2 font-medium text-grey-900 text-xs">{frac.code}</td>
                                      <td className="px-4 py-2 text-xs">
                                        <StatusBadge status={frac.is_active ? 'ACTIVE' : 'INACTIVE'} />
                                      </td>
                                      <td className="px-4 py-2 text-xs text-grey-700">{frac.name}</td>
                                      <td className="px-4 py-2 text-xs text-grey-700">{frac.eural_code || '\u2014'}</td>
                                      <td className="w-10"></td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
            </div>
          )}

          {/* Fractions Tab */}
          {activeTab === 2 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-grey-50 border-b border-grey-200">
                  <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Code</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">EURAL Code</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Linked Materials</th>
                  <th className="w-10 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filteredFractions.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-grey-400">No fractions found</td></tr>
                ) : filteredFractions.map((f) => {
                  const linkedMats = f.materials || [];
                  const matNames = linkedMats.map((lm) => lm.material?.code || lm.code).filter(Boolean);
                  return (
                    <tr key={f.id} className="border-b border-grey-100 hover:bg-grey-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-green-700">{f.code}</td>
                      <td className="px-4 py-3">
                        <ClickableStatusBadge
                          status={f.is_active ? 'ACTIVE' : 'INACTIVE'}
                          allowedTransitions={f.is_active ? ['INACTIVE'] : ['ACTIVE']}
                          onTransition={(newStatus) => handleFracStatusTransition(f, newStatus)}
                        />
                      </td>
                      <td className="px-4 py-3 text-grey-900">{f.name}</td>
                      <td className="px-4 py-3 text-grey-700">{f.eural_code || '\u2014'}</td>
                      <td className="px-4 py-3">
                        {linkedMats.length === 0 ? (
                          <span className="text-grey-400 text-xs">None</span>
                        ) : (
                          <span className="text-xs text-grey-700" title={matNames.join(', ')}>
                            {linkedMats.length} material{linkedMats.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <RowActionMenu actions={[
                          { label: 'Edit', icon: Pencil, onClick: () => setFracModal({ open: true, fraction: f }) },
                        ]} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Modals */}
      {wsModal.open && (
        <WasteStreamFormModal stream={wsModal.stream}
          onClose={() => setWsModal({ open: false, stream: null })}
          onSuccess={async () => { setWsModal({ open: false, stream: null }); await handleSuccess(); }} />
      )}
      {matModal.open && (
        <MaterialFormModal material={matModal.material}
          wasteStreams={wasteStreams} allFractions={fractions}
          onClose={() => setMatModal({ open: false, material: null })}
          onSuccess={async () => { setMatModal({ open: false, material: null }); await handleSuccess(); }} />
      )}
      {fracModal.open && (
        <FractionFormModal fraction={fracModal.fraction}
          onClose={() => setFracModal({ open: false, fraction: null })}
          onSuccess={async () => { setFracModal({ open: false, fraction: null }); await handleSuccess(); }} />
      )}
    </div>
  );
}
