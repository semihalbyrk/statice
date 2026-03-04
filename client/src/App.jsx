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
import WeighingEventPage from './pages/weighing/WeighingEventPage';
import SortingPage from './pages/sorting/SortingPage';

function ProtectedRoute({ children }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated());
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
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
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/orders/:id" element={<OrderDetailPage />} />
          <Route path="/arrival" element={<ArrivalPage />} />
          <Route path="/weighing-events/:eventId" element={<WeighingEventPage />} />
          <Route path="/sorting/:sessionId" element={<SortingPage />} />
          <Route path="/admin/carriers" element={<CarriersPage />} />
          <Route path="/admin/suppliers" element={<SuppliersPage />} />
          <Route path="/admin/waste-streams" element={<WasteStreamsPage />} />
        </Route>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
