import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, ClipboardList, Truck, Settings, Building2, Users, Recycle,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: null },
  { to: '/orders', label: 'Orders', icon: ClipboardList, roles: null },
  { to: '/arrival', label: 'Arrival', icon: Truck, roles: ['GATE_OPERATOR', 'ADMIN'] },
];

const ADMIN_ITEMS = [
  { to: '/admin/carriers', label: 'Carriers', icon: Building2 },
  { to: '/admin/suppliers', label: 'Suppliers', icon: Users },
  { to: '/admin/waste-streams', label: 'Waste Streams', icon: Recycle },
];

function SidebarLink({ to, label, icon: Icon }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
          isActive
            ? 'bg-primary-light text-primary'
            : 'text-text-secondary hover:bg-muted hover:text-foreground'
        }`
      }
    >
      <Icon size={18} />
      {label}
    </NavLink>
  );
}

export default function Sidebar() {
  const user = useAuthStore((state) => state.user);
  const role = user?.role;

  return (
    <aside className="w-56 bg-surface border-r border-border flex flex-col shrink-0">
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role)).map((item) => (
          <SidebarLink key={item.to} {...item} />
        ))}

        {role === 'ADMIN' && (
          <>
            <div className="pt-4 pb-2 px-3">
              <span className="text-xxs font-semibold text-text-placeholder uppercase tracking-wider flex items-center gap-1.5">
                <Settings size={12} />
                Admin
              </span>
            </div>
            {ADMIN_ITEMS.map((item) => (
              <SidebarLink key={item.to} {...item} />
            ))}
          </>
        )}
      </nav>
    </aside>
  );
}
