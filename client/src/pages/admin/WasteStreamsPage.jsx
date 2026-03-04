import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, ChevronDown, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { getWasteStreams, createWasteStream, updateWasteStream } from '../../api/wasteStreams';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-overlay/50">
      <div className="bg-surface rounded-2xl border border-border shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">{isEdit ? 'Edit Waste Stream' : 'New Waste Stream'}</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted transition text-text-tertiary">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Code</label>
            <input name="code" value={form.code} onChange={handleChange} required
              className="w-full px-3 py-2.5 rounded-lg border border-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition" />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Name (English)</label>
            <input name="name_en" value={form.name_en} onChange={handleChange} required
              className="w-full px-3 py-2.5 rounded-lg border border-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition" />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Name (Dutch)</label>
            <input name="name_nl" value={form.name_nl} onChange={handleChange} required
              className="w-full px-3 py-2.5 rounded-lg border border-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-foreground rounded-lg hover:bg-muted transition">Cancel</button>
            <button type="submit" disabled={submitting}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:bg-primary-hover disabled:opacity-50 transition">
              {submitting ? 'Saving...' : isEdit ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function WasteStreamsPage() {
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editStream, setEditStream] = useState(null);
  const [expanded, setExpanded] = useState({});

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

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-h-xs font-bold text-foreground">Waste Streams</h1>
        <button onClick={() => { setEditStream(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:bg-primary-hover transition">
          <Plus size={16} /> Add Stream
        </button>
      </div>

      {loading ? (
        <div className="bg-surface rounded-xl border border-border p-8 text-center text-text-placeholder text-sm">
          Loading...
        </div>
      ) : streams.length === 0 ? (
        <div className="bg-surface rounded-xl border border-border p-8 text-center text-text-placeholder text-sm">
          No waste streams found
        </div>
      ) : (
        <div className="space-y-3">
          {streams.map((ws) => (
            <div key={ws.id} className="bg-surface rounded-xl border border-border overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5">
                <button
                  onClick={() => toggleExpand(ws.id)}
                  className="flex items-center gap-2 text-left"
                >
                  {expanded[ws.id] ? <ChevronDown size={16} className="text-text-tertiary" /> : <ChevronRight size={16} className="text-text-tertiary" />}
                  <span className="font-semibold text-sm text-foreground">{ws.name_en}</span>
                  <span className="text-xs text-text-tertiary">({ws.code})</span>
                  <span className="text-xs text-text-placeholder ml-2">
                    {ws.categories?.length || 0} categories
                  </span>
                </button>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ws.is_active ? 'bg-green-100 text-green-700' : 'bg-grey-100 text-grey-500'}`}>
                    {ws.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <button onClick={() => { setEditStream(ws); setShowModal(true); }}
                    className="p-1.5 rounded-md hover:bg-muted transition text-text-tertiary hover:text-foreground">
                    <Pencil size={15} />
                  </button>
                </div>
              </div>

              {expanded[ws.id] && ws.categories?.length > 0 && (
                <div className="border-t border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted">
                        <th className="text-left px-5 py-2 font-medium text-text-secondary">Code</th>
                        <th className="text-left px-5 py-2 font-medium text-text-secondary">Description (EN)</th>
                        <th className="text-left px-5 py-2 font-medium text-text-secondary">Description (NL)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {ws.categories.map((cat) => (
                        <tr key={cat.id} className="hover:bg-muted transition">
                          <td className="px-5 py-2 font-medium text-foreground">{cat.code_cbs}</td>
                          <td className="px-5 py-2 text-text-secondary">{cat.description_en}</td>
                          <td className="px-5 py-2 text-text-secondary">{cat.description_nl}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
          onSuccess={() => { setShowModal(false); fetchData(); }}
        />
      )}
    </div>
  );
}
