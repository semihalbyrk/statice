import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/authStore';
import api from './api/axios';
import LoginPage from './pages/auth/LoginPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import DesignTokensPreview from './components/DesignTokensPreview';
import AppLayout from './components/layout/AppLayout';
import OrdersPage from './pages/orders/OrdersPage';
import OrderDetailPage from './pages/orders/OrderDetailPage';
import ArrivalPage from './pages/arrival/ArrivalPage';
import MaterialsManagementPage from './pages/admin/MaterialsManagementPage';
import WeighingEventPage from './pages/weighing/WeighingEventPage';
import OrderCreatePage from './pages/orders/OrderCreatePage';
import PlanningBoardPage from './pages/orders/PlanningBoardPage';
import InboundsPage from './pages/inbounds/InboundsPage';
import SortingPage from './pages/sorting/SortingPage';
import SortingProcessListPage from './pages/sorting/SortingProcessListPage';
import ReportsPage from './pages/reports/ReportsPage';
import SchedulesPage from './pages/reports/SchedulesPage';
import UsersPage from './pages/admin/UsersPage';
import AuditLogPage from './pages/admin/AuditLogPage';
import SystemSettingsPage from './pages/admin/SystemSettingsPage';
import ContractsDashboardPage from './pages/contracts/ContractsDashboardPage';
import ContractCreatePage from './pages/contracts/ContractCreatePage';
import ContractDetailPage from './pages/contracts/ContractDetailPage';
import FeeMasterPage from './pages/admin/FeeMasterPage';
import ContainerRegistryPage from './pages/admin/ContainerRegistryPage';
import InvoicesPage from './pages/invoices/InvoicesPage';
import InvoiceCreatePage from './pages/invoices/InvoiceCreatePage';
import InvoiceDetailPage from './pages/invoices/InvoiceDetailPage';
import EntitiesPage from './pages/admin/entities/EntitiesPage';
import EntityDetailPage from './pages/admin/entities/EntityDetailPage';
import EntityCreatePage from './pages/admin/entities/EntityCreatePage';
import EntityEditPage from './pages/admin/entities/EntityEditPage';
import OutboundOrderCreatePage from './pages/outbound-orders/OutboundOrderCreatePage';
import OutboundOrderDetailPage from './pages/outbound-orders/OutboundOrderDetailPage';
import OutboundsPage from './pages/outbounds/OutboundsPage';
import OutboundDetailPage from './pages/outbounds/OutboundDetailPage';
import ParcelsPage from './pages/parcels/ParcelsPage';
import IncomingParcelDetailPage from './pages/parcels/IncomingParcelDetailPage';
import NotFoundPage from './pages/errors/NotFoundPage';
import UnauthorisedPage from './pages/errors/UnauthorisedPage';

function ProtectedRoute({ children, allowedRoles }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated());
  const user = useAuthStore((state) => state.user);
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return <UnauthorisedPage />;
  }
  return children;
}

function BootstrapLoader() {
  return (
    <div className="flex h-screen items-center justify-center text-grey-500">
      Loading…
    </div>
  );
}

