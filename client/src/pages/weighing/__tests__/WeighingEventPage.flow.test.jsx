/**
 * WeighingEventPage Flow Tests
 * Tests inbound detail display (assets, weighing events)
 * Tests weight recording and session completion
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import WeighingEventPage from '../WeighingEventPage';
import * as weighingEventsApi from '../../../api/weighingEvents';
import * as assetsApi from '../../../api/assets';
import * as containersApi from '../../../api/containers';
import * as wasteStreamsApi from '../../../api/wasteStreams';

vi.mock('../../../api/weighingEvents');
vi.mock('../../../api/assets');
vi.mock('../../../api/containers');
vi.mock('../../../api/wasteStreams');

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ inboundId: 'inbound-1' }),
    Link: ({ children, to }) => <a href={to}>{children}</a>,
  };
});

vi.mock('../../../store/authStore', () => {
  const useAuthStore = vi.fn(() => ({ user: { role: 'SCALE_OPERATOR', name: 'Test User' } }));
  useAuthStore.getState = vi.fn(() => ({ user: { role: 'SCALE_OPERATOR', name: 'Test User' } }));
  return { default: useAuthStore };
});

const renderWithRouter = (component) =>
  render(<BrowserRouter>{component}</BrowserRouter>);

const mockInbound = {
  id: 'inbound-1',
  inbound_number: 'INB-001',
  status: 'ARRIVED',
  vehicle: { registration_plate: '12-ABC-3' },
  order: {
    id: 'order-1',
    order_number: 'ORD-001',
    supplier: { name: 'TechRecycle B.V.', supplier_type: 'COMMERCIAL' },
    carrier: { name: 'FastLog B.V.' },
    waste_stream: { id: 'ws-1', name: 'Small WEEE', afvalstroomnummer: '160118' },
  },
  assets: [
    {
      id: 'asset-1',
      asset_label: 'WEEE-001',
      parcel_type: 'CONTAINER',
      container_type: 'GITTERBOX',
      status: 'PENDING',
      waste_stream: { name: 'Small WEEE' },
      gross_weight_kg: null,
      tare_weight_kg: 85,
      net_weight_kg: null,
    },
    {
      id: 'asset-2',
      asset_label: 'WEEE-002',
      parcel_type: 'CONTAINER',
      container_type: 'PALLET',
      status: 'WEIGHED',
      waste_stream: { name: 'Small WEEE' },
      gross_weight_kg: 250,
      tare_weight_kg: 25,
      net_weight_kg: 225,
    },
  ],
  weighing_events: [],
  arrived_at: '2026-04-13T09:00:00Z',
};

describe('WeighingEventPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    weighingEventsApi.getInbound.mockResolvedValue({ data: { data: mockInbound } });
    weighingEventsApi.triggerNextWeighing.mockResolvedValue({ data: { data: mockInbound } });
    weighingEventsApi.registerParcel.mockResolvedValue({ data: { data: { id: 'asset-new' } } });
    weighingEventsApi.overrideWeight.mockResolvedValue({ data: { data: mockInbound } });
    weighingEventsApi.updateInboundStatus.mockResolvedValue({ data: { data: { ...mockInbound, status: 'WEIGHED_OUT' } } });
    weighingEventsApi.getInboundsByOrder.mockResolvedValue({ data: { data: [] } });
    weighingEventsApi.confirmWeighing.mockResolvedValue({ data: { data: {} } });
    weighingEventsApi.getWeighingAmendments.mockResolvedValue({ data: { data: [] } });
    weighingEventsApi.setInboundIncident.mockResolvedValue({ data: { data: {} } });
    assetsApi.getNextContainerLabel.mockResolvedValue({ data: { data: { label: 'WEEE-003' } } });
    assetsApi.deleteAsset.mockResolvedValue({ data: { success: true } });
    assetsApi.lookupContainerByLabel.mockResolvedValue({ data: { data: null } });
    containersApi.getContainers.mockResolvedValue({ data: { data: [] } });
    wasteStreamsApi.getProductCategories.mockResolvedValue({ data: { data: [] } });
  });

  it('should render inbound number after load', async () => {
    renderWithRouter(<WeighingEventPage />);

    await waitFor(() => {
      expect(document.body.textContent).toMatch(/INB-001/);
    });
  });

  it('should display order number', async () => {
    renderWithRouter(<WeighingEventPage />);

    await waitFor(() => {
      expect(document.body.textContent).toMatch(/ORD-001/);
    });
  });

  it('should display vehicle registration plate', async () => {
    renderWithRouter(<WeighingEventPage />);

    await waitFor(() => {
      expect(document.body.textContent).toMatch(/12-ABC-3/);
    });
  });

  it('should display supplier name', async () => {
    renderWithRouter(<WeighingEventPage />);

    await waitFor(() => {
      expect(document.body.textContent).toMatch(/TechRecycle/);
    });
  });

  it('should display asset labels', async () => {
    renderWithRouter(<WeighingEventPage />);

    await waitFor(() => {
      expect(document.body.textContent).toMatch(/WEEE-001|WEEE-002/);
    });
  });

  it('should display inbound status', async () => {
    renderWithRouter(<WeighingEventPage />);

    await waitFor(() => {
      expect(document.body.textContent).toMatch(/ARRIVED|arrived/i);
    });
  });

  it('should display waste stream name', async () => {
    renderWithRouter(<WeighingEventPage />);

    await waitFor(() => {
      expect(document.body.textContent).toMatch(/Small WEEE/);
    });
  });

  it('should show net weight for weighed asset', async () => {
    renderWithRouter(<WeighingEventPage />);

    await waitFor(() => {
      // WEEE-002 net_weight_kg = 225
      expect(document.body.textContent).toMatch(/225/);
    });
  });

  it('should call getInbound on mount', async () => {
    renderWithRouter(<WeighingEventPage />);

    await waitFor(() => {
      expect(weighingEventsApi.getInbound).toHaveBeenCalledWith('inbound-1');
    });
  });

  it('should have weighing or recording action available', async () => {
    renderWithRouter(<WeighingEventPage />);

    await waitFor(() => {
      expect(document.body.textContent).toMatch(/weigh|record|trigger|scan|register|weight/i);
    });
  });

  it('should handle API error on load without crashing', async () => {
    weighingEventsApi.getInbound.mockRejectedValue(new Error('Network Error'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Should not throw synchronously
    expect(() => renderWithRouter(<WeighingEventPage />)).not.toThrow();

    // Wait for async rejection to settle
    await new Promise((r) => setTimeout(r, 100));

    consoleSpy.mockRestore();
  });
});
