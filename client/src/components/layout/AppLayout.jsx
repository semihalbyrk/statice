import { useCallback, useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import IdleWarningModal from './IdleWarningModal';
import ErrorBoundary from '../ErrorBoundary';
import useMasterDataStore from '../../store/masterDataStore';
import useAuthStore from '../../store/authStore';
import useIdleTimer from '../../hooks/useIdleTimer';
import api from '../../api/axios';

export default function AppLayout() {
  const loadAll = useMasterDataStore((state) => state.loadAll);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated());
  const navigate = useNavigate();
  const { t } = useTranslation('common');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleIdleLogout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore — we're logging out anyway.
    }
    clearAuth();
    navigate('/login', { replace: true });
    toast.error(t('idleWarning.signedOutToast', 'Signed out due to inactivity'));
  }, [clearAuth, navigate, t]);

  const { warning, secondsRemaining, extendSession } = useIdleTimer({
    onTimeout: handleIdleLogout,
    enabled: isAuthenticated,
  });

  return (
    <div className="min-h-screen flex bg-grey-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onToggleSidebar={() => setSidebarOpen((o) => !o)} />
        <main className="flex-1 p-6 overflow-auto">
          <div>
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>
      <IdleWarningModal
        open={warning}
        secondsRemaining={secondsRemaining}
        onStay={extendSession}
        onLogout={handleIdleLogout}
      />
    </div>
  );
}
