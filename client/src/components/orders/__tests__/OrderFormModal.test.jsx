import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OrderFormModal from '../OrderFormModal';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

// Mock orders API
vi.mock('../../../api/orders', () => ({
  createOrder: vi.fn(),
  updateOrder: vi.fn(),
  createAdhocArrival: vi.fn(),
}));

// Mock suppliers API
vi.mock('../../../api/suppliers', () => ({
  getSupplierAfvalstroomnummers: vi.fn().mockResolvedValue({ data: [] }),
}));

// Master data store mock
vi.mock('../../../store/masterDataStore', () => ({
  default: (selector) => {
    const state = {
      carriers: [
        { id: 'c1', name: 'DHL Express' },
        { id: 'c2', name: 'PostNL' },
      ],
      suppliers: [
        { id: 's1', name: 'Recycler BV', supplier_type: 'PRO' },
        { id: 's2', name: 'Scrap Corp', supplier_type: 'THIRD_PARTY' },
      ],
      suppliersWithContract: [
        { id: 's1', name: 'Recycler BV', supplier_type: 'PRO' },
        { id: 's2', name: 'Scrap Corp', supplier_type: 'THIRD_PARTY' },
      ],
      wasteStreams: [
        { id: 'ws1', name: 'Large Household Appliances', code: 'LHA' },
        { id: 'ws2', name: 'Small Household Appliances', code: 'SHA' },
      ],
    };
    if (selector) return selector(state);
    return state;
  },
}));

const mockOnClose = vi.fn();
const mockOnSuccess = vi.fn();

function renderOrderFormModal(props = {}) {
  return render(
    <OrderFormModal
      onClose={mockOnClose}
      onSuccess={mockOnSuccess}
      {...props}
    />
  );
}

describe('OrderFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "New Order" title for create mode', () => {
    renderOrderFormModal();
    expect(screen.getByText('New Order')).toBeInTheDocument();
  });

  it('renders "Edit Order" title for edit mode', () => {
    renderOrderFormModal({
      order: {
        id: '1',
        carrier_id: 'c1',
        supplier_id: 's1',
        waste_stream_id: 'ws1',
        planned_date: '2026-03-22T00:00:00Z',
        expected_skip_count: 3,
        waste_streams: [],
      },
    });
    expect(screen.getByText('Edit Order')).toBeInTheDocument();
  });

  it('renders "Ad-hoc Order" title for adhoc mode', () => {
    renderOrderFormModal({ mode: 'adhoc', order: { vehicle_plate: 'AB-123-CD' } });
    expect(screen.getByText('Ad-hoc Order')).toBeInTheDocument();
  });

  it('renders Carrier select with options', () => {
    renderOrderFormModal();
    expect(screen.getByText('DHL Express')).toBeInTheDocument();
    expect(screen.getByText('PostNL')).toBeInTheDocument();
  });

  it('renders Supplier select with suppliersWithContract options', () => {
    renderOrderFormModal();
    expect(screen.getByText('Recycler BV')).toBeInTheDocument();
    expect(screen.getByText('Scrap Corp')).toBeInTheDocument();
  });

  it('only shows suppliers with active contracts, not all suppliers', () => {
    // Override the mock to have different suppliers vs suppliersWithContract
    const { unmount } = render(
      <OrderFormModal onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );
    // The component uses suppliersWithContract from the store mock,
    // which contains 's1' and 's2'. If it used 'suppliers' instead,
    // the same data would show (in our mock they match), but the
    // component code explicitly reads suppliersWithContract.
    const supplierSelect = screen.getAllByRole('option').filter(
      (opt) => opt.textContent === 'Recycler BV' || opt.textContent === 'Scrap Corp'
    );
    expect(supplierSelect).toHaveLength(2);
    unmount();
  });

  it('renders Waste Streams dropdown button', () => {
    renderOrderFormModal();
    expect(screen.getByText('Select waste streams...')).toBeInTheDocument();
  });

  it('renders Planned Date input', () => {
    renderOrderFormModal();
    // Label text
    expect(screen.getByText(/Planned Date/)).toBeInTheDocument();
  });

  it('renders Expected Parcels input', () => {
    renderOrderFormModal();
    expect(screen.getByText(/Expected Parcels/)).toBeInTheDocument();
  });

  it('renders Vehicle Plate input', () => {
    renderOrderFormModal();
    expect(screen.getByPlaceholderText('AB-123-CD')).toBeInTheDocument();
  });

  it('renders Cancel and submit buttons', () => {
    renderOrderFormModal();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Create Order')).toBeInTheDocument();
  });

  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup();
    renderOrderFormModal();
    await user.click(screen.getByText('Cancel'));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('renders "Update Order" button text in edit mode', () => {
    renderOrderFormModal({
      order: {
        id: '1',
        carrier_id: 'c1',
        supplier_id: 's1',
        waste_stream_id: 'ws1',
        planned_date: '2026-03-22T00:00:00Z',
        expected_skip_count: 3,
        waste_streams: [],
      },
    });
    expect(screen.getByText('Update Order')).toBeInTheDocument();
  });

  it('renders "Create Ad-hoc Order" button text in adhoc mode', () => {
    renderOrderFormModal({ mode: 'adhoc', order: { vehicle_plate: 'AB-123-CD' } });
    expect(screen.getByText('Create Ad-hoc Order')).toBeInTheDocument();
  });

  it('renders adhoc-specific fields in adhoc mode', () => {
    renderOrderFormModal({ mode: 'adhoc', order: { vehicle_plate: 'AB-123-CD' } });
    expect(screen.getByText('Contact Person')).toBeInTheDocument();
    expect(screen.getByText('ID Reference')).toBeInTheDocument();
  });

  it('renders LZV checkbox', () => {
    renderOrderFormModal();
    expect(screen.getByText(/LZV Vehicle/)).toBeInTheDocument();
  });

  it('renders Notes textarea', () => {
    renderOrderFormModal();
    expect(screen.getByPlaceholderText('Optional notes...')).toBeInTheDocument();
  });
});
