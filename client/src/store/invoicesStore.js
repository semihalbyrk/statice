import { create } from 'zustand';
import { listInvoices } from '../api/invoices';

const useInvoicesStore = create((set, get) => ({
  invoices: [],
  total: 0,
  loading: false,
  error: null,
  filters: {
    status: '',
    search: '',
    page: 1,
    limit: 20,
    date_from: '',
    date_to: '',
  },

  setFilters: (filters) => {
    set((state) => ({ filters: { ...state.filters, ...filters, page: filters.page || 1 } }));
  },

  clearFilters: () => {
    set({ filters: { status: '', search: '', page: 1, limit: 20, date_from: '', date_to: '' } });
  },

  fetchInvoices: async () => {
    set({ loading: true, error: null });
    try {
      const { filters } = get();
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.search) params.search = filters.search;
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;
      params.page = filters.page;
      params.limit = filters.limit;

      const { data } = await listInvoices(params);
      set({ invoices: data.data, total: data.total, loading: false });
    } catch (err) {
      set({ error: err.response?.data?.error || 'Failed to fetch invoices', loading: false });
    }
  },
}));

export default useInvoicesStore;
