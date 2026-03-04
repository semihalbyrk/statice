import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, ClipboardList, Loader2, CheckCircle2 } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { getDashboardStats } from '../../api/dashboard';
import StatusBadge from '../../components/ui/StatusBadge';

const ROLE_LABELS = {
  ADMIN: 'Admin',
  LOGISTICS_PLANNER: 'Logistics Planner',
  GATE_OPERATOR: 'Gate Operator',
  REPORTING_MANAGER: 'Reporting Manager',
};

function StatCard({ label, value, icon: Icon, colorClass }) {
  return (
    <div className="bg-surface rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-text-secondary">{label}</span>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colorClass}`}>
          <Icon size={18} />
        </div>
      </div>
      <p className="text-h-xs font-bold text-foreground">{value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await getDashboardStats();
      setStats(data);
    } catch {
      // silently fail — stats are non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-h-xs font-bold text-foreground">
          Welcome, {user?.full_name}
        </h1>
        <p className="text-text-tertiary text-sm mt-1">
          You are signed in as{' '}
          <span className="font-medium text-text-secondary">
            {ROLE_LABELS[user?.role] || user?.role}
          </span>
          .
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-text-placeholder" size={24} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              label="Today's Arrivals"
              value={stats?.todayArrivals ?? 0}
              icon={Truck}
              colorClass="bg-blue-100 text-blue-700"
            />
            <StatCard
              label="Planned Orders"
              value={stats?.plannedOrders ?? 0}
              icon={ClipboardList}
              colorClass="bg-grey-100 text-grey-700"
            />
            <StatCard
              label="In Progress"
              value={stats?.inProgressOrders ?? 0}
              icon={Loader2}
              colorClass="bg-orange-100 text-orange-700"
            />
            <StatCard
              label="Completed Today"
              value={stats?.completedToday ?? 0}
              icon={CheckCircle2}
              colorClass="bg-green-100 text-green-700"
            />
          </div>

          <div className="bg-surface rounded-xl border border-border">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">Recent Orders</h2>
            </div>
            {stats?.recentOrders?.length > 0 ? (
              <div className="divide-y divide-border">
                {stats.recentOrders.map((order) => (
                  <button
                    key={order.id}
                    onClick={() => navigate(`/orders/${order.id}`)}
                    className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted transition text-left"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-medium text-foreground">
                        {order.order_number}
                      </span>
                      <span className="text-sm text-text-secondary">
                        {order.carrier?.name}
                      </span>
                    </div>
                    <StatusBadge status={order.status} />
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-5 py-8 text-center text-sm text-text-placeholder">
                No orders yet
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
