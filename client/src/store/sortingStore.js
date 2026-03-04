import { create } from 'zustand';
import { getSession } from '../api/sorting';

const useSortingStore = create((set) => ({
  currentSession: null,
  activeAssetId: null,
  isLoading: false,
  isSubmitting: false,
  error: null,
  lineForm: null, // null | { mode: 'add'|'edit', lineId?, fields: {...} }

  fetchSession: async (sessionId) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await getSession(sessionId);
      const session = data.data;
      set({
        currentSession: session,
        isLoading: false,
        activeAssetId: session?.weighing_event?.assets?.[0]?.id ?? null,
      });
      return session;
    } catch (err) {
      set({ error: err.response?.data?.error || 'Failed to load session', isLoading: false });
      return null;
    }
  },

  setSession: (session) => set({ currentSession: session }),

  setActiveAssetId: (id) => set({ activeAssetId: id, lineForm: null }),

  setLineForm: (form) => set({ lineForm: form }),

  clearLineForm: () => set({ lineForm: null }),

  setSubmitting: (val) => set({ isSubmitting: val }),

  addLineToStore: (line) =>
    set((state) => ({
      currentSession: state.currentSession
        ? {
            ...state.currentSession,
            sorting_lines: [...(state.currentSession.sorting_lines || []), line],
          }
        : null,
    })),

  updateLineInStore: (lineId, updated) =>
    set((state) => ({
      currentSession: state.currentSession
        ? {
            ...state.currentSession,
            sorting_lines: (state.currentSession.sorting_lines || []).map((l) =>
              l.id === lineId ? { ...l, ...updated } : l
            ),
          }
        : null,
    })),

  removeLineFromStore: (lineId) =>
    set((state) => ({
      currentSession: state.currentSession
        ? {
            ...state.currentSession,
            sorting_lines: (state.currentSession.sorting_lines || []).filter((l) => l.id !== lineId),
          }
        : null,
    })),

  clearSession: () =>
    set({
      currentSession: null,
      activeAssetId: null,
      isLoading: false,
      isSubmitting: false,
      error: null,
      lineForm: null,
    }),
}));

export default useSortingStore;
