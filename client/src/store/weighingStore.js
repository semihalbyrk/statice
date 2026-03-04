import { create } from 'zustand';
import { getWeighingEvent } from '../api/weighingEvents';

const useWeighingStore = create((set) => ({
  currentEvent: null,
  isLoading: false,
  isTriggering: false,
  error: null,

  fetchEvent: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await getWeighingEvent(id);
      set({ currentEvent: data.data, isLoading: false });
      return data.data;
    } catch (err) {
      set({ error: err.response?.data?.error || 'Failed to load event', isLoading: false });
      return null;
    }
  },

  setEvent: (event) => set({ currentEvent: event }),

  setTriggering: (val) => set({ isTriggering: val }),

  addAsset: (asset) =>
    set((state) => ({
      currentEvent: state.currentEvent
        ? { ...state.currentEvent, assets: [...(state.currentEvent.assets || []), asset] }
        : null,
    })),

  removeAsset: (assetId) =>
    set((state) => ({
      currentEvent: state.currentEvent
        ? { ...state.currentEvent, assets: (state.currentEvent.assets || []).filter((a) => a.id !== assetId) }
        : null,
    })),

  updateAsset: (assetId, updated) =>
    set((state) => ({
      currentEvent: state.currentEvent
        ? {
            ...state.currentEvent,
            assets: (state.currentEvent.assets || []).map((a) => (a.id === assetId ? { ...a, ...updated } : a)),
          }
        : null,
    })),

  clearEvent: () => set({ currentEvent: null, isLoading: false, isTriggering: false, error: null }),
}));

export default useWeighingStore;
