import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OrderCreatePage from '../OrderCreatePage';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

// Mock APIs
vi.mock('../../../api/orders', () => ({
  createOrder: vi.fn(),
}));
vi.mock('../../../api/contracts', () => ({
  matchContractForOrder: vi.fn().mockResolvedValue({ data: { data: null } }),
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

function renderOrderCreatePage() {
  return render(
    <MemoryRouter initialEntries={['/orders/new']}>
      <OrderCreatePage />
    </MemoryRouter>
  );
}

describe('OrderCreatePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMasterDataState = {
      carriers: [
        { id: 'c1', name: 'Van der Valk Transport' },
        { id: 'c2', name: 'DHL Express' },
      ],
      suppliers: [
        { id: 's1', name: 'Wecycle B.V.', supplier_type: 'PRO' },
        { id: 's2', name: 'Coolrec B.V.', supplier_type: 'THIRD_PARTY' },
      ],
      entities: [],
      loadAll: mockLoadAll,
      getTransporterEntities: () => [],
      getSupplierEntities: () => [],
    };
  });

  it('renders the page title', () => {
    renderOrderCreatePage();
    expect(screen.getByRole('heading', { name: 'New Order' })).toBeInTheDocument();
  });

  it('renders the breadcrumb', () => {
    renderOrderCreatePage();
    expect(screen.getByTestId('breadcrumb')).toBeInTheDocument();
    expect(screen.getByText('Orders')).toBeInTheDocument();
  });

  it('renders supplier select with options', () => {
    renderOrderCreatePage();
    expect(screen.getByText('Select supplier...')).toBeInTheDocument();
    expect(screen.getByText('Wecycle B.V.')).toBeInTheDocument();
    expect(screen.getByText('Coolrec B.V.')).toBeInTheDocument();
  });

  it('renders transporter select with options', () => {
    renderOrderCreatePage();
    expect(screen.getByText('Select transporter...')).toBeInTheDocument();
    expect(screen.getByText('Van der Valk Transport')).toBeInTheDocument();
    expect(screen.getByText('DHL Express')).toBeInTheDocument();
  });

  it('renders the vehicle plate input', () => {
    renderOrderCreatePage();
    expect(screen.getByPlaceholderText('AB-123-CD')).toBeInTheDocument();
  });

  it('renders the planned date input', () => {
    renderOrderCreatePage();
    expect(screen.getByText('Planned Date')).toBeInTheDocument();
  });

  it('renders Create Order and Cancel buttons', () => {
    renderOrderCreatePage();
    expect(screen.getByText('Create Order')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('renders LZV checkbox', () => {
    renderOrderCreatePage();
    expect(screen.getByText('LZV Vehicle (up to 3 containers)')).toBeInTheDocument();
  });

  it('renders the notes textarea', () => {
    renderOrderCreatePage();
    expect(screen.getByPlaceholderText('Optional notes...')).toBeInTheDocument();
  });

  it('does not call loadAll when master data already present', () => {
    renderOrderCreatePage();
    expect(mockLoadAll).not.toHaveBeenCalled();
  });

  it('calls loadAll when carriers are empty', () => {
    mockMasterDataState = {
      ...mockMasterDataState,
      carriers: [],
    };
    renderOrderCreatePage();
    expect(mockLoadAll).toHaveBeenCalled();
  });
});
