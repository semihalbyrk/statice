import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, ClipboardList, Loader2, CheckCircle2, Calendar, Scale, FileBarChart } from 'lucide-react';
import { format } from 'date-fns';
import useAuthStore from '../../store/authStore';
import { getDashboardStats } from '../../api/dashboard';
import StatusBadge from '../../components/ui/StatusBadge';

const ROLE_LABELS = {
  ADMIN: 'Admin',
  LOGISTICS_PLANNER: 'Logistics Planner',
  GATE_OPERATOR: 'Gate Operator',
  REPORTING_MANAGER: 'Reporting Manager',
};

function StatCard({ label, value, icon: Icon, iconBg }) {
  return (
    <div className="bg-white rounded-lg border border-grey-200 shadow-sm p-5">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconBg}`}>
          <Icon size={20} />
        </div>
        <div>
          <p className="text-xs font-medium text-grey-500 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-grey-900 mt-0.5">{value}</p>
        </div>
      </div>
    </div>
  );
}

function formatTime(dateStr) {
  if (!dateStr) return '-';
  try {
    return format(new Date(dateStr), 'HH:mm');
  } catch {
    return '-';
  }
}

function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  try {
    return format(new Date(dateStr), 'dd MMM yyyy, HH:mm');
  } catch {
    return '-';
  }
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
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-grey-900">
          Welcome, {user?.full_name}
        </h1>
        <p className="text-grey-500 text-sm mt-1">
          You are signed in as{' '}
          <span className="font-medium text-grey-600">
            {ROLE_LABELS[user?.role] || user?.role}
          </span>
          .
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-grey-400" size={24} />
        </div>
      ) : (
        <>
          {/* Stat Cards — 6 cards, responsive grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
            <StatCard
              label="Today's Arrivals"
              value={stats?.todayArrivals ?? 0}
              icon={Truck}
              iconBg="bg-blue-50 text-blue-600"
            />
            <StatCard
              label="Planned Orders"
              value={stats?.plannedOrders ?? 0}
              icon={ClipboardList}
              iconBg="bg-grey-100 text-grey-600"
            />
            <StatCard
              label="In Progress"
              value={stats?.inProgressOrders ?? 0}
              icon={Loader2}
              iconBg="bg-orange-50 text-orange-600"
            />
            <StatCard
              label="Completed Today"
              value={stats?.completedToday ?? 0}
              icon={CheckCircle2}
              iconBg="bg-green-25 text-green-600"
            />
            <StatCard
              label="Tomorrow's Orders"
              value={stats?.tomorrowOrders ?? 0}
              icon={Calendar}
              iconBg="bg-purple-50 text-purple-600"
            />
            <StatCard
              label="Active Inbounds"
              value={stats?.activeInbounds ?? 0}
              icon={Scale}
              iconBg="bg-yellow-50 text-yellow-600"
            />
          </div>

          {/* Two-column layout: Arrivals table (left) | Recent Orders + Reports (right) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column — Today's Arrivals table (spans 2 cols) */}
            <div className="lg:col-span-2 bg-white rounded-lg border border-grey-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-grey-200">
                <h2 className="text-base font-semibold text-grey-900">Today&apos;s Arrivals</h2>
              </div>
              {stats?.todayInboundsTable?.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-grey-200 bg-grey-50">
                        <th className="text-left px-5 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Vehicle Plate</th>
                        <th className="text-left px-5 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Carrier</th>
                        <th className="text-left px-5 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Supplier</th>
                        <th className="text-left px-5 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Order #</th>
                        <th className="text-left px-5 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Skips</th>
                        <th className="text-left px-5 py-3 text-xs font-medium text-grey-500 uppercase tracking-wide">Arrived At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-grey-100">
                      {stats.todayInboundsTable.map((arrival) => (
                        <tr key={arrival.id} className="hover:bg-grey-50 transition-colors">
                          <td className="px-5 py-3 font-medium text-grey-900">{arrival.vehicle_plate}</td>
                          <td className="px-5 py-3 text-grey-500">{arrival.carrier}</td>
                          <td className="px-5 py-3 text-grey-500">{arrival.supplier}</td>
                          <td className="px-5 py-3 text-grey-900">{arrival.order_number}</td>
                          <td className="px-5 py-3 text-grey-900">{arrival.skips_registered}</td>
                          <td className="px-5 py-3 text-grey-500">{formatTime(arrival.arrived_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="px-5 py-8 text-center text-sm text-grey-400">
                  No arrivals recorded today
                </div>
              )}
            </div>

            {/* Right column — Recent Orders + Recent Reports stacked */}
            <div className="flex flex-col gap-6">
              {/* Recent Orders */}
              <div className="bg-white rounded-lg border border-grey-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-grey-200">
                  <h2 className="text-base font-semibold text-grey-900">Recent Orders</h2>
                </div>
                {stats?.recentOrders?.length > 0 ? (
                  <div className="divide-y divide-grey-100">
                    {stats.recentOrders.map((order) => (
                      <button
                        key={order.id}
                        onClick={() => navigate(`/orders/${order.id}`)}
                        className="w-full flex items-center justify-between px-5 py-2.5 hover:bg-grey-50 transition-colors text-left"
                      >
                        <div className="flex items-center gap-4">
                          <span className="text-sm font-medium text-grey-900">
                            {order.order_number}
                          </span>
                          <span className="text-sm text-grey-500">
                            {order.carrier?.name}
                          </span>
                        </div>
                        <StatusBadge status={order.status} />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="px-5 py-8 text-center text-sm text-grey-400">
                    No orders yet
                  </div>
                )}
              </div>

              {/* Recent Reports */}
              <div className="bg-white rounded-lg border border-grey-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-grey-200">
                  <h2 className="text-base font-semibold text-grey-900">Recent Reports</h2>
                </div>
                {stats?.recentReports?.length > 0 ? (
                  <div className="divide-y divide-grey-100">
                    {stats.recentReports.map((report) => (
                      <div
                        key={report.id}
                        className="flex items-center gap-3 px-5 py-2.5 hover:bg-grey-50 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-grey-100 text-grey-600 shrink-0">
                          <FileBarChart size={16} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-grey-900 truncate">{report.type}</p>
                          <p className="text-xs text-grey-500">{formatDateTime(report.generated_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-5 py-8 text-center text-sm text-grey-400">
                    No reports generated yet
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
