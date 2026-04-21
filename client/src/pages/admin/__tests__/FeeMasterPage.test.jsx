import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FeeMasterPage from '../FeeMasterPage';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

// Mock fees API
const mockListFees = vi.fn();
const mockCreateFee = vi.fn();
const mockUpdateFee = vi.fn();
const mockDeleteFee = vi.fn();
vi.mock('../../../api/fees', () => ({
  listFees: (...args) => mockListFees(...args),
  createFee: (...args) => mockCreateFee(...args),
  updateFee: (...args) => mockUpdateFee(...args),
  deleteFee: (...args) => mockDeleteFee(...args),
}));

function renderFeeMasterPage() {
  return render(<FeeMasterPage />);
}

describe('FeeMasterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListFees.mockResolvedValue({ data: { data: [] } });
  });

  it('renders the page title', () => {
    renderFeeMasterPage();
    expect(screen.getByText('Fee Master')).toBeInTheDocument();
  });

  it('renders the "Add Fee" button', () => {
    renderFeeMasterPage();
    expect(screen.getByText('Add Fee')).toBeInTheDocument();
  });

  it('renders the search input', () => {
    renderFeeMasterPage();
    expect(screen.getByPlaceholderText('Search fees...')).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    mockListFees.mockReturnValue(new Promise(() => {}));
    renderFeeMasterPage();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows "No fees found" when list is empty', async () => {
    renderFeeMasterPage();
    await waitFor(() => {
      expect(screen.getByText('No fees found')).toBeInTheDocument();
    });
  });

  it('renders fee table headers', () => {
    renderFeeMasterPage();
    expect(screen.getByText('Fee Type')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByText('Rate Type')).toBeInTheDocument();
    expect(screen.getByText('Rate Value')).toBeInTheDocument();
    expect(screen.getByText('Min Cap')).toBeInTheDocument();
    expect(screen.getByText('Max Cap')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('renders fee rows after data loads', async () => {
    mockListFees.mockResolvedValue({
      data: {
        data: [
          {
            id: 'f1',
            fee_type: 'CONTAMINATION_SURCHARGE',
            description: 'Toeslag voor verontreinigde lading',
            rate_type: 'PER_KG',
            rate_value: 0.15,
            min_cap: 25.0,
            max_cap: 500.0,
            is_active: true,
          },
          {
            id: 'f2',
            fee_type: 'HANDLING_FEE',
            description: 'Verwerkingskosten per levering',
            rate_type: 'FIXED',
            rate_value: 75.0,
            min_cap: null,
            max_cap: null,
            is_active: false,
          },
        ],
      },
    });

    renderFeeMasterPage();

    await waitFor(() => {
      expect(screen.getByText('Contamination Surcharge')).toBeInTheDocument();
    });

    expect(screen.getByText('Toeslag voor verontreinigde lading')).toBeInTheDocument();
    expect(screen.getByText('Per kg')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('HANDLING_FEE')).toBeInTheDocument();
    expect(screen.getByText('Verwerkingskosten per levering')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('opens the create modal on "Add Fee" click', async () => {
    const user = userEvent.setup();
    renderFeeMasterPage();

    await user.click(screen.getByText('Add Fee'));

    await waitFor(() => {
      expect(screen.getByText('New Fee')).toBeInTheDocument();
    });
  });

  it('handles API error gracefully', async () => {
    const toast = await import('react-hot-toast');
    mockListFees.mockRejectedValue(new Error('Network error'));

    renderFeeMasterPage();

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Failed to load fees');
    });
  });
});
