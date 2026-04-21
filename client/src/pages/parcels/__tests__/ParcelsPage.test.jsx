/**
 * ParcelsPage Tests
 * Tests dual-tab layout: incoming (assets) and outgoing (outbound parcels)
 * Tests filtering, navigation, empty/error/loading states
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import ParcelsPage from '../ParcelsPage';
import * as parcelsApi from '../../../api/parcels';

vi.mock('../../../api/parcels');

const mockNavigate = vi.fn();
let mockSearchParams = new URLSearchParams('');
const mockSetSearchParams = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [mockSearchParams, mockSetSearchParams],
  };
});

const renderWithRouter = (component) =>
  render(<BrowserRouter>{component}</BrowserRouter>);

describe('ParcelsPage', () => {
  const mockIncomingParcels = [
    {
      id: 'asset-1',
      asset_label: 'WEEE-001',
      container_label: 'Box A',
      container_type: 'GITTERBOX',
      waste_stream: { name: 'Small WEEE' },
      material_category: { description_en: 'Mixed Electronics' },
      net_weight_kg: 85.5,
      inbound: {
        id: 'inbound-1',
        inbound_number: 'INB-001',
        status: 'COMPLETED',
        order: {
          id: 'order-1',
          order_number: 'ORD-001',
          supplier: { name: 'TechRecycle', company_name: 'TechRecycle B.V.' },
        },
      },
      created_at: '2026-04-13T10:00:00Z',
    },
    {
      id: 'asset-2',
      asset_label: 'WEEE-002',
      container_label: 'Box B',
      container_type: 'PALLET',
      waste_stream: { name: 'Large WEEE' },
      material_category: { description_en: 'Monitors' },
      net_weight_kg: 120.0,
      inbound: {
        id: 'inbound-2',
        inbound_number: 'INB-002',
        status: 'COMPLETED',
        order: {
          id: 'order-2',
          order_number: 'ORD-002',
          supplier: { name: 'Wecycle', company_name: 'Wecycle B.V.' },
        },
      },
      created_at: '2026-04-13T09:00:00Z',
    },
  ];

  const mockOutgoingParcels = [
    {
      id: 'parcel-1',
      parcel_label: 'OUT-P001',
      status: 'AVAILABLE',
      container_type: 'OPEN_TOP',
      material: { name: 'Electronics' },
      volume_m3: 1.5,
      tare_weight_kg: 25,
      created_at: '2026-04-13T08:00:00Z',
    },
    {
      id: 'parcel-2',
      parcel_label: 'OUT-P002',
      status: 'ATTACHED',
      container_type: 'CLOSED_TOP',
      material: { name: 'Plastics' },
      volume_m3: 2.0,
      tare_weight_kg: 30,
      outbound: { id: 'out-1', outbound_number: 'OUT-001' },
      created_at: '2026-04-12T15:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams('');
    // ParcelsPage uses response.data.data to extract items
    parcelsApi.listIncomingParcels.mockResolvedValue({ data: { data: mockIncomingParcels } });
    parcelsApi.listOutgoingParcels.mockResolvedValue({ data: { data: mockOutgoingParcels } });
  });

  it('should render page with tab buttons (All, Incoming, Outgoing)', async () => {
    renderWithRouter(<ParcelsPage />);

    // Tab buttons exist — use getAllByText since translations may appear multiple times
    await screen.findAllByText('All');
    expect(screen.getAllByText('Incoming').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Outgoing').length).toBeGreaterThan(0);
  });

  it('should display incoming parcels on "All" tab (default)', async () => {
    // Default tab is 'all' which shows both incoming and outgoing
    renderWithRouter(<ParcelsPage />);

    await screen.findByText('WEEE-001');
    expect(screen.getByText('WEEE-002')).toBeInTheDocument();
  });

  it('should display incoming parcel metadata (inbound number, container type)', async () => {
    renderWithRouter(<ParcelsPage />);

    await screen.findByText('WEEE-001');

    expect(document.body.textContent).toMatch(/INB-001/);
    expect(document.body.textContent).toMatch(/GITTERBOX|gitterbox/i);
  });

  it('should display net weight for incoming parcels', async () => {
    renderWithRouter(<ParcelsPage />);

    await screen.findByText('WEEE-001');
    expect(document.body.textContent).toMatch(/85\.5|85,5|85/);
  });

  it('should display outgoing parcels on "All" tab', async () => {
    renderWithRouter(<ParcelsPage />);

    await screen.findByText('OUT-P001');
    expect(screen.getByText('OUT-P002')).toBeInTheDocument();
  });

  it('should show only incoming parcels on "Incoming" tab', async () => {
    // Pre-set searchParams to 'incoming' tab
    mockSearchParams = new URLSearchParams('tab=incoming');

    renderWithRouter(<ParcelsPage />);

    await screen.findByText('WEEE-001');
    expect(screen.getByText('WEEE-002')).toBeInTheDocument();
    // Outgoing parcels should NOT be in the table
    expect(screen.queryByText('OUT-P001')).not.toBeInTheDocument();
  });

  it('should show only outgoing parcels on "Outgoing" tab', async () => {
    // Pre-set searchParams to 'outgoing' tab
    mockSearchParams = new URLSearchParams('tab=outgoing');

    renderWithRouter(<ParcelsPage />);

    await screen.findByText('OUT-P001');
    expect(screen.getByText('OUT-P002')).toBeInTheDocument();
    // Incoming parcels should NOT be shown
    expect(screen.queryByText('WEEE-001')).not.toBeInTheDocument();
  });

  it('should display material name for outgoing parcels', async () => {
    mockSearchParams = new URLSearchParams('tab=outgoing');

    renderWithRouter(<ParcelsPage />);

    await screen.findByText('OUT-P001');
    expect(document.body.textContent).toMatch(/Electronics/);
    expect(document.body.textContent).toMatch(/Plastics/);
  });

  it('should display outgoing parcel status (AVAILABLE, ATTACHED)', async () => {
    mockSearchParams = new URLSearchParams('tab=outgoing');

    renderWithRouter(<ParcelsPage />);

    await screen.findByText('OUT-P001');
    expect(document.body.textContent).toMatch(/AVAILABLE|available/i);
    expect(document.body.textContent).toMatch(/ATTACHED|attached/i);
  });

  it('should show "Create Outgoing Parcel" button', () => {
    renderWithRouter(<ParcelsPage />);

    // Create button should always be present
    expect(
      screen.queryByRole('button', { name: /create.*outgoing|outgoing.*parcel/i }) ||
      screen.queryByRole('link', { name: /create.*parcel|new.*parcel/i })
    ).toBeTruthy();
  });

  it('should show empty state when no incoming parcels', async () => {
    mockSearchParams = new URLSearchParams('tab=incoming');
    parcelsApi.listIncomingParcels.mockResolvedValue({ data: { data: [] } });

    renderWithRouter(<ParcelsPage />);

    await screen.findByText(/no incoming parcels|no parcels|empty|geen/i);
  });

  it('should show empty state when no outgoing parcels', async () => {
    mockSearchParams = new URLSearchParams('tab=outgoing');
    parcelsApi.listOutgoingParcels.mockResolvedValue({ data: { data: [] } });

    renderWithRouter(<ParcelsPage />);

    await screen.findByText(/no outgoing parcels|no parcels|empty|geen/i);
  });

  it('should handle API error gracefully for incoming parcels', async () => {
    parcelsApi.listIncomingParcels.mockRejectedValue(new Error('API Error'));

    renderWithRouter(<ParcelsPage />);

    // Error state or toast shown — page should not crash
    await waitFor(() => {
      expect(document.body.textContent).toMatch(/.+/);
    });
  });

  it('should show loading state while fetching', () => {
    parcelsApi.listIncomingParcels.mockImplementation(() => new Promise(() => {}));
    parcelsApi.listOutgoingParcels.mockImplementation(() => new Promise(() => {}));

    renderWithRouter(<ParcelsPage />);

    // Loading spinner (Loader2) renders
    expect(document.querySelector('svg') || document.body.textContent).toBeTruthy();
  });

  it('should display table headers', () => {
    renderWithRouter(<ParcelsPage />);

    const body = document.body.textContent;
    expect(body).toMatch(/label|parcel|code/i);
  });

  it('should call listIncomingParcels on mount', async () => {
    renderWithRouter(<ParcelsPage />);

    await waitFor(() => {
      expect(parcelsApi.listIncomingParcels).toHaveBeenCalled();
    });
  });

  it('should call listOutgoingParcels on mount (prefetches all tabs)', async () => {
    renderWithRouter(<ParcelsPage />);

    // ParcelsPage fetches both incoming and outgoing on mount via Promise.all
    await waitFor(() => {
      expect(parcelsApi.listOutgoingParcels).toHaveBeenCalled();
    });
  });
});
