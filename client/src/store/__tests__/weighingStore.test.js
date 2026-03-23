import { describe, it, expect, vi, beforeEach } from 'vitest';
import useInboundsListStore from '../weighingStore';

// Mock API module
const mockGetInbounds = vi.fn();

vi.mock('../../api/weighingEvents', () => ({
  getInbounds: (...args) => mockGetInbounds(...args),
}));

describe('weighingStore (useInboundsListStore)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useInboundsListStore.setState({
      inbounds: [],
      totalCount: 0,
      filters: { status: '', search: '', page: 1, limit: 20 },
      loading: false,
      error: null,
    });
  });

  it('has correct initial state', () => {
    const state = useInboundsListStore.getState();
    expect(state.inbounds).toEqual([]);
    expect(state.totalCount).toBe(0);
    expect(state.filters).toEqual({ status: '', search: '', page: 1, limit: 20 });
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('setFilters merges filters and resets page to 1', () => {
    useInboundsListStore.getState().setFilters({ status: 'WEIGHED_IN', search: 'AB-123-CD' });

    const state = useInboundsListStore.getState();
    expect(state.filters.status).toBe('WEIGHED_IN');
    expect(state.filters.search).toBe('AB-123-CD');
    expect(state.filters.page).toBe(1);
    expect(state.filters.limit).toBe(20);
  });

  it('setFilters preserves explicit page number', () => {
    useInboundsListStore.getState().setFilters({ page: 5 });
    expect(useInboundsListStore.getState().filters.page).toBe(5);
  });

  it('clearFilters resets all filters to default', () => {
    useInboundsListStore.getState().setFilters({ status: 'WEIGHED_OUT', search: 'truck', page: 3 });
    useInboundsListStore.getState().clearFilters();

    expect(useInboundsListStore.getState().filters).toEqual({ status: '', search: '', page: 1, limit: 20 });
  });

  it('fetchInbounds fetches and stores inbounds list', async () => {
    const inbounds = [
      { id: 'inb-1', inbound_number: 'INB-0001', status: 'WEIGHED_IN', weight_in_kg: 1250 },
      { id: 'inb-2', inbound_number: 'INB-0002', status: 'ARRIVED', weight_in_kg: null },
    ];
    mockGetInbounds.mockResolvedValue({ data: { data: inbounds, total: 30 } });

    await useInboundsListStore.getState().fetchInbounds();

    expect(mockGetInbounds).toHaveBeenCalledWith({ page: 1, limit: 20 });
    expect(useInboundsListStore.getState().inbounds).toEqual(inbounds);
    expect(useInboundsListStore.getState().totalCount).toBe(30);
    expect(useInboundsListStore.getState().loading).toBe(false);
  });

  it('fetchInbounds passes active filters as params', async () => {
    useInboundsListStore.setState({
      filters: { status: 'WEIGHED_IN', search: 'Recycler', page: 2, limit: 20 },
    });
    mockGetInbounds.mockResolvedValue({ data: { data: [], total: 0 } });

    await useInboundsListStore.getState().fetchInbounds();

    expect(mockGetInbounds).toHaveBeenCalledWith({
      status: 'WEIGHED_IN',
      search: 'Recycler',
      page: 2,
      limit: 20,
    });
  });

  it('fetchInbounds sets loading true then false', async () => {
    mockGetInbounds.mockResolvedValue({ data: { data: [], total: 0 } });

    const promise = useInboundsListStore.getState().fetchInbounds();
    expect(useInboundsListStore.getState().loading).toBe(true);

    await promise;
    expect(useInboundsListStore.getState().loading).toBe(false);
  });

  it('fetchInbounds handles errors gracefully', async () => {
    mockGetInbounds.mockRejectedValue({ response: { data: { error: 'Unauthorized' } } });

    await useInboundsListStore.getState().fetchInbounds();

    expect(useInboundsListStore.getState().error).toBe('Unauthorized');
    expect(useInboundsListStore.getState().loading).toBe(false);
  });

  it('fetchInbounds uses fallback error message', async () => {
    mockGetInbounds.mockRejectedValue(new Error('Network error'));

    await useInboundsListStore.getState().fetchInbounds();

    expect(useInboundsListStore.getState().error).toBe('Failed to fetch inbounds');
  });
});
