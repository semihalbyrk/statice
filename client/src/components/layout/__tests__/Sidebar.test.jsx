import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from '../Sidebar';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

// Mock axios api
vi.mock('../../../api/axios', () => ({
  default: { post: vi.fn() },
}));

// Auth store mock state — mutated per test
let mockUser = null;
const mockClearAuth = vi.fn();

vi.mock('../../../store/authStore', () => ({
  default: (selector) => {
    const state = { user: mockUser, clearAuth: mockClearAuth };
    return selector(state);
  },
}));

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderSidebar(props = {}) {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Sidebar open={true} onClose={vi.fn()} {...props} />
    </MemoryRouter>
  );
}

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = null;
  });

  it('renders the Evreka360 branding', () => {
    mockUser = { id: 1, email: 'admin@statice.nl', role: 'ADMIN', full_name: 'Admin User' };
    renderSidebar();
    expect(screen.getByText('Evreka360')).toBeInTheDocument();
  });

  it('renders the Dashboard link for any role', () => {
    mockUser = { id: 3, email: 'gate@statice.nl', role: 'GATE_OPERATOR', full_name: 'Gate User' };
    renderSidebar();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('renders role-specific nav items for GATE_OPERATOR', () => {
    mockUser = { id: 3, email: 'gate@statice.nl', role: 'GATE_OPERATOR', full_name: 'Gate Op' };
    renderSidebar();

    // GATE_OPERATOR should see these
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Planning Board')).toBeInTheDocument();
    expect(screen.getByText('Arrivals')).toBeInTheDocument();
    expect(screen.getByText('Inbounds')).toBeInTheDocument();
    expect(screen.getByText('Outbounds')).toBeInTheDocument();
    expect(screen.getByText('Process')).toBeInTheDocument();

    // GATE_OPERATOR should NOT see these
    expect(screen.queryByText('Orders')).not.toBeInTheDocument();
    expect(screen.queryByText('Reports')).not.toBeInTheDocument();
  });

  it('renders role-specific nav items for LOGISTICS_PLANNER', () => {
    mockUser = { id: 2, email: 'planner@statice.nl', role: 'LOGISTICS_PLANNER', full_name: 'Planner' };
    renderSidebar();

    expect(screen.getByText('Orders')).toBeInTheDocument();
    expect(screen.getByText('Planning Board')).toBeInTheDocument();
    // LOGISTICS_PLANNER should NOT see sorting or arrival
    expect(screen.queryByText('Arrivals')).not.toBeInTheDocument();
    expect(screen.queryByText('Process')).not.toBeInTheDocument();
  });

  it('renders admin section with all admin links for ADMIN role', () => {
    mockUser = { id: 1, email: 'admin@statice.nl', role: 'ADMIN', full_name: 'Admin User' };
    renderSidebar();

    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('Entities')).toBeInTheDocument();
    expect(screen.getByText('Fee Master')).toBeInTheDocument();
    expect(screen.getByText('Materials')).toBeInTheDocument();
    expect(screen.getByText('Containers')).toBeInTheDocument();
    expect(screen.getByText('Audit Log')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('does not render admin section for non-admin roles', () => {
    mockUser = { id: 3, email: 'gate@statice.nl', role: 'GATE_OPERATOR', full_name: 'Gate User' };
    renderSidebar();

    expect(screen.queryByText('Users')).not.toBeInTheDocument();
    expect(screen.queryByText('Audit Log')).not.toBeInTheDocument();
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });

  it('renders the Logout button', () => {
    mockUser = { id: 1, email: 'admin@statice.nl', role: 'ADMIN', full_name: 'Admin User' };
    renderSidebar();
    expect(screen.getByText('Logout')).toBeInTheDocument();
  });

  it('displays the user full name and role label', () => {
    mockUser = { id: 1, email: 'admin@statice.nl', role: 'ADMIN', full_name: 'Admin User' };
    renderSidebar();
    expect(screen.getByText('Admin User')).toBeInTheDocument();
    // "Admin" appears both as the section header and the role label — use getAllByText
    const adminTexts = screen.getAllByText('Admin');
    expect(adminTexts.length).toBeGreaterThanOrEqual(2); // section header + role label
  });

  it('displays initials derived from full_name', () => {
    mockUser = { id: 1, email: 'admin@statice.nl', role: 'ADMIN', full_name: 'John Doe' };
    renderSidebar();
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('displays fallback text when user has no full_name', () => {
    mockUser = { id: 1, email: 'admin@statice.nl', role: 'ADMIN' };
    renderSidebar();
    // Falls back to email initial
    expect(screen.getByText('Statice User')).toBeInTheDocument();
  });

  it('renders REPORTING_MANAGER items correctly', () => {
    mockUser = { id: 4, email: 'reporting@statice.nl', role: 'REPORTING_MANAGER', full_name: 'Reporter' };
    renderSidebar();

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Reports')).toBeInTheDocument();
    // Should not see operations items
    expect(screen.queryByText('Arrivals')).not.toBeInTheDocument();
    expect(screen.queryByText('Orders')).not.toBeInTheDocument();
  });

  it('shows role label for GATE_OPERATOR', () => {
    mockUser = { id: 3, email: 'gate@statice.nl', role: 'GATE_OPERATOR', full_name: 'Gate Op' };
    renderSidebar();
    expect(screen.getByText('Gate Operator')).toBeInTheDocument();
  });
});
