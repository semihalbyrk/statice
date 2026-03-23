import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ContractsDashboardPage from '../ContractsDashboardPage';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

// Mock contracts API
const mockListContracts = vi.fn();
const mockGetContractDashboard = vi.fn();
vi.mock('../../../api/contracts', () => ({
  listContracts: (...args) => mockListContracts(...args),
  getContractDashboard: (...args) => mockGetContractDashboard(...args),
  deactivateContract: vi.fn(),
  updateContract: vi.fn(),
}));

// Mock ClickableStatusBadge
vi.mock('../../../components/ui/ClickableStatusBadge', () => ({
  default: ({ status }) => <span data-testid="status-badge">{status}</span>,
}));

// Mock ContractRagBadge
vi.mock('../../../components/contracts/ContractRagBadge', () => ({
  default: ({ status }) => status ? <span data-testid="rag-badge">{status}</span> : null,
}));

// Mock RowActionMenu
vi.mock('../../../components/ui/RowActionMenu', () => ({
  default: () => <button data-testid="row-action">...</button>,
}));

// Mock formatDate
vi.mock('../../../utils/formatDate', () => ({
  formatDate: (d) => d ? new Date(d).toLocaleDateString('en-GB') : '\u2014',
}));

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

// Auth store mock
let mockUser = null;
vi.mock('../../../store/authStore', () => ({
  default: (selector) => {
    const state = { user: mockUser };
    return selector(state);
  },
}));

function renderContractsDashboardPage() {
  return render(
    <MemoryRouter initialEntries={['/contracts']}>
      <ContractsDashboardPage />
    </MemoryRouter>
  );
}

describe('ContractsDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 1, email: 'admin@statice.nl', role: 'ADMIN', full_name: 'Admin User' };
    mockListContracts.mockResolvedValue({
      data: { data: [], total: 0 },
    });
    mockGetContractDashboard.mockResolvedValue({
      data: {
        data: {
          total: 5,
          expiry_rag: { green: 3, amber: 1, red: 1 },
        },
      },
    });
  });

  it('renders the page title', () => {
    renderContractsDashboardPage();
    expect(screen.getByText('Contracts')).toBeInTheDocument();
  });

  it('renders the New Contract button for ADMIN', () => {
    renderContractsDashboardPage();
    expect(screen.getByText('New Contract')).toBeInTheDocument();
  });

  it('does not render New Contract button for GATE_OPERATOR', () => {
    mockUser = { id: 3, email: 'gate@statice.nl', role: 'GATE_OPERATOR', full_name: 'Gate Op' };
    renderContractsDashboardPage();
    expect(screen.queryByText('New Contract')).not.toBeInTheDocument();
  });

  it('shows loading state', () => {
    mockListContracts.mockReturnValue(new Promise(() => {})); // Never resolves
    renderContractsDashboardPage();
    // The loading text inside the table
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows empty state when no contracts found', async () => {
    renderContractsDashboardPage();

    await waitFor(() => {
      expect(screen.getByText('No contracts found')).toBeInTheDocument();
    });
  });

  it('renders contract rows after loading', async () => {
    mockListContracts.mockResolvedValue({
      data: {
        data: [
          {
            id: 'ct-1',
            contract_number: 'CON-2026-001',
            status: 'ACTIVE',
            name: 'Wecycle WEEE Overeenkomst 2026',
            supplier: { name: 'Wecycle B.V.' },
            carrier: { name: 'Van der Valk Transport' },
            effective_date: '2026-01-01',
            expiry_date: '2026-12-31',
            rag_status: 'GREEN',
          },
          {
            id: 'ct-2',
            contract_number: 'CON-2026-002',
            status: 'EXPIRED',
            name: 'Coolrec Koeling Contract',
            supplier: { name: 'Coolrec B.V.' },
            carrier: { name: 'DHL Express' },
            effective_date: '2025-01-01',
            expiry_date: '2025-12-31',
            rag_status: 'RED',
          },
        ],
        total: 2,
      },
    });

    renderContractsDashboardPage();

    await waitFor(() => {
      expect(screen.getByText('CON-2026-001')).toBeInTheDocument();
    });

    expect(screen.getByText('CON-2026-002')).toBeInTheDocument();
    expect(screen.getByText('Wecycle B.V.')).toBeInTheDocument();
    expect(screen.getByText('Coolrec B.V.')).toBeInTheDocument();
    expect(screen.getByText('Wecycle WEEE Overeenkomst 2026')).toBeInTheDocument();
  });

  it('renders RAG summary cards from dashboard data', async () => {
    renderContractsDashboardPage();

    await waitFor(() => {
      expect(screen.getByText('On Track')).toBeInTheDocument();
    });

    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Expiring Soon')).toBeInTheDocument();
    // Both amber and red have value "1", so use getAllByText
    const onesInCards = screen.getAllByText('1');
    expect(onesInCards.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Critical / Expired')).toBeInTheDocument();
  });

  it('renders search input', () => {
    renderContractsDashboardPage();
    expect(screen.getByPlaceholderText('Search contracts...')).toBeInTheDocument();
  });

  it('renders status filter tabs', () => {
    renderContractsDashboardPage();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Expired')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });
});
