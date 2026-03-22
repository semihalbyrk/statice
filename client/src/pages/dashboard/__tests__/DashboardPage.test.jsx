import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DashboardPage from '../DashboardPage';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

// Mock dashboard API
const mockGetDashboardStats = vi.fn();
vi.mock('../../../api/dashboard', () => ({
  getDashboardStats: (...args) => mockGetDashboardStats(...args),
}));

// Auth store mock
let mockUser = null;
vi.mock('../../../store/authStore', () => ({
  default: (selector) => {
    const state = { user: mockUser };
    return selector(state);
  },
}));

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderDashboardPage() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <DashboardPage />
    </MemoryRouter>
  );
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 1, email: 'admin@statice.nl', role: 'ADMIN', full_name: 'Admin User' };
    mockGetDashboardStats.mockResolvedValue({ data: null });
  });

  it('renders the welcome message with user name', () => {
    mockGetDashboardStats.mockReturnValue(new Promise(() => {}));
    renderDashboardPage();
    expect(screen.getByText(/Welcome, Admin User/)).toBeInTheDocument();
  });

  it('renders the role label', () => {
    mockGetDashboardStats.mockReturnValue(new Promise(() => {}));
    renderDashboardPage();
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('shows loading spinner initially', () => {
    mockGetDashboardStats.mockReturnValue(new Promise(() => {}));
    renderDashboardPage();
    // Loader2 renders as an svg with animate-spin class
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeTruthy();
  });

  it('shows stat cards after data loads', async () => {
    mockGetDashboardStats.mockResolvedValue({
      data: {
        todayArrivals: 5,
        plannedOrders: 12,
        inProgressOrders: 3,
        completedToday: 2,
        tomorrowOrders: 8,
        activeInbounds: 4,
        todayInboundsTable: [],
        recentOrders: [],
        recentReports: [],
      },
    });

    renderDashboardPage();

    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('shows stat card labels', async () => {
    mockGetDashboardStats.mockResolvedValue({
      data: {
        todayArrivals: 0,
        plannedOrders: 0,
        inProgressOrders: 0,
        completedToday: 0,
        tomorrowOrders: 0,
        activeInbounds: 0,
        todayInboundsTable: [],
        recentOrders: [],
        recentReports: [],
      },
    });

    renderDashboardPage();

    await waitFor(() => {
      expect(screen.getAllByText("Today's Arrivals").length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText('Planned Orders').length).toBeGreaterThan(0);
    expect(screen.getAllByText('In Progress').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Completed Today').length).toBeGreaterThan(0);
    expect(screen.getAllByText("Tomorrow's Orders").length).toBeGreaterThan(0);
    expect(screen.getAllByText('Active Inbounds').length).toBeGreaterThan(0);
  });

  it('shows "No arrivals recorded today" when table is empty', async () => {
    mockGetDashboardStats.mockResolvedValue({
      data: {
        todayArrivals: 0,
        plannedOrders: 0,
        inProgressOrders: 0,
        completedToday: 0,
        tomorrowOrders: 0,
        activeInbounds: 0,
        todayInboundsTable: [],
        recentOrders: [],
        recentReports: [],
      },
    });

    renderDashboardPage();

    await waitFor(() => {
      expect(screen.getByText('No arrivals recorded today')).toBeInTheDocument();
    });
  });

  it('shows "No orders yet" when recent orders list is empty', async () => {
    mockGetDashboardStats.mockResolvedValue({
      data: {
        todayArrivals: 0,
        plannedOrders: 0,
        inProgressOrders: 0,
        completedToday: 0,
        tomorrowOrders: 0,
        activeInbounds: 0,
        todayInboundsTable: [],
        recentOrders: [],
        recentReports: [],
      },
    });

    renderDashboardPage();

    await waitFor(() => {
      expect(screen.getByText('No orders yet')).toBeInTheDocument();
    });
  });

  it('shows "No reports generated yet" when reports list is empty', async () => {
    mockGetDashboardStats.mockResolvedValue({
      data: {
        todayArrivals: 0,
        plannedOrders: 0,
        inProgressOrders: 0,
        completedToday: 0,
        tomorrowOrders: 0,
        activeInbounds: 0,
        todayInboundsTable: [],
        recentOrders: [],
        recentReports: [],
      },
    });

    renderDashboardPage();

    await waitFor(() => {
      expect(screen.getByText('No reports generated yet')).toBeInTheDocument();
    });
  });

  it('renders role label for GATE_OPERATOR', () => {
    mockUser = { id: 3, email: 'gate@statice.nl', role: 'GATE_OPERATOR', full_name: 'Gate Op' };
    mockGetDashboardStats.mockReturnValue(new Promise(() => {}));
    renderDashboardPage();
    expect(screen.getByText('Gate Operator')).toBeInTheDocument();
  });

  it('handles API failure gracefully without crashing', async () => {
    mockGetDashboardStats.mockRejectedValue(new Error('Network error'));
    renderDashboardPage();

    // Should still render the welcome area and stat cards with 0 values
    await waitFor(() => {
      expect(screen.getByText(/Welcome, Admin User/)).toBeInTheDocument();
    });
  });
});
