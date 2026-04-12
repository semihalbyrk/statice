import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ReportsPage from '../ReportsPage';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

// Mock reports API
vi.mock('../../../api/reports', () => ({
  downloadReport: vi.fn(),
}));

// Auth store mock
let mockUser = null;
vi.mock('../../../store/authStore', () => ({
  default: (selector) => {
    const state = { user: mockUser };
    return selector(state);
  },
}));

// Reports store mock
const mockFetchReports = vi.fn();
const mockGenerateReport = vi.fn();
const mockSetSelectedType = vi.fn();
const mockDeleteReport = vi.fn();
const mockClearGenerated = vi.fn();
let mockReportsState = {};

vi.mock('../../../store/reportsStore', () => ({
  default: (selector) => {
    if (selector) return selector(mockReportsState);
    return mockReportsState;
  },
}));

// Master data store mock
vi.mock('../../../store/masterDataStore', () => ({
  default: (selector) => {
    const state = {
      suppliers: [],
      carriers: [],
      entities: [],
      wasteStreams: [],
      productCategories: [],
      materials: [],
      fractions: [],
      loading: false,
      loadAll: vi.fn(),
      getTransporterEntities: () => [],
      getSupplierEntities: () => [],
      getAllActiveEntities: () => [],
    };
    if (selector) return selector(state);
    return state;
  },
}));

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderReportsPage() {
  return render(
    <MemoryRouter initialEntries={['/reports']}>
      <ReportsPage />
    </MemoryRouter>
  );
}

describe('ReportsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 1, email: 'admin@statice.nl', role: 'ADMIN', full_name: 'Admin User' };
    mockReportsState = {
      selectedType: 'RPT-01',
      setSelectedType: mockSetSelectedType,
      reports: [],
      totalCount: 0,
      loading: false,
      generating: false,
      generatedReport: null,
      clearGenerated: mockClearGenerated,
      fetchReports: mockFetchReports,
      deleteReport: mockDeleteReport,
      generateReport: mockGenerateReport,
    };
  });

  it('renders the page title', () => {
    renderReportsPage();
    expect(screen.getByText('Reports')).toBeInTheDocument();
  });

  it('renders the page subtitle', () => {
    renderReportsPage();
    expect(screen.getByText('Generate and download compliance reports')).toBeInTheDocument();
  });

  it('renders the "Scheduled Reports" button', () => {
    renderReportsPage();
    expect(screen.getByText('Scheduled Reports')).toBeInTheDocument();
  });

  it('renders all report type codes in the nav', () => {
    renderReportsPage();
    expect(screen.getByText('RPT-01')).toBeInTheDocument();
    expect(screen.getByText('RPT-02')).toBeInTheDocument();
    expect(screen.getByText('RPT-03')).toBeInTheDocument();
    expect(screen.getByText('RPT-04')).toBeInTheDocument();
    expect(screen.getByText('RPT-05')).toBeInTheDocument();
    expect(screen.getByText('RPT-06')).toBeInTheDocument();
    expect(screen.getByText('RPT-07')).toBeInTheDocument();
  });

  it('renders generate buttons for PDF and XLSX', () => {
    renderReportsPage();
    expect(screen.getByText('Generate PDF')).toBeInTheDocument();
    expect(screen.getByText('Generate XLSX')).toBeInTheDocument();
    expect(screen.getByText('Generate Both')).toBeInTheDocument();
  });

  it('renders the Recent Reports section', () => {
    renderReportsPage();
    expect(screen.getByText('Recent Reports')).toBeInTheDocument();
  });

  it('shows "No reports generated yet" when reports list is empty', () => {
    renderReportsPage();
    expect(screen.getByText('No reports generated yet')).toBeInTheDocument();
  });

  it('shows report table loading state', () => {
    mockReportsState.loading = true;
    renderReportsPage();
    expect(screen.getByText('Loading reports...')).toBeInTheDocument();
  });

  it('renders report rows when data is available', () => {
    mockReportsState.reports = [
      {
        id: 'r1',
        type: 'RPT-01',
        typeName: 'Supplier Circularity Statement',
        generatedAt: '2026-03-22T10:00:00Z',
        generatedBy: 'Admin User',
        hasPdf: true,
        hasXlsx: true,
      },
    ];
    mockReportsState.totalCount = 1;

    renderReportsPage();
    expect(screen.getAllByText('Supplier Circularity Statement').length).toBeGreaterThan(0);
  });

  it('calls fetchReports on mount', () => {
    renderReportsPage();
    expect(mockFetchReports).toHaveBeenCalledWith({ page: 1, limit: 20 });
  });

  it('renders the selected report config form (RPT-01 has Supplier field)', () => {
    renderReportsPage();
    // RPT-01 shows a Supplier select
    expect(screen.getByText('Supplier *')).toBeInTheDocument();
  });
});
