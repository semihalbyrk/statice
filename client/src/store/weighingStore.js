import { create } from 'zustand';
import { getInbounds } from '../api/weighingEvents';

const useInboundsListStore = create((set, get) => ({
  inbounds: [],
  totalCount: 0,
  filters: { status: '', search: '', page: 1, limit: 20 },
  loading: false,
  error: null,

  setFilters: (filters) => {
    set((state) => ({ filters: { ...state.filters, ...filters, page: filters.page || 1 } }));
  },

  clearFilters: () => {
    set({ filters: { status: '', search: '', page: 1, limit: 20 } });
  },

  fetchInbounds: async () => {
    set({ loading: true, error: null });
    try {
      const { filters } = get();
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.search) params.search = filters.search;
      params.page = filters.page;
      params.limit = filters.limit;

      const { data } = await getInbounds(params);
      set({ inbounds: data.data, totalCount: data.total, loading: false });
    } catch (err) {
      set({ error: err.response?.data?.error || 'Failed to fetch inbounds', loading: false });
    }
  },
}));

export { useInboundsListStore };
export default useInboundsListStore;
