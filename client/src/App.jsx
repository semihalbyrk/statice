import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/authStore';
import LoginPage from './pages/auth/LoginPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import DesignTokensPreview from './components/DesignTokensPreview';
import AppLayout from './components/layout/AppLayout';
import OrdersPage from './pages/orders/OrdersPage';
import OrderDetailPage from './pages/orders/OrderDetailPage';
import ArrivalPage from './pages/arrival/ArrivalPage';
import CarriersPage from './pages/admin/CarriersPage';
import SuppliersPage from './pages/admin/SuppliersPage';
import WasteStreamsPage from './pages/admin/WasteStreamsPage';
import ProductTypesPage from './pages/admin/ProductTypesPage';
import ProcessorsPage from './pages/admin/ProcessorsPage';
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

export default function App() {
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
          <Route path="/arrival" element={<ProtectedRoute allowedRoles={['GATE_OPERATOR', 'ADMIN']}><ArrivalPage /></ProtectedRoute>} />
          <Route path="/inbounds" element={<ProtectedRoute allowedRoles={['GATE_OPERATOR', 'ADMIN']}><InboundsPage /></ProtectedRoute>} />
          <Route path="/inbounds/:inboundId" element={<ProtectedRoute allowedRoles={['GATE_OPERATOR', 'ADMIN']}><WeighingEventPage /></ProtectedRoute>} />
          <Route path="/weighing-events/:eventId" element={<Navigate to="/inbounds" replace />} />
          <Route path="/sorting" element={<ProtectedRoute allowedRoles={['SORTING_EMPLOYEE', 'GATE_OPERATOR', 'ADMIN']}><SortingProcessListPage /></ProtectedRoute>} />
          <Route path="/sorting/:sessionId" element={<ProtectedRoute allowedRoles={['SORTING_EMPLOYEE', 'GATE_OPERATOR', 'ADMIN']}><SortingPage /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute allowedRoles={['REPORTING_MANAGER', 'ADMIN']}><ReportsPage /></ProtectedRoute>} />
          <Route path="/reports/schedules" element={<ProtectedRoute allowedRoles={['REPORTING_MANAGER', 'ADMIN']}><SchedulesPage /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['ADMIN']}><UsersPage /></ProtectedRoute>} />
          <Route path="/admin/carriers" element={<ProtectedRoute allowedRoles={['ADMIN']}><CarriersPage /></ProtectedRoute>} />
          <Route path="/admin/suppliers" element={<ProtectedRoute allowedRoles={['ADMIN']}><SuppliersPage /></ProtectedRoute>} />
          <Route path="/admin/waste-streams" element={<ProtectedRoute allowedRoles={['ADMIN']}><WasteStreamsPage /></ProtectedRoute>} />
          <Route path="/admin/product-types" element={<ProtectedRoute allowedRoles={['ADMIN']}><ProductTypesPage /></ProtectedRoute>} />
          <Route path="/admin/processors" element={<ProtectedRoute allowedRoles={['ADMIN']}><ProcessorsPage /></ProtectedRoute>} />
          <Route path="/admin/audit-log" element={<ProtectedRoute allowedRoles={['ADMIN']}><AuditLogPage /></ProtectedRoute>} />
          <Route path="/admin/settings" element={<ProtectedRoute allowedRoles={['ADMIN']}><SystemSettingsPage /></ProtectedRoute>} />
        </Route>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
