import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Truck, Scale, Building2, Recycle, FileBarChart,
  UserCog, ScrollText, Settings2, Boxes, ChevronDown, LogOut, CalendarDays, Receipt, FileText, Box,
  PackageCheck, Briefcase, Factory, Shield, ClipboardList,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import api from '../../api/axios';
import useAuthStore from '../../store/authStore';
import LanguageSelector from './LanguageSelector';

function StandaloneLink({ to, label, icon: Icon, onClick }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-md text-[14px] font-semibold transition-colors ${
          isActive
            ? 'text-green-500 bg-green-500/[0.10]'
            : 'text-white hover:bg-white/[0.06]'
        }`
      }
    >
      <Icon size={20} strokeWidth={1.6} />
      {label}
    </NavLink>
  );
}

function GroupHeader({ icon: Icon, label, isOpen, onToggle, isActive }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-[14px] font-semibold transition-colors ${
        isActive ? 'text-green-500 bg-green-500/[0.10]' : 'text-white hover:bg-white/[0.06]'
      }`}
    >
      <span className="flex items-center gap-3">
        <Icon size={20} strokeWidth={1.6} />
        {label}
      </span>
      <ChevronDown
        size={16}
        className={`transition-transform duration-150 ${isActive ? 'text-green-500' : 'text-white/70'} ${isOpen ? '' : '-rotate-90'}`}
      />
    </button>
  );
}

function GroupChild({ to, label, onClick }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `block pl-4 pr-3 py-1.5 text-[13.5px] transition-colors ${
          isActive
            ? 'text-green-500 font-semibold'
            : 'text-dark-blue-300 hover:text-white'
        }`
      }
    >
      {label}
    </NavLink>
  );
}

export default function Sidebar({ open, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation(['nav', 'common']);
  const { user, clearAuth } = useAuthStore((state) => ({
    user: state.user,
    clearAuth: state.clearAuth,
  }));
  const role = user?.role;
  const [openGroups, setOpenGroups] = useState({
    engagement: false,
    mrf: false,
    admin: false,
  });
  const toggleGroup = (key) => setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  const initials = useMemo(() => {
    const source = user?.full_name || user?.email || 'S';
    return source
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'S';
  }, [user?.email, user?.full_name]);

  const standaloneTop = [
    { to: '/dashboard', label: t('nav:dashboard'), icon: LayoutDashboard, roles: null },
  ];

  const engagementItems = [
    { to: '/orders', label: t('nav:orders'), roles: ['ADMIN', 'LOGISTICS_PLANNER'] },
    { to: '/planning', label: t('nav:planningBoard'), roles: ['ADMIN', 'LOGISTICS_PLANNER', 'GATE_OPERATOR'] },
    { to: '/admin/entities', label: t('nav:entities'), roles: ['ADMIN'] },
    { to: '/admin/fees', label: t('nav:feeMaster'), roles: ['ADMIN'] },
    { to: '/contracts', label: t('nav:contracts'), roles: ['ADMIN', 'FINANCE_MANAGER', 'FINANCE_USER'] },
    { to: '/invoices', label: t('nav:invoices'), roles: ['ADMIN', 'FINANCE_MANAGER', 'FINANCE_USER'] },
  ];

  const mrfItems = [
    { to: '/arrival', label: t('nav:arrivals'), roles: ['GATE_OPERATOR', 'ADMIN'] },
    { to: '/inbounds', label: t('nav:inbounds'), roles: ['GATE_OPERATOR', 'ADMIN'] },
{ to: '/outbounds', label: t('nav:outbounds'), roles: ['GATE_OPERATOR', 'ADMIN', 'LOGISTICS_PLANNER'] },
    { to: '/parcels', label: t('nav:parcels'), roles: ['GATE_OPERATOR', 'ADMIN', 'LOGISTICS_PLANNER'] },
    { to: '/sorting', label: t('nav:process'), roles: ['SORTING_EMPLOYEE', 'GATE_OPERATOR', 'ADMIN'] },
    { to: '/admin/materials', label: t('nav:materials'), roles: ['ADMIN'] },
    { to: '/admin/containers', label: t('nav:containers'), roles: ['ADMIN'] },
  ];

  const adminItems = [
    { to: '/reports', label: t('nav:reports'), roles: ['REPORTING_MANAGER', 'ADMIN'] },
    { to: '/admin/users', label: t('nav:users'), roles: ['ADMIN'] },
    { to: '/admin/audit-log', label: t('nav:auditLog'), roles: ['ADMIN'] },
    { to: '/admin/settings', label: t('nav:settings'), roles: ['ADMIN'] },
  ];

  const filterByRole = (items) => items.filter((item) => !item.roles || item.roles.includes(role));

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

  const visibleTop = filterByRole(standaloneTop);
  const visibleEngagement = filterByRole(engagementItems);
  const visibleMrf = filterByRole(mrfItems);
  const visibleAdmin = filterByRole(adminItems);

  const isItemActive = (to) => location.pathname === to || location.pathname.startsWith(to + '/');
  const isGroupActive = (items) => items.some((item) => isItemActive(item.to));

  useEffect(() => {
    const activations = {
      engagement: isGroupActive(visibleEngagement),
      mrf: isGroupActive(visibleMrf),
      admin: isGroupActive(visibleAdmin),
    };
    setOpenGroups((prev) => ({
      ...prev,
      ...Object.fromEntries(Object.entries(activations).filter(([, v]) => v).map(([k]) => [k, true])),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const renderGroup = (key, label, icon, items) => {
    if (items.length === 0) return null;
    const isOpen = openGroups[key];
    const active = isGroupActive(items);
    return (
      <div>
        <GroupHeader icon={icon} label={label} isOpen={isOpen} onToggle={() => toggleGroup(key)} isActive={active} />
        {isOpen && (
          <div className="mt-0.5 ml-[22px] border-l border-white/15 pl-2 py-0.5 space-y-0.5">
            {items.map((item) => (
              <GroupChild key={item.to} to={item.to} label={item.label} onClick={onClose} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={onClose} />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 w-[230px] h-screen bg-dark-blue-900 text-white flex flex-col shrink-0 transition-transform duration-200 lg:sticky lg:top-0 lg:translate-x-0 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="h-20 flex items-center gap-3 px-4 border-b border-white/10">
          <img src="/logo-360.png" alt="360" className="h-12 w-12 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1">
            <div className="whitespace-nowrap text-[17px] font-bold tracking-tight text-white">Evreka360</div>
          </div>
        </div>

        <nav className="flex-1 py-3 px-2.5 space-y-1 overflow-y-auto">
          {visibleTop.map((item) => (
            <StandaloneLink key={item.to} {...item} onClick={onClose} />
          ))}
          {renderGroup('engagement', t('nav:engagement'), Briefcase, visibleEngagement)}
          {renderGroup('mrf', t('nav:mrf'), Factory, visibleMrf)}
          {renderGroup('admin', t('nav:admin'), Shield, visibleAdmin)}
        </nav>

        <div className="px-3 pb-3 space-y-3">
          <div className="border-t border-white/10 pt-3">
            <div className="flex items-center justify-between">
              <LanguageSelector />
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[13px] font-medium text-[#f04438] transition-colors hover:text-[#ff6b5b] hover:bg-white/[0.06]"
              >
                <LogOut size={14} strokeWidth={1.8} />
                {t('nav:logout')}
              </button>
            </div>
          </div>

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
      </aside>
    </>
  );
}
