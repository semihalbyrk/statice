import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import InvoicesPage from '../InvoicesPage';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const mockUpdateInvoiceStatus = vi.fn();
const mockGetInvoicePdf = vi.fn();
vi.mock('../../../api/invoices', () => ({
  updateInvoiceStatus: (...args) => mockUpdateInvoiceStatus(...args),
  getInvoicePdf: (...args) => mockGetInvoicePdf(...args),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

let mockStore;
vi.mock('../../../store/invoicesStore', () => ({
  default: () => mockStore,
}));

let mockAuthState;
vi.mock('../../../store/authStore', () => ({
  default: (selector) => selector(mockAuthState),
}));

vi.mock('../../../components/ui/ClickableStatusBadge', () => ({
  default: ({ status, allowedTransitions = [], onTransition }) => (
    <div>
      <span>{status}</span>
      {allowedTransitions.map((transition) => (
        <button key={transition} onClick={() => onTransition(transition)}>
          status-{transition}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('../../../components/ui/RowActionMenu', () => ({
  default: ({ actions }) => (
    <div>
      {actions.map((action) => (
        <button key={action.label} onClick={action.onClick}>
          {action.label}
        </button>
      ))}
    </div>
  ),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <InvoicesPage />
    </MemoryRouter>
  );
}

describe('InvoicesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState = { user: { role: 'FINANCE_MANAGER' } };
    mockStore = {
      invoices: [
        {
          id: 'inv-1',
          invoice_number: 'INV-001',
          status: 'DRAFT',
          supplier: { name: 'Supplier A' },
          invoice_date: '2026-04-01',
          due_date: '2026-04-30',
          total_amount: 1250.5,
        },
      ],
      total: 1,
      loading: false,
      filters: { status: '', search: '', page: 1, limit: 20, date_from: '', date_to: '' },
      setFilters: vi.fn(),
      fetchInvoices: vi.fn(),
    };
    mockUpdateInvoiceStatus.mockResolvedValue({});
    mockGetInvoicePdf.mockResolvedValue({ data: new Uint8Array([1, 2, 3]) });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pdf');
    window.open = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders invoice list and create button', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Invoices' })).toBeInTheDocument();
    expect(screen.getByText('INV-001')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New Invoice/i })).toBeInTheDocument();
  });

  it('updates search filter after debounce', async () => {
    renderPage();

    fireEvent.change(screen.getByPlaceholderText('Search invoices...'), { target: { value: 'INV' } });

    await waitFor(() => {
      expect(mockStore.setFilters).toHaveBeenCalledWith({ search: 'INV' });
    });
  });

  it('handles status change and pdf download actions', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'status-FINALIZED' }));
    await waitFor(() => expect(mockUpdateInvoiceStatus).toHaveBeenCalledWith('inv-1', 'FINALIZED'));

    await user.click(screen.getByRole('button', { name: 'Download PDF' }));
    await waitFor(() => expect(mockGetInvoicePdf).toHaveBeenCalledWith('inv-1'));
    expect(window.open).toHaveBeenCalledWith('blob:pdf', '_blank');
  });
});
