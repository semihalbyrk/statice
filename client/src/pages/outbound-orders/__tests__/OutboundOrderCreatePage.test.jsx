import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import OutboundOrderCreatePage from '../OutboundOrderCreatePage';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const mockCreateOutboundOrder = vi.fn();
vi.mock('../../../api/outboundOrders', () => ({
  createOutboundOrder: (...args) => mockCreateOutboundOrder(...args),
}));

const mockListContracts = vi.fn();
vi.mock('../../../api/contracts', () => ({
  listContracts: (...args) => mockListContracts(...args),
}));

vi.mock('../../../components/ui/Breadcrumb', () => ({
  default: () => <div data-testid="breadcrumb" />,
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
      <OutboundOrderCreatePage />
    </MemoryRouter>
  );
}

describe('OutboundOrderCreatePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMasterData = {
      entities: [{ id: 't1', company_name: 'Fast Transport' }],
      loadAll: vi.fn(),
      getTransporterEntities: () => [{ id: 't1', company_name: 'Fast Transport' }],
    };
    mockListContracts.mockResolvedValue({
      data: {
        data: [
          {
            id: 'c1',
            contract_number: 'CON-OUT-1',
            name: 'Outbound Contract',
            buyer: { id: 'buyer-1', company_name: 'Buyer GmbH' },
            sender: { company_name: 'Statice B.V.' },
            disposer: { company_name: 'Recycler BV' },
            disposer_site: { company_name: 'Plant A' },
            agreement_transporter: { company_name: 'Agreement Logistics' },
            shipment_type: 'DOMESTIC_NL',
            contract_waste_streams: [
              {
                id: 'cws-1',
                waste_stream_id: 'ws-1',
                waste_stream: { name: 'Plastic' },
                receiver: { company_name: 'Receiver Site' },
                afvalstroomnummer: 'ASN-42',
                rate_lines: [{ material: { name: 'PET' }, processing_method: 'Recycle' }],
              },
            ],
          },
        ],
      },
    });
    mockCreateOutboundOrder.mockResolvedValue({ data: { data: { id: 'oo-1' } } });
  });

  it('renders and auto-fills contract related fields', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByRole('heading', { name: 'Create Outbound Order' })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Buyer GmbH')).toBeInTheDocument();
    });

    await user.selectOptions(screen.getAllByRole('combobox')[0], 'buyer-1');
    await user.selectOptions(screen.getAllByRole('combobox')[1], 'c1');

    await waitFor(() => {
      expect(screen.getAllByDisplayValue('Buyer GmbH')).toHaveLength(2);
    });

    expect(screen.getByDisplayValue('Statice B.V.')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Recycler BV')).toBeInTheDocument();
    expect(screen.getByText('Plastic')).toBeInTheDocument();
  });

  it('shows outsourced transporter select when checkbox is enabled', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByLabelText('Use outsourced transporter for this shipment'));

    expect(screen.getByText('Select transporter...')).toBeInTheDocument();
    expect(screen.getByText('Fast Transport')).toBeInTheDocument();
  });

  it('submits mapped payload and redirects after success', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Buyer GmbH')).toBeInTheDocument();
    });

    await user.selectOptions(screen.getAllByRole('combobox')[0], 'buyer-1');
    await user.selectOptions(screen.getAllByRole('combobox')[1], 'c1');
    await waitFor(() => expect(screen.getByText('Plastic')).toBeInTheDocument());
    await user.type(screen.getByPlaceholderText('AB-123-CD'), '34ab123');
    fireEvent.change(document.querySelector('input[name="planned_date"]'), { target: { value: '2026-04-14' } });
    await user.clear(document.querySelector('input[name="expected_outbound_count"]'));
    await user.type(document.querySelector('input[name="expected_outbound_count"]'), '2');
    await user.type(screen.getByPlaceholderText('0'), '500');
    await user.click(screen.getByRole('button', { name: 'Create Order' }));

    await waitFor(() => {
      expect(mockCreateOutboundOrder).toHaveBeenCalledWith({
        contract_id: 'c1',
        outsourced_transporter_id: null,
        vehicle_plate: '34AB123',
        planned_date: '2026-04-14',
        time_window_start: null,
        time_window_end: null,
        expected_outbound_count: 2,
        notes: null,
        waste_streams: [
          {
            contract_waste_stream_id: 'cws-1',
            waste_stream_id: 'ws-1',
            planned_amount_kg: 500,
          },
        ],
      });
    });

    expect(mockNavigate).toHaveBeenCalledWith('/outbound-orders');
  });
});
