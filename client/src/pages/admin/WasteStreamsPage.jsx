import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import ClickableStatusBadge from '../../components/ui/ClickableStatusBadge';
import useMasterDataStore from '../../store/masterDataStore';
import {
  getWasteStreams,
  createWasteStream,
  updateWasteStream,
  createProductCategory,
  updateProductCategory,
  deleteProductCategory,
} from '../../api/wasteStreams';

const inputClass = "w-full h-10 px-3.5 rounded-md border border-grey-300 text-sm text-grey-900 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors";

function WasteStreamFormModal({ stream, onClose, onSuccess }) {
  const isEdit = !!stream;
  const [form, setForm] = useState({
    name_en: stream?.name_en || '',
    name_nl: stream?.name_nl || '',
    code: stream?.code || '',
  });
  const [submitting, setSubmitting] = useState(false);

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isEdit) {
        await updateWasteStream(stream.id, form);
        toast.success('Waste stream updated');
      } else {
        await createWasteStream(form);
        toast.success('Waste stream created');
      }
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save waste stream');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app-modal-overlay">
      <div className="app-modal-panel max-w-md">
        <div className="flex items-center justify-between px-5 py-3 border-b border-grey-200">
          <h2 className="text-lg font-semibold text-grey-900">{isEdit ? 'Edit Waste Stream' : 'New Waste Stream'}</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-grey-50 transition-colors text-grey-400">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-grey-700 mb-1.5">Code</label>
            <input name="code" value={form.code} onChange={handleChange} required className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-grey-700 mb-1.5">Name (English)</label>
            <input name="name_en" value={form.name_en} onChange={handleChange} required className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-grey-700 mb-1.5">Name (Dutch)</label>
            <input name="name_nl" value={form.name_nl} onChange={handleChange} required className={inputClass} />
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

function CategoryFormModal({ category, wasteStreamId, onClose, onSuccess }) {
  const isEdit = !!category;
  const [form, setForm] = useState({
    waste_stream_id: category?.waste_stream_id || wasteStreamId || '',
    code_cbs: category?.code_cbs || '',
    description_en: category?.description_en || '',
    description_nl: category?.description_nl || '',
    recycled_pct_default: category?.recycled_pct_default != null ? String(Number(category.recycled_pct_default)) : '0',
    reused_pct_default: category?.reused_pct_default != null ? String(Number(category.reused_pct_default)) : '0',
    disposed_pct_default: category?.disposed_pct_default != null ? String(Number(category.disposed_pct_default)) : '0',
    landfill_pct_default: category?.landfill_pct_default != null ? String(Number(category.landfill_pct_default)) : '0',
  });
  const [submitting, setSubmitting] = useState(false);

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        recycled_pct_default: Number(form.recycled_pct_default),
        reused_pct_default: Number(form.reused_pct_default),
        disposed_pct_default: Number(form.disposed_pct_default),
        landfill_pct_default: Number(form.landfill_pct_default),
      };
      if (isEdit) {
        await updateProductCategory(category.id, payload);
        toast.success('Category updated');
      } else {
        await createProductCategory(payload);
        toast.success('Category created');
      }
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save category');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app-modal-overlay">
      <div className="app-modal-panel max-w-2xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-grey-200">
          <h2 className="text-lg font-semibold text-grey-900">{isEdit ? 'Edit Sub Category' : 'New Sub Category'}</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-grey-50 transition-colors text-grey-400">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">Code</label>
              <input name="code_cbs" value={form.code_cbs} onChange={handleChange} required className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">Waste Stream ID</label>
              <input name="waste_stream_id" value={form.waste_stream_id} onChange={handleChange} required className={inputClass} disabled />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">Description (English)</label>
              <input name="description_en" value={form.description_en} onChange={handleChange} required className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">Description (Dutch)</label>
              <input name="description_nl" value={form.description_nl} onChange={handleChange} required className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <PercentageInput name="recycled_pct_default" label="Recycled %" value={form.recycled_pct_default} onChange={handleChange} />
            <PercentageInput name="reused_pct_default" label="Reused %" value={form.reused_pct_default} onChange={handleChange} />
            <PercentageInput name="disposed_pct_default" label="Disposed %" value={form.disposed_pct_default} onChange={handleChange} />
            <PercentageInput name="landfill_pct_default" label="Landfill %" value={form.landfill_pct_default} onChange={handleChange} />
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

