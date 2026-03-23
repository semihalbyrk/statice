import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CarriersPage from '../CarriersPage';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

// Mock carriers API
const mockGetCarriers = vi.fn();
const mockCreateCarrier = vi.fn();
const mockUpdateCarrier = vi.fn();
const mockToggleCarrierStatus = vi.fn();
vi.mock('../../../api/carriers', () => ({
  getCarriers: (...args) => mockGetCarriers(...args),
  createCarrier: (...args) => mockCreateCarrier(...args),
  updateCarrier: (...args) => mockUpdateCarrier(...args),
  toggleCarrierStatus: (...args) => mockToggleCarrierStatus(...args),
}));

function renderCarriersPage() {
  return render(<CarriersPage />);
}

describe('CarriersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCarriers.mockResolvedValue({ data: { data: [] } });
  });

  it('renders the page title', () => {
    renderCarriersPage();
    expect(screen.getByText('Carriers')).toBeInTheDocument();
  });

  it('renders the "Add Carrier" button', () => {
    renderCarriersPage();
    expect(screen.getByText('Add Carrier')).toBeInTheDocument();
  });

  it('renders the search input', () => {
    renderCarriersPage();
    expect(screen.getByPlaceholderText('Search carriers...')).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    mockGetCarriers.mockReturnValue(new Promise(() => {}));
    renderCarriersPage();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows "No carriers found" when list is empty', async () => {
    renderCarriersPage();
    await waitFor(() => {
      expect(screen.getByText('No carriers found')).toBeInTheDocument();
    });
  });

  it('renders carrier table headers without an Actions header', () => {
    renderCarriersPage();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('KVK')).toBeInTheDocument();
    expect(screen.getByText('Contact Name')).toBeInTheDocument();
    expect(screen.getByText('Contact Email')).toBeInTheDocument();
    expect(screen.getByText('Contact Phone')).toBeInTheDocument();
    // Actions column uses a kebab menu — no visible header text
    expect(screen.queryByText('Actions')).not.toBeInTheDocument();
  });

  it('renders carrier rows after data loads', async () => {
    mockGetCarriers.mockResolvedValue({
      data: {
        data: [
          {
            id: '1',
            name: 'Transportbedrijf Bakker',
            kvk_number: '87654321',
            contact_name: 'Kees Bakker',
            contact_email: 'kees@bakker-transport.nl',
            contact_phone: '+31 20 555 0101',
            licence_number: 'VIHB-2025-0042',
            is_active: true,
          },
        ],
      },
    });

    renderCarriersPage();

    await waitFor(() => {
      expect(screen.getByText('Transportbedrijf Bakker')).toBeInTheDocument();
    });

    expect(screen.getByText('87654321')).toBeInTheDocument();
    expect(screen.getByText('Kees Bakker')).toBeInTheDocument();
    expect(screen.getByText('kees@bakker-transport.nl')).toBeInTheDocument();
    expect(screen.getByText('+31 20 555 0101')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('shows Inactive status badge for inactive carriers', async () => {
    mockGetCarriers.mockResolvedValue({
      data: {
        data: [
          {
            id: '2',
            name: 'Oud Logistiek BV',
            is_active: false,
          },
        ],
      },
    });

    renderCarriersPage();

    await waitFor(() => {
      expect(screen.getByText('Inactive')).toBeInTheDocument();
    });
  });

  it('renders a kebab menu (RowActionMenu) for each carrier row', async () => {
    mockGetCarriers.mockResolvedValue({
      data: {
        data: [
          {
            id: '1',
            name: 'Vervoer Nederland',
            is_active: true,
          },
          {
            id: '2',
            name: 'Sneltransport Groningen',
            is_active: true,
          },
        ],
      },
    });

    renderCarriersPage();

    await waitFor(() => {
      expect(screen.getByText('Vervoer Nederland')).toBeInTheDocument();
    });

    // Each row should have a kebab menu button (MoreVertical icon rendered as SVG)
    const menuButtons = screen.getAllByRole('button').filter((btn) =>
      btn.querySelector('svg') && btn.className.includes('hover:bg-grey-100')
    );
    expect(menuButtons.length).toBe(2);
  });

  it('opens the create modal on "Add Carrier" click', async () => {
    const user = userEvent.setup();
    renderCarriersPage();

    await user.click(screen.getByText('Add Carrier'));

    await waitFor(() => {
      expect(screen.getByText('New Carrier')).toBeInTheDocument();
    });
  });

  it('handles API error gracefully', async () => {
    const toast = await import('react-hot-toast');
    mockGetCarriers.mockRejectedValue(new Error('Network error'));

    renderCarriersPage();

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Failed to load carriers');
    });
  });

  it('shows em dash for missing optional fields', async () => {
    mockGetCarriers.mockResolvedValue({
      data: {
        data: [
          {
            id: '3',
            name: 'Minimale Vervoerder',
            is_active: true,
            kvk_number: null,
            contact_name: null,
            contact_email: null,
            contact_phone: null,
          },
        ],
      },
    });

    renderCarriersPage();

    await waitFor(() => {
      expect(screen.getByText('Minimale Vervoerder')).toBeInTheDocument();
    });

    // Em dashes for missing fields
    const dashes = screen.getAllByText('\u2014');
    expect(dashes.length).toBeGreaterThanOrEqual(4);
  });
});
