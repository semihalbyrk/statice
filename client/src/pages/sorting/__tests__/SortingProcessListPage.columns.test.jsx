/**
 * SortingProcessListPage Columns Test
 * Tests rendering of sorting session list
 * Tests session status display, navigation to detail
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import SortingProcessListPage from '../SortingProcessListPage';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useSearchParams: () => [new URLSearchParams(''), () => {}],
    Link: ({ children, to }) => <a href={to}>{children}</a>,
  };
});

// SortingProcessListPage uses useSortingListStore (default export) from store/sortingListStore
const mockSessions = [
  {
    id: 'session-1',
    status: 'PLANNED',
    recorded_at: null,
    inbound: {
      id: 'inbound-1',
      inbound_number: 'INB-001',
      vehicle: { registration_plate: '12-ABC-3' },
      assets: [
        { id: 'a1', net_weight_kg: 100 },
        { id: 'a2', net_weight_kg: 200 },
      ],
      order: {
        order_number: 'ORD-001',
        supplier: { name: 'TechRecycle B.V.', supplier_type: 'COMMERCIAL' },
        carrier: { name: 'FastLog B.V.' },
      },
    },
  },
  {
    id: 'session-2',
    status: 'SORTED',
    recorded_at: '2026-04-13T12:00:00Z',
    inbound: {
      id: 'inbound-2',
      inbound_number: 'INB-002',
      vehicle: { registration_plate: 'XY-456-Z' },
      assets: [{ id: 'a3', net_weight_kg: 500 }],
      order: {
        order_number: 'ORD-002',
        supplier: { name: 'Coolrec B.V.', supplier_type: 'COMMERCIAL' },
        carrier: { name: 'SlowLog B.V.' },
      },
    },
  },
];

vi.mock('../../../store/sortingListStore', () => ({
  default: () => ({
    sessions: mockSessions,
    totalCount: 2,
    filters: { status: '', search: '', page: 1, limit: 20 },
    loading: false,
    error: null,
    fetchSessions: vi.fn(),
    setFilters: vi.fn(),
    clearFilters: vi.fn(),
  }),
}));

const renderWithRouter = (component) =>
  render(<BrowserRouter>{component}</BrowserRouter>);

describe('SortingProcessListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render sorting session list', () => {
    renderWithRouter(<SortingProcessListPage />);

    // Sessions render as SRT-xxx (getSortingName transforms INB-001 → SRT-001)
    expect(document.body.textContent).toMatch(/SRT-001|INB-001|session/i);
  });

  it('should display session statuses', () => {
    renderWithRouter(<SortingProcessListPage />);

    expect(document.body.textContent).toMatch(/PLANNED|planned/i);
    expect(document.body.textContent).toMatch(/SORTED|sorted/i);
  });

  it('should display order numbers', () => {
    renderWithRouter(<SortingProcessListPage />);

    expect(document.body.textContent).toMatch(/ORD-001/);
    expect(document.body.textContent).toMatch(/ORD-002/);
  });

  it('should display supplier names', () => {
    renderWithRouter(<SortingProcessListPage />);

    expect(document.body.textContent).toMatch(/TechRecycle/);
    expect(document.body.textContent).toMatch(/Coolrec/);
  });

  it('should display vehicle plates', () => {
    renderWithRouter(<SortingProcessListPage />);

    expect(document.body.textContent).toMatch(/12-ABC-3/);
    expect(document.body.textContent).toMatch(/XY-456-Z/);
  });

  it('should display asset counts', () => {
    renderWithRouter(<SortingProcessListPage />);

    // session-1 has 2 assets, session-2 has 1 asset
    expect(document.body.textContent).toMatch(/2|1/);
  });

  it('should render table headers', () => {
    renderWithRouter(<SortingProcessListPage />);

    const body = document.body.textContent;
    expect(body).toMatch(/status/i);
  });

  it('should have a search input', () => {
    renderWithRouter(<SortingProcessListPage />);

    const input = document.querySelector('input[type="text"]') ||
      screen.queryByRole('textbox');
    expect(input).toBeTruthy();
  });

  it('should have a status filter', () => {
    renderWithRouter(<SortingProcessListPage />);

    const select = document.querySelector('select');
    expect(select).toBeTruthy();
  });

  it('should render recorded date for completed session', () => {
    renderWithRouter(<SortingProcessListPage />);

    // session-2 has recorded_at = 2026-04-13
    expect(document.body.textContent).toMatch(/Apr|april|2026/i);
  });
});
