import { create } from 'zustand';
import * as outboundOrdersApi from '../api/outboundOrders';

const useOutboundOrdersStore = create((set, get) => ({
  outboundOrders: [],
  totalCount: 0,
  currentOrder: null,
  filters: { status: '', search: '', page: 1, limit: 20 },
  loading: false,
  error: null,

  setFilters: (filters) => {
    set((state) => ({ filters: { ...state.filters, ...filters, page: filters.page || 1 } }));
  },

  clearFilters: () => {
    set({ filters: { status: '', search: '', page: 1, limit: 20 } });
  },

  fetchOutboundOrders: async () => {
    set({ loading: true, error: null });
    try {
      const { filters } = get();
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.search) params.search = filters.search;
      params.page = filters.page;
      params.limit = filters.limit;

      const { data } = await outboundOrdersApi.listOutboundOrders(params);
      set({ outboundOrders: data.data, totalCount: data.total, loading: false });
    } catch (err) {
      set({ error: err.response?.data?.error || 'Failed to fetch outbound orders', loading: false });
    }
  },

  fetchOutboundOrder: async (id) => {
    set({ loading: true, error: null });
    try {
      const { data } = await outboundOrdersApi.getOutboundOrder(id);
      set({ currentOrder: data.data || data, loading: false });
    } catch (err) {
      set({ error: err.response?.data?.error || 'Failed to fetch outbound order', loading: false });
    }
  },
}));

export default useOutboundOrdersStore;
