import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import PenaltySelectModal from '../PenaltySelectModal';

// Mock toast
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

// Mock fees API
const mockListFees = vi.fn();

vi.mock('../../../api/fees', () => ({
  listFees: (...args) => mockListFees(...args),
}));

// Mock contracts API
const mockSyncContractPenalties = vi.fn();

vi.mock('../../../api/contracts', () => ({
  syncContractPenalties: (...args) => mockSyncContractPenalties(...args),
}));

const mockFees = [
  { id: 'fee-1', fee_type: 'Contamination Fine', description: 'Charged when contamination exceeds tolerance', rate_type: 'PERCENTAGE', rate_value: 10, min_cap: null, max_cap: null },
  { id: 'fee-2', fee_type: 'Late Delivery Penalty', description: 'Per-kg surcharge for late deliveries', rate_type: 'PER_KG', rate_value: 0.50, min_cap: 25, max_cap: 500 },
];

describe('PenaltySelectModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the modal title', async () => {
    mockListFees.mockResolvedValue({ data: { data: mockFees } });

    render(
      <PenaltySelectModal
        contractId="c1"
        currentPenalties={[]}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    expect(screen.getByText('Manage Contamination Penalties')).toBeInTheDocument();
  });

  it('shows loading text while fetching fees', () => {
    mockListFees.mockReturnValue(new Promise(() => {})); // never resolves

    render(
      <PenaltySelectModal
        contractId="c1"
        currentPenalties={[]}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    expect(screen.getByText('Loading fees...')).toBeInTheDocument();
  });

  it('displays fee list after loading', async () => {
    mockListFees.mockResolvedValue({ data: { data: mockFees } });

    render(
      <PenaltySelectModal
        contractId="c1"
        currentPenalties={[]}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Contamination Fine')).toBeInTheDocument();
      expect(screen.getByText('Late Delivery Penalty')).toBeInTheDocument();
    });
  });

  it('displays "No active fees found" when fees list is empty', async () => {
    mockListFees.mockResolvedValue({ data: { data: [] } });

    render(
      <PenaltySelectModal
        contractId="c1"
        currentPenalties={[]}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('No active fees found')).toBeInTheDocument();
    });
  });

  it('renders fee descriptions', async () => {
    mockListFees.mockResolvedValue({ data: { data: mockFees } });

    render(
      <PenaltySelectModal
        contractId="c1"
        currentPenalties={[]}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Charged when contamination exceeds tolerance')).toBeInTheDocument();
      expect(screen.getByText('Per-kg surcharge for late deliveries')).toBeInTheDocument();
    });
  });

  it('pre-selects fees from currentPenalties', async () => {
    mockListFees.mockResolvedValue({ data: { data: mockFees } });

    render(
      <PenaltySelectModal
        contractId="c1"
        currentPenalties={[{ fee_id: 'fee-1' }]}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes[0].checked).toBe(true);
      expect(checkboxes[1].checked).toBe(false);
    });
  });

  it('renders Cancel and Save buttons', async () => {
    mockListFees.mockResolvedValue({ data: { data: mockFees } });

    render(
      <PenaltySelectModal
        contractId="c1"
        currentPenalties={[]}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    expect(screen.getByText('Cancel')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Save (0 selected)')).toBeInTheDocument();
    });
  });

  it('calls onClose when Cancel is clicked', async () => {
    mockListFees.mockResolvedValue({ data: { data: [] } });
    const handleClose = vi.fn();

    render(
      <PenaltySelectModal
        contractId="c1"
        currentPenalties={[]}
        onClose={handleClose}
        onSuccess={vi.fn()}
      />
    );

    await waitFor(() => {
      fireEventClick('Cancel');
    });

    function fireEventClick(text) {
      screen.getByText(text).click();
    }

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when X button is clicked', () => {
    mockListFees.mockResolvedValue({ data: { data: [] } });
    const handleClose = vi.fn();

    render(
      <PenaltySelectModal
        contractId="c1"
        currentPenalties={[]}
        onClose={handleClose}
        onSuccess={vi.fn()}
      />
    );

    screen.getByText('\u00D7').click();

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('shows selected count in Save button', async () => {
    mockListFees.mockResolvedValue({ data: { data: mockFees } });

    render(
      <PenaltySelectModal
        contractId="c1"
        currentPenalties={[{ fee_id: 'fee-1' }, { fee_id: 'fee-2' }]}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Save (2 selected)')).toBeInTheDocument();
    });
  });
});
