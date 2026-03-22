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
            waste_stream: { name_en: 'LHA' },
            waste_streams: [],
            expected_skip_count: 3,
          },
          waste_stream: { name_en: 'LHA' },
          assets: [],
          weighing_events: [],
        },
      },
    });

    renderWeighingPage();

    // Wait for load to complete — the spinner should disappear
    const { findByText } = screen;
    // The page should render the order number or inbound number
    const matches = await screen.findAllByText('INB-001');
    expect(matches.length).toBeGreaterThan(0);
  });
});
