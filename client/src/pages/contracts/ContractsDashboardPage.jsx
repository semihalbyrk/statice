import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import { listContracts, getContractDashboard, deactivateContract, updateContract } from '../../api/contracts';
import ClickableStatusBadge from '../../components/ui/ClickableStatusBadge';
import ContractRagBadge from '../../components/contracts/ContractRagBadge';
import RowActionMenu from '../../components/ui/RowActionMenu';
import useAuthStore from '../../store/authStore';
import { formatDate } from '../../utils/formatDate';

const STATUS_TABS = ['ALL', 'ACTIVE', 'EXPIRED', 'INACTIVE'];

const CONTRACT_TRANSITIONS = {
  ACTIVE: ['INACTIVE', 'EXPIRED'],
  INACTIVE: ['ACTIVE'],
  EXPIRED: ['ACTIVE'],
  DRAFT: ['ACTIVE'],
};

export default function ContractsDashboardPage() {
  const navigate = useNavigate();
  const userRole = useAuthStore((s) => s.user?.role);
  const canWrite = ['ADMIN', 'FINANCE_MANAGER'].includes(userRole);

  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [total, setTotal] = useState(0);
  const [dashboard, setDashboard] = useState(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const { data } = await getContractDashboard();
      setDashboard(data.data);
    } catch {
      // non-critical
    }
  }, []);

  const fetchContracts = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 50, search: search || undefined };
      if (statusFilter !== 'ALL') params.status = statusFilter;
      const { data } = await listContracts(params);
      setContracts(data.data);
      setTotal(data.total);
    } catch {
      toast.error('Failed to load contracts');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  useEffect(() => {
    const timer = setTimeout(fetchContracts, 300);
    return () => clearTimeout(timer);
  }, [fetchContracts]);

  async function handleStatusTransition(contractId, newStatus) {
    try {
      if (newStatus === 'INACTIVE') {
        await deactivateContract(contractId);
      } else {
        await updateContract(contractId, { status: newStatus });
      }
      toast.success('Contract status updated');
      fetchContracts();
      fetchDashboard();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update status');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-grey-900">Contracts</h1>
        {canWrite && (
          <button onClick={() => navigate('/contracts/new')}
            className="flex items-center gap-2 h-9 px-4 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-700 transition-colors">
            <Plus size={16} strokeWidth={2} /> New Contract
          </button>
        )}
      </div>

      {/* RAG Summary Cards */}
      {dashboard && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-grey-200 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-grey-500">On Track</p>
              <span className="h-3 w-3 rounded-full bg-green-500" />
            </div>
            <p className="text-2xl font-bold text-grey-900 mt-1">{dashboard.expiry_rag.green}</p>
            <p className="text-xs text-grey-400 mt-0.5">&gt;60 days to expiry</p>
          </div>
          <div className="bg-white rounded-lg border border-grey-200 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-grey-500">Expiring Soon</p>
              <span className="h-3 w-3 rounded-full bg-orange-500" />
            </div>
            <p className="text-2xl font-bold text-grey-900 mt-1">{dashboard.expiry_rag.amber}</p>
            <p className="text-xs text-grey-400 mt-0.5">30&ndash;60 days to expiry</p>
          </div>
          <div className="bg-white rounded-lg border border-grey-200 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-grey-500">Critical / Expired</p>
              <span className="h-3 w-3 rounded-full bg-red-500" />
            </div>
            <p className="text-2xl font-bold text-grey-900 mt-1">{dashboard.expiry_rag.red}</p>
            <p className="text-xs text-grey-400 mt-0.5">&lt;30 days or expired</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-grey-400" />
          <input type="text" placeholder="Search contracts..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-3 rounded-md border border-grey-300 text-sm text-grey-900 placeholder:text-grey-400 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 outline-none transition-colors" />
        </div>
        <div className="flex gap-1">
          {STATUS_TABS.map((tab) => (
            <button key={tab} onClick={() => setStatusFilter(tab)}
              className={`h-8 px-3 rounded-md text-xs font-medium transition-colors ${statusFilter === tab
                ? 'bg-green-500 text-white'
                : 'bg-grey-100 text-grey-600 hover:bg-grey-200'
              }`}>
              {tab === 'ALL' ? `All (${dashboard?.total || total})` : tab.charAt(0) + tab.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-grey-200 shadow-sm overflow-visible">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="bg-grey-50 border-b border-grey-200">
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Contract #</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Status</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Supplier</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Carrier</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Name</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Effective</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Expiry</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">RAG</th>
              <th className="w-10 px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-grey-400">Loading...</td></tr>
            ) : contracts.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-grey-400">No contracts found</td></tr>
            ) : contracts.map((c) => (
              <tr key={c.id} onClick={() => navigate(`/contracts/${c.id}`)}
                className="border-b border-grey-100 hover:bg-grey-50 transition-colors cursor-pointer">
                <td className="px-4 py-3 font-medium text-green-700">{c.contract_number}</td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <ClickableStatusBadge
                    status={c.status}
                    allowedTransitions={canWrite ? (CONTRACT_TRANSITIONS[c.status] || []) : []}
                    onTransition={(newStatus) => handleStatusTransition(c.id, newStatus)}
                  />
                </td>
                <td className="px-4 py-3 text-grey-700">{c.supplier?.name || '\u2014'}</td>
                <td className="px-4 py-3 text-grey-700">{c.carrier?.name || '\u2014'}</td>
                <td className="px-4 py-3 text-grey-900">{c.name}</td>
                <td className="px-4 py-3 text-grey-700">{formatDate(c.effective_date)}</td>
                <td className="px-4 py-3 text-grey-700">{formatDate(c.expiry_date)}</td>
                <td className="px-4 py-3"><ContractRagBadge status={c.rag_status} /></td>
                <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <RowActionMenu actions={[
                    { label: 'Edit', icon: Pencil, onClick: () => navigate(`/contracts/${c.id}`) },
                  ]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
