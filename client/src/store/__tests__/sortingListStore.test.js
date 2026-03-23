import { describe, it, expect, vi, beforeEach } from 'vitest';
import useSortingListStore from '../sortingListStore';

// Mock API module
const mockListAllSessions = vi.fn();

vi.mock('../../api/sorting', () => ({
  listAllSessions: (...args) => mockListAllSessions(...args),
}));

describe('sortingListStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSortingListStore.setState({
      sessions: [],
      totalCount: 0,
      filters: { status: '', search: '', page: 1, limit: 20 },
      loading: false,
      error: null,
    });
  });

  it('has correct initial state', () => {
    const state = useSortingListStore.getState();
    expect(state.sessions).toEqual([]);
    expect(state.totalCount).toBe(0);
    expect(state.filters).toEqual({ status: '', search: '', page: 1, limit: 20 });
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('setFilters merges filters and resets page to 1', () => {
    useSortingListStore.getState().setFilters({ status: 'IN_PROGRESS', search: 'LHA' });

    const state = useSortingListStore.getState();
    expect(state.filters.status).toBe('IN_PROGRESS');
    expect(state.filters.search).toBe('LHA');
    expect(state.filters.page).toBe(1);
    expect(state.filters.limit).toBe(20);
  });

  it('setFilters preserves explicit page number', () => {
    useSortingListStore.getState().setFilters({ page: 4 });
    expect(useSortingListStore.getState().filters.page).toBe(4);
  });

  it('clearFilters resets all filters to default', () => {
    useSortingListStore.getState().setFilters({ status: 'COMPLETED', search: 'KGA', page: 3 });
    useSortingListStore.getState().clearFilters();

    expect(useSortingListStore.getState().filters).toEqual({ status: '', search: '', page: 1, limit: 20 });
  });

  it('fetchSessions fetches and stores sorting sessions', async () => {
    const sessions = [
      { id: 'ss-1', status: 'IN_PROGRESS', inbound: { order: { order_number: 'ORD-2026-0010' } } },
      { id: 'ss-2', status: 'COMPLETED', inbound: { order: { order_number: 'ORD-2026-0011' } } },
    ];
    mockListAllSessions.mockResolvedValue({ data: { data: sessions, total: 28 } });

    await useSortingListStore.getState().fetchSessions();

    expect(mockListAllSessions).toHaveBeenCalledWith({ page: 1, limit: 20 });
    expect(useSortingListStore.getState().sessions).toEqual(sessions);
    expect(useSortingListStore.getState().totalCount).toBe(28);
    expect(useSortingListStore.getState().loading).toBe(false);
  });

  it('fetchSessions passes active filters as params', async () => {
    useSortingListStore.setState({
      filters: { status: 'COMPLETED', search: 'Wecycle', page: 2, limit: 20 },
    });
    mockListAllSessions.mockResolvedValue({ data: { data: [], total: 0 } });

    await useSortingListStore.getState().fetchSessions();

    expect(mockListAllSessions).toHaveBeenCalledWith({
      status: 'COMPLETED',
      search: 'Wecycle',
      page: 2,
      limit: 20,
    });
  });

  it('fetchSessions sets loading true then false', async () => {
    mockListAllSessions.mockResolvedValue({ data: { data: [], total: 0 } });

    const promise = useSortingListStore.getState().fetchSessions();
    expect(useSortingListStore.getState().loading).toBe(true);

    await promise;
    expect(useSortingListStore.getState().loading).toBe(false);
  });

  it('fetchSessions handles errors gracefully', async () => {
    mockListAllSessions.mockRejectedValue({ response: { data: { error: 'Forbidden' } } });

    await useSortingListStore.getState().fetchSessions();

    expect(useSortingListStore.getState().error).toBe('Forbidden');
    expect(useSortingListStore.getState().loading).toBe(false);
  });

  it('fetchSessions uses fallback error message', async () => {
    mockListAllSessions.mockRejectedValue(new Error('Network error'));

    await useSortingListStore.getState().fetchSessions();

    expect(useSortingListStore.getState().error).toBe('Failed to fetch sorting sessions');
  });
});
