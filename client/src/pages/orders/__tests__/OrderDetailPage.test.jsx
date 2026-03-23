import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import OrderDetailPage from '../OrderDetailPage';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

// Mock orders API
vi.mock('../../../api/orders', () => ({
  updateOrder: vi.fn(),
  setOrderIncident: vi.fn(),
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
const mockFetchOrder = vi.fn();
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

function renderOrderDetailPage(orderId = '1') {
  return render(
    <MemoryRouter initialEntries={[`/orders/${orderId}`]}>
      <Routes>
        <Route path="/orders/:id" element={<OrderDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('OrderDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 1, email: 'admin@statice.nl', role: 'ADMIN', full_name: 'Admin User' };
    mockOrdersState = {
      currentOrder: null,
      loading: true,
      fetchOrder: mockFetchOrder,
    };
  });

  it('shows loading spinner when loading', () => {
    renderOrderDetailPage();
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeTruthy();
  });

  it('calls fetchOrder with the route id on mount', () => {
    renderOrderDetailPage('42');
    expect(mockFetchOrder).toHaveBeenCalledWith('42');
  });

  it('renders order number after loading', () => {
    mockOrdersState = {
      currentOrder: {
        id: '1',
        order_number: 'ORD-2026-001',
        status: 'PLANNED',
        carrier: { name: 'DHL Express' },
        supplier: { name: 'Recycler BV', supplier_type: 'PRO' },
        waste_stream: { name: 'Large Household Appliances' },
        waste_streams: [],
        planned_date: '2026-03-22T00:00:00Z',
        expected_skip_count: 3,
        created_by_user: { full_name: 'Admin User' },
        inbounds: [],
      },
      loading: false,
      fetchOrder: mockFetchOrder,
    };

    renderOrderDetailPage();
    expect(screen.getAllByText('ORD-2026-001').length).toBeGreaterThan(0);
  });

  it('renders carrier and supplier details', () => {
    mockOrdersState = {
      currentOrder: {
        id: '1',
        order_number: 'ORD-2026-001',
        status: 'PLANNED',
        carrier: { name: 'DHL Express' },
        supplier: { name: 'Recycler BV', supplier_type: 'PRO' },
        waste_stream: { name: 'Large Household Appliances' },
        waste_streams: [],
        planned_date: '2026-03-22T00:00:00Z',
        expected_skip_count: 3,
        created_by_user: { full_name: 'Admin User' },
        inbounds: [],
      },
      loading: false,
      fetchOrder: mockFetchOrder,
    };

    renderOrderDetailPage();
    expect(screen.getByText('DHL Express')).toBeInTheDocument();
    expect(screen.getByText('Recycler BV')).toBeInTheDocument();
  });

  it('shows "No inbounds yet" when order has no inbounds', () => {
    mockOrdersState = {
      currentOrder: {
        id: '1',
        order_number: 'ORD-2026-001',
        status: 'PLANNED',
        carrier: { name: 'DHL Express' },
        supplier: { name: 'Recycler BV', supplier_type: 'PRO' },
        waste_stream: { name: 'LHA' },
        waste_streams: [],
        planned_date: '2026-03-22T00:00:00Z',
        expected_skip_count: 3,
        created_by_user: { full_name: 'Admin' },
        inbounds: [],
      },
      loading: false,
      fetchOrder: mockFetchOrder,
    };

    renderOrderDetailPage();
    expect(screen.getByText('No inbounds yet')).toBeInTheDocument();
  });

  it('renders Actions button for ADMIN with PLANNED order', () => {
    mockOrdersState = {
      currentOrder: {
        id: '1',
        order_number: 'ORD-2026-001',
        status: 'PLANNED',
        carrier: { name: 'DHL' },
        supplier: { name: 'Recycler BV' },
        waste_stream: { name: 'LHA' },
        waste_streams: [],
        planned_date: '2026-03-22T00:00:00Z',
        expected_skip_count: 3,
        created_by_user: { full_name: 'Admin' },
        inbounds: [],
      },
      loading: false,
      fetchOrder: mockFetchOrder,
    };

    renderOrderDetailPage();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('does not render Actions button for GATE_OPERATOR', () => {
    mockUser = { id: 3, email: 'gate@statice.nl', role: 'GATE_OPERATOR', full_name: 'Gate Op' };
    mockOrdersState = {
      currentOrder: {
        id: '1',
        order_number: 'ORD-2026-001',
        status: 'PLANNED',
        carrier: { name: 'DHL' },
        supplier: { name: 'Recycler BV' },
        waste_stream: { name: 'LHA' },
        waste_streams: [],
        planned_date: '2026-03-22T00:00:00Z',
        expected_skip_count: 3,
        created_by_user: { full_name: 'Admin' },
        inbounds: [],
      },
      loading: false,
      fetchOrder: mockFetchOrder,
    };

    renderOrderDetailPage();
    expect(screen.queryByText('Actions')).not.toBeInTheDocument();
  });

  it('renders the Report Incident section for non-completed orders', () => {
    mockOrdersState = {
      currentOrder: {
        id: '1',
        order_number: 'ORD-2026-001',
        status: 'IN_PROGRESS',
        carrier: { name: 'DHL' },
        supplier: { name: 'Recycler BV' },
        waste_stream: { name: 'LHA' },
        waste_streams: [],
        planned_date: '2026-03-22T00:00:00Z',
        expected_skip_count: 3,
        created_by_user: { full_name: 'Admin' },
        inbounds: [],
      },
      loading: false,
      fetchOrder: mockFetchOrder,
    };

    renderOrderDetailPage();
    expect(screen.getByText('Report Incident')).toBeInTheDocument();
  });

  it('renders inbound items when they exist', () => {
    mockOrdersState = {
      currentOrder: {
        id: '1',
        order_number: 'ORD-2026-001',
        status: 'IN_PROGRESS',
        carrier: { name: 'DHL' },
        supplier: { name: 'Recycler BV' },
        waste_stream: { name: 'LHA' },
        waste_streams: [],
        planned_date: '2026-03-22T00:00:00Z',
        expected_skip_count: 3,
        created_by_user: { full_name: 'Admin' },
        inbounds: [
          {
            id: 'inb-1',
            inbound_number: 'INB-001',
            status: 'ARRIVED',
            vehicle: { registration_plate: 'AB-123-CD' },
            arrived_at: '2026-03-22T10:00:00Z',
            waste_stream: { name: 'LHA' },
            sorting_session: null,
          },
        ],
      },
      loading: false,
      fetchOrder: mockFetchOrder,
    };

    renderOrderDetailPage();
    expect(screen.getByText('INB-001')).toBeInTheDocument();
    expect(screen.getByText('AB-123-CD')).toBeInTheDocument();
  });
});
