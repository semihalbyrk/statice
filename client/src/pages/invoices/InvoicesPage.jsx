import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Download, XCircle, Plus, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import useInvoicesStore from '../../store/invoicesStore';
import useAuthStore from '../../store/authStore';
import ClickableStatusBadge from '../../components/ui/ClickableStatusBadge';
import RowActionMenu from '../../components/ui/RowActionMenu';
import { updateInvoiceStatus, getInvoicePdf } from '../../api/invoices';

const INVOICE_TRANSITIONS = {
  DRAFT: ['FINALIZED', 'CANCELLED'],
  FINALIZED: [],
  CANCELLED: [],
};

const inputClass =
  'w-full h-10 px-3.5 rounded-md border border-grey-300 text-sm text-grey-900 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors';
const selectClass = `${inputClass} bg-white`;

function formatDateDDMMYYYY(d) {
  if (!d) return '\u2014';
  const dt = new Date(d);
  const day = String(dt.getDate()).padStart(2, '0');
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const year = dt.getFullYear();
  return `${day}-${month}-${year}`;
}

function formatCurrency(amount) {
  if (amount == null) return '\u2014';
  return '\u20AC ' + Number(amount).toLocaleString('nl-NL', { minimumFractionDigits: 2 });
}

export default function InvoicesPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const canWrite = ['ADMIN', 'FINANCE_MANAGER', 'FINANCE_USER'].includes(user?.role);

  const { invoices, total, loading, filters, setFilters, fetchInvoices } = useInvoicesStore();

  const [searchInput, setSearchInput] = useState(filters.search || '');

  const totalPages = Math.max(1, Math.ceil(total / filters.limit));

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters({ search: searchInput });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, setFilters]);

  // Fetch on filter change
  useEffect(() => {
    fetchInvoices();
  }, [filters, fetchInvoices]);

  const handleStatusChange = useCallback(
    async (id, newStatus) => {
      try {
        await updateInvoiceStatus(id, newStatus);
        toast.success('Status updated');
        fetchInvoices();
      } catch (err) {
        toast.error(err.response?.data?.error || 'Failed to update status');
      }
    },
    [fetchInvoices],
  );

  const handleDownloadPdf = useCallback(async (invoice) => {
    try {
      const res = await getInvoicePdf(invoice.id);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch {
      toast.error('Failed to generate PDF');
    }
  }, []);

  function getRowActions(invoice) {
    const actions = [
      { label: 'View', icon: Eye, onClick: () => navigate(`/invoices/${invoice.id}`) },
      { label: 'Download PDF', icon: Download, onClick: () => handleDownloadPdf(invoice) },
    ];
    if (canWrite && invoice.status === 'DRAFT') {
      actions.push({
        label: 'Cancel',
        icon: XCircle,
        variant: 'danger',
        onClick: () => handleStatusChange(invoice.id, 'CANCELLED'),
      });
    }
    return actions;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-grey-900">Invoices</h1>
        {canWrite && (
          <button
            onClick={() => navigate('/invoices/new')}
            className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
          >
            <Plus size={16} strokeWidth={2} /> New Invoice
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <div className="w-48">
          <select
            value={filters.status}
            onChange={(e) => setFilters({ status: e.target.value })}
            className={selectClass}
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="FINALIZED">Finalized</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        <div className="relative w-64">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-grey-400" />
          <input
            type="text"
            placeholder="Search invoices..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full h-10 pl-9 pr-3 rounded-md border border-grey-300 text-sm text-grey-900 placeholder:text-grey-400 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-grey-500">From</label>
          <input
            type="date"
            value={filters.date_from}
            onChange={(e) => setFilters({ date_from: e.target.value })}
            className={`${inputClass} w-40`}
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-grey-500">To</label>
          <input
            type="date"
            value={filters.date_to}
            onChange={(e) => setFilters({ date_to: e.target.value })}
            className={`${inputClass} w-40`}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-grey-200 shadow-sm overflow-visible">
        <table className="w-full min-w-[960px] text-sm">
          <thead>
            <tr className="bg-grey-50 border-b border-grey-200">
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">
                Invoice Number
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">
                Status
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">
                Supplier
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">
                Invoice Date
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">
                Due Date
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">
                Total
              </th>
              <th className="w-10 px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-grey-400">
                  Loading...
                </td>
              </tr>
            ) : invoices.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-grey-400">
                  No invoices found.
                </td>
              </tr>
            ) : (
              invoices.map((inv) => (
                <tr
                  key={inv.id}
                  className="border-b border-grey-100 hover:bg-grey-50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <span
                      className="font-medium text-green-700 cursor-pointer hover:underline"
                      onClick={() => navigate(`/invoices/${inv.id}`)}
                    >
                      {inv.invoice_number}
                    </span>
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <ClickableStatusBadge
                      status={inv.status}
                      allowedTransitions={canWrite ? (INVOICE_TRANSITIONS[inv.status] || []) : []}
                      onTransition={(newStatus) => handleStatusChange(inv.id, newStatus)}
                    />
                  </td>
                  <td className="px-4 py-3 text-grey-700">{inv.supplier?.name || '\u2014'}</td>
                  <td className="px-4 py-3 text-grey-700">{formatDateDDMMYYYY(inv.invoice_date)}</td>
                  <td className="px-4 py-3 text-grey-700">{formatDateDDMMYYYY(inv.due_date)}</td>
                  <td className="px-4 py-3 text-grey-700">{formatCurrency(inv.total_amount)}</td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <RowActionMenu actions={getRowActions(inv)} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && invoices.length > 0 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-grey-500">
            Page {filters.page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              disabled={filters.page <= 1}
              onClick={() => setFilters({ page: filters.page - 1 })}
              className="h-9 px-3 rounded-md border border-grey-300 text-sm font-medium text-grey-700 hover:bg-grey-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              disabled={filters.page >= totalPages}
              onClick={() => setFilters({ page: filters.page + 1 })}
              className="h-9 px-3 rounded-md border border-grey-300 text-sm font-medium text-grey-700 hover:bg-grey-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
