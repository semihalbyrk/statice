import { useMemo, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ClipboardList, Truck, Scale, Building2, Users, Recycle, FileBarChart,
  UserCog, ScrollText, Settings2, Boxes, ChevronDown, ChevronRight, LogOut, CalendarDays, Receipt,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import useAuthStore from '../../store/authStore';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: null },
  { to: '/orders', label: 'Orders', icon: ClipboardList, roles: ['ADMIN', 'LOGISTICS_PLANNER'] },
  { to: '/planning', label: 'Planning Board', icon: CalendarDays, roles: ['ADMIN', 'LOGISTICS_PLANNER', 'GATE_OPERATOR'] },
  { to: '/arrival', label: 'Arrival', icon: Truck, roles: ['GATE_OPERATOR', 'ADMIN'] },
  { to: '/inbounds', label: 'Inbounds', icon: Scale, roles: ['GATE_OPERATOR', 'ADMIN'] },
  { to: '/sorting', label: 'Process', icon: Boxes, roles: ['SORTING_EMPLOYEE', 'GATE_OPERATOR', 'ADMIN'] },
  { to: '/reports', label: 'Reports', icon: FileBarChart, roles: ['REPORTING_MANAGER', 'ADMIN'] },
  { to: '/contracts', label: 'Contracts', icon: ScrollText, roles: ['ADMIN', 'FINANCE_MANAGER', 'FINANCE_USER'] },
];

const ADMIN_ITEMS = [
  { to: '/admin/users', label: 'Users', icon: UserCog },
  { to: '/admin/carriers', label: 'Carriers', icon: Building2 },
  { to: '/admin/suppliers', label: 'Suppliers', icon: Users },
  { to: '/admin/materials', label: 'Materials', icon: Recycle },
  { to: '/admin/fees', label: 'Fee Master', icon: Receipt },
  { to: '/admin/audit-log', label: 'Audit Log', icon: ScrollText },
  { to: '/admin/settings', label: 'Settings', icon: Settings2 },
];

const ROLE_LABELS = {
  ADMIN: 'Admin',
  LOGISTICS_PLANNER: 'Logistics Planner',
  GATE_OPERATOR: 'Gate Operator',
  REPORTING_MANAGER: 'Reporting Manager',
  SORTING_EMPLOYEE: 'Sorting Employee',
  COMPLIANCE_OFFICER: 'Compliance Officer',
  LOGISTICS_COORDINATOR: 'Logistics Coordinator',
  FINANCE_MANAGER: 'Finance Manager',
  FINANCE_USER: 'Finance User',
};

function SidebarLink({ to, label, icon: Icon, onClick }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
          isActive
            ? 'text-green-500 bg-green-500/[0.12] border-l-[3px] border-green-500 font-semibold'
            : 'text-dark-blue-400 hover:text-white hover:bg-white/[0.08] border-l-[3px] border-transparent'
        }`
      }
    >
      <Icon size={18} strokeWidth={1.5} />
      {label}
    </NavLink>
  );
}

export default function Sidebar({ open, onClose }) {
  const navigate = useNavigate();
  const { user, clearAuth } = useAuthStore((state) => ({
    user: state.user,
    clearAuth: state.clearAuth,
  }));
  const role = user?.role;
  const [adminOpen, setAdminOpen] = useState(true);
  const initials = useMemo(() => {
    const source = user?.full_name || user?.email || 'S';
    return source
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'S';
  }, [user?.email, user?.full_name]);

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
    <>
      {/* Mobile backdrop */}
      {open && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={onClose} />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 w-[220px] bg-dark-blue-900 text-white flex flex-col shrink-0 transition-transform duration-200 lg:static lg:translate-x-0 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="h-20 flex items-center gap-3 px-4 border-b border-white/10">
          <img src="/logo-360.png" alt="360" className="h-12 w-12 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1">
            <div className="whitespace-nowrap text-[17px] font-bold tracking-tight text-white">Evreka360</div>
          </div>
        </div>

        <nav className="flex-1 py-3 px-2.5 space-y-0.5 overflow-y-auto">
          <div className="px-3 pt-1 pb-2">
            <span className="text-[10px] font-semibold text-dark-blue-500 uppercase tracking-widest">Main</span>
          </div>
          {NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role)).map((item) => (
            <SidebarLink key={item.to} {...item} onClick={onClose} />
          ))}

          {role === 'ADMIN' && (
            <>
              <button
                onClick={() => setAdminOpen((v) => !v)}
                className="w-full flex items-center justify-between px-3 pt-5 pb-2 group"
              >
                <span className="text-[10px] font-semibold text-dark-blue-500 uppercase tracking-widest">Admin</span>
                {adminOpen
                  ? <ChevronDown size={12} className="text-dark-blue-500 group-hover:text-dark-blue-400" />
                  : <ChevronRight size={12} className="text-dark-blue-500 group-hover:text-dark-blue-400" />
                }
              </button>
              {adminOpen && ADMIN_ITEMS.map((item) => (
                <SidebarLink key={item.to} {...item} onClick={onClose} />
              ))}
            </>
          )}
        </nav>

        <div className="px-3 pb-3">
          <div className="border-t border-white/20 pt-3">
            <button
              onClick={handleLogout}
              className="mb-3 flex items-center gap-2 text-[14px] font-medium text-[#f04438] transition-colors hover:text-[#ff6b5b]"
            >
              <LogOut size={15} strokeWidth={1.8} />
              Logout
            </button>

            <div className="flex items-center gap-3 rounded-xl">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-white/80 bg-[#d8f0cf] text-[13px] font-semibold text-[#5f7f59]">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-white">{user?.full_name || 'Statice User'}</p>
                <p className="truncate text-[12px] text-white/72">{ROLE_LABELS[role] || role || 'User'}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
