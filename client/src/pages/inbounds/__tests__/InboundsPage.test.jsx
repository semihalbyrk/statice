import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import InboundsPage from '../InboundsPage';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

// Mock weighingEvents API
vi.mock('../../../api/weighingEvents', () => ({
  updateInboundStatus: vi.fn(),
}));

// Mock ClickableStatusBadge to avoid complex dropdown internals
vi.mock('../../../components/ui/ClickableStatusBadge', () => ({
  default: ({ status }) => <span data-testid="status-badge">{status}</span>,
}));

// Mock SupplierTypeBadge
vi.mock('../../../components/ui/SupplierTypeBadge', () => ({
  default: ({ type }) => type ? <span>{type}</span> : null,
}));

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

// Store mock
const mockFetchInbounds = vi.fn();
const mockSetFilters = vi.fn();
let mockStoreState = {};

vi.mock('../../../store/weighingStore', () => ({
  useInboundsListStore: (selector) => {
    if (selector) return selector(mockStoreState);
    return mockStoreState;
  },
  default: (selector) => {
    if (selector) return selector(mockStoreState);
    return mockStoreState;
  },
}));

function renderInboundsPage() {
  return render(
    <MemoryRouter initialEntries={['/inbounds']}>
      <InboundsPage />
    </MemoryRouter>
  );
}

describe('InboundsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState = {
      inbounds: [],
      totalCount: 0,
      filters: { status: '', search: '', page: 1, limit: 20 },
      loading: true,
      fetchInbounds: mockFetchInbounds,
      setFilters: mockSetFilters,
    };
  });

  it('renders the page title', () => {
    renderInboundsPage();
    expect(screen.getByText('Inbounds')).toBeInTheDocument();
  });

  it('calls fetchInbounds on mount', () => {
    renderInboundsPage();
    expect(mockFetchInbounds).toHaveBeenCalled();
  });

  it('shows loading state', () => {
    renderInboundsPage();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows empty state when no inbounds exist', () => {
    mockStoreState = {
      ...mockStoreState,
      loading: false,
      inbounds: [],
    };

    renderInboundsPage();
    expect(screen.getByText('No inbounds found')).toBeInTheDocument();
  });

  it('renders inbound rows after loading', () => {
    mockStoreState = {
      ...mockStoreState,
      loading: false,
      inbounds: [
        {
          id: 'inb-1',
          inbound_number: 'INB-2026-001',
          status: 'ARRIVED',
          arrived_at: '2026-03-22T10:00:00Z',
          skip_count: 3,
          net_weight: 1250,
          vehicle: { registration_plate: 'AB-123-CD' },
          order: {
            order_number: 'ORD-2026-001',
            carrier: { name: 'Van der Valk Transport' },
            supplier: { name: 'Wecycle B.V.', supplier_type: 'PRO' },
            waste_stream: { name: 'Grote Huishoudelijke Apparaten' },
          },
        },
        {
          id: 'inb-2',
          inbound_number: 'INB-2026-002',
          status: 'WEIGHED_IN',
          arrived_at: '2026-03-22T11:30:00Z',
          skip_count: 2,
          net_weight: 800,
          vehicle: { registration_plate: 'EF-456-GH' },
          order: {
            order_number: 'ORD-2026-002',
            carrier: { name: 'DHL Express' },
            supplier: { name: 'Coolrec B.V.', supplier_type: 'THIRD_PARTY' },
            waste_stream: { name: 'Koeling & Klimaat' },
          },
        },
      ],
      totalCount: 2,
    };

    renderInboundsPage();
    expect(screen.getByText('INB-2026-001')).toBeInTheDocument();
    expect(screen.getByText('INB-2026-002')).toBeInTheDocument();
    expect(screen.getByText('AB-123-CD')).toBeInTheDocument();
    expect(screen.getByText('ORD-2026-001')).toBeInTheDocument();
    expect(screen.getByText('Van der Valk Transport')).toBeInTheDocument();
  });

  it('renders search input', () => {
    renderInboundsPage();
    expect(screen.getByPlaceholderText('Search by inbound name')).toBeInTheDocument();
  });

  it('renders status filter dropdown', () => {
    renderInboundsPage();
    expect(screen.getByText('All statuses')).toBeInTheDocument();
  });
});
