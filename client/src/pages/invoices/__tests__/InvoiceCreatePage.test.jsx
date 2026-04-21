import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import InvoiceCreatePage from '../InvoiceCreatePage';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const mockGenerateSupplierInvoice = vi.fn();
const mockGetCompletedOrdersForInvoicing = vi.fn();
vi.mock('../../../api/invoices', () => ({
  generateSupplierInvoice: (...args) => mockGenerateSupplierInvoice(...args),
  getCompletedOrdersForInvoicing: (...args) => mockGetCompletedOrdersForInvoicing(...args),
}));

vi.mock('../../../components/ui/Breadcrumb', () => ({
  default: () => <div data-testid="breadcrumb" />,
}));

vi.mock('../../../components/ui/StatusBadge', () => ({
  default: ({ status }) => <span>{status}</span>,
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

let mockMasterData;
vi.mock('../../../store/masterDataStore', () => ({
  default: (selector) => {
    if (selector) return selector(mockMasterData);
    return mockMasterData;
  },
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <InvoiceCreatePage />
    </MemoryRouter>
  );
}

describe('InvoiceCreatePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMasterData = {
      suppliers: [{ id: 's1', name: 'Supplier A', is_active: true }],
      fetchSuppliers: vi.fn(),
      getSupplierEntities: () => [],
    };
    mockGetCompletedOrdersForInvoicing.mockResolvedValue({
      data: {
        data: [
          {
            id: 'o1',
            order_number: 'ORD-100',
            planned_date: '2026-04-10',
            waste_stream: { name: 'Electronics' },
            status: 'COMPLETED',
            inbounds: [{ net_weight_kg: 1000 }],
          },
        ],
      },
    });
    mockGenerateSupplierInvoice.mockResolvedValue({ data: { data: { id: 'inv-42' } } });
  });

  it('renders supplier selection and loads orders', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByRole('heading', { name: 'Create Invoice' })).toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox'), 's1');

    await waitFor(() => {
      expect(mockGetCompletedOrdersForInvoicing).toHaveBeenCalledWith('s1');
    });

    expect(screen.getByText('ORD-100')).toBeInTheDocument();
    expect(screen.getByText('Electronics')).toBeInTheDocument();
  });

  it('generates invoice from selected orders and redirects', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.selectOptions(screen.getByRole('combobox'), 's1');
    await waitFor(() => expect(screen.getByText('ORD-100')).toBeInTheDocument());
    await user.click(screen.getAllByRole('checkbox')[1]);
    await user.click(screen.getByRole('button', { name: 'Generate Invoice' }));

    await waitFor(() => {
      expect(mockGenerateSupplierInvoice).toHaveBeenCalledWith({ order_ids: ['o1'] });
    });

    expect(mockNavigate).toHaveBeenCalledWith('/invoices/inv-42');
  });
});
