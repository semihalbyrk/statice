import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SuppliersPage from '../SuppliersPage';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

// Mock suppliers API
const mockGetSuppliers = vi.fn();
const mockCreateSupplier = vi.fn();
const mockUpdateSupplier = vi.fn();
const mockDeleteSupplier = vi.fn();
vi.mock('../../../api/suppliers', () => ({
  getSuppliers: (...args) => mockGetSuppliers(...args),
  createSupplier: (...args) => mockCreateSupplier(...args),
  updateSupplier: (...args) => mockUpdateSupplier(...args),
  deleteSupplier: (...args) => mockDeleteSupplier(...args),
}));

function renderSuppliersPage() {
  return render(<SuppliersPage />);
}

describe('SuppliersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSuppliers.mockResolvedValue({ data: { data: [] } });
  });

  it('renders the page title', () => {
    renderSuppliersPage();
    expect(screen.getByText('Suppliers')).toBeInTheDocument();
  });

  it('renders the "Add Supplier" button', () => {
    renderSuppliersPage();
    expect(screen.getByText('Add Supplier')).toBeInTheDocument();
  });

  it('renders the search input', () => {
    renderSuppliersPage();
    expect(screen.getByPlaceholderText('Search suppliers...')).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    mockGetSuppliers.mockReturnValue(new Promise(() => {}));
    renderSuppliersPage();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows "No suppliers found" when list is empty', async () => {
    renderSuppliersPage();
    await waitFor(() => {
      expect(screen.getByText('No suppliers found')).toBeInTheDocument();
    });
  });

  it('renders supplier table headers', () => {
    renderSuppliersPage();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByText('KVK')).toBeInTheDocument();
    expect(screen.getByText('Contact Name')).toBeInTheDocument();
    expect(screen.getByText('Contact Email')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('renders supplier rows after data loads', async () => {
    mockGetSuppliers.mockResolvedValue({
      data: {
        data: [
          {
            id: '1',
            name: 'Recycler BV',
            supplier_type: 'PRO',
            kvk_number: '12345678',
            contact_name: 'Jan de Vries',
            contact_email: 'jan@recycler.nl',
            is_active: true,
          },
        ],
      },
    });

    renderSuppliersPage();

    await waitFor(() => {
      expect(screen.getByText('Recycler BV')).toBeInTheDocument();
    });

    expect(screen.getByText('PRO')).toBeInTheDocument();
    expect(screen.getByText('12345678')).toBeInTheDocument();
    expect(screen.getByText('Jan de Vries')).toBeInTheDocument();
    expect(screen.getByText('jan@recycler.nl')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('opens the create modal on "Add Supplier" click', async () => {
    const user = userEvent.setup();
    renderSuppliersPage();

    await user.click(screen.getByText('Add Supplier'));

    await waitFor(() => {
      expect(screen.getByText('New Supplier')).toBeInTheDocument();
    });
  });

  it('shows Inactive status badge for inactive suppliers', async () => {
    mockGetSuppliers.mockResolvedValue({
      data: {
        data: [
          {
            id: '2',
            name: 'Old Corp',
            supplier_type: 'COMMERCIAL',
            is_active: false,
          },
        ],
      },
    });

    renderSuppliersPage();

    await waitFor(() => {
      expect(screen.getByText('Inactive')).toBeInTheDocument();
    });
  });

  it('handles API error gracefully', async () => {
    const toast = await import('react-hot-toast');
    mockGetSuppliers.mockRejectedValue(new Error('Network error'));

    renderSuppliersPage();

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Failed to load suppliers');
    });
  });
});
