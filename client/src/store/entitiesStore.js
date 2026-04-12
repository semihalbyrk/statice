import { create } from 'zustand';
import { getEntities } from '../api/entities';

const useEntitiesStore = create((set, get) => ({
  entities: [],
  totalCount: 0,
  filters: { role: '', status: '', search: '', page: 1, limit: 20 },
  loading: false,
  error: null,

  setFilters: (filters) => {
    set((state) => ({ filters: { ...state.filters, ...filters, page: filters.page || 1 } }));
  },

  clearFilters: () => {
    set({ filters: { role: '', status: '', search: '', page: 1, limit: 20 } });
  },

  fetchEntities: async () => {
    set({ loading: true, error: null });
    try {
      const { filters } = get();
      const params = {};
      if (filters.role) params.role = filters.role;
      if (filters.status) params.status = filters.status;
      if (filters.search) params.search = filters.search;
      params.page = filters.page;
      params.limit = filters.limit;

      const { data } = await getEntities(params);
      set({ entities: data.data, totalCount: data.total, loading: false });
    } catch (err) {
      set({ error: err.response?.data?.error || 'Failed to fetch entities', loading: false });
    }
  },
}));

export default useEntitiesStore;
