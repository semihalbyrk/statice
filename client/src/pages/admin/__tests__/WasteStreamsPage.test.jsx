import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WasteStreamsPage from '../WasteStreamsPage';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

// Mock waste streams API
const mockGetWasteStreams = vi.fn();
const mockCreateWasteStream = vi.fn();
const mockUpdateWasteStream = vi.fn();
const mockCreateProductCategory = vi.fn();
const mockUpdateProductCategory = vi.fn();
const mockDeleteProductCategory = vi.fn();
vi.mock('../../../api/wasteStreams', () => ({
  getWasteStreams: (...args) => mockGetWasteStreams(...args),
  createWasteStream: (...args) => mockCreateWasteStream(...args),
  updateWasteStream: (...args) => mockUpdateWasteStream(...args),
  createProductCategory: (...args) => mockCreateProductCategory(...args),
  updateProductCategory: (...args) => mockUpdateProductCategory(...args),
  deleteProductCategory: (...args) => mockDeleteProductCategory(...args),
}));

// Master data store mock
vi.mock('../../../store/masterDataStore', () => ({
  default: (selector) => {
    const state = {
      fetchWasteStreams: vi.fn(),
      fetchProductCategories: vi.fn(),
      fetchProductTypes: vi.fn(),
    };
    if (selector) return selector(state);
    return state;
  },
}));

function renderWasteStreamsPage() {
  return render(<WasteStreamsPage />);
}

describe('WasteStreamsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetWasteStreams.mockResolvedValue({ data: { data: [] } });
  });

  it('renders the page title', () => {
    renderWasteStreamsPage();
    expect(screen.getByText('Waste Streams')).toBeInTheDocument();
  });

  it('renders the "Add Stream" button', () => {
    renderWasteStreamsPage();
    expect(screen.getByText('Add Stream')).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    mockGetWasteStreams.mockReturnValue(new Promise(() => {}));
    renderWasteStreamsPage();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows "No waste streams found" when list is empty', async () => {
    renderWasteStreamsPage();
    await waitFor(() => {
      expect(screen.getByText('No waste streams found')).toBeInTheDocument();
    });
  });

  it('renders waste stream items after data loads', async () => {
    mockGetWasteStreams.mockResolvedValue({
      data: {
        data: [
          {
            id: '1',
            name_en: 'Large Household Appliances',
            name_nl: 'Grote Huishoudelijke Apparaten',
            code: 'LHA',
            cbs_code: '01',
            weeelabex_code: 'W1',
            ewc_code: '200123',
            is_active: true,
            categories: [
              {
                id: 'c1',
                code_cbs: 'LHA-01',
                description_en: 'Washing Machines',
                recycled_pct_default: 85,
                reused_pct_default: 5,
                disposed_pct_default: 8,
                landfill_pct_default: 2,
                is_active: true,
              },
            ],
          },
        ],
      },
    });

    renderWasteStreamsPage();

    await waitFor(() => {
      expect(screen.getByText('Large Household Appliances')).toBeInTheDocument();
    });

    expect(screen.getByText('(LHA)')).toBeInTheDocument();
    expect(screen.getByText('1 sub categories')).toBeInTheDocument();
  });

  it('opens the create modal on "Add Stream" click', async () => {
    const user = userEvent.setup();
    renderWasteStreamsPage();

    await user.click(screen.getByText('Add Stream'));

    await waitFor(() => {
      expect(screen.getByText('New Waste Stream')).toBeInTheDocument();
    });
  });

  it('expands waste stream to show categories on click', async () => {
    mockGetWasteStreams.mockResolvedValue({
      data: {
        data: [
          {
            id: '1',
            name_en: 'Large Household Appliances',
            code: 'LHA',
            is_active: true,
            categories: [
              {
                id: 'c1',
                code_cbs: 'LHA-01',
                description_en: 'Washing Machines',
                recycled_pct_default: 85,
                reused_pct_default: 5,
                disposed_pct_default: 8,
                landfill_pct_default: 2,
                is_active: true,
              },
            ],
          },
        ],
      },
    });

    const user = userEvent.setup();
    renderWasteStreamsPage();

    await waitFor(() => {
      expect(screen.getByText('Large Household Appliances')).toBeInTheDocument();
    });

    // Click the expand button (the row itself is the button)
    await user.click(screen.getByText('Large Household Appliances'));

    await waitFor(() => {
      expect(screen.getByText('Sub Categories')).toBeInTheDocument();
      expect(screen.getByText('LHA-01')).toBeInTheDocument();
      expect(screen.getByText('Washing Machines')).toBeInTheDocument();
    });
  });

  it('handles API error gracefully', async () => {
    const toast = await import('react-hot-toast');
    mockGetWasteStreams.mockRejectedValue(new Error('Network error'));

    renderWasteStreamsPage();

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Failed to load waste streams');
    });
  });
});
