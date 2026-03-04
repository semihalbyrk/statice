import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import useAuthStore from '../../store/authStore';

const ROLE_LABELS = {
  ADMIN: 'Admin',
  LOGISTICS_PLANNER: 'Logistics Planner',
  GATE_OPERATOR: 'Gate Operator',
  REPORTING_MANAGER: 'Reporting Manager',
};

const ROLE_COLORS = {
  ADMIN: 'bg-purple-100 text-purple-700',
  LOGISTICS_PLANNER: 'bg-blue-100 text-blue-700',
  GATE_OPERATOR: 'bg-green-100 text-green-700',
  REPORTING_MANAGER: 'bg-orange-100 text-orange-700',
};

export default function Topbar() {
  const navigate = useNavigate();
  const { user, clearAuth } = useAuthStore();

  async function handleLogout() {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore logout errors
    }
    clearAuth();
    navigate('/login');
    toast.success('Signed out');
  }

  return (
    <header className="bg-surface border-b border-border sticky top-0 z-20">
      <div className="h-14 flex items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-xs">S</span>
          </div>
          <span className="font-semibold text-foreground text-sm tracking-wide">
            STATICE MRF
          </span>
        </div>

        <div className="flex items-center gap-3">
          {user && (
            <>
              <span className="text-sm text-text-secondary hidden sm:block">
                {user.full_name}
              </span>
              <span
                className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                  ROLE_COLORS[user.role] || 'bg-muted text-muted-foreground'
                }`}
              >
                {ROLE_LABELS[user.role] || user.role}
              </span>
            </>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-sm text-text-tertiary hover:text-foreground transition px-2 py-1 rounded-md hover:bg-muted"
          >
            <LogOut size={15} />
            <span className="hidden sm:block">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
