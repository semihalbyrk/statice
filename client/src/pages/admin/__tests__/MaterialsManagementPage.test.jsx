import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MaterialsManagementPage from '../MaterialsManagementPage';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

// Mock wasteStreams API
const mockGetWasteStreams = vi.fn();
const mockCreateWasteStream = vi.fn();
const mockUpdateWasteStream = vi.fn();
vi.mock('../../../api/wasteStreams', () => ({
  getWasteStreams: (...args) => mockGetWasteStreams(...args),
  createWasteStream: (...args) => mockCreateWasteStream(...args),
  updateWasteStream: (...args) => mockUpdateWasteStream(...args),
}));

// Mock catalogue API
const mockListMaterials = vi.fn();
const mockCreateMaterial = vi.fn();
const mockUpdateMaterial = vi.fn();
const mockListFractions = vi.fn();
const mockCreateFraction = vi.fn();
const mockUpdateFraction = vi.fn();
const mockReplaceMaterialFractions = vi.fn();
vi.mock('../../../api/catalogue', () => ({
  listMaterials: (...args) => mockListMaterials(...args),
  createMaterial: (...args) => mockCreateMaterial(...args),
  updateMaterial: (...args) => mockUpdateMaterial(...args),
  listFractions: (...args) => mockListFractions(...args),
  createFraction: (...args) => mockCreateFraction(...args),
  updateFraction: (...args) => mockUpdateFraction(...args),
  replaceMaterialFractions: (...args) => mockReplaceMaterialFractions(...args),
}));

// Mock masterDataStore
const mockFetchMaterials = vi.fn();
vi.mock('../../../store/masterDataStore', () => ({
  default: (selector) => {
    const state = { fetchMaterials: mockFetchMaterials };
    return selector(state);
  },
}));

function renderMaterialsManagementPage() {
  return render(<MaterialsManagementPage />);
}

describe('MaterialsManagementPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetWasteStreams.mockResolvedValue({ data: { data: [] } });
    mockListMaterials.mockResolvedValue({ data: { data: [] } });
    mockListFractions.mockResolvedValue({ data: { data: [] } });
  });

  it('renders the page title', () => {
    renderMaterialsManagementPage();
    expect(screen.getByText('Materials Management')).toBeInTheDocument();
  });

  it('renders three tabs: Waste Streams, Materials, Fractions', () => {
    renderMaterialsManagementPage();
    expect(screen.getByText('Waste Streams')).toBeInTheDocument();
    expect(screen.getByText('Materials')).toBeInTheDocument();
    expect(screen.getByText('Fractions')).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    mockGetWasteStreams.mockReturnValue(new Promise(() => {}));
    mockListMaterials.mockReturnValue(new Promise(() => {}));
    mockListFractions.mockReturnValue(new Promise(() => {}));
    renderMaterialsManagementPage();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows "No waste streams found" when waste streams list is empty', async () => {
    renderMaterialsManagementPage();
    await waitFor(() => {
      expect(screen.getByText('No waste streams found')).toBeInTheDocument();
    });
  });

  it('renders waste stream rows after data loads', async () => {
    mockGetWasteStreams.mockResolvedValue({
      data: {
        data: [
          {
            id: 'ws1',
            code: 'LHA',
            name: 'Grote Huishoudelijke Apparaten',
            ewc_code: '20 01 36',
            is_active: true,
          },
          {
            id: 'ws2',
            code: 'SHA',
            name: 'Kleine Huishoudelijke Apparaten',
            ewc_code: '20 01 35*',
            is_active: true,
          },
        ],
      },
    });

    renderMaterialsManagementPage();

    await waitFor(() => {
      expect(screen.getByText('LHA')).toBeInTheDocument();
    });

    expect(screen.getByText('Grote Huishoudelijke Apparaten')).toBeInTheDocument();
    expect(screen.getByText('20 01 36')).toBeInTheDocument();
    expect(screen.getByText('SHA')).toBeInTheDocument();
    expect(screen.getByText('Kleine Huishoudelijke Apparaten')).toBeInTheDocument();
  });

  it('switches to Materials tab and shows empty state', async () => {
    const user = userEvent.setup();
    renderMaterialsManagementPage();

    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Click the Materials tab button (there are tab buttons distinct from the table header)
    const tabButtons = screen.getAllByRole('button');
    const materialsTab = tabButtons.find((btn) => btn.textContent === 'Materials');
    await user.click(materialsTab);

    await waitFor(() => {
      expect(screen.getByText('No materials found')).toBeInTheDocument();
    });
  });

  it('switches to Fractions tab and shows empty state', async () => {
    const user = userEvent.setup();
    renderMaterialsManagementPage();

    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    const tabButtons = screen.getAllByRole('button');
    const fractionsTab = tabButtons.find((btn) => btn.textContent === 'Fractions');
    await user.click(fractionsTab);

    await waitFor(() => {
      expect(screen.getByText('No fractions found')).toBeInTheDocument();
    });
  });

  it('renders materials with waste stream badge after data loads', async () => {
    const user = userEvent.setup();
    mockGetWasteStreams.mockResolvedValue({
      data: {
        data: [
          { id: 'ws1', code: 'LHA', name: 'Grote Huishoudelijke Apparaten', is_active: true },
        ],
      },
    });
    mockListMaterials.mockResolvedValue({
      data: {
        data: [
          {
            id: 'm1',
            code: 'LHA-001',
            name: 'Wasmachines',
            waste_stream_id: 'ws1',
            weee_category: 'Cat 1',
            is_active: true,
            fractions: [],
          },
        ],
      },
    });

    renderMaterialsManagementPage();

    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    const tabButtons = screen.getAllByRole('button');
    const materialsTab = tabButtons.find((btn) => btn.textContent === 'Materials');
    await user.click(materialsTab);

    await waitFor(() => {
      expect(screen.getByText('LHA-001')).toBeInTheDocument();
    });

    expect(screen.getByText('Wasmachines')).toBeInTheDocument();
    expect(screen.getByText('Cat 1')).toBeInTheDocument();
  });

  it('opens the waste stream create modal on button click', async () => {
    const user = userEvent.setup();
    renderMaterialsManagementPage();

    // On Waste Streams tab, the add button says "Waste Stream"
    await user.click(screen.getByText('Waste Stream'));

    await waitFor(() => {
      expect(screen.getByText('New Waste Stream')).toBeInTheDocument();
    });
  });

  it('renders search input with tab-specific placeholder', async () => {
    renderMaterialsManagementPage();
    expect(screen.getByPlaceholderText('Search waste streams...')).toBeInTheDocument();
  });

  it('handles API error gracefully', async () => {
    const toast = await import('react-hot-toast');
    mockGetWasteStreams.mockRejectedValue(new Error('Network error'));
    mockListMaterials.mockRejectedValue(new Error('Network error'));
    mockListFractions.mockRejectedValue(new Error('Network error'));

    renderMaterialsManagementPage();

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Failed to load data');
    });
  });
});
