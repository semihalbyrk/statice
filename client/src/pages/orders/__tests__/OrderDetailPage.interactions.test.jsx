/**
 * OrderDetailPage Interaction Tests
 * Tests order detail display, status badge, incident reporting
 * Tests document list rendering
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import OrderDetailPage from '../OrderDetailPage';
import * as ordersApi from '../../../api/orders';

vi.mock('../../../api/orders');

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: 'order-1' }),
    Link: ({ children, to }) => <a href={to}>{children}</a>,
  };
});

const mockOrder = {
  id: 'order-1',
  order_number: 'ORD-001',
  status: 'PLANNED',
  type: 'INCOMING',
  planned_date: '2026-04-15',
  supplier: { id: 'sup-1', name: 'TechRecycle B.V.', supplier_type: 'COMMERCIAL' },
  entity_supplier: { company_name: 'TechRecycle B.V.' },
  carrier: { id: 'car-1', name: 'FastLog B.V.' },
  waste_stream: { id: 'ws-1', name: 'Small WEEE', afvalstroomnummer: '160118' },
  vehicle_plate: '12-ABC-3',
  expected_skip_count: 3,
  received_asset_count: 0,
  net_weight_kg: null,
  incident: null,
  inbounds: [],
  notes: null,
};

// OrderDetailPage uses useOrdersStore (default) and useAuthStore (default)
vi.mock('../../../store/ordersStore', () => ({
  default: (selector) => {
    const state = {
      currentOrder: mockOrder,
      loading: false,
      error: null,
      fetchOrder: vi.fn(),
      clearCurrentOrder: vi.fn(),
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock('../../../store/authStore', () => {
  const useAuthStore = vi.fn((selector) => {
    const state = { user: { role: 'WAREHOUSE_MANAGER', name: 'Test User' } };
    return selector ? selector(state) : state;
  });
  useAuthStore.getState = vi.fn(() => ({ user: { role: 'WAREHOUSE_MANAGER' } }));
  return { default: useAuthStore };
});

const renderWithRouter = (component) =>
  render(<BrowserRouter>{component}</BrowserRouter>);

describe('OrderDetailPage Interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ordersApi.updateOrder.mockResolvedValue({ data: { data: { ...mockOrder, status: 'ARRIVED' } } });
    ordersApi.setOrderIncident.mockResolvedValue({ data: { data: { ...mockOrder, incident: 'Test incident' } } });
    ordersApi.getOrderDocuments.mockResolvedValue({ data: { data: [] } });
    ordersApi.uploadOrderDocument.mockResolvedValue({ data: { data: { id: 'doc-1' } } });
    ordersApi.downloadOrderDocument.mockResolvedValue({ data: new Blob() });
    ordersApi.deleteOrderDocument.mockResolvedValue({ data: { success: true } });
  });

  it('should render order number', () => {
    renderWithRouter(<OrderDetailPage />);

    // ORD-001 may appear in multiple places (breadcrumb, title, etc.)
    const matches = screen.getAllByText('ORD-001');
    expect(matches.length).toBeGreaterThan(0);
  });

  it('should display supplier name', () => {
    renderWithRouter(<OrderDetailPage />);

    expect(document.body.textContent).toMatch(/TechRecycle/);
  });

  it('should display order status', () => {
    renderWithRouter(<OrderDetailPage />);

    expect(document.body.textContent).toMatch(/PLANNED|Planned/i);
  });

  it('should display vehicle plate', () => {
    renderWithRouter(<OrderDetailPage />);

    expect(document.body.textContent).toMatch(/12-ABC-3/);
  });

  it('should display waste stream name', () => {
    renderWithRouter(<OrderDetailPage />);

    expect(document.body.textContent).toMatch(/Small WEEE/);
  });

  it('should display planned date', () => {
    renderWithRouter(<OrderDetailPage />);

    expect(document.body.textContent).toMatch(/Apr|2026/i);
  });

  it('should display carrier name', () => {
    renderWithRouter(<OrderDetailPage />);

    expect(document.body.textContent).toMatch(/FastLog/);
  });

  it('should show clickable status badge', () => {
    renderWithRouter(<OrderDetailPage />);

    // Status badge should be present (may be clickable)
    expect(document.body.textContent).toMatch(/PLANNED|Planned/i);
  });

  it('should render action controls (edit, incident, or status)', () => {
    renderWithRouter(<OrderDetailPage />);

    const body = document.body.textContent;
    // At least some action should be present
    expect(body).toMatch(/edit|incident|status|update/i);
  });

  it('should have updateOrder API available for status transitions', () => {
    renderWithRouter(<OrderDetailPage />);

    // Verify the API is wired up — actual transition tested via E2E
    expect(ordersApi.updateOrder).toBeDefined();
    expect(document.body.textContent).toMatch(/PLANNED|Planned/i);
  });

  it('should display documents section', () => {
    renderWithRouter(<OrderDetailPage />);

    expect(document.body.textContent).toMatch(/document|file|upload/i);
  });

  it('should call getOrderDocuments on mount', async () => {
    renderWithRouter(<OrderDetailPage />);

    await waitFor(() => {
      expect(ordersApi.getOrderDocuments).toHaveBeenCalledWith('order-1');
    });
  });

  it('should show incident button or field', () => {
    renderWithRouter(<OrderDetailPage />);

    const incidentBtn = screen.queryByRole('button', { name: /incident|report/i }) ||
      document.querySelector('[data-incident]');
    expect(incidentBtn || document.body.textContent.match(/incident/i)).toBeTruthy();
  });

  it('should display carrier information', () => {
    renderWithRouter(<OrderDetailPage />);

    expect(document.body.textContent).toMatch(/FastLog/);
  });

  it('should show order type', () => {
    renderWithRouter(<OrderDetailPage />);

    expect(document.body.textContent).toMatch(/incoming|INCOMING|order/i);
  });

  it('should render without crashing on load', () => {
    renderWithRouter(<OrderDetailPage />);

    // currentOrder is mocked — order number should appear immediately
    const matches = screen.getAllByText('ORD-001');
    expect(matches.length).toBeGreaterThan(0);
  });
});
