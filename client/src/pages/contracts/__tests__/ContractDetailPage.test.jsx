import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ContractDetailPage from '../ContractDetailPage';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

// Mock contracts API
const mockGetContract = vi.fn();
vi.mock('../../../api/contracts', () => ({
  getContract: (...args) => mockGetContract(...args),
  deactivateContract: vi.fn(),
  updateContract: vi.fn(),
  deleteRateLine: vi.fn(),
  deleteContractWasteStream: vi.fn(),
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

// Mock ContractFormModal
vi.mock('../../../components/contracts/ContractFormModal', () => ({
  default: ({ onClose }) => <div data-testid="contract-form-modal"><button onClick={onClose}>Close</button></div>,
}));

// Mock RateLineFormModal
vi.mock('../../../components/contracts/RateLineFormModal', () => ({
  default: ({ onClose }) => <div data-testid="rate-line-modal"><button onClick={onClose}>Close</button></div>,
}));

// Mock PenaltySelectModal
vi.mock('../../../components/contracts/PenaltySelectModal', () => ({
  default: ({ onClose }) => <div data-testid="penalty-modal"><button onClick={onClose}>Close</button></div>,
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

function renderContractDetailPage(contractId = 'ct-1') {
  return render(
    <MemoryRouter initialEntries={[`/contracts/${contractId}`]}>
      <Routes>
        <Route path="/contracts/:id" element={<ContractDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

const mockContract = {
  id: 'ct-1',
  contract_number: 'CON-2026-001',
  name: 'Wecycle WEEE Overeenkomst 2026',
  status: 'ACTIVE',
  supplier: { name: 'Wecycle B.V.' },
  carrier: { name: 'Van der Valk Transport' },
  receiver_name: 'Statice B.V.',
  effective_date: '2026-01-01',
  expiry_date: '2026-12-31',
  days_until_expiry: 283,
  payment_term_days: 30,
  invoicing_frequency: 'MONTHLY',
  currency: 'EUR',
  contamination_tolerance_pct: 5,
  rag_status: 'GREEN',
  contract_waste_streams: [
    {
      id: 'cws-1',
      afvalstroomnummer: 'AVR1234567',
      waste_stream: { name: 'Grote Huishoudelijke Apparaten', code: 'LHA' },
      rate_lines: [
        {
          id: 'rl-1',
          material: { code: 'FE', name: 'IJzer' },
          pricing_model: 'WEIGHT',
          unit_rate: 0.15,
          btw_rate: 21,
        },
        {
          id: 'rl-2',
          material: { code: 'CU', name: 'Koper' },
          pricing_model: 'WEIGHT',
          unit_rate: 4.50,
          btw_rate: 21,
        },
      ],
    },
  ],
  rate_lines: [],
  contamination_penalties: [
    {
      id: 'cp-1',
      fee: { fee_type: 'CONTAMINATION_SURCHARGE', description: 'Excess contamination penalty', rate_type: 'PERCENTAGE', rate_value: 10 },
    },
  ],
};

describe('ContractDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 1, email: 'admin@statice.nl', role: 'ADMIN', full_name: 'Admin User' };
    mockGetContract.mockResolvedValue({ data: { data: mockContract } });
  });

  it('shows loading state initially', () => {
    mockGetContract.mockReturnValue(new Promise(() => {})); // Never resolves
    renderContractDetailPage();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders contract number after loading', async () => {
    renderContractDetailPage();

    await waitFor(() => {
      expect(screen.getByText('CON-2026-001')).toBeInTheDocument();
    });
  });

  it('renders contract details', async () => {
    renderContractDetailPage();

    await waitFor(() => {
      expect(screen.getByText('Wecycle WEEE Overeenkomst 2026')).toBeInTheDocument();
    });

    expect(screen.getByText('Wecycle B.V.')).toBeInTheDocument();
    expect(screen.getByText('Van der Valk Transport')).toBeInTheDocument();
    expect(screen.getByText('Statice B.V.')).toBeInTheDocument();
    expect(screen.getByText('30 days')).toBeInTheDocument();
    expect(screen.getByText('Monthly')).toBeInTheDocument();
    expect(screen.getByText('EUR')).toBeInTheDocument();
    expect(screen.getByText('5%')).toBeInTheDocument();
  });

  it('renders waste stream section with rate lines', async () => {
    renderContractDetailPage();

    await waitFor(() => {
      expect(screen.getByText('Grote Huishoudelijke Apparaten (LHA)')).toBeInTheDocument();
    });

    expect(screen.getByText('ASN: AVR1234567')).toBeInTheDocument();
  });

  it('renders material rate lines in the table', async () => {
    renderContractDetailPage();

    await waitFor(() => {
      expect(screen.getByText('CON-2026-001')).toBeInTheDocument();
    });

    // Check for material names (name only)
    expect(screen.getByText(/IJzer/)).toBeInTheDocument();
    expect(screen.getByText(/Koper/)).toBeInTheDocument();
  });

  it('renders contamination penalties section', async () => {
    renderContractDetailPage();

    await waitFor(() => {
      expect(screen.getByText('Contamination Penalties (1)')).toBeInTheDocument();
    });

    expect(screen.getByText('CONTAMINATION_SURCHARGE')).toBeInTheDocument();
    expect(screen.getByText('10%')).toBeInTheDocument();
  });

  it('renders Edit button for ADMIN', async () => {
    renderContractDetailPage();

    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });
  });

  it('does not render Edit button for GATE_OPERATOR', async () => {
    mockUser = { id: 3, email: 'gate@statice.nl', role: 'GATE_OPERATOR', full_name: 'Gate Op' };
    renderContractDetailPage();

    await waitFor(() => {
      expect(screen.getByText('CON-2026-001')).toBeInTheDocument();
    });

    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
  });

  it('renders Back to Contracts link', async () => {
    renderContractDetailPage();

    await waitFor(() => {
      expect(screen.getByText('Back to Contracts')).toBeInTheDocument();
    });
  });

  it('calls getContract with the route id', () => {
    renderContractDetailPage('ct-42');
    expect(mockGetContract).toHaveBeenCalledWith('ct-42');
  });

  it('shows "No penalties linked" when none exist', async () => {
    mockGetContract.mockResolvedValue({
      data: {
        data: {
          ...mockContract,
          contamination_penalties: [],
        },
      },
    });

    renderContractDetailPage();

    await waitFor(() => {
      expect(screen.getByText('No penalties linked')).toBeInTheDocument();
    });
  });
});
