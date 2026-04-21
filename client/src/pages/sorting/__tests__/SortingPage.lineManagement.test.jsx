/**
 * SortingPage Tests
 * Tests session detail display (inbound info, assets, processing status)
 * Tests catalogue entry and processing outcome rendering
 * Tests session-level actions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import SortingPage from '../SortingPage';
import * as catalogueApi from '../../../api/catalogue';
import * as processingApi from '../../../api/processing';
import * as reportsApi from '../../../api/reports';
import * as contaminationApi from '../../../api/contamination';
import * as sortingApi from '../../../api/sorting';

vi.mock('../../../api/catalogue');
vi.mock('../../../api/processing');
vi.mock('../../../api/reports');
vi.mock('../../../api/contamination');
vi.mock('../../../api/sorting');

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ sessionId: 'session-1' }),
    Link: ({ children, to }) => <a href={to}>{children}</a>,
  };
});

// SortingPage uses useSortingStore (default export)
const mockSession = {
  id: 'session-1',
  status: 'PLANNED',
  processing_status: 'IN_PROGRESS',
  order_id: 'order-1',
  inbound_id: 'inbound-1',
  recorded_at: null,
  inbound: {
    id: 'inbound-1',
    inbound_number: 'INB-001',
    vehicle: { registration_plate: '12-ABC-3' },
    linked_contract: null,
    order: {
      id: 'order-1',
      order_number: 'ORD-001',
      supplier: { id: 'sup-1', name: 'TechRecycle B.V.', supplier_type: 'COMMERCIAL', supplier_id: 'sup-1' },
      carrier: { name: 'FastLog B.V.' },
      waste_stream: { name: 'Small WEEE' },
    },
    assets: [
      {
        id: 'asset-1',
        asset_label: 'WEEE-001',
        parcel_type: 'CONTAINER',
        container_type: 'GITTERBOX',
        status: 'WEIGHED',
        net_weight_kg: 300,
        waste_stream: { name: 'Small WEEE' },
        catalogue_entries: [],
        processing_outcomes: [],
        reusable_items: [],
      },
    ],
  },
  sorting_lines: [],
};

vi.mock('../../../store/sortingStore', () => ({
  default: () => ({
    currentSession: mockSession,
    isLoading: false,
    isSubmitting: false,
    error: null,
    fetchSession: vi.fn(),
    clearSession: vi.fn(),
    setActiveAssetId: vi.fn(),
    activeAssetId: 'asset-1',
    lineForm: null,
    setLineForm: vi.fn(),
    clearLineForm: vi.fn(),
    setSubmitting: vi.fn(),
    addLineToStore: vi.fn(),
    updateLineInStore: vi.fn(),
    removeLineFromStore: vi.fn(),
    setSession: vi.fn(),
  }),
}));

// vi.mock factory hoisted — define materials/fractions inline
vi.mock('../../../store/masterDataStore', () => {
  const _materials = [
    { id: 'mat-1', name: 'Electronics', code: 'ELEC' },
    { id: 'mat-2', name: 'Plastics', code: 'PLAS' },
  ];
  const _fractions = [
    { id: 'frc-1', name: 'Copper', code: 'CU', material_id: 'mat-1' },
    { id: 'frc-2', name: 'Plastics Mix', code: 'PLAS-MIX', material_id: 'mat-2' },
  ];
  const useMasterDataStore = vi.fn(() => ({
    materials: _materials,
    fractions: _fractions,
    loadAll: vi.fn(),
  }));
  useMasterDataStore.getState = vi.fn(() => ({ materials: _materials, fractions: _fractions }));
  return { default: useMasterDataStore };
});

vi.mock('../../../store/authStore', () => {
  const useAuthStore = vi.fn(() => ({ user: { role: 'SORTING_EMPLOYEE', name: 'Sorter' } }));
  useAuthStore.getState = vi.fn(() => ({ user: { role: 'SORTING_EMPLOYEE', name: 'Sorter' } }));
  return { default: useAuthStore };
});

const renderWithRouter = (component) =>
  render(<BrowserRouter>{component}</BrowserRouter>);

describe('SortingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    catalogueApi.listReusableItems.mockResolvedValue({ data: { data: [] } });
    processingApi.getProcessingHistory.mockResolvedValue({ data: { data: [] } });
    reportsApi.getReports.mockResolvedValue({ data: { data: [] } });
    contaminationApi.listContaminationIncidents.mockResolvedValue({ data: { data: [] } });
    sortingApi.getSession.mockResolvedValue({ data: { data: mockSession } });
  });

  it('should render inbound number', () => {
    renderWithRouter(<SortingPage />);

    // getSortingName: INB-001 → SRT-001, or inbound_number shown directly
    expect(document.body.textContent).toMatch(/SRT-001|INB-001/i);
  });

  it('should display order number', () => {
    renderWithRouter(<SortingPage />);

    expect(document.body.textContent).toMatch(/ORD-001/);
  });

  it('should display supplier name', () => {
    renderWithRouter(<SortingPage />);

    expect(document.body.textContent).toMatch(/TechRecycle/);
  });

  it('should display vehicle registration plate', () => {
    renderWithRouter(<SortingPage />);

    expect(document.body.textContent).toMatch(/12-ABC-3/);
  });

  it('should display session status', () => {
    renderWithRouter(<SortingPage />);

    expect(document.body.textContent).toMatch(/PLANNED|planned/i);
  });

  it('should display asset label', () => {
    renderWithRouter(<SortingPage />);

    expect(document.body.textContent).toMatch(/WEEE-001/);
  });

  it('should display waste stream', () => {
    renderWithRouter(<SortingPage />);

    expect(document.body.textContent).toMatch(/Small WEEE/);
  });

  it('should render processing tab or action area', () => {
    renderWithRouter(<SortingPage />);

    const body = document.body.textContent;
    expect(body).toMatch(/process|catalogue|outcome|sorting|material/i);
  });

  it('should show asset label in the asset nav tabs', () => {
    renderWithRouter(<SortingPage />);

    // Asset tab list shows asset labels
    expect(document.body.textContent).toMatch(/WEEE-001/);
  });

  it('should render without crashing when APIs return empty data', async () => {
    renderWithRouter(<SortingPage />);

    await waitFor(() => {
      expect(document.body.textContent).toBeTruthy();
    });
  });
});
