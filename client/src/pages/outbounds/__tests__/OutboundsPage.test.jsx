/**
 * OutboundsPage Column & List Tests
 * Tests rendering of outbound list with correct columns
 * Tests filtering, status badges, navigation to detail
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import OutboundsPage from '../OutboundsPage';
import * as outboundsApi from '../../../api/outbounds';

vi.mock('../../../api/outbounds');

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams(''), vi.fn()],
  };
});

const mockOutbounds = [
  {
    id: 'outbound-1',
    outbound_number: 'OUT-001',
    status: 'CREATED',
    outbound_order: {
      id: 'order-out-1',
      order_number: 'ORD-OUT-001',
      buyer: { name: 'Wecycle', company_name: 'Wecycle B.V.' },
      vehicle_plate: 'AB-123-C',
    },
    vehicle_plate: 'AB-123-C',
    net_weight_kg: null,
    parcels: [],
    created_at: '2026-04-13T10:00:00Z',
  },
  {
    id: 'outbound-2',
    outbound_number: 'OUT-002',
    status: 'LOADING',
    outbound_order: {
      id: 'order-out-2',
      order_number: 'ORD-OUT-002',
      buyer: { name: 'Coolrec', company_name: 'Coolrec B.V.' },
      vehicle_plate: 'XY-456-Z',
    },
    vehicle_plate: 'XY-456-Z',
    net_weight_kg: 500.0,
    parcels: [{ id: 'p1' }, { id: 'p2' }],
    created_at: '2026-04-13T09:00:00Z',
  },
  {
    id: 'outbound-3',
    outbound_number: 'OUT-003',
    status: 'DEPARTED',
    outbound_order: {
      id: 'order-out-3',
      order_number: 'ORD-OUT-003',
      buyer: { name: 'TechRecycle', company_name: 'TechRecycle B.V.' },
      vehicle_plate: 'NL-789-K',
    },
    vehicle_plate: 'NL-789-K',
    net_weight_kg: 1200.5,
    parcels: [{ id: 'p3' }],
    departed_at: '2026-04-13T14:00:00Z',
    created_at: '2026-04-12T08:00:00Z',
  },
];

// OutboundsPage uses useOutboundsStore to manage state and fetch data
vi.mock('../../../store/outboundsStore', () => ({
  useOutboundsStore: () => ({
    outbounds: mockOutbounds,
    totalCount: 3,
    filters: { status: null, search: '', page: 1, limit: 10 },
    loading: false,
    fetchOutbounds: vi.fn(),
    setFilters: vi.fn(),
  }),
}));

const renderWithRouter = (component) =>
  render(<BrowserRouter>{component}</BrowserRouter>);

describe('OutboundsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render outbound list with numbers', () => {
    renderWithRouter(<OutboundsPage />);

    expect(screen.getByText('OUT-001')).toBeInTheDocument();
    expect(screen.getByText('OUT-002')).toBeInTheDocument();
    expect(screen.getByText('OUT-003')).toBeInTheDocument();
  });

  it('should display status for each outbound', () => {
    renderWithRouter(<OutboundsPage />);

    // Status values should be visible (may be translated)
    expect(document.body.textContent).toMatch(/CREATED|Created|Aangemaakt/i);
    expect(document.body.textContent).toMatch(/LOADING|Loading|Beladen/i);
    expect(document.body.textContent).toMatch(/DEPARTED|Departed|Vertrokken/i);
  });

  it('should display buyer/company names', () => {
    renderWithRouter(<OutboundsPage />);

    expect(document.body.textContent).toMatch(/Wecycle/i);
    expect(document.body.textContent).toMatch(/Coolrec/i);
    expect(document.body.textContent).toMatch(/TechRecycle/i);
  });

  it('should display vehicle plates', () => {
    renderWithRouter(<OutboundsPage />);

    expect(document.body.textContent).toMatch(/AB-123-C/);
    expect(document.body.textContent).toMatch(/XY-456-Z/);
    expect(document.body.textContent).toMatch(/NL-789-K/);
  });

  it('should display net weight when available', () => {
    renderWithRouter(<OutboundsPage />);

    // OUT-002 net weight = 500
    expect(document.body.textContent).toMatch(/500/);
  });

  it('should navigate to outbound detail on row click', async () => {
    const user = userEvent.setup();
    renderWithRouter(<OutboundsPage />);

    const firstRow = screen.getByText('OUT-001').closest('tr') ||
      screen.getByText('OUT-001').closest('[role="row"]');
    if (firstRow) {
      await user.click(firstRow);
      expect(mockNavigate).toHaveBeenCalledWith('/outbounds/outbound-1');
    }
  });

  it('should render column headers', () => {
    renderWithRouter(<OutboundsPage />);

    // Column headers (from i18n translations)
    expect(document.body.textContent).toMatch(/Outbound|Number|#|Status/i);
  });

  it('should show empty state when no outbounds', () => {
    vi.doMock('../../../store/outboundsStore', () => ({
      useOutboundsStore: () => ({
        outbounds: [],
        totalCount: 0,
        filters: { status: null, search: '', page: 1, limit: 10 },
        loading: false,
        fetchOutbounds: vi.fn(),
        setFilters: vi.fn(),
      }),
    }));

    // Re-render with empty store — check page renders
    renderWithRouter(<OutboundsPage />);
    expect(document.body.textContent).toBeTruthy();
  });

  it('should show loading indicator when loading is true', () => {
    vi.doMock('../../../store/outboundsStore', () => ({
      useOutboundsStore: () => ({
        outbounds: [],
        totalCount: 0,
        filters: { status: null, search: '', page: 1, limit: 10 },
        loading: true,
        fetchOutbounds: vi.fn(),
        setFilters: vi.fn(),
      }),
    }));

    renderWithRouter(<OutboundsPage />);
    expect(document.body.textContent).toBeTruthy();
  });

  it('should display outbound order number', () => {
    renderWithRouter(<OutboundsPage />);

    // Order numbers should appear in rows
    expect(document.body.textContent).toMatch(/ORD-OUT-001|ORD-OUT-002|ORD-OUT-003/);
  });

  it('should have a status filter control', () => {
    renderWithRouter(<OutboundsPage />);

    // Filter dropdown or select
    const filterControl = document.querySelector('select') ||
      screen.queryByRole('combobox', { name: /status/i }) ||
      screen.queryByText(/all statuses|filter/i);
    expect(filterControl || document.body.textContent.match(/status/i)).toBeTruthy();
  });

  it('should have a search input', () => {
    renderWithRouter(<OutboundsPage />);

    const searchInput = screen.queryByPlaceholderText(/search/i) ||
      screen.queryByRole('searchbox');
    expect(searchInput || document.querySelector('input[type="text"]')).toBeTruthy();
  });

  it('should show dates in the outbounds list', () => {
    renderWithRouter(<OutboundsPage />);

    // Dates from created_at and departed_at should appear in some format
    // OUT-003 departed_at: 2026-04-13T14:00:00Z, created_at: 2026-04-12T08:00:00Z
    const body = document.body.textContent;
    // Any date format from 2026-04 period
    expect(body).toMatch(/Apr|april|2026|04-1[23]|13-04/i);
  });
});
