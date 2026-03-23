import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SortingProcessListPage from '../SortingProcessListPage';

// Mock StatusBadge
vi.mock('../../../components/ui/StatusBadge', () => ({
  default: ({ status }) => <span data-testid="status-badge">{status}</span>,
}));

// Mock SupplierTypeBadge
vi.mock('../../../components/ui/SupplierTypeBadge', () => ({
  default: ({ type }) => type ? <span>{type}</span> : null,
}));

// Mock entityNames
vi.mock('../../../utils/entityNames', () => ({
  getSortingName: (session) => {
    const inboundNumber = session?.inbound?.inbound_number;
    if (inboundNumber) return inboundNumber.replace(/^INB-/i, 'SRT-');
    if (session?.id) return `SRT-${session.id.slice(0, 8).toUpperCase()}`;
    return 'SRT-';
  },
}));

// Store mock
const mockFetchSessions = vi.fn();
const mockSetFilters = vi.fn();
let mockStoreState = {};

vi.mock('../../../store/sortingListStore', () => ({
  default: (selector) => {
    if (selector) return selector(mockStoreState);
    return mockStoreState;
  },
}));

function renderSortingProcessListPage() {
  return render(
    <MemoryRouter initialEntries={['/sorting']}>
      <SortingProcessListPage />
    </MemoryRouter>
  );
}

describe('SortingProcessListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState = {
      sessions: [],
      totalCount: 0,
      filters: { status: '', search: '', page: 1, limit: 20 },
      loading: true,
      fetchSessions: mockFetchSessions,
      setFilters: mockSetFilters,
    };
  });

  it('renders the page title', () => {
    renderSortingProcessListPage();
    expect(screen.getByText('Process')).toBeInTheDocument();
  });

  it('calls fetchSessions on mount', () => {
    renderSortingProcessListPage();
    expect(mockFetchSessions).toHaveBeenCalled();
  });

  it('shows loading state', () => {
    renderSortingProcessListPage();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows empty state when no sessions found', () => {
    mockStoreState = {
      ...mockStoreState,
      loading: false,
      sessions: [],
    };

    renderSortingProcessListPage();
    expect(screen.getByText('No process sessions found')).toBeInTheDocument();
  });

  it('renders session rows after loading', () => {
    mockStoreState = {
      ...mockStoreState,
      loading: false,
      sessions: [
        {
          id: 'sess-1',
          status: 'PLANNED',
          recorded_at: '2026-03-22T10:00:00Z',
          inbound: {
            inbound_number: 'INB-2026-001',
            vehicle: { registration_plate: 'AB-123-CD' },
            assets: [
              { net_weight_kg: 500, container_type: 'OPEN_TOP', parcel_type: 'CONTAINER', waste_stream: { name: 'Grote Huishoudelijke Apparaten' } },
              { net_weight_kg: 300, container_type: 'GITTERBOX', parcel_type: 'CONTAINER', waste_stream: { name: 'Grote Huishoudelijke Apparaten' } },
            ],
            order: {
              order_number: 'ORD-2026-001',
              carrier: { name: 'Van der Valk Transport' },
              supplier: { name: 'Wecycle B.V.', supplier_type: 'PRO' },
              waste_stream: { name: 'Grote Huishoudelijke Apparaten' },
            },
          },
        },
      ],
      totalCount: 1,
    };

    renderSortingProcessListPage();
    expect(screen.getByText('SRT-2026-001')).toBeInTheDocument();
    expect(screen.getByText('ORD-2026-001')).toBeInTheDocument();
    expect(screen.getByText('AB-123-CD')).toBeInTheDocument();
    expect(screen.getByText('Van der Valk Transport')).toBeInTheDocument();
  });

  it('renders search input', () => {
    renderSortingProcessListPage();
    expect(screen.getByPlaceholderText('Search by process name...')).toBeInTheDocument();
  });

  it('renders status filter dropdown', () => {
    renderSortingProcessListPage();
    expect(screen.getByText('All statuses')).toBeInTheDocument();
  });

  it('renders table headers', () => {
    renderSortingProcessListPage();
    expect(screen.getByText('Process Name')).toBeInTheDocument();
    expect(screen.getByText('Linked Order')).toBeInTheDocument();
    expect(screen.getByText('Supplier')).toBeInTheDocument();
    expect(screen.getByText('Carrier')).toBeInTheDocument();
    expect(screen.getByText('Plate')).toBeInTheDocument();
    expect(screen.getByText('Waste Stream')).toBeInTheDocument();
  });
});
