/**
 * InboundsPage Column & List Tests
 * Tests rendering of inbound list with correct columns
 * Tests filtering, navigation to detail
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import InboundsPage from '../InboundsPage';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams(''), () => {}],
  };
});

// InboundsPage uses useInboundsListStore from store/weighingStore
vi.mock('../../../store/weighingStore', () => ({
  useInboundsListStore: () => ({
    inbounds: mockInbounds,
    totalCount: 3,
    filters: { status: '', search: '', page: 1, limit: 20 },
    loading: false,
    error: null,
    fetchInbounds: vi.fn(),
    setFilters: vi.fn(),
    clearFilters: vi.fn(),
  }),
}));

// updateInboundStatus is called via the store but imported from api/weighingEvents
vi.mock('../../../api/weighingEvents', () => ({
  updateInboundStatus: vi.fn().mockResolvedValue({ data: { success: true } }),
  getInbounds: vi.fn(),
  getInbound: vi.fn(),
  createInbound: vi.fn(),
}));

const mockInbounds = [
  {
    id: 'inbound-1',
    inbound_number: 'INB-001',
    status: 'ARRIVED',
    vehicle: { registration_plate: '12-ABC-3' },
    order: {
      order_number: 'ORD-001',
      supplier: { name: 'TechRecycle B.V.', supplier_type: 'COMMERCIAL' },
      carrier: { name: 'FastLog B.V.' },
      waste_stream: { name: 'Small WEEE' },
    },
    arrived_at: '2026-04-13T09:00:00Z',
    net_weight: null,
    skip_count: 0,
  },
  {
    id: 'inbound-2',
    inbound_number: 'INB-002',
    status: 'WEIGHED_OUT',
    vehicle: { registration_plate: 'XY-456-Z' },
    order: {
      order_number: 'ORD-002',
      supplier: { name: 'Wecycle B.V.', supplier_type: 'COMMERCIAL' },
      carrier: { name: 'SlowLog B.V.' },
      waste_stream: { name: 'Large WEEE' },
    },
    arrived_at: '2026-04-13T08:00:00Z',
    net_weight: 950,
    skip_count: 1,
  },
  {
    id: 'inbound-3',
    inbound_number: 'INB-003',
    status: 'READY_FOR_SORTING',
    vehicle: { registration_plate: 'NL-789-K' },
    order: {
      order_number: 'ORD-003',
      supplier: { name: 'Coolrec B.V.', supplier_type: 'COMMERCIAL' },
      carrier: null,
      waste_stream: { name: 'Mixed Metals' },
    },
    arrived_at: '2026-04-12T14:00:00Z',
    net_weight: 1500,
    skip_count: 0,
  },
];

const renderWithRouter = (component) =>
  render(<BrowserRouter>{component}</BrowserRouter>);

describe('InboundsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render inbound list with inbound numbers', () => {
    renderWithRouter(<InboundsPage />);

    expect(screen.getByText('INB-001')).toBeInTheDocument();
    expect(screen.getByText('INB-002')).toBeInTheDocument();
    expect(screen.getByText('INB-003')).toBeInTheDocument();
  });

  it('should display status for each inbound', () => {
    renderWithRouter(<InboundsPage />);

    expect(document.body.textContent).toMatch(/ARRIVED|Arrived/i);
    expect(document.body.textContent).toMatch(/WEIGHED_OUT|Weighed Out/i);
    expect(document.body.textContent).toMatch(/READY_FOR_SORTING|Ready For Sorting/i);
  });

  it('should display order numbers', () => {
    renderWithRouter(<InboundsPage />);

    expect(screen.getByText('ORD-001')).toBeInTheDocument();
    expect(screen.getByText('ORD-002')).toBeInTheDocument();
    expect(screen.getByText('ORD-003')).toBeInTheDocument();
  });

  it('should display vehicle registration plates', () => {
    renderWithRouter(<InboundsPage />);

    expect(document.body.textContent).toMatch(/12-ABC-3/);
    expect(document.body.textContent).toMatch(/XY-456-Z/);
    expect(document.body.textContent).toMatch(/NL-789-K/);
  });

  it('should display supplier names', () => {
    renderWithRouter(<InboundsPage />);

    expect(document.body.textContent).toMatch(/TechRecycle/);
    expect(document.body.textContent).toMatch(/Wecycle/);
    expect(document.body.textContent).toMatch(/Coolrec/);
  });

  it('should display waste stream names', () => {
    renderWithRouter(<InboundsPage />);

    expect(document.body.textContent).toMatch(/Small WEEE/);
    expect(document.body.textContent).toMatch(/Large WEEE/);
    expect(document.body.textContent).toMatch(/Mixed Metals/);
  });

  it('should display net weight when available', () => {
    renderWithRouter(<InboundsPage />);

    expect(document.body.textContent).toMatch(/950/);
    expect(document.body.textContent).toMatch(/1[,.]?500/);
  });

  it('should navigate to inbound detail on row click', async () => {
    const user = userEvent.setup();
    renderWithRouter(<InboundsPage />);

    const row = screen.getByText('INB-001').closest('tr');
    if (row) {
      await user.click(row);
      expect(mockNavigate).toHaveBeenCalledWith('/inbounds/inbound-1');
    }
  });

  it('should render column headers', () => {
    renderWithRouter(<InboundsPage />);

    const body = document.body.textContent;
    expect(body).toMatch(/inbound|number|#/i);
    expect(body).toMatch(/status/i);
  });

  it('should have a search input', () => {
    renderWithRouter(<InboundsPage />);

    const searchInput = document.querySelector('input[type="text"]') ||
      screen.queryByRole('textbox');
    expect(searchInput).toBeTruthy();
  });

  it('should have a status filter', () => {
    renderWithRouter(<InboundsPage />);

    const filterControl = document.querySelector('select') ||
      screen.queryByRole('combobox');
    expect(filterControl).toBeTruthy();
  });

  it('should show dates from arrived_at', () => {
    renderWithRouter(<InboundsPage />);

    const body = document.body.textContent;
    expect(body).toMatch(/Apr|april|2026/i);
  });
});
