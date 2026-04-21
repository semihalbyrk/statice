import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import OrderCreatePage from '../OrderCreatePage';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

// Mock APIs
const mockCreateOrder = vi.fn();
vi.mock('../../../api/orders', () => ({
  createOrder: (...args) => mockCreateOrder(...args),
}));
const mockListContracts = vi.fn();
const mockMatchContractForOrder = vi.fn();
vi.mock('../../../api/contracts', () => ({
  listContracts: (...args) => mockListContracts(...args),
  matchContractForOrder: (...args) => mockMatchContractForOrder(...args),
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

// Auth store mock — accessToken must be set for useEffect to call loadAll
vi.mock('../../../store/authStore', () => ({
  default: (selector) => {
    const state = { accessToken: 'test-token', user: { role: 'ADMIN' } };
    return selector ? selector(state) : state;
  },
}));

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
    mockCreateOrder.mockResolvedValue({ data: { id: 'order-1' } });
    mockListContracts.mockResolvedValue({ data: { data: [] } });
    mockMatchContractForOrder.mockResolvedValue({ data: { data: null } });
    mockMasterDataState = {
      carriers: [
        { id: 'c1', name: 'Van der Valk Transport' },
        { id: 'c2', name: 'DHL Express' },
      ],
      suppliers: [
        { id: 's1', name: 'Wecycle B.V.', supplier_type: 'PRO' },
        { id: 's2', name: 'Coolrec B.V.', supplier_type: 'THIRD_PARTY' },
      ],
      entities: [{ id: 'e1', company_name: 'Entity A', entity_types: ['TRANSPORTER'] }],
      loadAll: mockLoadAll,
      getTransporterEntities: () => [],
      getSupplierEntities: () => [],
    };
  });

  it('renders the page title', () => {
    const { container } = renderOrderCreatePage();
    expect(screen.getByRole('heading', { name: 'New Order' })).toBeInTheDocument();
  });

  it('renders the breadcrumb', () => {
    const { container } = renderOrderCreatePage();
    expect(screen.getByTestId('breadcrumb')).toBeInTheDocument();
    expect(screen.getByText('Orders')).toBeInTheDocument();
  });

  it('renders supplier select with options', () => {
    const { container } = renderOrderCreatePage();
    expect(screen.getByText('Select supplier...')).toBeInTheDocument();
    expect(screen.getByText('Wecycle B.V.')).toBeInTheDocument();
    expect(screen.getByText('Coolrec B.V.')).toBeInTheDocument();
  });

  it('renders transporter select with options', () => {
    renderOrderCreatePage();
    expect(screen.getByText('Select transporter...')).toBeInTheDocument();
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

  it('calls loadAll when carriers are empty', async () => {
    mockMasterDataState = {
      ...mockMasterDataState,
      carriers: [],
    };
    renderOrderCreatePage();
    await waitFor(() => expect(mockLoadAll).toHaveBeenCalled());
  });

  it('filters transporter options from selected supplier contracts', async () => {
    const user = userEvent.setup();
    mockListContracts.mockResolvedValue({
      data: {
        data: [
          {
            id: 'ctr-1',
            agreement_transporter: { id: 'c1', company_name: 'Van der Valk Transport' },
          },
        ],
      },
    });

    renderOrderCreatePage();
    await user.selectOptions(screen.getAllByRole('combobox')[0], 's1');

    await waitFor(() => {
      expect(mockListContracts).toHaveBeenCalledWith({
        contract_type: 'INCOMING',
        status: 'ACTIVE',
        supplier_id: 's1',
        limit: 200,
      });
    });

    expect(screen.getByRole('option', { name: 'Van der Valk Transport' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'DHL Express' })).not.toBeInTheDocument();
  });

  it('keeps all transporters available for THIRD_PARTY suppliers', async () => {
    const user = userEvent.setup();
    mockListContracts.mockResolvedValue({ data: { data: [] } });

    renderOrderCreatePage();
    await user.selectOptions(screen.getAllByRole('combobox')[0], 's2');

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Van der Valk Transport' })).toBeInTheDocument();
    });

    expect(screen.getByRole('option', { name: 'DHL Express' })).toBeInTheDocument();
  });

  it('submits entity supplier and entity transporter ids without forcing legacy carrier_id', async () => {
    const user = userEvent.setup();
    const supplierEntities = [
      { id: 'es1', company_name: 'Entity Supplier', entity_types: ['SUPPLIER'], supplier_type: 'THIRD_PARTY' },
    ];
    const transporterEntities = [
      { id: 'et1', company_name: 'Entity Transporter', entity_types: ['TRANSPORTER'] },
    ];
    mockMasterDataState = {
      ...mockMasterDataState,
      carriers: [],
      suppliers: [],
      entities: [...supplierEntities, ...transporterEntities],
      getSupplierEntities: () => supplierEntities,
      getTransporterEntities: () => transporterEntities,
    };
    mockMatchContractForOrder.mockResolvedValue({
      data: {
        data: {
          id: 'ctr-entity',
          contract_waste_streams: [
            {
              waste_stream_id: 'ws1',
              waste_stream: { id: 'ws1', name: 'Grote Huishoudelijke Apparaten', code: 'LHA' },
              afvalstroomnummer: 'ASN-001',
            },
          ],
        },
      },
    });

    const { container } = renderOrderCreatePage();

    const comboboxes = screen.getAllByRole('combobox');
    await user.selectOptions(comboboxes[0], 'es1');
    await user.selectOptions(comboboxes[1], 'et1');
    await waitFor(() => {
      expect(mockMatchContractForOrder).toHaveBeenCalledWith({
        supplier_id: 'es1',
        carrier_id: 'et1',
        date: expect.any(String),
      });
    });
    expect(await screen.findByText('1 selected')).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText('AB-123-CD'), '34-TEST-1');
    await user.type(container.querySelector('input[name="planned_date"]'), '2026-04-17');
    await user.click(screen.getByRole('button', { name: 'Create Order' }));

    await waitFor(() => {
      expect(mockCreateOrder).toHaveBeenCalledWith(expect.objectContaining({
        supplier_id: 'es1',
        entity_supplier_id: 'es1',
        transporter_id: 'et1',
        carrier_id: null,
        contract_id: 'ctr-entity',
        waste_stream_ids: ['ws1'],
        vehicle_plate: '34-TEST-1',
      }));
    });

    expect(mockNavigate).toHaveBeenCalledWith('/orders');
  });
});
