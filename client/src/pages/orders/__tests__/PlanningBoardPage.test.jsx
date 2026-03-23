import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PlanningBoardPage from '../PlanningBoardPage';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

// Mock orders API
const mockGetPlanningBoard = vi.fn();
vi.mock('../../../api/orders', () => ({
  getPlanningBoard: (...args) => mockGetPlanningBoard(...args),
}));

// Mock StatusBadge
vi.mock('../../../components/ui/StatusBadge', () => ({
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

// MasterData store mock
const mockLoadAll = vi.fn();
vi.mock('../../../store/masterDataStore', () => ({
  default: (selector) => {
    const state = {
      carriers: [{ id: 'c1', name: 'Van der Valk Transport' }],
      suppliers: [{ id: 's1', name: 'Wecycle B.V.' }],
      wasteStreams: [{ id: 'ws1', name: 'Grote Huishoudelijke Apparaten' }],
      loadAll: mockLoadAll,
    };
    if (selector) return selector(state);
    return state;
  },
}));

function renderPlanningBoardPage() {
  return render(
    <MemoryRouter initialEntries={['/orders/planning']}>
      <PlanningBoardPage />
    </MemoryRouter>
  );
}

describe('PlanningBoardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlanningBoard.mockResolvedValue({ data: [] });
  });

  it('renders the page title', () => {
    renderPlanningBoardPage();
    expect(screen.getByText('Daily Planning Board')).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    mockGetPlanningBoard.mockReturnValue(new Promise(() => {})); // Never resolves
    renderPlanningBoardPage();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows empty state when no orders for the date', async () => {
    mockGetPlanningBoard.mockResolvedValue({ data: [] });

    renderPlanningBoardPage();

    await waitFor(() => {
      expect(screen.getByText('No deliveries planned for this date')).toBeInTheDocument();
    });
  });

  it('renders order cards after loading', async () => {
    mockGetPlanningBoard.mockResolvedValue({
      data: [
        {
          id: 'ord-1',
          order_number: 'ORD-2026-001',
          status: 'PLANNED',
          carrier: { name: 'Van der Valk Transport' },
          supplier: { name: 'Wecycle B.V.', supplier_type: 'PRO' },
          waste_stream: { name: 'Grote Huishoudelijke Apparaten' },
          waste_streams: [],
          planned_date: '2026-03-22T00:00:00Z',
          expected_skip_count: 3,
          inbound_count: 1,
          total_net_weight_kg: 1250,
          vehicle_plate: 'AB-123-CD',
          is_lzv: false,
          incident_category: null,
        },
      ],
    });

    renderPlanningBoardPage();

    await waitFor(() => {
      expect(screen.getByText('ORD-2026-001')).toBeInTheDocument();
    });

    expect(screen.getAllByText('Van der Valk Transport').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Wecycle B.V.').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('AB-123-CD')).toBeInTheDocument();
  });

  it('renders filter dropdowns', () => {
    renderPlanningBoardPage();
    expect(screen.getByText('All carriers')).toBeInTheDocument();
    expect(screen.getByText('All suppliers')).toBeInTheDocument();
    expect(screen.getByText('All supplier types')).toBeInTheDocument();
    expect(screen.getByText('All waste streams')).toBeInTheDocument();
    expect(screen.getByText('All statuses')).toBeInTheDocument();
  });

  it('shows LZV badge for LZV orders', async () => {
    mockGetPlanningBoard.mockResolvedValue({
      data: [
        {
          id: 'ord-2',
          order_number: 'ORD-2026-002',
          status: 'PLANNED',
          carrier: { name: 'DHL Express' },
          supplier: { name: 'Coolrec B.V.', supplier_type: 'THIRD_PARTY' },
          waste_stream: { name: 'Koeling & Klimaat' },
          waste_streams: [],
          planned_date: '2026-03-22T00:00:00Z',
          expected_skip_count: 5,
          inbound_count: 0,
          total_net_weight_kg: 0,
          vehicle_plate: 'KL-789-MN',
          is_lzv: true,
          incident_category: null,
        },
      ],
    });

    renderPlanningBoardPage();

    await waitFor(() => {
      expect(screen.getByText('LZV')).toBeInTheDocument();
    });
  });

  it('shows incident badge when incident exists', async () => {
    mockGetPlanningBoard.mockResolvedValue({
      data: [
        {
          id: 'ord-3',
          order_number: 'ORD-2026-003',
          status: 'DISPUTE',
          carrier: { name: 'DHL Express' },
          supplier: { name: 'Wecycle B.V.', supplier_type: 'PRO' },
          waste_stream: { name: 'IT Apparatuur' },
          waste_streams: [],
          planned_date: '2026-03-22T00:00:00Z',
          expected_skip_count: 2,
          inbound_count: 1,
          total_net_weight_kg: 500,
          vehicle_plate: 'PQ-321-RS',
          is_lzv: false,
          incident_category: 'CONTAMINATION',
        },
      ],
    });

    renderPlanningBoardPage();

    await waitFor(() => {
      expect(screen.getByText('Incident')).toBeInTheDocument();
    });
  });

  it('calls getPlanningBoard on mount', () => {
    renderPlanningBoardPage();
    expect(mockGetPlanningBoard).toHaveBeenCalled();
  });
});
