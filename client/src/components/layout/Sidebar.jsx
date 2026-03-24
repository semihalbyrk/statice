import { useMemo, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ClipboardList, Truck, Scale, Building2, Users, Recycle, FileBarChart,
  UserCog, ScrollText, Settings2, Boxes, ChevronDown, ChevronRight, LogOut, CalendarDays, Receipt, FileText,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import api from '../../api/axios';
import useAuthStore from '../../store/authStore';
import LanguageSelector from './LanguageSelector';

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
  const { t } = useTranslation(['nav', 'common']);
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

  const navItems = [
    { to: '/dashboard', label: t('nav:dashboard'), icon: LayoutDashboard, roles: null },
    { to: '/orders', label: t('nav:orders'), icon: ClipboardList, roles: ['ADMIN', 'LOGISTICS_PLANNER'] },
    { to: '/planning', label: t('nav:planningBoard'), icon: CalendarDays, roles: ['ADMIN', 'LOGISTICS_PLANNER', 'GATE_OPERATOR'] },
    { to: '/arrival', label: t('nav:arrival'), icon: Truck, roles: ['GATE_OPERATOR', 'ADMIN'] },
    { to: '/inbounds', label: t('nav:inbounds'), icon: Scale, roles: ['GATE_OPERATOR', 'ADMIN'] },
    { to: '/sorting', label: t('nav:process'), icon: Boxes, roles: ['SORTING_EMPLOYEE', 'GATE_OPERATOR', 'ADMIN'] },
    { to: '/reports', label: t('nav:reports'), icon: FileBarChart, roles: ['REPORTING_MANAGER', 'ADMIN'] },
    { to: '/contracts', label: t('nav:contracts'), icon: ScrollText, roles: ['ADMIN', 'FINANCE_MANAGER', 'FINANCE_USER'] },
    { to: '/invoices', label: t('nav:invoices'), icon: FileText, roles: ['ADMIN', 'FINANCE_MANAGER', 'FINANCE_USER'] },
  ];

  const adminItems = [
    { to: '/admin/users', label: t('nav:users'), icon: UserCog },
    { to: '/admin/carriers', label: t('nav:carriers'), icon: Building2 },
    { to: '/admin/suppliers', label: t('nav:suppliers'), icon: Users },
    { to: '/admin/materials', label: t('nav:materials'), icon: Recycle },
    { to: '/admin/fees', label: t('nav:feeMaster'), icon: Receipt },
    { to: '/admin/audit-log', label: t('nav:auditLog'), icon: ScrollText },
    { to: '/admin/settings', label: t('nav:settings'), icon: Settings2 },
  ];

  async function handleLogout() {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore logout errors
    }
    clearAuth();
    navigate('/login');
    toast.success(t('nav:signedOut'));
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
            <span className="text-[10px] font-semibold text-dark-blue-500 uppercase tracking-widest">{t('nav:main')}</span>
          </div>
          {navItems.filter((item) => !item.roles || item.roles.includes(role)).map((item) => (
            <SidebarLink key={item.to} {...item} onClick={onClose} />
          ))}

          {role === 'ADMIN' && (
            <>
              <button
                onClick={() => setAdminOpen((v) => !v)}
                className="w-full flex items-center justify-between px-3 pt-5 pb-2 group"
              >
                <span className="text-[10px] font-semibold text-dark-blue-500 uppercase tracking-widest">{t('nav:admin')}</span>
                {adminOpen
                  ? <ChevronDown size={12} className="text-dark-blue-500 group-hover:text-dark-blue-400" />
                  : <ChevronRight size={12} className="text-dark-blue-500 group-hover:text-dark-blue-400" />
                }
              </button>
              {adminOpen && adminItems.map((item) => (
                <SidebarLink key={item.to} {...item} onClick={onClose} />
              ))}
            </>
          )}
        </nav>

        <div className="px-3 pb-3">
          <div className="border-t border-white/20 pt-3">
            <LanguageSelector />

            <button
              onClick={handleLogout}
              className="mb-3 flex items-center gap-2 text-[14px] font-medium text-[#f04438] transition-colors hover:text-[#ff6b5b]"
            >
              <LogOut size={15} strokeWidth={1.8} />
              {t('nav:logout')}
            </button>

            <div className="flex items-center gap-3 rounded-xl">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-white/80 bg-[#d8f0cf] text-[13px] font-semibold text-[#5f7f59]">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-white">{user?.full_name || 'Statice User'}</p>
                <p className="truncate text-[12px] text-white/72">{t('common:roles.' + role, { defaultValue: role || 'User' })}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
