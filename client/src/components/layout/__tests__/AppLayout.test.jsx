import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AppLayout from '../AppLayout';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

// Mock axios api
vi.mock('../../../api/axios', () => ({
  default: { post: vi.fn() },
}));

// Mock masterDataStore
const mockLoadAll = vi.fn();

vi.mock('../../../store/masterDataStore', () => ({
  default: (selector) => {
    const state = { loadAll: mockLoadAll };
    return selector(state);
  },
}));

// Auth store mock — AppLayout itself may not use it, but Sidebar (child) does
let mockUser = { id: 1, email: 'admin@statice.nl', role: 'ADMIN', full_name: 'Admin User' };
const mockClearAuth = vi.fn();

vi.mock('../../../store/authStore', () => ({
  default: (selector) => {
    const state = {
      user: mockUser,
      clearAuth: mockClearAuth,
      isAuthenticated: () => !!mockUser,
    };
    return selector(state);
  },
}));

// Mock navigate
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

function renderAppLayout() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <AppLayout />
    </MemoryRouter>
  );
}

describe('AppLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 1, email: 'admin@statice.nl', role: 'ADMIN', full_name: 'Admin User' };
  });

  it('calls loadAll on mount to fetch master data', () => {
    renderAppLayout();
    expect(mockLoadAll).toHaveBeenCalledTimes(1);
  });

  it('renders the Sidebar component', () => {
    renderAppLayout();
    // Sidebar renders the Evreka360 branding
    expect(screen.getByText('Evreka360')).toBeInTheDocument();
  });

  it('renders a main content area', () => {
    const { container } = renderAppLayout();
    expect(container.querySelector('main')).toBeInTheDocument();
  });

  it('has the correct layout classes', () => {
    const { container } = renderAppLayout();
    const root = container.firstChild;
    expect(root.className).toContain('min-h-screen');
    expect(root.className).toContain('flex');
    expect(root.className).toContain('bg-grey-50');
  });

  it('renders header (Topbar) with sticky positioning', () => {
    const { container } = renderAppLayout();
    const header = container.querySelector('header');
    expect(header).toBeInTheDocument();
    expect(header.className).toContain('sticky');
  });
});
