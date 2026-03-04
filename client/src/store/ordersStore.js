import { create } from 'zustand';
import * as ordersApi from '../api/orders';

const useOrdersStore = create((set, get) => ({
  orders: [],
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

  fetchOrders: async () => {
    set({ loading: true, error: null });
    try {
      const { filters } = get();
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.search) params.search = filters.search;
      params.page = filters.page;
      params.limit = filters.limit;

      const { data } = await ordersApi.getOrders(params);
      set({ orders: data.data, totalCount: data.total, loading: false });
    } catch (err) {
      set({ error: err.response?.data?.error || 'Failed to fetch orders', loading: false });
    }
  },

  fetchOrder: async (id) => {
    set({ loading: true, error: null });
    try {
      const { data } = await ordersApi.getOrder(id);
      set({ currentOrder: data, loading: false });
    } catch (err) {
      set({ error: err.response?.data?.error || 'Failed to fetch order', loading: false });
    }
  },

  createOrder: async (orderData) => {
    const { data } = await ordersApi.createOrder(orderData);
    return data;
  },

  updateOrder: async (id, orderData) => {
    const { data } = await ordersApi.updateOrder(id, orderData);
    return data;
  },

  cancelOrder: async (id) => {
    const { data } = await ordersApi.cancelOrder(id);
    return data;
  },
}));

export default useOrdersStore;
