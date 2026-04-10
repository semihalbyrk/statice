import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Note: WeighingEventPage exports as InboundDetailPage
// We need to dynamically import after mocks are set up

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

// Mock all APIs used by WeighingEventPage
const mockGetInbound = vi.fn();
vi.mock('../../../api/weighingEvents', () => ({
  getInbound: (...args) => mockGetInbound(...args),
  triggerNextWeighing: vi.fn(),
  registerParcel: vi.fn(),
  overrideWeight: vi.fn(),
  downloadTicketPdf: vi.fn(),
  updateInboundStatus: vi.fn(),
  setInboundIncident: vi.fn(),
  confirmWeighing: vi.fn(),
  getWeighingAmendments: vi.fn(),
}));

vi.mock('../../../api/assets', () => ({
  deleteAsset: vi.fn(),
  getNextContainerLabel: vi.fn(),
  lookupContainerByLabel: vi.fn(),
}));

// Auth store mock
let mockUser = null;
vi.mock('../../../store/authStore', () => ({
  default: (selector) => {
    const state = { user: mockUser };
    return selector(state);
  },
}));

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

// Import after mocks
import InboundDetailPage from '../WeighingEventPage';

function renderWeighingPage(inboundId = '1') {
  return render(
    <MemoryRouter initialEntries={[`/inbounds/${inboundId}`]}>
      <Routes>
        <Route path="/inbounds/:inboundId" element={<InboundDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('WeighingEventPage (InboundDetailPage)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 1, email: 'admin@statice.nl', role: 'ADMIN', full_name: 'Admin User' };
    mockGetInbound.mockReturnValue(new Promise(() => {}));
  });

  it('shows loading spinner on mount', () => {
    renderWeighingPage();
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeTruthy();
  });

  it('calls getInbound with the route id', () => {
    renderWeighingPage('42');
    expect(mockGetInbound).toHaveBeenCalledWith('42');
  });

  it('renders inbound details after loading', async () => {
    mockGetInbound.mockResolvedValue({
      data: {
        data: {
          id: '1',
          inbound_number: 'INB-001',
          status: 'ARRIVED',
          arrived_at: '2026-03-22T10:00:00Z',
          vehicle: { registration_plate: 'AB-123-CD' },
          order: {
            id: 'o1',
            order_number: 'ORD-001',
            carrier: { name: 'DHL' },
            supplier: { name: 'Recycler BV', supplier_type: 'PRO' },
            waste_stream: { name: 'LHA' },
            waste_streams: [],
            expected_skip_count: 3,
          },
          waste_stream: { name: 'LHA' },
          assets: [],
          weighing_events: [],
        },
      },
    });

    renderWeighingPage();

    const matches = await screen.findAllByText('INB-001');
    expect(matches.length).toBeGreaterThan(0);
  });

  it('renders device dropdown when inbound has no device_id and can_weigh_first', async () => {
    mockGetInbound.mockResolvedValue({
      data: {
        data: {
          id: '1',
          inbound_number: 'INB-002',
          status: 'ARRIVED',
          arrived_at: '2026-03-22T10:00:00Z',
          can_weigh_first: true,
          device_id: null,
          vehicle: { registration_plate: 'AB-123-CD' },
          order: {
            id: 'o1',
            order_number: 'ORD-002',
            carrier: { name: 'DHL' },
            supplier: { name: 'Recycler BV', supplier_type: 'PRO' },
            waste_stream: { name: 'LHA' },
            waste_streams: [],
            expected_skip_count: 3,
          },
          waste_stream: { name: 'LHA' },
          assets: [],
          weighing_events: [],
        },
      },
    });

    renderWeighingPage();

    // Wait for the page to render
    await screen.findAllByText('INB-002');

    // Device options should be present
    const wb1Options = screen.getAllByText('WB_1');
    expect(wb1Options.length).toBeGreaterThan(0);
    const wb2Options = screen.getAllByText('WB_2');
    expect(wb2Options.length).toBeGreaterThan(0);
    const wb3Options = screen.getAllByText('WB_3');
    expect(wb3Options.length).toBeGreaterThan(0);
  });

  it('does not show device dropdown when inbound already has device_id', async () => {
    mockGetInbound.mockResolvedValue({
      data: {
        data: {
          id: '1',
          inbound_number: 'INB-003',
          status: 'ARRIVED',
          arrived_at: '2026-03-22T10:00:00Z',
          can_weigh_first: true,
          device_id: 'WB_1',
          vehicle: { registration_plate: 'AB-123-CD' },
          order: {
            id: 'o1',
            order_number: 'ORD-003',
            carrier: { name: 'DHL' },
            supplier: { name: 'Recycler BV', supplier_type: 'PRO' },
            waste_stream: { name: 'LHA' },
            waste_streams: [],
            expected_skip_count: 3,
          },
          waste_stream: { name: 'LHA' },
          assets: [],
          weighing_events: [],
        },
      },
    });

    renderWeighingPage();

    await screen.findAllByText('INB-003');

    // The select dropdown for device should NOT be present (device already assigned)
    // WB_2 and WB_3 should not appear as options since no dropdown is rendered
    const selectElements = document.querySelectorAll('select');
    const deviceSelects = Array.from(selectElements).filter(
      (el) => Array.from(el.options).some((opt) => opt.value === 'WB_2')
    );
    expect(deviceSelects).toHaveLength(0);
  });

  it('disables first weighing button when no device selected and no device_id', async () => {
    mockGetInbound.mockResolvedValue({
      data: {
        data: {
          id: '1',
          inbound_number: 'INB-004',
          status: 'ARRIVED',
          arrived_at: '2026-03-22T10:00:00Z',
          can_weigh_first: true,
          device_id: null,
          vehicle: { registration_plate: 'AB-123-CD' },
          order: {
            id: 'o1',
            order_number: 'ORD-004',
            carrier: { name: 'DHL' },
            supplier: { name: 'Recycler BV', supplier_type: 'PRO' },
            waste_stream: { name: 'LHA' },
            waste_streams: [],
            expected_skip_count: 3,
          },
          waste_stream: { name: 'LHA' },
          assets: [],
          weighing_events: [],
        },
      },
    });

    renderWeighingPage();

    await screen.findAllByText('INB-004');

    // The first weighing button should be disabled since WEIGHBRIDGE_DEVICES has 3 entries
    // and no device is selected yet (selectedDevice defaults to '' when length > 1)
    // Find the button containing the scale icon in the weighing section
    const buttons = document.querySelectorAll('button[disabled]');
    const weighingButtons = Array.from(buttons).filter(
      (btn) => btn.closest('.bg-white.rounded-lg')
    );
    expect(weighingButtons.length).toBeGreaterThan(0);
  });
});