function PercentageInput({ name, label, value, onChange }) {
  return (
    <div>
      <label className="block text-sm font-medium text-grey-700 mb-1.5">{label}</label>
      <input type="number" step="0.01" min="0" max="100" name={name} value={value} onChange={onChange} required className={inputClass} />
    </div>
  );
}

export default function WasteStreamsPage() {
  const fetchActiveWasteStreams = useMasterDataStore((state) => state.fetchWasteStreams);
  const fetchActiveProductCategories = useMasterDataStore((state) => state.fetchProductCategories);
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editStream, setEditStream] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [categoryModal, setCategoryModal] = useState({ open: false, category: null, wasteStreamId: '' });

  const syncMasterData = useCallback(async () => {
    await Promise.all([fetchActiveWasteStreams(), fetchActiveProductCategories()]);
  }, [fetchActiveProductCategories, fetchActiveWasteStreams]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getWasteStreams();
      setStreams(data.data);
    } catch {
      toast.error('Failed to load waste streams');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function toggleExpand(id) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function handleStreamStatusToggle(stream, nextStatus) {
    try {
      await updateWasteStream(stream.id, { is_active: nextStatus === 'ACTIVE' });
      toast.success('Waste stream status updated');
      await fetchData();
      await syncMasterData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update status');
    }
  }

  async function handleCategoryStatusToggle(category, nextStatus) {
    try {
      await updateProductCategory(category.id, { is_active: nextStatus === 'ACTIVE' });
      toast.success('Category status updated');
      await fetchData();
      await syncMasterData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update status');
    }
  }

  async function handleDeleteCategory(categoryId) {
    if (!window.confirm('Delete this sub category?')) return;
    try {
      await deleteProductCategory(categoryId);
      toast.success('Category deleted');
      await fetchData();
      await syncMasterData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete category');
    }
  }

  function closeCategoryModal() {
    setCategoryModal({ open: false, category: null, wasteStreamId: '' });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-grey-900">Waste Streams</h1>
        <button onClick={() => { setEditStream(null); setShowModal(true); }} className="flex items-center gap-2 h-9 px-4 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-700 transition-colors">
          <Plus size={16} strokeWidth={2} /> Add Stream
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-8 text-center text-grey-400 text-sm">Loading...</div>
      ) : streams.length === 0 ? (
        <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-8 text-center text-grey-400 text-sm">No waste streams found</div>
      ) : (
        <div className="space-y-3">
          {streams.map((ws) => (
            <div key={ws.id} className="bg-white rounded-lg border border-grey-200 shadow-sm overflow-hidden">
              <button onClick={() => toggleExpand(ws.id)} className="w-full px-5 py-3 flex items-center justify-between hover:bg-grey-50 transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  {expanded[ws.id] ? <ChevronDown size={16} className="text-grey-500" /> : <ChevronRight size={16} className="text-grey-500" />}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm text-grey-900">{ws.name_en}</span>
                      <span className="text-xs text-grey-500">({ws.code})</span>
                      <span className="text-xs text-grey-400">{ws.categories?.length || 0} sub categories</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div onClick={(e) => e.stopPropagation()}>
                    <ClickableStatusBadge
                      status={ws.is_active ? 'ACTIVE' : 'INACTIVE'}
                      allowedTransitions={ws.is_active ? ['INACTIVE'] : ['ACTIVE']}
                      onTransition={(nextStatus) => handleStreamStatusToggle(ws, nextStatus)}
                    />
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); setEditStream(ws); setShowModal(true); }} className="p-1.5 rounded-md hover:bg-grey-100 transition-colors text-grey-400 hover:text-grey-600">
                    <Pencil size={15} />
                  </button>
                </div>
              </button>

              {expanded[ws.id] && (
                <div className="border-t border-grey-200">
                  <div className="flex items-center justify-between px-5 py-3 bg-grey-25 border-b border-grey-200">
                    <div>
                      <h3 className="text-sm font-semibold text-grey-900">Sub Categories</h3>
                      <p className="text-xs text-grey-500 mt-0.5">Manage recovery defaults and availability for this waste stream.</p>
                    </div>
                    <button
                      onClick={() => setCategoryModal({ open: true, category: null, wasteStreamId: ws.id })}
                      className="flex items-center gap-2 h-8 px-3 bg-green-500 text-white rounded-md text-xs font-semibold hover:bg-green-700 transition-colors"
                    >
                      <Plus size={14} /> Add Sub Category
                    </button>
                  </div>

                  {ws.categories?.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[980px] text-sm">
                        <thead>
                          <tr className="bg-grey-50">
                            <th className="text-left px-5 py-2 text-xs font-medium text-grey-500 uppercase tracking-wide">Code</th>
                            <th className="text-left px-5 py-2 text-xs font-medium text-grey-500 uppercase tracking-wide">Description</th>
                            <th className="text-right px-5 py-2 text-xs font-medium text-grey-500 uppercase tracking-wide">Recycled %</th>
                            <th className="text-right px-5 py-2 text-xs font-medium text-grey-500 uppercase tracking-wide">Reused %</th>
                            <th className="text-right px-5 py-2 text-xs font-medium text-grey-500 uppercase tracking-wide">Disposed %</th>
                            <th className="text-right px-5 py-2 text-xs font-medium text-grey-500 uppercase tracking-wide">Landfill %</th>
                            <th className="text-left px-5 py-2 text-xs font-medium text-grey-500 uppercase tracking-wide">Status</th>
                            <th className="text-right px-5 py-2 text-xs font-medium text-grey-500 uppercase tracking-wide">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ws.categories.map((cat) => (
                            <tr key={cat.id} className="border-b border-grey-100 hover:bg-grey-50 transition-colors">
                              <td className="px-5 py-2 font-medium text-grey-900">{cat.code_cbs}</td>
                              <td className="px-5 py-2 text-grey-700">{cat.description_en}</td>
                              <td className="px-5 py-2 text-right text-grey-700">{Number(cat.recycled_pct_default)}</td>
                              <td className="px-5 py-2 text-right text-grey-700">{Number(cat.reused_pct_default)}</td>
                              <td className="px-5 py-2 text-right text-grey-700">{Number(cat.disposed_pct_default)}</td>
                              <td className="px-5 py-2 text-right text-grey-700">{Number(cat.landfill_pct_default)}</td>
                              <td className="px-5 py-2">
                                <ClickableStatusBadge
                                  status={cat.is_active ? 'ACTIVE' : 'INACTIVE'}
                                  allowedTransitions={cat.is_active ? ['INACTIVE'] : ['ACTIVE']}
                                  onTransition={(nextStatus) => handleCategoryStatusToggle(cat, nextStatus)}
                                />
                              </td>
                              <td className="px-5 py-2 text-right">
                                <button onClick={() => setCategoryModal({ open: true, category: cat, wasteStreamId: ws.id })} className="p-1.5 rounded-md hover:bg-grey-100 transition-colors text-grey-400 hover:text-grey-600">
                                  <Pencil size={15} />
                                </button>
                                <button onClick={() => handleDeleteCategory(cat.id)} className="ml-1 p-1.5 rounded-md hover:bg-grey-100 transition-colors text-grey-400 hover:text-red-600">
                                  <Trash2 size={15} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="px-5 py-8 text-center text-sm text-grey-400">No sub categories yet</div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <WasteStreamFormModal
          stream={editStream}
          onClose={() => setShowModal(false)}
          onSuccess={async () => {
            setShowModal(false);
            await fetchData();
            await syncMasterData();
          }}
        />
      )}

      {categoryModal.open && (
        <CategoryFormModal
          category={categoryModal.category}
          wasteStreamId={categoryModal.wasteStreamId}
          onClose={closeCategoryModal}
          onSuccess={async () => {
            closeCategoryModal();
            await fetchData();
            await syncMasterData();
          }}
        />
      )}
    </div>
  );
}
