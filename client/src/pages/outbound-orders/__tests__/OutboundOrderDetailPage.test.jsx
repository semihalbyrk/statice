import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import OutboundOrderDetailPage from '../OutboundOrderDetailPage';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const mockUpdateOutboundOrderStatus = vi.fn();
const mockCancelOutboundOrder = vi.fn();
vi.mock('../../../api/outboundOrders', () => ({
  updateOutboundOrderStatus: (...args) => mockUpdateOutboundOrderStatus(...args),
  cancelOutboundOrder: (...args) => mockCancelOutboundOrder(...args),
}));

const mockApiPost = vi.fn();
vi.mock('../../../api/axios', () => ({
  default: { post: (...args) => mockApiPost(...args) },
}));

let mockStore;
vi.mock('../../../store/outboundOrdersStore', () => ({
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
          outbound-order-{transition}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('../../../components/ui/StatusBadge', () => ({
  default: ({ status }) => <span>{status}</span>,
}));

vi.mock('../../../components/ui/Breadcrumb', () => ({
  default: () => <div data-testid="breadcrumb" />,
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/outbound-orders/ord-1']}>
      <Routes>
        <Route path="/outbound-orders/:id" element={<OutboundOrderDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('OutboundOrderDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState = { user: { role: 'ADMIN' } };
    mockStore = {
      currentOrder: {
        id: 'ord-1',
        order_number: 'OO-001',
        status: 'PLANNED',
        contract: { id: 'ct-1', contract_number: 'CON-001' },
        buyer: { company_name: 'Buyer A' },
        sender: { company_name: 'Sender A' },
        disposer: { company_name: 'Disposer A' },
        disposer_site: { company_name: 'Plant A' },
        agreement_transporter: { company_name: 'Carrier A' },
        vehicle_plate: '34ABC123',
        planned_date: '2026-04-14',
        shipment_type: 'DOMESTIC_NL',
        expected_outbound_count: 2,
        waste_streams: [
          {
            id: 'ws1',
            waste_stream: { name: 'Plastic' },
            receiver: { company_name: 'Receiver A' },
            afvalstroomnummer: 'ASN-1',
            rate_lines: [{ material: { name: 'PET' }, processing_method: 'Recycle' }],
            planned_amount_kg: 600,
          },
        ],
        outbounds: [],
      },
      loading: false,
      fetchOutboundOrder: vi.fn(),
    };
    mockUpdateOutboundOrderStatus.mockResolvedValue({});
    mockApiPost.mockResolvedValue({ data: { data: { id: 'ob-99' } } });
  });

  it('renders outbound order details and waste streams', async () => {
    renderPage();

    expect(screen.getByText('OO-001')).toBeInTheDocument();
    expect(screen.getByText('Buyer A')).toBeInTheDocument();
    expect(screen.getByText('Plastic')).toBeInTheDocument();
    // Button now appears in both header and outbounds section
    expect(screen.getAllByRole('button', { name: 'Create Outbound' }).length).toBeGreaterThanOrEqual(1);
  });

  it('creates outbound and redirects to outbound detail', async () => {
    const user = userEvent.setup();
    renderPage();

    // Click the first "Create Outbound" button (page header)
    await user.click(screen.getAllByRole('button', { name: 'Create Outbound' })[0]);

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/outbounds/order/ord-1');
    });

    expect(mockNavigate).toHaveBeenCalledWith('/outbounds/ob-99');
  });
});
