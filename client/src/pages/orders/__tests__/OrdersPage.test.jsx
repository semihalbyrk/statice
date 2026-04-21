import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import OrdersPage from '../OrdersPage';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

// Mock orders API
vi.mock('../../../api/orders', () => ({
  updateOrder: vi.fn(),
}));

// Auth store mock
let mockUser = null;
vi.mock('../../../store/authStore', () => ({
  default: (selector) => {
    const state = { user: mockUser };
    return selector(state);
  },
}));

// Orders store mock
const mockFetchOrders = vi.fn();
const mockSetFilters = vi.fn();
let mockOrdersState = {};

vi.mock('../../../store/ordersStore', () => ({
  default: (selector) => {
    if (selector) return selector(mockOrdersState);
    return mockOrdersState;
  },
}));

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderOrdersPage() {
  return render(
    <MemoryRouter initialEntries={['/orders']}>
      <OrdersPage />
    </MemoryRouter>
  );
}

describe('OrdersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 1, email: 'admin@statice.nl', role: 'ADMIN', full_name: 'Admin User' };
    mockOrdersState = {
      orders: [],
      totalCount: 0,
      filters: { search: '', status: '', page: 1, limit: 10, date_from: '', date_to: '' },
      loading: false,
      fetchOrders: mockFetchOrders,
      setFilters: mockSetFilters,
    };
  });

  it('renders the page title', () => {
    renderOrdersPage();
    expect(screen.getByText('Orders')).toBeInTheDocument();
  });

  it('renders "New Order" button for ADMIN role', () => {
    renderOrdersPage();
    expect(screen.getByText('Create Order')).toBeInTheDocument();
  });

  it('renders "New Order" button for LOGISTICS_PLANNER role', () => {
    mockUser = { id: 2, email: 'planner@statice.nl', role: 'LOGISTICS_PLANNER', full_name: 'Planner' };
    renderOrdersPage();
    expect(screen.getByText('Create Order')).toBeInTheDocument();
  });

  it('does not render "New Order" button for GATE_OPERATOR role', () => {
    mockUser = { id: 3, email: 'gate@statice.nl', role: 'GATE_OPERATOR', full_name: 'Gate Op' };
    renderOrdersPage();
    expect(screen.queryByText('Create Order')).not.toBeInTheDocument();
  });

  it('renders tabs for Inbound Orders and Outbound Orders', () => {
    renderOrdersPage();
    expect(screen.getByText('Inbound Orders')).toBeInTheDocument();
    expect(screen.getByText('Outbound Orders')).toBeInTheDocument();
  });

  it('renders search input', () => {
    renderOrdersPage();
    expect(screen.getByPlaceholderText('Search by order name...')).toBeInTheDocument();
  });

  it('renders status filter select', () => {
    renderOrdersPage();
    expect(screen.getByText('All statuses')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    mockOrdersState.loading = true;
    renderOrdersPage();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows "No orders found" when orders array is empty', () => {
    renderOrdersPage();
    expect(screen.getByText('No orders found')).toBeInTheDocument();
  });

  it('renders order rows when data is loaded', () => {
    mockOrdersState.orders = [
      {
        id: '1',
        order_number: 'ORD-2026-001',
        status: 'PLANNED',
        carrier: { name: 'DHL Express' },
        supplier: { name: 'Recycler BV', supplier_type: 'PRO' },
        waste_stream: { name: 'Large Household Appliances' },
        waste_streams: [],
        planned_date: '2026-03-22T00:00:00Z',
        vehicle_plate: 'AB-123-CD',
        afvalstroomnummer: '123456',
        expected_skip_count: 3,
        notes: '',
      },
    ];
    mockOrdersState.totalCount = 1;

    renderOrdersPage();
    expect(screen.getByText('ORD-2026-001')).toBeInTheDocument();
    expect(screen.getByText('DHL Express')).toBeInTheDocument();
  });

  it('calls fetchOrders on mount', () => {
    renderOrdersPage();
    expect(mockFetchOrders).toHaveBeenCalled();
  });

  it('navigates to new order page on "New Order" button click', async () => {
    const user = userEvent.setup();
    renderOrdersPage();
    await user.click(screen.getByText('Create Order'));
    expect(mockNavigate).toHaveBeenCalledWith('/orders/new?type=INCOMING');
  });
});
