import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import useMasterDataStore from '../../store/masterDataStore';
import {
  createFraction,
  createMaterial,
  listFractions,
  listMaterials,
  replaceMaterialFractions,
  updateFraction,
  updateMaterial,
} from '../../api/catalogue';
import StatusBadge from '../../components/ui/StatusBadge';

const inputClass = 'w-full h-10 px-3.5 rounded-md border border-grey-300 text-sm text-grey-900 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors';
const selectClass = `${inputClass} bg-white`;

function MaterialFormModal({ material, wasteStreams, productCategories, fractions, onClose, onSuccess }) {
  const isEdit = Boolean(material);
  const [form, setForm] = useState({
    code: material?.code || '',
    name_en: material?.name_en || '',
    name_nl: material?.name_nl || '',
    waste_stream_id: material?.waste_stream_id || '',
    cbs_code: material?.cbs_code || '',
    weeelabex_group: material?.weeelabex_group || '',
    eural_code: material?.eural_code || '',
    default_afvalstroomnummer: material?.default_afvalstroomnummer || '',
    weee_category: material?.weee_category || '',
    default_process_description: material?.default_process_description || '',
    legacy_category_id: material?.legacy_category_id || '',
    is_active: material?.is_active ?? true,
    fraction_ids: material?.fractions?.map((entry) => entry.fraction_id) || [],
  });
  const [submitting, setSubmitting] = useState(false);

  const eligibleCategories = productCategories.filter((category) => !form.waste_stream_id || category.waste_stream_id === form.waste_stream_id);

  function handleChange(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  }

  function toggleFraction(fractionId) {
    setForm((current) => ({
      ...current,
      fraction_ids: current.fraction_ids.includes(fractionId)
        ? current.fraction_ids.filter((id) => id !== fractionId)
        : [...current.fraction_ids, fractionId],
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    try {
      let materialId = material?.id;
      if (isEdit) {
        const { data } = await updateMaterial(material.id, form);
        materialId = data.data.id;
        toast.success('Material updated');
      } else {
        const { data } = await createMaterial(form);
        materialId = data.data.id;
        toast.success('Material created');
      }
      await replaceMaterialFractions(materialId, { fraction_ids: form.fraction_ids });
      onSuccess();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save material');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app-modal-overlay">
      <div className="app-modal-panel max-w-4xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-grey-200">
          <h2 className="text-lg font-semibold text-grey-900">{isEdit ? 'Edit Material' : 'New Material'}</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-grey-50 transition-colors text-grey-400">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">Code</label>
              <input name="code" value={form.code} onChange={handleChange} required className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">Waste Stream</label>
              <select name="waste_stream_id" value={form.waste_stream_id} onChange={handleChange} required className={selectClass}>
                <option value="">Select waste stream...</option>
                {wasteStreams.map((stream) => (
                  <option key={stream.id} value={stream.id}>{stream.name_en}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">Material Name (EN)</label>
              <input name="name_en" value={form.name_en} onChange={handleChange} required className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">Material Name (NL)</label>
              <input name="name_nl" value={form.name_nl} onChange={handleChange} required className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">CBS Code</label>
              <input name="cbs_code" value={form.cbs_code} onChange={handleChange} required className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">WEEELABEX Group</label>
              <input name="weeelabex_group" value={form.weeelabex_group} onChange={handleChange} required className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">EURAL Code</label>
              <input name="eural_code" value={form.eural_code} onChange={handleChange} required className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">WEEE Category</label>
              <input name="weee_category" value={form.weee_category} onChange={handleChange} required className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">Default Afvalstroom</label>
              <input name="default_afvalstroomnummer" value={form.default_afvalstroomnummer} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">Legacy Category</label>
              <select name="legacy_category_id" value={form.legacy_category_id} onChange={handleChange} className={selectClass}>
                <option value="">None</option>
                {eligibleCategories.map((category) => (
                  <option key={category.id} value={category.id}>{category.code_cbs} - {category.description_en}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">Status</label>
              <label className="inline-flex items-center gap-2 text-sm font-medium text-grey-700 h-10">
                <input type="checkbox" name="is_active" checked={form.is_active} onChange={handleChange} />
                Active
              </label>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-grey-700 mb-1.5">Default Process Description</label>
            <input name="default_process_description" value={form.default_process_description} onChange={handleChange} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-grey-700 mb-2">Fractions</label>
            <div className="max-h-64 overflow-y-auto rounded-lg border border-grey-200 p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
              {fractions.map((fraction) => (
                <label key={fraction.id} className="flex items-center gap-2 text-sm text-grey-700">
                  <input
                    type="checkbox"
                    checked={form.fraction_ids.includes(fraction.id)}
                    onChange={() => toggleFraction(fraction.id)}
                  />
                  <span>{fraction.code} - {fraction.name_en}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="h-9 px-4 bg-white text-grey-700 border border-grey-300 rounded-md text-sm font-semibold hover:bg-grey-50 transition-colors">Cancel</button>
            <button type="submit" disabled={submitting} className="h-9 px-4 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors">
              {submitting ? 'Saving...' : isEdit ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FractionFormModal({ fraction, onClose, onSuccess }) {
  const isEdit = Boolean(fraction);
  const [form, setForm] = useState({
    code: fraction?.code || '',
    name_en: fraction?.name_en || '',
    name_nl: fraction?.name_nl || '',
    eural_code: fraction?.eural_code || '',
    default_acceptant_stage: fraction?.default_acceptant_stage || 'FIRST_ACCEPTANT',
    default_process_description: fraction?.default_process_description || '',
    prepared_for_reuse_pct_default: String(fraction?.prepared_for_reuse_pct_default ?? 0),
    recycling_pct_default: String(fraction?.recycling_pct_default ?? 0),
    other_material_recovery_pct_default: String(fraction?.other_material_recovery_pct_default ?? 0),
    energy_recovery_pct_default: String(fraction?.energy_recovery_pct_default ?? 0),
    thermal_disposal_pct_default: String(fraction?.thermal_disposal_pct_default ?? 0),
    landfill_disposal_pct_default: String(fraction?.landfill_disposal_pct_default ?? 0),
    is_active: fraction?.is_active ?? true,
  });
  const [submitting, setSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    try {
      if (isEdit) {
        await updateFraction(fraction.id, form);
        toast.success('Fraction updated');
      } else {
        await createFraction(form);
        toast.success('Fraction created');
      }
      onSuccess();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save fraction');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app-modal-overlay">
      <div className="app-modal-panel max-w-4xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-grey-200">
          <h2 className="text-lg font-semibold text-grey-900">{isEdit ? 'Edit Fraction' : 'New Fraction'}</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-grey-50 transition-colors text-grey-400">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">Code</label>
              <input name="code" value={form.code} onChange={handleChange} required className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">Name (EN)</label>
              <input name="name_en" value={form.name_en} onChange={handleChange} required className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">Name (NL)</label>
              <input name="name_nl" value={form.name_nl} onChange={handleChange} required className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">EURAL Code</label>
              <input name="eural_code" value={form.eural_code} onChange={handleChange} required className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">Acceptant Stage</label>
              <select name="default_acceptant_stage" value={form.default_acceptant_stage} onChange={handleChange} className={selectClass}>
                <option value="FIRST_ACCEPTANT">First acceptant</option>
                <option value="FOLLOWING">Following</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-grey-700 mb-1.5">Default Process Description</label>
              <input name="default_process_description" value={form.default_process_description} onChange={handleChange} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <NumericField label="% Prepared for re-use" name="prepared_for_reuse_pct_default" value={form.prepared_for_reuse_pct_default} onChange={handleChange} />
            <NumericField label="% Recycling" name="recycling_pct_default" value={form.recycling_pct_default} onChange={handleChange} />
            <NumericField label="% Other material recovery" name="other_material_recovery_pct_default" value={form.other_material_recovery_pct_default} onChange={handleChange} />
            <NumericField label="% Energy recovery" name="energy_recovery_pct_default" value={form.energy_recovery_pct_default} onChange={handleChange} />
            <NumericField label="% Thermal disposal" name="thermal_disposal_pct_default" value={form.thermal_disposal_pct_default} onChange={handleChange} />
            <NumericField label="% Landfill disposal" name="landfill_disposal_pct_default" value={form.landfill_disposal_pct_default} onChange={handleChange} />
          </div>
          <label className="inline-flex items-center gap-2 text-sm font-medium text-grey-700">
            <input type="checkbox" name="is_active" checked={form.is_active} onChange={handleChange} />
            Active
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="h-9 px-4 bg-white text-grey-700 border border-grey-300 rounded-md text-sm font-semibold hover:bg-grey-50 transition-colors">Cancel</button>
            <button type="submit" disabled={submitting} className="h-9 px-4 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors">
              {submitting ? 'Saving...' : isEdit ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NumericField({ label, name, value, onChange }) {
  return (
    <div>
      <label className="block text-sm font-medium text-grey-700 mb-1.5">{label}</label>
      <input type="number" step="0.01" min="0" max="100" name={name} value={value} onChange={onChange} required className={inputClass} />
    </div>
  );
}

export default function ProductTypesPage() {
  const { wasteStreams, productCategories, loadAll } = useMasterDataStore();
  const [materials, setMaterials] = useState([]);
  const [fractions, setFractions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [showFractionModal, setShowFractionModal] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [editingFraction, setEditingFraction] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: materialsData }, { data: fractionsData }] = await Promise.all([
        listMaterials(),
        listFractions(),
      ]);
      setMaterials(materialsData.data);
      setFractions(fractionsData.data);
    } catch {
      toast.error('Failed to load materials and fractions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
    fetchData();
  }, [loadAll, fetchData]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-grey-900">Materials & Fractions</h1>
          <p className="mt-1 text-sm text-grey-500">Maintain the material master and reusable fraction library that drive downstream statements.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setEditingFraction(null); setShowFractionModal(true); }}
            className="flex items-center gap-2 h-9 px-4 bg-white border border-grey-300 text-grey-700 rounded-md text-sm font-semibold hover:bg-grey-50 transition-colors"
          >
            <Plus size={16} /> Add Fraction
          </button>
          <button
            onClick={() => { setEditingMaterial(null); setShowMaterialModal(true); }}
            className="flex items-center gap-2 h-9 px-4 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-700 transition-colors"
          >
            <Plus size={16} /> Add Material
          </button>
        </div>
      </div>

      <section className="bg-white rounded-lg border border-grey-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 border-b border-grey-200">
          <h2 className="text-sm font-semibold text-grey-900">Materials</h2>
        </div>
        <table className="w-full min-w-[1240px] text-sm">
          <thead>
            <tr className="bg-grey-50 border-b border-grey-200">
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Code</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Material</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Waste Stream</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">EURAL</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">WEEE Category</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Fractions</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Status</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-grey-400">Loading...</td></tr>
            ) : materials.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-grey-400">No materials found</td></tr>
            ) : materials.map((material) => (
              <tr key={material.id} className="border-b border-grey-100 hover:bg-grey-50 transition-colors">
                <td className="px-4 py-2.5 font-medium text-grey-900">{material.code}</td>
                <td className="px-4 py-2.5 text-grey-700">
                  <div>{material.name_en}</div>
                  <div className="text-xs text-grey-400 mt-0.5">{material.name_nl}</div>
                </td>
                <td className="px-4 py-2.5 text-grey-700">{material.waste_stream?.name_en || '—'}</td>
                <td className="px-4 py-2.5 text-grey-700">{material.eural_code}</td>
                <td className="px-4 py-2.5 text-grey-700">{material.weee_category}</td>
                <td className="px-4 py-2.5 text-grey-700">{material.fractions?.map((entry) => entry.fraction?.name_en).filter(Boolean).join(', ') || '—'}</td>
                <td className="px-4 py-2.5"><StatusBadge status={material.is_active ? 'ACTIVE' : 'INACTIVE'} /></td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    onClick={() => { setEditingMaterial(material); setShowMaterialModal(true); }}
                    className="p-1.5 rounded-md hover:bg-grey-100 transition-colors text-grey-400 hover:text-grey-600"
                  >
                    <Pencil size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="bg-white rounded-lg border border-grey-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 border-b border-grey-200">
          <h2 className="text-sm font-semibold text-grey-900">Fraction Library</h2>
        </div>
        <table className="w-full min-w-[1360px] text-sm">
          <thead>
            <tr className="bg-grey-50 border-b border-grey-200">
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Code</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Fraction</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">EURAL</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Acceptant</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">% Re-use</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">% Recycling</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">% Other MR</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">% Energy</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">% Thermal</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">% Landfill</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Status</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={12} className="px-4 py-8 text-center text-grey-400">Loading...</td></tr>
            ) : fractions.length === 0 ? (
              <tr><td colSpan={12} className="px-4 py-8 text-center text-grey-400">No fractions found</td></tr>
            ) : fractions.map((fraction) => (
              <tr key={fraction.id} className="border-b border-grey-100 hover:bg-grey-50 transition-colors">
                <td className="px-4 py-2.5 font-medium text-grey-900">{fraction.code}</td>
                <td className="px-4 py-2.5 text-grey-700">
                  <div>{fraction.name_en}</div>
                  <div className="text-xs text-grey-400 mt-0.5">{fraction.name_nl}</div>
                </td>
                <td className="px-4 py-2.5 text-grey-700">{fraction.eural_code}</td>
                <td className="px-4 py-2.5 text-grey-700">{fraction.default_acceptant_stage === 'FOLLOWING' ? 'Following' : 'First acceptant'}</td>
                <td className="px-4 py-2.5 text-grey-700">{fraction.prepared_for_reuse_pct_default}%</td>
                <td className="px-4 py-2.5 text-grey-700">{fraction.recycling_pct_default}%</td>
                <td className="px-4 py-2.5 text-grey-700">{fraction.other_material_recovery_pct_default}%</td>
                <td className="px-4 py-2.5 text-grey-700">{fraction.energy_recovery_pct_default}%</td>
                <td className="px-4 py-2.5 text-grey-700">{fraction.thermal_disposal_pct_default}%</td>
                <td className="px-4 py-2.5 text-grey-700">{fraction.landfill_disposal_pct_default}%</td>
                <td className="px-4 py-2.5"><StatusBadge status={fraction.is_active ? 'ACTIVE' : 'INACTIVE'} /></td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    onClick={() => { setEditingFraction(fraction); setShowFractionModal(true); }}
                    className="p-1.5 rounded-md hover:bg-grey-100 transition-colors text-grey-400 hover:text-grey-600"
                  >
                    <Pencil size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {showMaterialModal && (
        <MaterialFormModal
          material={editingMaterial}
          wasteStreams={wasteStreams}
          productCategories={productCategories}
          fractions={fractions.filter((fraction) => fraction.is_active)}
          onClose={() => setShowMaterialModal(false)}
          onSuccess={() => { setShowMaterialModal(false); fetchData(); loadAll(); }}
        />
      )}

      {showFractionModal && (
        <FractionFormModal
          fraction={editingFraction}
          onClose={() => setShowFractionModal(false)}
          onSuccess={() => { setShowFractionModal(false); fetchData(); loadAll(); }}
        />
      )}
    </div>
  );
}
