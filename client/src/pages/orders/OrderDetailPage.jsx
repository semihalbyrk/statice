import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Plus, Truck } from 'lucide-react';
import toast from 'react-hot-toast';
import useOrdersStore from '../../store/ordersStore';
import useAuthStore from '../../store/authStore';
import StatusBadge from '../../components/ui/StatusBadge';
import OrderFormModal from '../../components/orders/OrderFormModal';
import { updateOrder } from '../../api/orders';
import { createWeighingEvent } from '../../api/weighingEvents';
import { format } from 'date-fns';

const TRANSITIONS = {
  PLANNED: ['ARRIVED', 'CANCELLED'],
  ARRIVED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

const ACTION_LABELS = {
  ARRIVED: 'Mark Arrived',
  IN_PROGRESS: 'Start Processing',
  COMPLETED: 'Complete',
  CANCELLED: 'Cancel',
};

const ACTION_STYLES = {
  ARRIVED: 'bg-blue-600 text-white hover:bg-blue-700',
  IN_PROGRESS: 'bg-orange-500 text-white hover:bg-orange-600',
  COMPLETED: 'bg-green-600 text-white hover:bg-green-700',
  CANCELLED: 'bg-red-600 text-white hover:bg-red-700',
};

export default function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const { currentOrder: order, loading, fetchOrder } = useOrdersStore();
  const [showEdit, setShowEdit] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [plateInput, setPlateInput] = useState('');
  const [creatingEvent, setCreatingEvent] = useState(false);

  const canEdit = ['ADMIN', 'LOGISTICS_PLANNER'].includes(user?.role);
  const canOperate = ['ADMIN', 'GATE_OPERATOR'].includes(user?.role);
  const allowedTransitions = TRANSITIONS[order?.status] || [];
  const canCreateEvent = canOperate && ['ARRIVED', 'IN_PROGRESS'].includes(order?.status);

  useEffect(() => {
    fetchOrder(id);
  }, [id, fetchOrder]);

  async function handleTransition(newStatus) {
    setTransitioning(true);
    try {
      await updateOrder(id, { status: newStatus });
      toast.success(`Order ${ACTION_LABELS[newStatus]?.toLowerCase() || 'updated'}`);
      fetchOrder(id);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update status');
    } finally {
      setTransitioning(false);
    }
  }

  async function handleCreateEvent(e) {
    e.preventDefault();
    if (!plateInput.trim()) return;
    setCreatingEvent(true);
    try {
      const { data } = await createWeighingEvent({
        order_id: id,
        registration_plate: plateInput.trim().toUpperCase(),
      });
      toast.success('Weighing event created');
      setShowCreateEvent(false);
      setPlateInput('');
      navigate(`/weighing-events/${data.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create weighing event');
    } finally {
      setCreatingEvent(false);
    }
  }

  if (loading || !order) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-text-placeholder" size={24} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <button
        onClick={() => navigate('/orders')}
        className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-foreground mb-4 transition"
      >
        <ArrowLeft size={16} />
        Back to Orders
      </button>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-h-xs font-bold text-foreground">{order.order_number}</h1>
          <StatusBadge status={order.status} />
          {order.is_adhoc && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
              Ad-hoc
            </span>
          )}
        </div>
        {canEdit && order.status === 'PLANNED' && (
          <button
            onClick={() => setShowEdit(true)}
            className="px-4 py-2 text-sm font-medium text-foreground border border-border rounded-lg hover:bg-muted transition"
          >
            Edit
          </button>
        )}
      </div>

      {/* Info Grid */}
      <div className="bg-surface rounded-xl border border-border p-6 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
          <div>
            <span className="text-xs text-text-tertiary uppercase tracking-wide">Carrier</span>
            <p className="text-sm font-medium text-foreground mt-0.5">{order.carrier?.name}</p>
          </div>
          <div>
            <span className="text-xs text-text-tertiary uppercase tracking-wide">Supplier</span>
            <p className="text-sm font-medium text-foreground mt-0.5">{order.supplier?.name}</p>
          </div>
          <div>
            <span className="text-xs text-text-tertiary uppercase tracking-wide">Waste Stream</span>
            <p className="text-sm font-medium text-foreground mt-0.5">{order.waste_stream?.name_en}</p>
          </div>
          <div>
            <span className="text-xs text-text-tertiary uppercase tracking-wide">Planned Date</span>
            <p className="text-sm font-medium text-foreground mt-0.5">
              {format(new Date(order.planned_date), 'dd MMMM yyyy')}
            </p>
          </div>
          <div>
            <span className="text-xs text-text-tertiary uppercase tracking-wide">Expected Skips</span>
            <p className="text-sm font-medium text-foreground mt-0.5">{order.expected_skip_count}</p>
          </div>
          <div>
            <span className="text-xs text-text-tertiary uppercase tracking-wide">Created By</span>
            <p className="text-sm font-medium text-foreground mt-0.5">{order.created_by_user?.full_name}</p>
          </div>
          {order.notes && (
            <div className="sm:col-span-2">
              <span className="text-xs text-text-tertiary uppercase tracking-wide">Notes</span>
              <p className="text-sm text-foreground mt-0.5">{order.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Status Actions */}
      {allowedTransitions.length > 0 && (
        <div className="bg-surface rounded-xl border border-border p-5 mb-6">
          <h2 className="text-sm font-semibold text-foreground mb-3">Actions</h2>
          <div className="flex gap-3 flex-wrap">
            {allowedTransitions.map((status) => (
              <button
                key={status}
                onClick={() => handleTransition(status)}
                disabled={transitioning}
                className={`px-4 py-2 rounded-lg font-semibold text-sm transition disabled:opacity-50 ${ACTION_STYLES[status]}`}
              >
                {ACTION_LABELS[status]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Weighing Events */}
      <div className="bg-surface rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">Weighing Events</h2>
          {canCreateEvent && !showCreateEvent && (
            <button
              onClick={() => setShowCreateEvent(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg font-semibold text-xs hover:bg-primary-hover transition"
            >
              <Plus size={14} /> Create Weighing Event
            </button>
          )}
        </div>

        {showCreateEvent && (
          <form onSubmit={handleCreateEvent} className="mb-4 p-4 bg-muted rounded-lg border border-border">
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Vehicle Registration Plate
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                value={plateInput}
                onChange={(e) => setPlateInput(e.target.value.toUpperCase())}
                placeholder="AB-123-CD"
                required
                autoFocus
                className="flex-1 px-3 py-2 rounded-lg border border-input text-sm font-mono text-foreground placeholder-text-placeholder focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition tracking-wider"
              />
              <button
                type="submit"
                disabled={creatingEvent}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:bg-primary-hover disabled:opacity-50 transition"
              >
                <Truck size={16} />
                {creatingEvent ? 'Creating...' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => { setShowCreateEvent(false); setPlateInput(''); }}
                className="px-3 py-2 text-sm text-text-secondary hover:text-foreground rounded-lg hover:bg-surface transition"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {order.weighing_events?.length > 0 ? (
          <div className="divide-y divide-border">
            {order.weighing_events.map((event) => (
              <button
                key={event.id}
                onClick={() => navigate(`/weighing-events/${event.id}`)}
                className="py-3 flex items-center justify-between w-full text-left hover:bg-muted rounded-lg px-2 -mx-2 transition"
              >
                <div>
                  <span className="text-sm font-medium font-mono text-foreground">
                    {event.vehicle?.registration_plate}
                  </span>
                  <span className="text-sm text-text-secondary ml-3">
                    {format(new Date(event.arrived_at), 'dd MMM yyyy HH:mm')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={event.status} />
                  {event.sorting_session && (
                    <StatusBadge status={event.sorting_session.status} />
                  )}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-placeholder">No weighing events yet</p>
        )}
      </div>

      {showEdit && (
        <OrderFormModal
          order={order}
          onClose={() => setShowEdit(false)}
          onSuccess={() => {
            setShowEdit(false);
            fetchOrder(id);
          }}
        />
      )}
    </div>
  );
}