export default function App() {
  const isBootstrapping = useAuthStore((state) => state.isBootstrapping);
  const setAuth = useAuthStore((state) => state.setAuth);
  const setBootstrapping = useAuthStore((state) => state.setBootstrapping);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.post('/auth/refresh');
        if (!cancelled && data?.accessToken) {
          setAuth(data.accessToken, data.user ?? null);
        }
      } catch {
        if (!cancelled) clearAuth();
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clearAuth, setAuth, setBootstrapping]);

  if (isBootstrapping) {
    return <BootstrapLoader />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/design-tokens" element={<DesignTokensPreview />} />
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/planning" element={<ProtectedRoute allowedRoles={['ADMIN', 'LOGISTICS_PLANNER', 'GATE_OPERATOR']}><PlanningBoardPage /></ProtectedRoute>} />
          <Route path="/orders" element={<ProtectedRoute allowedRoles={['ADMIN', 'LOGISTICS_PLANNER']}><OrdersPage /></ProtectedRoute>} />
          <Route path="/orders/new" element={<ProtectedRoute allowedRoles={['ADMIN', 'LOGISTICS_PLANNER']}><OrderCreatePage /></ProtectedRoute>} />
          <Route path="/orders/:id" element={<ProtectedRoute allowedRoles={['ADMIN', 'LOGISTICS_PLANNER']}><OrderDetailPage /></ProtectedRoute>} />
          <Route path="/outbound-orders" element={<Navigate to="/orders?tab=outbound" replace />} />
          <Route path="/outbound-orders/new" element={<ProtectedRoute allowedRoles={['ADMIN', 'LOGISTICS_PLANNER']}><OutboundOrderCreatePage /></ProtectedRoute>} />
          <Route path="/outbound-orders/:id" element={<ProtectedRoute allowedRoles={['ADMIN', 'LOGISTICS_PLANNER']}><OutboundOrderDetailPage /></ProtectedRoute>} />
          <Route path="/outbounds" element={<ProtectedRoute allowedRoles={['GATE_OPERATOR', 'ADMIN', 'LOGISTICS_PLANNER']}><OutboundsPage /></ProtectedRoute>} />
          <Route path="/outbounds/:outboundId" element={<ProtectedRoute allowedRoles={['GATE_OPERATOR', 'ADMIN', 'LOGISTICS_PLANNER']}><OutboundDetailPage /></ProtectedRoute>} />
          <Route path="/parcels" element={<ProtectedRoute allowedRoles={['GATE_OPERATOR', 'ADMIN', 'LOGISTICS_PLANNER']}><ParcelsPage /></ProtectedRoute>} />
          <Route path="/parcels/incoming/:id" element={<ProtectedRoute allowedRoles={['GATE_OPERATOR', 'ADMIN', 'LOGISTICS_PLANNER']}><IncomingParcelDetailPage /></ProtectedRoute>} />
          <Route path="/arrival" element={<ProtectedRoute allowedRoles={['GATE_OPERATOR', 'ADMIN']}><ArrivalPage /></ProtectedRoute>} />
          <Route path="/inbounds" element={<ProtectedRoute allowedRoles={['GATE_OPERATOR', 'ADMIN']}><InboundsPage /></ProtectedRoute>} />
          <Route path="/inbounds/:inboundId" element={<ProtectedRoute allowedRoles={['GATE_OPERATOR', 'ADMIN']}><WeighingEventPage /></ProtectedRoute>} />
          <Route path="/weighing-events/:eventId" element={<Navigate to="/inbounds" replace />} />
          <Route path="/sorting" element={<ProtectedRoute allowedRoles={['SORTING_EMPLOYEE', 'GATE_OPERATOR', 'ADMIN']}><SortingProcessListPage /></ProtectedRoute>} />
          <Route path="/sorting/:sessionId" element={<ProtectedRoute allowedRoles={['SORTING_EMPLOYEE', 'GATE_OPERATOR', 'ADMIN']}><SortingPage /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute allowedRoles={['REPORTING_MANAGER', 'ADMIN']}><ReportsPage /></ProtectedRoute>} />
          <Route path="/reports/schedules" element={<ProtectedRoute allowedRoles={['REPORTING_MANAGER', 'ADMIN']}><SchedulesPage /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['ADMIN']}><UsersPage /></ProtectedRoute>} />
          <Route path="/admin/carriers" element={<Navigate to="/admin/entities?tab=transporters" replace />} />
          <Route path="/admin/suppliers" element={<Navigate to="/admin/entities?tab=suppliers" replace />} />
          <Route path="/admin/materials" element={<ProtectedRoute allowedRoles={['ADMIN']}><MaterialsManagementPage /></ProtectedRoute>} />
          <Route path="/admin/containers" element={<ProtectedRoute allowedRoles={['ADMIN']}><ContainerRegistryPage /></ProtectedRoute>} />
          <Route path="/contracts" element={<ProtectedRoute allowedRoles={['ADMIN', 'FINANCE_MANAGER', 'FINANCE_USER']}><ContractsDashboardPage /></ProtectedRoute>} />
          <Route path="/contracts/new" element={<ProtectedRoute allowedRoles={['ADMIN', 'FINANCE_MANAGER']}><ContractCreatePage /></ProtectedRoute>} />
          <Route path="/contracts/:id/edit" element={<ProtectedRoute allowedRoles={['ADMIN', 'FINANCE_MANAGER']}><ContractCreatePage /></ProtectedRoute>} />
          <Route path="/contracts/:id" element={<ProtectedRoute allowedRoles={['ADMIN', 'FINANCE_MANAGER', 'FINANCE_USER']}><ContractDetailPage /></ProtectedRoute>} />
          <Route path="/invoices" element={<ProtectedRoute allowedRoles={['ADMIN', 'FINANCE_MANAGER', 'FINANCE_USER']}><InvoicesPage /></ProtectedRoute>} />
          <Route path="/invoices/new" element={<ProtectedRoute allowedRoles={['ADMIN', 'FINANCE_MANAGER', 'FINANCE_USER']}><InvoiceCreatePage /></ProtectedRoute>} />
          <Route path="/invoices/:id" element={<ProtectedRoute allowedRoles={['ADMIN', 'FINANCE_MANAGER', 'FINANCE_USER']}><InvoiceDetailPage /></ProtectedRoute>} />
          <Route path="/admin/fees" element={<ProtectedRoute allowedRoles={['ADMIN', 'FINANCE_MANAGER']}><FeeMasterPage /></ProtectedRoute>} />
          <Route path="/admin/entities" element={<ProtectedRoute allowedRoles={['ADMIN']}><EntitiesPage /></ProtectedRoute>} />
          <Route path="/admin/entities/new" element={<ProtectedRoute allowedRoles={['ADMIN']}><EntityCreatePage /></ProtectedRoute>} />
          <Route path="/admin/entities/:id/edit" element={<ProtectedRoute allowedRoles={['ADMIN']}><EntityEditPage /></ProtectedRoute>} />
          <Route path="/admin/entities/:id" element={<ProtectedRoute allowedRoles={['ADMIN']}><EntityDetailPage /></ProtectedRoute>} />
          <Route path="/admin/audit-log" element={<ProtectedRoute allowedRoles={['ADMIN']}><AuditLogPage /></ProtectedRoute>} />
          <Route path="/admin/settings" element={<ProtectedRoute allowedRoles={['ADMIN']}><SystemSettingsPage /></ProtectedRoute>} />
        </Route>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
