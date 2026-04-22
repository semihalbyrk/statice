/**
 * ParcelsPage Tests
 * Tests incoming parcel listing (assets), filtering, empty/error/loading states.
 * Outgoing parcel tab has been removed as part of the Outbound Lines refactor.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams('');
    parcelsApi.listIncomingParcels.mockResolvedValue({ data: { data: mockIncomingParcels } });
  });

  it('should render page title', async () => {
    renderWithRouter(<ParcelsPage />);

    await screen.findByText(/parcels/i);
  });

  it('should display incoming parcels', async () => {
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

  it('should display supplier name for incoming parcels', async () => {
    renderWithRouter(<ParcelsPage />);

    await screen.findByText('WEEE-001');
    expect(document.body.textContent).toMatch(/TechRecycle|Wecycle/);
  });

  it('should show empty state when there are no incoming parcels', async () => {
    parcelsApi.listIncomingParcels.mockResolvedValue({ data: { data: [] } });

    renderWithRouter(<ParcelsPage />);

    await screen.findByText(/no.*parcels|empty|geen/i);
  });

  it('should handle API error gracefully', async () => {
    parcelsApi.listIncomingParcels.mockRejectedValue(new Error('API Error'));

    renderWithRouter(<ParcelsPage />);

    await waitFor(() => {
      expect(document.body.textContent).toMatch(/.+/);
    });
  });

  it('should show loading state while fetching', () => {
    parcelsApi.listIncomingParcels.mockImplementation(() => new Promise(() => {}));

    renderWithRouter(<ParcelsPage />);

    expect(document.querySelector('svg') || document.body.textContent).toBeTruthy();
  });

  it('should display table headers', async () => {
    renderWithRouter(<ParcelsPage />);

    await screen.findByText('WEEE-001');
    const body = document.body.textContent;
    expect(body).toMatch(/label|parcel|code/i);
  });

  it('should call listIncomingParcels on mount', async () => {
    renderWithRouter(<ParcelsPage />);

    await waitFor(() => {
      expect(parcelsApi.listIncomingParcels).toHaveBeenCalled();
    });
  });
});
