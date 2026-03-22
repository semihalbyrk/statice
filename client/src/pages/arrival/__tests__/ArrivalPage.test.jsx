import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ArrivalPage from '../ArrivalPage';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

// Mock APIs
const mockMatchPlate = vi.fn();
const mockCreateInbound = vi.fn();
vi.mock('../../../api/orders', () => ({
  matchPlate: (...args) => mockMatchPlate(...args),
}));
vi.mock('../../../api/weighingEvents', () => ({
  createInbound: (...args) => mockCreateInbound(...args),
}));

// Mock OrderFormModal to avoid deep dependency chain
vi.mock('../../../components/orders/OrderFormModal', () => ({
  default: ({ onClose }) => (
    <div data-testid="order-form-modal">
      <button onClick={onClose}>Close Modal</button>
    </div>
  ),
}));

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderArrivalPage() {
  return render(
    <MemoryRouter initialEntries={['/arrival']}>
      <ArrivalPage />
    </MemoryRouter>
  );
}

describe('ArrivalPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMatchPlate.mockResolvedValue({
      data: {
        data: {
          exact_same_day: [],
          exact_window: [],
          manual_override_candidates: [],
          ranked_candidates: [],
        },
      },
    });
  });

  it('renders the page title', () => {
    renderArrivalPage();
    expect(screen.getByText('Arrival Registration')).toBeInTheDocument();
  });

  it('renders the license plate input', () => {
    renderArrivalPage();
    expect(screen.getByPlaceholderText('XX-999-XX')).toBeInTheDocument();
  });

  it('renders the scan instruction', () => {
    renderArrivalPage();
    expect(screen.getByText('Scan or enter the vehicle license plate')).toBeInTheDocument();
  });

  it('converts plate input to uppercase', async () => {
    const user = userEvent.setup();
    renderArrivalPage();

    const input = screen.getByPlaceholderText('XX-999-XX');
    await user.type(input, 'ab-123-cd');
    expect(input).toHaveValue('AB-123-CD');
  });

  it('shows no results message when plate has no matches', async () => {
    mockMatchPlate.mockResolvedValue({
      data: {
        data: {
          exact_same_day: [],
          exact_window: [],
          manual_override_candidates: [],
          ranked_candidates: [],
        },
      },
    });

    const user = userEvent.setup();
    renderArrivalPage();

    const input = screen.getByPlaceholderText('XX-999-XX');
    await user.type(input, 'ZZ-999-ZZ');

    await waitFor(() => {
      expect(screen.getByText(/No orders match plate/)).toBeInTheDocument();
    });
  });

  it('shows matching orders section when candidates exist', async () => {
    mockMatchPlate.mockResolvedValue({
      data: {
        data: {
          exact_same_day: [
            {
              id: '1',
              order_number: 'ORD-001',
              status: 'PLANNED',
              match_label: 'Exact match',
              vehicle_plate: 'AB-123-CD',
              carrier: { name: 'DHL' },
              supplier: { name: 'Recycler BV', supplier_type: 'PRO' },
              waste_stream: { name_en: 'LHA' },
              planned_date: '2026-03-22T00:00:00Z',
              expected_skip_count: 3,
              received_asset_count: 0,
            },
          ],
          exact_window: [],
          manual_override_candidates: [],
          ranked_candidates: [
            {
              id: '1',
              order_number: 'ORD-001',
              status: 'PLANNED',
              match_label: 'Exact match',
              vehicle_plate: 'AB-123-CD',
              carrier: { name: 'DHL' },
              supplier: { name: 'Recycler BV', supplier_type: 'PRO' },
              waste_stream: { name_en: 'LHA' },
              planned_date: '2026-03-22T00:00:00Z',
              expected_skip_count: 3,
              received_asset_count: 0,
            },
          ],
        },
      },
    });

    const user = userEvent.setup();
    renderArrivalPage();

    const input = screen.getByPlaceholderText('XX-999-XX');
    await user.type(input, 'AB-123-CD');

    await waitFor(() => {
      expect(screen.getByText('Matching Orders')).toBeInTheDocument();
    });

    expect(screen.getByText('ORD-001')).toBeInTheDocument();
  });

  it('shows "Create Ad-hoc Order" button when no matches found', async () => {
    const user = userEvent.setup();
    renderArrivalPage();

    const input = screen.getByPlaceholderText('XX-999-XX');
    await user.type(input, 'ZZ-999-ZZ');

    await waitFor(() => {
      expect(screen.getByText('Create Ad-hoc Order')).toBeInTheDocument();
    });
  });
});
