import { useCallback, useEffect, useState, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Plus, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import ClickableStatusBadge from '../../components/ui/ClickableStatusBadge';
import RowActionMenu from '../../components/ui/RowActionMenu';
import {
  getInvoice,
  updateInvoiceStatus,
  addInvoiceLine,
  updateInvoiceLine,
  deleteInvoiceLine,
  getInvoicePdf,
} from '../../api/invoices';
import useAuthStore from '../../store/authStore';
import { formatDate } from '../../utils/formatDate';

const INVOICE_TRANSITIONS = {
  DRAFT: ['FINALIZED', 'CANCELLED'],
  FINALIZED: ['CANCELLED'],
};

const LINE_TYPE_LABELS = {
  material: 'Material',
  contamination_fee: 'Contamination Fee',
  manual: 'Manual',
};

/**
 * Format a number in Dutch locale: € X.XXX,XX
 */
function formatEur(value) {
  const num = Number(value) || 0;
  return `\u20AC ${num.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/* ─────────────────────────────────────────────
   AddEditLineModal
   ───────────────────────────────────────────── */
function AddEditLineModal({ isOpen, onClose, onSuccess, line, invoiceId }) {
  const isEdit = !!line;

  const [form, setForm] = useState({
    description: line?.description || '',
    quantity: line?.quantity ?? '',
    unit: line?.unit || 'kg',
    unit_rate: line?.unit_rate ?? '',
    btw_rate: line?.btw_rate ?? 21,
  });
  const [submitting, setSubmitting] = useState(false);

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  const quantity = parseFloat(form.quantity) || 0;
  const unitRate = parseFloat(form.unit_rate) || 0;
  const btwRate = parseFloat(form.btw_rate) || 0;
  const lineSubtotal = quantity * unitRate;
  const btwAmount = lineSubtotal * (btwRate / 100);
  const lineTotal = lineSubtotal + btwAmount;

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        description: form.description,
        quantity: parseFloat(form.quantity),
        unit: form.unit,
        unit_rate: parseFloat(form.unit_rate),
        btw_rate: parseFloat(form.btw_rate),
      };
      if (isEdit) {
        await updateInvoiceLine(line.id, payload);
        toast.success('Line item updated');
      } else {
        await addInvoiceLine(invoiceId, payload);
        toast.success('Line item added');
      }
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save line item');
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) return null;

  const inputClass =
    'w-full h-10 px-3.5 rounded-md border border-grey-300 text-sm text-grey-900 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors';
  const selectClass = `${inputClass} bg-white`;

  return (
    <div className="app-modal-overlay">
      <div className="app-modal-panel max-w-md">
        <div className="flex items-center justify-between px-5 py-3 border-b border-grey-200">
          <h2 className="text-lg font-semibold text-grey-900">
            {isEdit ? 'Edit Line Item' : 'Add Line Item'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-grey-50 transition-colors text-grey-400"
          >
            &times;
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-grey-700 mb-1.5">
              Description <span className="text-red-500">*</span>
            </label>
            <input
              name="description"
              type="text"
              value={form.description}
              onChange={handleChange}
              required
              className={inputClass}
              placeholder="Line item description"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">
                Quantity <span className="text-red-500">*</span>
              </label>
              <input
                name="quantity"
                type="number"
                step="0.01"
                min="0"
                value={form.quantity}
                onChange={handleChange}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">
                Unit <span className="text-red-500">*</span>
              </label>
              <select
                name="unit"
                value={form.unit}
                onChange={handleChange}
                required
                className={selectClass}
              >
                <option value="kg">kg</option>
                <option value="pcs">pcs</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">
                Unit Rate (&euro;) <span className="text-red-500">*</span>
              </label>
              <input
                name="unit_rate"
                type="number"
                step="0.01"
                min="0"
                value={form.unit_rate}
                onChange={handleChange}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">
                BTW Rate (%)
              </label>
              <input
                name="btw_rate"
                type="number"
                step="0.01"
                min="0"
                value={form.btw_rate}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
          </div>

          {/* Live calculation preview */}
          <div className="bg-grey-50 rounded-md p-3 text-sm space-y-1">
            <div className="flex justify-between text-grey-600">
              <span>Subtotal</span>
              <span>{formatEur(lineSubtotal)}</span>
            </div>
            <div className="flex justify-between text-grey-600">
              <span>BTW ({btwRate}%)</span>
              <span>{formatEur(btwAmount)}</span>
            </div>
            <div className="flex justify-between font-medium text-grey-900 pt-1 border-t border-grey-200">
              <span>Total</span>
              <span>{formatEur(lineTotal)}</span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 bg-white text-grey-700 border border-grey-300 rounded-md text-sm font-semibold hover:bg-grey-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-9 px-4 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Saving...' : isEdit ? 'Update' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   InvoiceDetailPage
   ───────────────────────────────────────────── */
export default function InvoiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const userRole = useAuthStore((s) => s.user?.role);
  const canWrite = ['ADMIN', 'FINANCE_MANAGER'].includes(userRole);

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lineModalOpen, setLineModalOpen] = useState(false);
  const [editLine, setEditLine] = useState(null);

  const fetchInvoice = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getInvoice(id);
      setInvoice(res.data.data);
    } catch {
      toast.error('Failed to load invoice');
      navigate('/invoices');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  /* ── Status transition ── */
  const handleStatusChange = async (newStatus) => {
    try {
      await updateInvoiceStatus(id, newStatus);
      toast.success('Invoice status updated');
      fetchInvoice();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update status');
    }
  };

  /* ── PDF download ── */
  const handlePdf = async () => {
    try {
      const res = await getInvoicePdf(invoice.id);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      window.open(URL.createObjectURL(blob), '_blank');
    } catch {
      toast.error('Failed to generate PDF');
    }
  };

  /* ── Delete line ── */
  const handleDeleteLine = async (lineId) => {
    if (!window.confirm('Remove this line item?')) return;
    try {
      await deleteInvoiceLine(lineId);
      toast.success('Line item removed');
      fetchInvoice();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to remove line item');
    }
  };

  /* ── BTW summary ── */
  const btwSummary = useMemo(() => {
    if (!invoice?.lines) return [];
    const map = {};
    invoice.lines.forEach((l) => {
      const rate = Number(l.btw_rate);
      if (!map[rate]) map[rate] = { rate, subtotal: 0, btw: 0 };
      map[rate].subtotal += Number(l.line_subtotal) || 0;
      map[rate].btw += Number(l.btw_amount) || 0;
    });
    return Object.values(map).sort((a, b) => a.rate - b.rate);
  }, [invoice]);

  /* ── Grand totals ── */
  const totals = useMemo(() => {
    if (!invoice?.lines) return { subtotal: 0, btw: 0, total: 0 };
    return invoice.lines.reduce(
      (acc, l) => ({
        subtotal: acc.subtotal + (Number(l.line_subtotal) || 0),
        btw: acc.btw + (Number(l.btw_amount) || 0),
        total: acc.total + (Number(l.line_total) || 0),
      }),
      { subtotal: 0, btw: 0, total: 0 },
    );
  }, [invoice]);

  /* ── Loading / empty guards ── */
  if (loading) return <div className="text-center py-12 text-grey-400">Loading...</div>;
  if (!invoice) return null;

  const isDraft = invoice.status === 'DRAFT';

  return (
    <div>
      {/* Breadcrumb + Header */}
      <div className="mb-6">
        <Link
          to="/invoices"
          className="inline-flex items-center gap-1.5 text-sm text-grey-500 hover:text-grey-700 mb-3"
        >
          <ArrowLeft size={14} /> Back to Invoices
        </Link>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-grey-900">{invoice.invoice_number}</h1>
            <ClickableStatusBadge
              status={invoice.status}
              allowedTransitions={canWrite ? (INVOICE_TRANSITIONS[invoice.status] || []) : []}
              onTransition={handleStatusChange}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePdf}
              className="flex items-center gap-1.5 h-9 px-4 bg-white text-grey-700 border border-grey-300 rounded-md text-sm font-semibold hover:bg-grey-50 transition-colors"
            >
              <Download size={14} /> Download PDF
            </button>
            {canWrite && isDraft && (
              <button
                onClick={() => {
                  setEditLine(null);
                  setLineModalOpen(true);
                }}
                className="flex items-center gap-1.5 h-9 px-4 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-700 transition-colors"
              >
                <Plus size={14} /> Add Line
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Invoice Info Grid */}
      <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-5 mb-6">
        <h2 className="text-sm font-semibold text-grey-900 mb-4">Invoice Details</h2>
        <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
          {/* Left column */}
          <div className="space-y-4">
            <div>
              <p className="text-grey-500 mb-0.5">Invoice Date</p>
              <p className="text-grey-900 font-medium">{formatDate(invoice.invoice_date)}</p>
            </div>
            <div>
              <p className="text-grey-500 mb-0.5">Due Date</p>
              <p className="text-grey-900 font-medium">{formatDate(invoice.due_date)}</p>
            </div>
            <div>
              <p className="text-grey-500 mb-0.5">Currency</p>
              <p className="text-grey-900">EUR</p>
            </div>
            <div>
              <p className="text-grey-500 mb-0.5">Payment Terms</p>
              <p className="text-grey-900">{invoice.payment_term_days ? `${invoice.payment_term_days} days` : '\u2014'}</p>
            </div>
            <div>
              <p className="text-grey-500 mb-0.5">Contract</p>
              {invoice.contract ? (
                <Link
                  to={`/contracts/${invoice.contract_id}`}
                  className="text-green-600 hover:text-green-700 font-medium hover:underline"
                >
                  {invoice.contract.contract_number}
                </Link>
              ) : (
                <p className="text-grey-900">{'\u2014'}</p>
              )}
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            <div>
              <p className="text-grey-500 mb-0.5">Supplier</p>
              <p className="text-grey-900 font-medium">{invoice.supplier?.name || '\u2014'}</p>
            </div>
            <div>
              <p className="text-grey-500 mb-0.5">Address</p>
              <p className="text-grey-900">{invoice.supplier?.address || '\u2014'}</p>
            </div>
            <div>
              <p className="text-grey-500 mb-0.5">KvK</p>
              <p className="text-grey-900">{invoice.supplier?.kvk_number || '\u2014'}</p>
            </div>
            <div>
              <p className="text-grey-500 mb-0.5">BTW</p>
              <p className="text-grey-900">{invoice.supplier?.btw_number || '\u2014'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Line Items Table */}
      <div className="bg-white rounded-lg border border-grey-200 shadow-sm mb-6">
        <div className="px-5 py-3 border-b border-grey-200">
          <h2 className="text-sm font-semibold text-grey-900">
            Line Items ({invoice.lines?.length || 0})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1100px]">
            <thead>
              <tr className="bg-grey-50 border-b border-grey-200">
                <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide w-10">
                  #
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">
                  Description
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">
                  Type
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">
                  Qty
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">
                  Unit
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">
                  Unit Rate (&euro;)
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">
                  BTW%
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">
                  Subtotal (&euro;)
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">
                  BTW (&euro;)
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">
                  Total (&euro;)
                </th>
                {canWrite && isDraft && (
                  <th className="w-10 px-4 py-3" />
                )}
              </tr>
            </thead>
            <tbody>
              {(!invoice.lines || invoice.lines.length === 0) ? (
                <tr>
                  <td
                    colSpan={canWrite && isDraft ? 11 : 10}
                    className="px-4 py-4 text-center text-grey-400 text-xs"
                  >
                    No line items {'\u2014'}
                  </td>
                </tr>
              ) : (
                invoice.lines.map((line, idx) => {
                  const isContaminationFee = line.line_type === 'contamination_fee';
                  return (
                    <tr
                      key={line.id}
                      className={`border-b border-grey-100 hover:bg-grey-50 transition-colors ${
                        isContaminationFee ? 'bg-orange-50' : ''
                      }`}
                    >
                      <td className="px-4 py-3 text-grey-500">{idx + 1}</td>
                      <td className="px-4 py-3 text-grey-900 font-medium">
                        {line.description || '\u2014'}
                      </td>
                      <td className="px-4 py-3 text-grey-700">
                        {LINE_TYPE_LABELS[line.line_type] || line.line_type || '\u2014'}
                      </td>
                      <td className="px-4 py-3 text-right text-grey-900">
                        {Number(line.quantity).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-grey-700">{line.unit || '\u2014'}</td>
                      <td className="px-4 py-3 text-right text-grey-900">
                        {formatEur(line.unit_rate)}
                      </td>
                      <td className="px-4 py-3 text-right text-grey-700">
                        {Number(line.btw_rate)}%
                      </td>
                      <td className="px-4 py-3 text-right text-grey-900">
                        {formatEur(line.line_subtotal)}
                      </td>
                      <td className="px-4 py-3 text-right text-grey-700">
                        {formatEur(line.btw_amount)}
                      </td>
                      <td className="px-4 py-3 text-right text-grey-900 font-medium">
                        {formatEur(line.line_total)}
                      </td>
                      {canWrite && isDraft && (
                        <td className="px-4 py-3 text-right">
                          <RowActionMenu
                            actions={[
                              {
                                label: 'Edit',
                                icon: Pencil,
                                onClick: () => {
                                  setEditLine(line);
                                  setLineModalOpen(true);
                                },
                              },
                              {
                                label: 'Delete',
                                icon: Trash2,
                                onClick: () => handleDeleteLine(line.id),
                                variant: 'danger',
                              },
                            ]}
                          />
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* BTW Summary */}
      {btwSummary.length > 0 && (
        <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-5 mb-6">
          <h2 className="text-sm font-semibold text-grey-900 mb-3">BTW Summary</h2>
          <div className="space-y-2 text-sm">
            {btwSummary.map((entry) => (
              <div key={entry.rate} className="flex items-center gap-4 text-grey-700">
                <span className="font-medium text-grey-900">BTW {entry.rate}%:</span>
                <span>Subtotal {formatEur(entry.subtotal)}</span>
                <span className="text-grey-400">&rarr;</span>
                <span>BTW {formatEur(entry.btw)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grand Total Block */}
      <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-5 mb-6">
        <div className="flex justify-end">
          <div className="w-full max-w-xs space-y-2 text-sm border-t border-grey-200 pt-4">
            <div className="flex justify-between text-grey-700">
              <span>Subtotal excl. BTW</span>
              <span>{formatEur(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-grey-700">
              <span>BTW Total</span>
              <span>{formatEur(totals.btw)}</span>
            </div>
            <div className="flex justify-between font-semibold text-base text-grey-900 pt-2 border-t border-grey-200">
              <span>Total incl. BTW</span>
              <span>{formatEur(totals.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* AddEditLineModal */}
      <AddEditLineModal
        isOpen={lineModalOpen}
        onClose={() => {
          setLineModalOpen(false);
          setEditLine(null);
        }}
        onSuccess={() => {
          setLineModalOpen(false);
          setEditLine(null);
          fetchInvoice();
        }}
        line={editLine}
        invoiceId={id}
      />
    </div>
  );
}
