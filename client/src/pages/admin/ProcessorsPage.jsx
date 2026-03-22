import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Pencil, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import useMasterDataStore from '../../store/masterDataStore';
import {
  createProcessor,
  createProcessorCertificate,
  listProcessors,
  updateProcessor,
  updateProcessorCertificate,
} from '../../api/processors';
import StatusBadge from '../../components/ui/StatusBadge';

const inputClass = 'w-full h-10 px-3.5 rounded-md border border-grey-300 text-sm text-grey-900 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors';
const selectClass = `${inputClass} bg-white`;

function ProcessorFormModal({ processor, onClose, onSuccess }) {
  const isEdit = Boolean(processor);
  const [form, setForm] = useState({
    name: processor?.name || '',
    address: processor?.address || '',
    country: processor?.country || '',
    environmental_permit_number: processor?.environmental_permit_number || '',
    is_weeelabex_listed: processor?.is_weeelabex_listed || false,
    is_active: processor?.is_active ?? true,
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
        await updateProcessor(processor.id, form);
        toast.success('Processor updated');
      } else {
        await createProcessor(form);
        toast.success('Processor created');
      }
      onSuccess();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save processor');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app-modal-overlay">
      <div className="app-modal-panel max-w-xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-grey-200">
          <h2 className="text-lg font-semibold text-grey-900">{isEdit ? 'Edit Processor' : 'New Processor'}</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-grey-50 transition-colors text-grey-400">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">Name</label>
              <input name="name" value={form.name} onChange={handleChange} required className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">Country</label>
              <input name="country" value={form.country} onChange={handleChange} required className={inputClass} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-grey-700 mb-1.5">Address</label>
            <input name="address" value={form.address} onChange={handleChange} required className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-grey-700 mb-1.5">Environmental Permit Number</label>
            <input name="environmental_permit_number" value={form.environmental_permit_number} onChange={handleChange} required className={inputClass} />
          </div>
          <div className="flex gap-5">
            <label className="inline-flex items-center gap-2 text-sm font-medium text-grey-700">
              <input type="checkbox" name="is_weeelabex_listed" checked={form.is_weeelabex_listed} onChange={handleChange} />
              WEEELABEX listed
            </label>
            <label className="inline-flex items-center gap-2 text-sm font-medium text-grey-700">
              <input type="checkbox" name="is_active" checked={form.is_active} onChange={handleChange} />
              Active
            </label>
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

function CertificateFormModal({ processorId, certificate, materials, onClose, onSuccess }) {
  const isEdit = Boolean(certificate);
  const [form, setForm] = useState({
    certificate_number: certificate?.certificate_number || '',
    certification_body: certificate?.certification_body || '',
    valid_from: certificate?.valid_from ? new Date(certificate.valid_from).toISOString().slice(0, 10) : '',
    valid_to: certificate?.valid_to ? new Date(certificate.valid_to).toISOString().slice(0, 10) : '',
    document_url: certificate?.document_url || '',
    is_active: certificate?.is_active ?? true,
    material_ids: certificate?.materials?.map((scope) => scope.material_id) || certificate?.product_types?.map((scope) => scope.product_type_id) || [],
  });
  const [submitting, setSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  }

  function toggleMaterial(materialId) {
    setForm((current) => ({
      ...current,
      material_ids: current.material_ids.includes(materialId)
        ? current.material_ids.filter((id) => id !== materialId)
        : [...current.material_ids, materialId],
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    try {
      if (isEdit) {
        await updateProcessorCertificate(certificate.id, form);
        toast.success('Certificate updated');
      } else {
        await createProcessorCertificate(processorId, form);
        toast.success('Certificate created');
      }
      onSuccess();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save certificate');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app-modal-overlay">
      <div className="app-modal-panel max-w-2xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-grey-200">
          <h2 className="text-lg font-semibold text-grey-900">{isEdit ? 'Edit Certificate' : 'New Certificate'}</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-grey-50 transition-colors text-grey-400">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">Certificate Number</label>
              <input name="certificate_number" value={form.certificate_number} onChange={handleChange} required className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">Certification Body</label>
              <input name="certification_body" value={form.certification_body} onChange={handleChange} required className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">Valid From</label>
              <input type="date" name="valid_from" value={form.valid_from} onChange={handleChange} required className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">Valid To</label>
              <input type="date" name="valid_to" value={form.valid_to} onChange={handleChange} required className={inputClass} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-grey-700 mb-1.5">Document URL</label>
            <input name="document_url" value={form.document_url} onChange={handleChange} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-grey-700 mb-2">Material Scope</label>
            <div className="max-h-56 overflow-y-auto rounded-lg border border-grey-200 p-3 space-y-2">
              {materials.map((material) => (
                <label key={material.id} className="flex items-center gap-2 text-sm text-grey-700">
                  <input
                    type="checkbox"
                    checked={form.material_ids.includes(material.id)}
                    onChange={() => toggleMaterial(material.id)}
                  />
                  <span>{material.code} - {material.name_en}</span>
                </label>
              ))}
            </div>
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

export default function ProcessorsPage() {
  const { materials, loadAll } = useMasterDataStore();
  const [processors, setProcessors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [showProcessorModal, setShowProcessorModal] = useState(false);
  const [editingProcessor, setEditingProcessor] = useState(null);
  const [certificateModal, setCertificateModal] = useState({ open: false, processorId: '', certificate: null });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await listProcessors();
      setProcessors(data.data);
    } catch {
      toast.error('Failed to load processors');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
    fetchData();
  }, [loadAll, fetchData]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-grey-900">Processors</h1>
          <p className="mt-1 text-sm text-grey-500">Maintain downstream processors and certificate scopes used during processing validation.</p>
        </div>
        <button
          onClick={() => { setEditingProcessor(null); setShowProcessorModal(true); }}
          className="flex items-center gap-2 h-9 px-4 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-700 transition-colors"
        >
          <Plus size={16} /> Add Processor
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-8 text-center text-grey-400">Loading...</div>
      ) : (
        <div className="space-y-3">
          {processors.map((processor) => (
            <div key={processor.id} className="bg-white rounded-lg border border-grey-200 shadow-sm overflow-hidden">
              <button
                onClick={() => setExpanded((current) => ({ ...current, [processor.id]: !current[processor.id] }))}
                className="w-full px-5 py-3 flex items-center justify-between hover:bg-grey-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {expanded[processor.id] ? <ChevronDown size={16} className="text-grey-500" /> : <ChevronRight size={16} className="text-grey-500" />}
                  <div className="text-left">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-grey-900">{processor.name}</span>
                      <StatusBadge status={processor.is_active ? 'ACTIVE' : 'INACTIVE'} />
                      {processor.is_weeelabex_listed && <span className="text-xs text-green-700 bg-green-25 border border-green-200 rounded-full px-2 py-0.5">WEEELABEX</span>}
                    </div>
                    <p className="text-xs text-grey-500 mt-1">{processor.environmental_permit_number} | {processor.country}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(event) => { event.stopPropagation(); setEditingProcessor(processor); setShowProcessorModal(true); }}
                  className="p-1.5 rounded-md hover:bg-grey-100 transition-colors text-grey-400 hover:text-grey-600"
                >
                  <Pencil size={15} />
                </button>
              </button>

              {expanded[processor.id] && (
                <div className="border-t border-grey-200">
                  <div className="px-5 py-3 bg-grey-25 border-b border-grey-200 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-grey-900">Certificates</h3>
                      <p className="text-xs text-grey-500 mt-0.5">{processor.certificates.length} certificate(s)</p>
                    </div>
                    <button
                      onClick={() => setCertificateModal({ open: true, processorId: processor.id, certificate: null })}
                      className="h-8 px-3 rounded-md bg-green-500 text-white text-xs font-semibold hover:bg-green-700"
                    >
                      Add Certificate
                    </button>
                  </div>

                  {processor.certificates.length === 0 ? (
                    <div className="px-5 py-8 text-center text-sm text-grey-400">No certificates yet</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[980px] text-sm">
                        <thead>
                          <tr className="bg-grey-50">
                            <th className="text-left px-5 py-2 text-xs font-medium text-grey-500 uppercase tracking-wide">Certificate</th>
                            <th className="text-left px-5 py-2 text-xs font-medium text-grey-500 uppercase tracking-wide">Body</th>
                            <th className="text-left px-5 py-2 text-xs font-medium text-grey-500 uppercase tracking-wide">Validity</th>
                            <th className="text-left px-5 py-2 text-xs font-medium text-grey-500 uppercase tracking-wide">Scope</th>
                            <th className="text-left px-5 py-2 text-xs font-medium text-grey-500 uppercase tracking-wide">Status</th>
                            <th className="text-right px-5 py-2 text-xs font-medium text-grey-500 uppercase tracking-wide">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {processor.certificates.map((certificate) => (
                            <tr key={certificate.id} className="border-b border-grey-100 hover:bg-grey-50 transition-colors">
                              <td className="px-5 py-2.5 font-medium text-grey-900">{certificate.certificate_number}</td>
                              <td className="px-5 py-2.5 text-grey-700">{certificate.certification_body}</td>
                              <td className="px-5 py-2.5 text-grey-700">
                                {new Date(certificate.valid_from).toLocaleDateString()} - {new Date(certificate.valid_to).toLocaleDateString()}
                              </td>
                              <td className="px-5 py-2.5 text-grey-700">
                                {(certificate.materials || certificate.product_types || []).map((scope) => scope.material?.code || scope.product_type?.code).filter(Boolean).join(', ') || '—'}
                              </td>
                              <td className="px-5 py-2.5"><StatusBadge status={certificate.is_active ? 'ACTIVE' : 'INACTIVE'} /></td>
                              <td className="px-5 py-2.5 text-right">
                                <button
                                  onClick={() => setCertificateModal({ open: true, processorId: processor.id, certificate })}
                                  className="p-1.5 rounded-md hover:bg-grey-100 transition-colors text-grey-400 hover:text-grey-600"
                                >
                                  <Pencil size={15} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showProcessorModal && (
        <ProcessorFormModal
          processor={editingProcessor}
          onClose={() => setShowProcessorModal(false)}
          onSuccess={() => { setShowProcessorModal(false); fetchData(); }}
        />
      )}

      {certificateModal.open && (
        <CertificateFormModal
          processorId={certificateModal.processorId}
          certificate={certificateModal.certificate}
          materials={materials}
          onClose={() => setCertificateModal({ open: false, processorId: '', certificate: null })}
          onSuccess={() => { setCertificateModal({ open: false, processorId: '', certificate: null }); fetchData(); }}
        />
      )}
    </div>
  );
}
