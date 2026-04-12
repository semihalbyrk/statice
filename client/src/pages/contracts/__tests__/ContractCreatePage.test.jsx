import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ContractCreatePage from '../ContractCreatePage';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

// Mock contracts API
vi.mock('../../../api/contracts', () => ({
  createContract: vi.fn(),
  getContract: vi.fn(),
  updateContract: vi.fn(),
}));

// Mock admin API (for getSettings in ContractCreatePage)
vi.mock('../../../api/admin', () => ({
  getSettings: vi.fn().mockResolvedValue({ data: { data: { facility_name: 'Statice B.V.' } } }),
}));

// Mock fees API
vi.mock('../../../api/fees', () => ({
  listFees: vi.fn().mockResolvedValue({ data: { data: [] } }),
}));

// Mock entities API
vi.mock('../../../api/entities', () => ({
  getProtectedEntity: vi.fn().mockResolvedValue({ data: { data: { id: 'statice-entity', company_name: 'Statice B.V.' } } }),
  getDisposerSites: vi.fn().mockResolvedValue({ data: { data: [] } }),
}));

// Mock Breadcrumb
vi.mock('../../../components/ui/Breadcrumb', () => ({
  default: ({ items }) => (
    <nav data-testid="breadcrumb">
      {items.map((item, i) => (
        <span key={i}>{item.label}</span>
      ))}
    </nav>
  ),
}));

// Mock PenaltySelectModal
vi.mock('../../../components/contracts/PenaltySelectModal', () => ({
  default: ({ onClose }) => (
    <div data-testid="penalty-modal">
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

// MasterData store mock
const mockLoadAll = vi.fn();
let mockMasterDataState = {};

vi.mock('../../../store/masterDataStore', () => ({
  default: (selector) => {
    if (selector) return selector(mockMasterDataState);
    return mockMasterDataState;
  },
}));

function renderContractCreatePage() {
  return render(
    <MemoryRouter initialEntries={['/contracts/new']}>
      <ContractCreatePage />
    </MemoryRouter>
  );
}

describe('ContractCreatePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMasterDataState = {
      suppliers: [
        { id: 's1', name: 'Wecycle B.V.' },
        { id: 's2', name: 'Coolrec B.V.' },
      ],
      carriers: [
        { id: 'c1', name: 'Van der Valk Transport' },
        { id: 'c2', name: 'DHL Express' },
      ],
      entities: [],
      wasteStreams: [
        { id: 'ws1', name: 'Grote Huishoudelijke Apparaten', code: 'LHA' },
        { id: 'ws2', name: 'Koeling & Klimaat', code: 'CFA' },
      ],
      materials: [
        { id: 'm1', name: 'IJzer', code: 'FE', waste_stream_id: 'ws1' },
        { id: 'm2', name: 'Koper', code: 'CU', waste_stream_id: 'ws1' },
      ],
      loadAll: mockLoadAll,
      getSupplierEntities: () => [],
      getTransporterEntities: () => [],
      getAllActiveEntities: () => [],
    };
  });

  it('renders the page title', () => {
    renderContractCreatePage();
    expect(screen.getByRole('heading', { level: 1, name: 'New Contract' })).toBeInTheDocument();
  });

  it('renders the breadcrumb', () => {
    renderContractCreatePage();
    expect(screen.getByTestId('breadcrumb')).toBeInTheDocument();
    expect(screen.getByText('Contracts')).toBeInTheDocument();
  });

  it('renders Contract Details section', () => {
    renderContractCreatePage();
    expect(screen.getByText('Contract Details')).toBeInTheDocument();
  });

  it('renders supplier select with options', () => {
    renderContractCreatePage();
    expect(screen.getByText('Select supplier...')).toBeInTheDocument();
    expect(screen.getByText('Wecycle B.V.')).toBeInTheDocument();
    expect(screen.getByText('Coolrec B.V.')).toBeInTheDocument();
  });

  it('renders agreement transporter select with options', () => {
    renderContractCreatePage();
    expect(screen.getByText('Select carrier...')).toBeInTheDocument();
    expect(screen.getByText('Van der Valk Transport')).toBeInTheDocument();
  });

  it('renders Payment Details section', () => {
    renderContractCreatePage();
    expect(screen.getByText('Payment Details')).toBeInTheDocument();
  });

  it('renders Contamination Details section', () => {
    renderContractCreatePage();
    expect(screen.getByText('Contamination Details')).toBeInTheDocument();
  });

  it('renders Waste Streams section', () => {
    renderContractCreatePage();
    expect(screen.getByText('Waste Streams')).toBeInTheDocument();
    expect(screen.getByText('No waste streams added yet')).toBeInTheDocument();
  });

  it('renders Add Waste Stream button', () => {
    renderContractCreatePage();
    expect(screen.getByText('Add Waste Stream')).toBeInTheDocument();
  });

  it('renders Create Contract and Cancel buttons', () => {
    renderContractCreatePage();
    expect(screen.getByText('Create Contract')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('renders the contract name input', () => {
    renderContractCreatePage();
    expect(screen.getByPlaceholderText('e.g. 2026 WEEE Processing Agreement')).toBeInTheDocument();
  });

  it('renders contract type selector with OUTGOING disabled', () => {
    renderContractCreatePage();
    const select = screen.getByDisplayValue('Incoming');
    expect(select).toBeInTheDocument();
    // OUTGOING option should be disabled per spec
    const outgoingOption = select.querySelector('option[value="OUTGOING"]');
    expect(outgoingOption).toBeTruthy();
    expect(outgoingOption.disabled).toBe(true);
  });

  it('renders Manage Penalties button', () => {
    renderContractCreatePage();
    expect(screen.getByText('Manage Penalties (0)')).toBeInTheDocument();
  });

  it('does not call loadAll when master data already present', () => {
    renderContractCreatePage();
    expect(mockLoadAll).not.toHaveBeenCalled();
  });

  it('calls loadAll when suppliers are empty', () => {
    mockMasterDataState = {
      ...mockMasterDataState,
      suppliers: [],
    };
    renderContractCreatePage();
    expect(mockLoadAll).toHaveBeenCalled();
  });
});
