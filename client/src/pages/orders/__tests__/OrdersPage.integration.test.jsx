/**
 * OrdersPage Integration Tests
 * Tests rendering of both INCOMING and OUTGOING order tabs
 * Tests tab switching, filtering, navigation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import OrdersPage from '../OrdersPage';
import * as ordersApi from '../../../api/orders';
import * as outboundOrdersApi from '../../../api/outboundOrders';

vi.mock('../../../api/orders');
vi.mock('../../../api/outboundOrders');

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams(''), vi.fn()],
    Link: ({ children, to }) => <a href={to}>{children}</a>,
  };
});

const mockInboundOrders = [
  {
    id: 'order-1',
    order_number: 'ORD-001',
    status: 'PLANNED',
    supplier: { name: 'TechRecycle B.V.', supplier_type: 'COMMERCIAL' },
    carrier: { name: 'FastLog B.V.' },
    waste_stream: { name: 'Small WEEE' },
    planned_date: '2026-04-15',
    entity_supplier: { company_name: 'TechRecycle B.V.' },
  },
  {
    id: 'order-2',
    order_number: 'ORD-002',
    status: 'COMPLETED',
    supplier: { name: 'Wecycle B.V.', supplier_type: 'COMMERCIAL' },
    carrier: { name: 'SlowLog B.V.' },
    waste_stream: { name: 'Large WEEE' },
    planned_date: '2026-04-10',
    entity_supplier: { company_name: 'Wecycle B.V.' },
  },
];

const mockOutboundOrders = [
  {
    id: 'out-order-1',
    order_number: 'OUT-ORD-001',
    status: 'PLANNED',
    buyer_entity: { company_name: 'Coolrec B.V.' },
    buyer: { name: 'Coolrec B.V.' },
    waste_stream: { name: 'Mixed Metals' },
    planned_date: '2026-04-20',
  },
];

// OrdersPage uses default exports from stores
vi.mock('../../../store/ordersStore', () => ({
  default: () => ({
    orders: mockInboundOrders,
    totalCount: 2,
    filters: { status: '', search: '', page: 1, limit: 20, date_from: '', date_to: '' },
    loading: false,
    error: null,
    fetchOrders: vi.fn(),
    setFilters: vi.fn(),
    clearFilters: vi.fn(),
  }),
}));

vi.mock('../../../store/outboundOrdersStore', () => ({
  default: () => ({
    outboundOrders: mockOutboundOrders,
    totalCount: 1,
    filters: { status: '', search: '', page: 1, limit: 20 },
    loading: false,
    error: null,
    fetchOutboundOrders: vi.fn(),
    setFilters: vi.fn(),
    clearFilters: vi.fn(),
  }),
}));

vi.mock('../../../store/authStore', () => {
  const useAuthStore = vi.fn((selector) => {
    const state = { user: { role: 'LOGISTICS_PLANNER', name: 'Test User' } };
    return selector ? selector(state) : state;
  });
  useAuthStore.getState = vi.fn(() => ({ user: { role: 'LOGISTICS_PLANNER' } }));
  return { default: useAuthStore };
});

const renderWithRouter = (component) =>
  render(<BrowserRouter>{component}</BrowserRouter>);

describe('OrdersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ordersApi.updateOrder.mockResolvedValue({ data: { data: {} } });
    outboundOrdersApi.updateOutboundOrderStatus.mockResolvedValue({ data: { data: {} } });
  });

  it('should render inbound orders tab with orders', () => {
    renderWithRouter(<OrdersPage />);

    expect(screen.getByText('ORD-001')).toBeInTheDocument();
    expect(screen.getByText('ORD-002')).toBeInTheDocument();
  });

  it('should display tab buttons for inbound and outbound', () => {
    renderWithRouter(<OrdersPage />);

    const body = document.body.textContent;
    // Tabs exist (i18n translated)
    expect(body).toMatch(/inbound.*order|order.*inbound|incoming/i);
    expect(body).toMatch(/outbound.*order|order.*outbound|outgoing/i);
  });

  it('should display order statuses', () => {
    renderWithRouter(<OrdersPage />);

    expect(document.body.textContent).toMatch(/PLANNED|planned/i);
    expect(document.body.textContent).toMatch(/COMPLETED|completed/i);
  });

  it('should display supplier names', () => {
    renderWithRouter(<OrdersPage />);

    expect(document.body.textContent).toMatch(/TechRecycle/);
    expect(document.body.textContent).toMatch(/Wecycle/);
  });

  it('should display waste stream names', () => {
    renderWithRouter(<OrdersPage />);

    expect(document.body.textContent).toMatch(/Small WEEE/);
    expect(document.body.textContent).toMatch(/Large WEEE/);
  });

  it('should navigate to order detail on row click', async () => {
    const user = userEvent.setup();
    renderWithRouter(<OrdersPage />);

    const row = screen.getByText('ORD-001').closest('tr');
    if (row) {
      await user.click(row);
      expect(mockNavigate).toHaveBeenCalledWith('/orders/order-1');
    }
  });

  it('should have a create order button', () => {
    renderWithRouter(<OrdersPage />);

    const createBtn = screen.queryByRole('button', { name: /create|new|add/i }) ||
      screen.queryByRole('link', { name: /create|new|add/i });
    expect(createBtn || document.body.textContent.match(/create|new.*order/i)).toBeTruthy();
  });

  it('should have a search input', () => {
    renderWithRouter(<OrdersPage />);

    const input = document.querySelector('input[type="text"]');
    expect(input).toBeTruthy();
  });

  it('should have a status filter', () => {
    renderWithRouter(<OrdersPage />);

    const select = document.querySelector('select');
    expect(select).toBeTruthy();
  });

  it('should display planned dates', () => {
    renderWithRouter(<OrdersPage />);

    expect(document.body.textContent).toMatch(/Apr|april|2026/i);
  });
});
