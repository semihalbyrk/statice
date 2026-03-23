import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SystemSettingsPage from '../SystemSettingsPage';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

// Mock admin API
const mockGetSettings = vi.fn();
const mockUpdateSettings = vi.fn();
vi.mock('../../../api/admin', () => ({
  getSettings: (...args) => mockGetSettings(...args),
  updateSettings: (...args) => mockUpdateSettings(...args),
}));

function renderSystemSettingsPage() {
  return render(<SystemSettingsPage />);
}

const mockSettingsData = {
  facility_name: 'Statice Elektronica Recycling B.V.',
  facility_address: 'Industrieweg 12, 3295 BT Midden-Delfland',
  facility_permit_number: 'NL-2024-MRF-001',
  facility_kvk: '12345678',
  report_footer_text: 'Statice verwerking conform WEEELABEX standaard',
  max_skips_per_event: 5,
  require_downstream_processor: true,
  smtp_configured: false,
};

describe('SystemSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSettings.mockResolvedValue({ data: { data: mockSettingsData } });
  });

  it('shows loading state initially', () => {
    mockGetSettings.mockReturnValue(new Promise(() => {}));
    renderSystemSettingsPage();
    expect(screen.getByText('Loading settings...')).toBeInTheDocument();
  });

  it('renders the page title after loading', async () => {
    renderSystemSettingsPage();
    await waitFor(() => {
      expect(screen.getByText('System Settings')).toBeInTheDocument();
    });
  });

  it('renders the subtitle', async () => {
    renderSystemSettingsPage();
    await waitFor(() => {
      expect(screen.getByText('Facility configuration and system defaults')).toBeInTheDocument();
    });
  });

  it('renders the three settings cards', async () => {
    renderSystemSettingsPage();
    await waitFor(() => {
      expect(screen.getByText('Facility Information')).toBeInTheDocument();
    });
    expect(screen.getByText('Report Defaults')).toBeInTheDocument();
    expect(screen.getByText('Integration Status')).toBeInTheDocument();
  });

  it('displays loaded facility settings values', async () => {
    renderSystemSettingsPage();
    await waitFor(() => {
      expect(screen.getByDisplayValue('Statice Elektronica Recycling B.V.')).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue('Industrieweg 12, 3295 BT Midden-Delfland')).toBeInTheDocument();
    expect(screen.getByDisplayValue('NL-2024-MRF-001')).toBeInTheDocument();
    expect(screen.getByDisplayValue('12345678')).toBeInTheDocument();
  });

  it('displays report defaults values', async () => {
    renderSystemSettingsPage();
    await waitFor(() => {
      expect(screen.getByDisplayValue('Statice verwerking conform WEEELABEX standaard')).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue('5')).toBeInTheDocument();
  });

  it('renders integration status badges', async () => {
    renderSystemSettingsPage();
    await waitFor(() => {
      expect(screen.getByText('Pfister Weighbridge')).toBeInTheDocument();
    });
    expect(screen.getByText('DIWASS API')).toBeInTheDocument();
    expect(screen.getByText('Email (SMTP)')).toBeInTheDocument();
    expect(screen.getByText('CONNECTED')).toBeInTheDocument();
    expect(screen.getAllByText('NOT CONFIGURED').length).toBe(2);
  });

  it('renders save buttons for facility and report defaults', async () => {
    renderSystemSettingsPage();
    await waitFor(() => {
      expect(screen.getByText('Save Facility Settings')).toBeInTheDocument();
    });
    expect(screen.getByText('Save Report Defaults')).toBeInTheDocument();
  });

  it('calls updateSettings on facility save', async () => {
    mockUpdateSettings.mockResolvedValue({ data: { data: mockSettingsData } });
    const user = userEvent.setup();

    renderSystemSettingsPage();
    await waitFor(() => {
      expect(screen.getByText('Save Facility Settings')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Save Facility Settings'));

    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith({
        facility_name: 'Statice Elektronica Recycling B.V.',
        facility_address: 'Industrieweg 12, 3295 BT Midden-Delfland',
        facility_permit_number: 'NL-2024-MRF-001',
        facility_kvk: '12345678',
      });
    });
  });

  it('handles API error gracefully', async () => {
    const toast = await import('react-hot-toast');
    mockGetSettings.mockRejectedValue(new Error('Network error'));

    renderSystemSettingsPage();

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Failed to load settings');
    });
  });
});
