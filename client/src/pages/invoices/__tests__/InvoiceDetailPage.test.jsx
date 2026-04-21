import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import InvoiceDetailPage from '../InvoiceDetailPage';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const mockGetInvoice = vi.fn();
const mockUpdateInvoiceStatus = vi.fn();
const mockAddInvoiceLine = vi.fn();
const mockUpdateInvoiceLine = vi.fn();
const mockDeleteInvoiceLine = vi.fn();
const mockGetInvoicePdf = vi.fn();
vi.mock('../../../api/invoices', () => ({
  getInvoice: (...args) => mockGetInvoice(...args),
  updateInvoiceStatus: (...args) => mockUpdateInvoiceStatus(...args),
  addInvoiceLine: (...args) => mockAddInvoiceLine(...args),
  updateInvoiceLine: (...args) => mockUpdateInvoiceLine(...args),
  deleteInvoiceLine: (...args) => mockDeleteInvoiceLine(...args),
  getInvoicePdf: (...args) => mockGetInvoicePdf(...args),
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
          invoice-{transition}
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

vi.mock('../../../utils/formatDate', () => ({
  formatDate: (value) => value || '—',
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/invoices/inv-1']}>
      <Routes>
        <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('InvoiceDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState = { user: { role: 'ADMIN' } };
    mockGetInvoice.mockResolvedValue({
      data: {
        data: {
          id: 'inv-1',
          invoice_number: 'INV-001',
          status: 'DRAFT',
          invoice_date: '2026-04-01',
          due_date: '2026-04-30',
          payment_term_days: 30,
          contract_id: 'ct-1',
          contract: { contract_number: 'CON-001' },
          supplier: {
            name: 'Supplier A',
            address: 'Main St 1',
            kvk_number: '1234',
            btw_number: 'NL123',
          },
          lines: [
            {
              id: 'line-1',
              description: 'Material sale',
              line_type: 'material',
              quantity: 10,
              unit: 'kg',
              unit_rate: 2,
              btw_rate: 21,
              line_subtotal: 20,
              btw_amount: 4.2,
              line_total: 24.2,
            },
          ],
        },
      },
    });
    mockUpdateInvoiceStatus.mockResolvedValue({});
    mockGetInvoicePdf.mockResolvedValue({ data: new Uint8Array([1, 2, 3]) });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:invoice');
    window.open = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders invoice details and line items', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('INV-001')).toBeInTheDocument();
    });

    expect(screen.getByText('Supplier A')).toBeInTheDocument();
    expect(screen.getByText('Material sale')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Line' })).toBeInTheDocument();
  });

  it('handles status transition and pdf download', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByText('INV-001')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'invoice-FINALIZED' }));
    await waitFor(() => expect(mockUpdateInvoiceStatus).toHaveBeenCalledWith('inv-1', 'FINALIZED'));

    await user.click(screen.getByRole('button', { name: 'Download PDF' }));
    await waitFor(() => expect(mockGetInvoicePdf).toHaveBeenCalledWith('inv-1'));
    expect(window.open).toHaveBeenCalledWith('blob:invoice', '_blank');
  });
});
