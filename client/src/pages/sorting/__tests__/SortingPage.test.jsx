import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SortingPage from '../SortingPage';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

// Mock all API modules used by SortingPage
vi.mock('../../../api/catalogue', () => ({
  createCatalogueEntry: vi.fn(),
  deleteCatalogueEntry: vi.fn(),
  updateCatalogueEntry: vi.fn(),
  listReusableItems: vi.fn(),
  updateReusableItem: vi.fn(),
}));
vi.mock('../../../api/processing', () => ({
  confirmAssetProcessing: vi.fn(),
  createProcessingOutcome: vi.fn(),
  deleteProcessingOutcome: vi.fn(),
  finalizeAssetProcessing: vi.fn(),
  getProcessingHistory: vi.fn(),
  reopenAssetProcessing: vi.fn(),
  updateProcessingOutcome: vi.fn(),
}));
vi.mock('../../../api/processors', () => ({
  listProcessors: vi.fn(() => Promise.resolve({ data: { data: [] } })),
}));
vi.mock('../../../api/reports', () => ({
  generateReport: vi.fn(),
  getReports: vi.fn(),
  downloadReport: vi.fn(),
}));
vi.mock('../../../utils/entityNames', () => ({
  getSortingName: vi.fn(() => 'Sorting Session'),
}));

// Auth store mock
let mockUser = null;
vi.mock('../../../store/authStore', () => ({
  default: (selector) => {
    const state = { user: mockUser };
    if (typeof selector === 'function') return selector(state);
    return state;
  },
}));

// Sorting store mock
const mockFetchSession = vi.fn();
const mockClearSession = vi.fn();
let mockSortingState = {};

vi.mock('../../../store/sortingStore', () => ({
  default: (selector) => {
    if (typeof selector === 'function') return selector(mockSortingState);
    return mockSortingState;
  },
}));

// Master data store mock
vi.mock('../../../store/masterDataStore', () => ({
  default: (selector) => {
    const state = {
      materials: [],
      fractions: [],
      productTypes: [],
      wasteStreams: [],
      productCategories: [],
      carriers: [],
      suppliers: [],
      fetchMaterials: vi.fn(),
      loadAll: vi.fn(),
    };
    if (selector) return selector(state);
    return state;
  },
}));

function renderSortingPage(sessionId = '1') {
  return render(
    <MemoryRouter initialEntries={[`/sorting/${sessionId}`]}>
      <Routes>
        <Route path="/sorting/:sessionId" element={<SortingPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('SortingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 1, email: 'admin@statice.nl', role: 'ADMIN', full_name: 'Admin User' };
    mockSortingState = {
      session: null,
      loading: true,
      fetchSession: mockFetchSession,
      clearSession: mockClearSession,
    };
  });

  it('shows loading spinner when loading', () => {
    renderSortingPage();
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeTruthy();
  });

  it('calls fetchSession on mount', () => {
    renderSortingPage('42');
    expect(mockFetchSession).toHaveBeenCalledWith('42');
  });
});
