import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil, Trash2, Settings2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { getContract, deactivateContract, updateContract, deleteRateLine, deleteContractWasteStream } from '../../api/contracts';
import ClickableStatusBadge from '../../components/ui/ClickableStatusBadge';
import RowActionMenu from '../../components/ui/RowActionMenu';
import ContractRagBadge from '../../components/contracts/ContractRagBadge';
import RateLineFormModal from '../../components/contracts/RateLineFormModal';
import PenaltySelectModal from '../../components/contracts/PenaltySelectModal';
import useAuthStore from '../../store/authStore';
import { formatDate } from '../../utils/formatDate';

const PRICING_LABELS = { WEIGHT: 'Per Weight', QUANTITY: 'Per Quantity' };
const FREQ_LABELS = { PER_ORDER: 'Per Order', WEEKLY: 'Weekly', MONTHLY: 'Monthly', QUARTERLY: 'Quarterly' };
const CONTRACT_TRANSITIONS = {
  ACTIVE: ['INACTIVE', 'EXPIRED'],
  INACTIVE: ['ACTIVE'],
  EXPIRED: ['ACTIVE'],
  DRAFT: ['ACTIVE'],
};

export default function ContractDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const userRole = useAuthStore((s) => s.user?.role);
  const canWrite = ['ADMIN', 'FINANCE_MANAGER'].includes(userRole);

  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRateModal, setShowRateModal] = useState(false);
  const [editRateLine, setEditRateLine] = useState(null);
  const [rateLineContractWsId, setRateLineContractWsId] = useState(null);
  const [showPenaltyModal, setShowPenaltyModal] = useState(false);

  const fetchContract = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getContract(id);
      setContract(data.data);
    } catch {
      toast.error('Failed to load contract');
      navigate('/contracts');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { fetchContract(); }, [fetchContract]);

  async function handleStatusTransition(newStatus) {
    try {
      if (newStatus === 'INACTIVE') {
        await deactivateContract(id);
      } else {
        await updateContract(id, { status: newStatus });
      }
      toast.success('Contract status updated');
      fetchContract();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update status');
    }
  }

  async function handleDeleteRateLine(lineId) {
    if (!window.confirm('Remove this rate line?')) return;
    try {
      await deleteRateLine(lineId);
      toast.success('Rate line removed');
      fetchContract();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to remove rate line');
    }
  }

  async function handleDeleteWasteStream(cwsId) {
    if (!window.confirm('Remove this waste stream and all its rate lines from the contract?')) return;
    try {
      await deleteContractWasteStream(id, cwsId);
      toast.success('Waste stream removed');
      fetchContract();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to remove waste stream');
    }
  }

  if (loading) return <div className="text-center py-12 text-grey-400">Loading...</div>;
  if (!contract) return null;

  const currencySymbol = contract.currency === 'USD' ? '$' : contract.currency === 'GBP' ? '\u00A3' : '\u20AC';
  const hasWasteStreams = contract.contract_waste_streams && contract.contract_waste_streams.length > 0;
  // Standalone rate lines (not linked to a waste stream — legacy data)
  const standaloneRateLines = (contract.rate_lines || []).filter((rl) => !rl.contract_waste_stream_id);

  return (
    <div>
      {/* Breadcrumb + Header */}
      <div className="mb-6">
        <Link to="/contracts" className="inline-flex items-center gap-1.5 text-sm text-grey-500 hover:text-grey-700 mb-3">
          <ArrowLeft size={14} /> Back to Contracts
        </Link>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-grey-900">{contract.contract_number}</h1>
            <ClickableStatusBadge
              status={contract.status}
              allowedTransitions={canWrite ? (CONTRACT_TRANSITIONS[contract.status] || []) : []}
              onTransition={handleStatusTransition}
            />
            <ContractRagBadge status={contract.rag_status} />
          </div>
          <div className="flex items-center gap-2">
            {canWrite && (
              <button onClick={() => navigate(`/contracts/${id}/edit`)}
                className="flex items-center gap-1.5 h-9 px-4 bg-white text-grey-700 border border-grey-300 rounded-md text-sm font-semibold hover:bg-grey-50 transition-colors">
                <Pencil size={14} /> Edit
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Contract Details */}
      <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-5 mb-6">
        <h2 className="text-sm font-semibold text-grey-900 mb-4">Contract Details</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-y-4 gap-x-6 text-sm">
          <div>
            <p className="text-grey-500 mb-0.5">Name</p>
            <p className="text-grey-900 font-medium">{contract.name}</p>
          </div>
          <div>
            <p className="text-grey-500 mb-0.5">Supplier</p>
            <p className="text-grey-900 font-medium">{contract.supplier?.name}</p>
          </div>
          <div>
            <p className="text-grey-500 mb-0.5">Carrier</p>
            <p className="text-grey-900 font-medium">{contract.carrier?.name || '\u2014'}</p>
          </div>
          <div>
            <p className="text-grey-500 mb-0.5">Receiver</p>
            <p className="text-grey-900 font-medium">{contract.receiver_name || 'Statice B.V.'}</p>
          </div>
          <div>
            <p className="text-grey-500 mb-0.5">Effective Date</p>
            <p className="text-grey-900">{formatDate(contract.effective_date)}</p>
          </div>
          <div>
            <p className="text-grey-500 mb-0.5">Expiry Date</p>
            <p className="text-grey-900">{formatDate(contract.expiry_date)}{contract.days_until_expiry != null ? ` (${contract.days_until_expiry}d)` : ''}</p>
          </div>
          <div>
            <p className="text-grey-500 mb-0.5">Payment Terms</p>
            <p className="text-grey-900">{contract.payment_term_days} days</p>
          </div>
          <div>
            <p className="text-grey-500 mb-0.5">Invoicing Frequency</p>
            <p className="text-grey-900">{FREQ_LABELS[contract.invoicing_frequency] || contract.invoicing_frequency}</p>
          </div>
          <div>
            <p className="text-grey-500 mb-0.5">Currency</p>
            <p className="text-grey-900">{contract.currency}</p>
          </div>
          <div>
            <p className="text-grey-500 mb-0.5">Approved By</p>
            <p className="text-grey-900">{contract.approved_by_user?.full_name || '\u2014'}</p>
          </div>
          <div>
            <p className="text-grey-500 mb-0.5">Contamination Tolerance</p>
            <p className="text-grey-900">{Number(contract.contamination_tolerance_pct)}%</p>
          </div>
          <div>
            <p className="text-grey-500 mb-0.5">Finance Review Required</p>
            <p className="text-grey-900">{contract.requires_finance_review ? 'Yes' : 'No'}</p>
          </div>
        </div>
      </div>

      {/* Waste Stream Sections */}
      {hasWasteStreams && (
        <div className="space-y-4 mb-6">
          {contract.contract_waste_streams.map((cws) => (
            <div key={cws.id} className="bg-white rounded-lg border border-grey-200 shadow-sm">
              <div className="flex items-center justify-between px-5 py-3 border-b border-grey-200">
                <div className="flex items-center gap-3">
                  <h2 className="text-sm font-semibold text-grey-900">
                    {cws.waste_stream?.name} ({cws.waste_stream?.code})
                  </h2>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-25 text-green-700 border border-green-300">
                    ASN: {cws.afvalstroomnummer}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {canWrite && contract.status === 'ACTIVE' && (
                    <button
                      onClick={() => { setEditRateLine(null); setRateLineContractWsId(cws.id); setShowRateModal(true); }}
                      className="flex items-center gap-1.5 h-8 px-3 bg-green-500 text-white rounded-md text-xs font-semibold hover:bg-green-700 transition-colors"
                    >
                      <Plus size={14} /> Add Material
                    </button>
                  )}
                  {canWrite && contract.status === 'ACTIVE' && (
                    <RowActionMenu actions={[
                      { label: 'Remove Waste Stream', icon: Trash2, onClick: () => handleDeleteWasteStream(cws.id), variant: 'danger' },
                    ]} />
                  )}
                </div>
              </div>
              <div className="overflow-visible">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-grey-50 border-b border-grey-200">
                      <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Material</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Pricing</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Unit Rate</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">BTW %</th>
                      {canWrite && <th className="w-10 px-4 py-3"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {(!cws.rate_lines || cws.rate_lines.length === 0) ? (
                      <tr><td colSpan={canWrite ? 5 : 4} className="px-4 py-4 text-center text-grey-400 text-xs">No materials</td></tr>
                    ) : cws.rate_lines.map((rl) => (
                      <tr key={rl.id} className="border-b border-grey-100 hover:bg-grey-50 transition-colors">
                        <td className="px-4 py-3 text-grey-900 font-medium">{rl.material?.name}</td>
                        <td className="px-4 py-3 text-grey-700">{PRICING_LABELS[rl.pricing_model]}</td>
                        <td className="px-4 py-3 text-right text-grey-900 font-medium">{currencySymbol} {Number(rl.unit_rate).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-grey-700">{Number(rl.btw_rate)}%</td>
                        {canWrite && (
                          <td className="px-4 py-3 text-right">
                            <RowActionMenu actions={[
                              { label: 'Edit', icon: Pencil, onClick: () => { setEditRateLine(rl); setRateLineContractWsId(cws.id); setShowRateModal(true); } },
                              { label: 'Delete', icon: Trash2, onClick: () => handleDeleteRateLine(rl.id), variant: 'danger' },
                            ]} />
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Standalone Rate Lines (legacy, not grouped under waste streams) */}
      {standaloneRateLines.length > 0 && (
        <div className="bg-white rounded-lg border border-grey-200 shadow-sm mb-6">
          <div className="flex items-center justify-between px-5 py-3 border-b border-grey-200">
            <h2 className="text-sm font-semibold text-grey-900">Rate Lines ({standaloneRateLines.length})</h2>
            {canWrite && contract.status === 'ACTIVE' && (
              <button onClick={() => { setEditRateLine(null); setRateLineContractWsId(null); setShowRateModal(true); }}
                className="flex items-center gap-1.5 h-8 px-3 bg-green-500 text-white rounded-md text-xs font-semibold hover:bg-green-700 transition-colors">
                <Plus size={14} /> Add Rate Line
              </button>
            )}
          </div>
          <div className="overflow-visible">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-grey-50 border-b border-grey-200">
                  <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Material</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Pricing</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Unit Rate</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">BTW %</th>
                  {canWrite && <th className="w-10 px-4 py-3"></th>}
                </tr>
              </thead>
              <tbody>
                {standaloneRateLines.map((rl) => (
                  <tr key={rl.id} className="border-b border-grey-100 hover:bg-grey-50 transition-colors">
                    <td className="px-4 py-3 text-grey-900 font-medium">{rl.material?.name}</td>
                    <td className="px-4 py-3 text-grey-700">{PRICING_LABELS[rl.pricing_model]}</td>
                    <td className="px-4 py-3 text-right text-grey-900 font-medium">{currencySymbol} {Number(rl.unit_rate).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-grey-700">{Number(rl.btw_rate)}%</td>
                    {canWrite && (
                      <td className="px-4 py-3 text-right">
                        <RowActionMenu actions={[
                          { label: 'Edit', icon: Pencil, onClick: () => { setEditRateLine(rl); setRateLineContractWsId(null); setShowRateModal(true); } },
                          { label: 'Delete', icon: Trash2, onClick: () => handleDeleteRateLine(rl.id), variant: 'danger' },
                        ]} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Contamination Penalties */}
      <div className="bg-white rounded-lg border border-grey-200 shadow-sm">
        <div className="flex items-center justify-between px-5 py-3 border-b border-grey-200">
          <h2 className="text-sm font-semibold text-grey-900">Contamination Penalties ({contract.contamination_penalties?.length || 0})</h2>
          {canWrite && contract.status === 'ACTIVE' && (
            <button onClick={() => setShowPenaltyModal(true)}
              className="flex items-center gap-1.5 h-8 px-3 bg-white text-grey-700 border border-grey-300 rounded-md text-xs font-semibold hover:bg-grey-50 transition-colors">
              <Settings2 size={14} /> Manage
            </button>
          )}
        </div>
        <div className="p-5">
          {(!contract.contamination_penalties || contract.contamination_penalties.length === 0) ? (
            <p className="text-sm text-grey-400 text-center py-4">No penalties linked</p>
          ) : (
            <div className="space-y-2">
              {contract.contamination_penalties.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-md border border-grey-200">
                  <div>
                    <p className="text-sm font-medium text-grey-900">{p.fee?.fee_type}</p>
                    <p className="text-xs text-grey-500">{p.fee?.description}</p>
                  </div>
                  <p className="text-sm font-medium text-grey-700">
                    {p.fee?.rate_type === 'PERCENTAGE' ? `${p.fee?.rate_value}%` : `\u20AC${Number(p.fee?.rate_value).toFixed(2)}`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showRateModal && (
        <RateLineFormModal
          contractId={id}
          rateLine={editRateLine}
          contractWasteStreamId={rateLineContractWsId}
          contractDates={{ effective_date: contract.effective_date, expiry_date: contract.expiry_date }}
          currency={contract.currency}
          onClose={() => { setShowRateModal(false); setEditRateLine(null); setRateLineContractWsId(null); }}
          onSuccess={() => { setShowRateModal(false); setEditRateLine(null); setRateLineContractWsId(null); fetchContract(); }}
        />
      )}
      {showPenaltyModal && (
        <PenaltySelectModal
          contractId={id}
          currentPenalties={contract.contamination_penalties || []}
          onClose={() => setShowPenaltyModal(false)}
          onSuccess={() => { setShowPenaltyModal(false); fetchContract(); }}
        />
      )}
    </div>
  );
}
