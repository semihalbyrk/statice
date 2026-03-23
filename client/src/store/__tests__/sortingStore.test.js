import { describe, it, expect, vi, beforeEach } from 'vitest';
import useSortingStore from '../sortingStore';

// Mock API module
const mockGetSession = vi.fn();

vi.mock('../../api/sorting', () => ({
  getSession: (...args) => mockGetSession(...args),
}));

const mockSession = {
  id: 'ss-1',
  status: 'IN_PROGRESS',
  inbound: {
    id: 'inb-1',
    assets: [
      { id: 'asset-1', label: 'CT-001' },
      { id: 'asset-2', label: 'CT-002' },
    ],
  },
  sorting_lines: [
    { id: 'sl-1', material_id: 'm1', weight_kg: 120.5 },
    { id: 'sl-2', material_id: 'm2', weight_kg: 45.0 },
  ],
};

describe('sortingStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSortingStore.setState({
      currentSession: null,
      activeAssetId: null,
      isLoading: false,
      isSubmitting: false,
      error: null,
      lineForm: null,
    });
  });

  it('has correct initial state', () => {
    const state = useSortingStore.getState();
    expect(state.currentSession).toBeNull();
    expect(state.activeAssetId).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.isSubmitting).toBe(false);
    expect(state.error).toBeNull();
    expect(state.lineForm).toBeNull();
  });

  it('fetchSession fetches and stores session with first asset as active', async () => {
    mockGetSession.mockResolvedValue({ data: { data: mockSession } });

    const result = await useSortingStore.getState().fetchSession('ss-1');

    expect(mockGetSession).toHaveBeenCalledWith('ss-1');
    expect(result).toEqual(mockSession);
    expect(useSortingStore.getState().currentSession).toEqual(mockSession);
    expect(useSortingStore.getState().activeAssetId).toBe('asset-1');
    expect(useSortingStore.getState().isLoading).toBe(false);
  });

  it('fetchSession sets isLoading true then false', async () => {
    mockGetSession.mockResolvedValue({ data: { data: mockSession } });

    const promise = useSortingStore.getState().fetchSession('ss-1');
    expect(useSortingStore.getState().isLoading).toBe(true);

    await promise;
    expect(useSortingStore.getState().isLoading).toBe(false);
  });

  it('fetchSession sets activeAssetId to null when no assets', async () => {
    const noAssets = { ...mockSession, inbound: { id: 'inb-1', assets: [] } };
    mockGetSession.mockResolvedValue({ data: { data: noAssets } });

    await useSortingStore.getState().fetchSession('ss-1');

    expect(useSortingStore.getState().activeAssetId).toBeNull();
  });

  it('fetchSession handles errors gracefully', async () => {
    mockGetSession.mockRejectedValue({ response: { data: { error: 'Session not found' } } });

    const result = await useSortingStore.getState().fetchSession('nonexistent');

    expect(result).toBeNull();
    expect(useSortingStore.getState().error).toBe('Session not found');
    expect(useSortingStore.getState().isLoading).toBe(false);
  });

  it('fetchSession uses fallback error message', async () => {
    mockGetSession.mockRejectedValue(new Error('Network error'));

    await useSortingStore.getState().fetchSession('ss-1');

    expect(useSortingStore.getState().error).toBe('Failed to load session');
  });

  it('setSession directly sets the current session', () => {
    useSortingStore.getState().setSession(mockSession);

    expect(useSortingStore.getState().currentSession).toEqual(mockSession);
  });

  it('setActiveAssetId sets active asset and clears line form', () => {
    useSortingStore.setState({ lineForm: { mode: 'add', fields: {} } });

    useSortingStore.getState().setActiveAssetId('asset-2');

    expect(useSortingStore.getState().activeAssetId).toBe('asset-2');
    expect(useSortingStore.getState().lineForm).toBeNull();
  });

  it('setLineForm sets the line form state', () => {
    const form = { mode: 'add', fields: { material_id: 'm1', weight_kg: 50 } };
    useSortingStore.getState().setLineForm(form);

    expect(useSortingStore.getState().lineForm).toEqual(form);
  });

  it('clearLineForm resets lineForm to null', () => {
    useSortingStore.setState({ lineForm: { mode: 'edit', lineId: 'sl-1' } });

    useSortingStore.getState().clearLineForm();

    expect(useSortingStore.getState().lineForm).toBeNull();
  });

  it('setSubmitting toggles submitting state', () => {
    useSortingStore.getState().setSubmitting(true);
    expect(useSortingStore.getState().isSubmitting).toBe(true);

    useSortingStore.getState().setSubmitting(false);
    expect(useSortingStore.getState().isSubmitting).toBe(false);
  });

  it('addLineToStore appends a line to sorting_lines', () => {
    useSortingStore.setState({ currentSession: { ...mockSession } });

    const newLine = { id: 'sl-3', material_id: 'm3', weight_kg: 80 };
    useSortingStore.getState().addLineToStore(newLine);

    const lines = useSortingStore.getState().currentSession.sorting_lines;
    expect(lines).toHaveLength(3);
    expect(lines[2]).toEqual(newLine);
  });

  it('addLineToStore does nothing when currentSession is null', () => {
    useSortingStore.getState().addLineToStore({ id: 'sl-new' });

    expect(useSortingStore.getState().currentSession).toBeNull();
  });

  it('updateLineInStore updates a specific line by ID', () => {
    useSortingStore.setState({ currentSession: { ...mockSession } });

    useSortingStore.getState().updateLineInStore('sl-1', { weight_kg: 200 });

    const lines = useSortingStore.getState().currentSession.sorting_lines;
    expect(lines[0].weight_kg).toBe(200);
    expect(lines[0].material_id).toBe('m1'); // other fields preserved
    expect(lines[1].weight_kg).toBe(45.0); // other lines untouched
  });

  it('updateLineInStore does nothing when currentSession is null', () => {
    useSortingStore.getState().updateLineInStore('sl-1', { weight_kg: 200 });
    expect(useSortingStore.getState().currentSession).toBeNull();
  });

  it('removeLineFromStore removes a line by ID', () => {
    useSortingStore.setState({ currentSession: { ...mockSession } });

    useSortingStore.getState().removeLineFromStore('sl-1');

    const lines = useSortingStore.getState().currentSession.sorting_lines;
    expect(lines).toHaveLength(1);
    expect(lines[0].id).toBe('sl-2');
  });

  it('removeLineFromStore does nothing when currentSession is null', () => {
    useSortingStore.getState().removeLineFromStore('sl-1');
    expect(useSortingStore.getState().currentSession).toBeNull();
  });

  it('clearSession resets all session state', () => {
    useSortingStore.setState({
      currentSession: mockSession,
      activeAssetId: 'asset-1',
      isLoading: true,
      isSubmitting: true,
      error: 'some error',
      lineForm: { mode: 'add' },
    });

    useSortingStore.getState().clearSession();

    const state = useSortingStore.getState();
    expect(state.currentSession).toBeNull();
    expect(state.activeAssetId).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.isSubmitting).toBe(false);
    expect(state.error).toBeNull();
    expect(state.lineForm).toBeNull();
  });
});
