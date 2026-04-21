import { create } from 'zustand';
import { listOutbounds } from '../api/outbounds';

const useOutboundsStore = create((set, get) => ({
  outbounds: [],
  totalCount: 0,
  filters: { status: '', outbound_order_id: '', search: '', page: 1, limit: 20 },
  loading: false,
  error: null,

  setFilters: (filters) => {
    set((state) => ({ filters: { ...state.filters, ...filters, page: filters.page || 1 } }));
  },

  clearFilters: () => {
    set({ filters: { status: '', outbound_order_id: '', search: '', page: 1, limit: 20 } });
  },

  fetchOutbounds: async () => {
    set({ loading: true, error: null });
    try {
      const { filters } = get();
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.outbound_order_id) params.outbound_order_id = filters.outbound_order_id;
      if (filters.search) params.search = filters.search;
      params.page = filters.page;
      params.limit = filters.limit;

      const { data } = await listOutbounds(params);
      set({ outbounds: data.data, totalCount: data.total, loading: false });
    } catch (err) {
      set({ error: err.response?.data?.error || 'Failed to fetch outbounds', loading: false });
    }
  },
}));

export { useOutboundsStore };
export default useOutboundsStore;
